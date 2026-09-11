import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleAuthUser {
  email?: string | null;
  displayName?: string | null;
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const translateAuthError = (err: any): Error => {
  const code = err?.code || '';
  const msg = err?.message || String(err);

  if (code === 'auth/popup-blocked' || msg.includes('popup_blocked') || msg.includes('popup blocked')) {
    return new Error('브라우저에서 팝업이 차단되었습니다. 주소창 우측의 팝업 차단을 해제하거나 앱을 새 창/새 탭에서 열어주세요.');
  }
  if (code === 'auth/popup-closed-by-user' || msg.includes('user_cancel') || msg.includes('access_denied')) {
    return new Error('Google 로그인 창이 닫혔거나 승인이 취소되었습니다. 다시 시도해주세요.');
  }
  if (code === 'auth/unauthorized-domain') {
    return new Error('개발용 도메인 보안 인증이 필요합니다. 우측 상단 "새 탭에서 열기"를 눌러 접속하시면 정상 작동합니다.');
  }
  if (code === 'auth/cancelled-popup-request') {
    return new Error('이전 로그인 요청이 아직 처리 중입니다. 잠시 후 다시 시도해주세요.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인해주세요.');
  }
  return new Error(msg || 'Google 계정 로그인 중 오류가 발생했습니다.');
};

/**
 * Google Identity Services (GSI)를 통한 OAuth 토큰 발급
 */
export const gsiSignIn = (): Promise<{ user: GoogleAuthUser; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    const clientId = (firebaseConfig as any).oAuthClientId || (firebaseConfig as any).appId;
    if (!clientId) {
      reject(new Error('OAuth 클라이언트 ID가 설정되지 않았습니다.'));
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        callback: async (resp: any) => {
          if (resp.error) {
            if (resp.error === 'access_denied') {
              reject(new Error('Google 계정 접근 권한 승인이 취소되었습니다.'));
            } else {
              reject(new Error(resp.error_description || resp.error));
            }
            return;
          }
          if (!resp.access_token) {
            reject(new Error('Google 액세스 토큰을 가져오지 못했습니다.'));
            return;
          }
          cachedAccessToken = resp.access_token;
          let email: string | null = null;
          let displayName: string | null = null;

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` }
            });
            if (userRes.ok) {
              const profile = await userRes.json();
              email = profile.email || null;
              displayName = profile.name || null;
            }
          } catch (e) {
            console.warn('Failed to fetch userinfo:', e);
          }

          resolve({
            user: { email, displayName },
            accessToken: resp.access_token
          });
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google 로그인 중 오류가 발생했습니다.'));
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e: any) {
      reject(translateAuthError(e));
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: GoogleAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess({ email: user.email, displayName: user.displayName }, cachedAccessToken);
    } else if (!isSigningIn) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Google 로그인: Firebase signInWithPopup 우선 시도 후 실패 시 GSI 자동 폴백
 */
export const googleSignIn = async (): Promise<{ user: GoogleAuthUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google 액세스 토큰을 가져오지 못했습니다.');
    }
    cachedAccessToken = credential.accessToken;
    return {
      user: {
        email: result.user.email,
        displayName: result.user.displayName
      },
      accessToken: cachedAccessToken
    };
  } catch (firebaseErr: any) {
    console.warn('Firebase signInWithPopup failed, falling back to GSI...', firebaseErr);
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2 && (firebaseConfig as any).oAuthClientId) {
      try {
        return await gsiSignIn();
      } catch (gsiErr: any) {
        console.error('GSI fallback error:', gsiErr);
        throw translateAuthError(gsiErr);
      }
    }
    throw translateAuthError(firebaseErr);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
};
