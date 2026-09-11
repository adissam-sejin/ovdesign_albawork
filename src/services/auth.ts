import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export interface GoogleAuthUser {
  email?: string | null;
  displayName?: string | null;
}

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const isRunningInIframe = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
};

export const translateAuthError = (err: any): Error => {
  const code = err?.code || '';
  const msg = err?.message || String(err);

  if (code === 'auth/popup-blocked' || msg.includes('popup_blocked') || msg.includes('popup blocked')) {
    return new Error('브라우저에서 팝업이 차단되었습니다. 주소창 우측의 팝업 허용을 설정하시거나 상단의 [새 탭에서 열기]를 눌러 진행해주세요.');
  }
  if (code === 'auth/popup-closed-by-user' || msg.includes('user_cancel') || msg.includes('access_denied')) {
    return new Error('Google 로그인 창이 닫혔거나 승인이 취소되었습니다. 다시 시도해주세요.');
  }
  if (code === 'auth/unauthorized-domain') {
    return new Error('도메인 인증을 위해 상단 우측 [새 탭에서 열기] 버튼을 눌러 새 창에서 실행해주세요.');
  }
  if (code === 'auth/cancelled-popup-request') {
    return new Error('이전 로그인 요청이 아직 처리 중입니다. 잠시 후 다시 시도해주세요.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인해주세요.');
  }
  return new Error(msg || 'Google 계정 로그인 중 오류가 발생했습니다.');
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
 * Google 로그인: Firebase SDK signInWithPopup을 통해 OAuth 토큰 획득
 */
export const googleSignIn = async (): Promise<{ user: GoogleAuthUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google 액세스 토큰을 가져오지 못했습니다. 권한 승인을 확인해주세요.');
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
    console.error('Firebase signInWithPopup failed:', firebaseErr);
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

