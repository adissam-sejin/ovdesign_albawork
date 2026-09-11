import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Clock, Calendar, Plus, Trash2, CheckCircle2, 
  ChevronLeft, ChevronRight, User, Shield, 
  RefreshCw, ExternalLink, Eye, EyeOff,
  LogOut, Settings, Users, FileSpreadsheet, AlertTriangle, KeyRound,
  Copy, Check, Code2, Globe, Download, Link as LinkIcon, Share2
} from 'lucide-react';
import { Employee, WorkLog, Settlement, UserSession } from './types';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken,
  isRunningInIframe,
  GoogleAuthUser 
} from './services/auth';
import { 
  createSpreadsheet, 
  fetchAllSheetData, 
  appendWorkLogToSheet, 
  deleteWorkLogFromSheet, 
  saveSettlementToSheet, 
  addEmployeeToSheet, 
  toggleEmployeeActiveInSheet,
  extractSpreadsheetId,
  ensureSheetsInitialized,
  fetchGasData,
  saveGasData,
  GAS_SAMPLE_CODE,
  fetchPublicSheetData,
  formatAsTsv,
  downloadCsv
} from './services/sheetsService';

const DEFAULT_HOURLY_RATE = 12000;
const SPREADSHEET_STORAGE_KEY = 'alba_connected_spreadsheet_id';
const GAS_URL_STORAGE_KEY = 'alba_connected_gas_url';
const EMPLOYEES_STORAGE_KEY = 'alba_employees_list';
const USER_SESSION_STORAGE_KEY = 'alba_user_session';
const GOOGLE_EMAIL_KEY = 'alba_connected_google_email';

// 고정 관리자 계정 정보
const FIXED_ADMIN_ID = 'admin';
const FIXED_ADMIN_PW = 'adi2026';

export default function App() {
  // 1. Google 계정 및 구글 시트 연동 상태 (관리자 설정에서 관리)
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(() => {
    const savedEmail = localStorage.getItem(GOOGLE_EMAIL_KEY);
    if (savedEmail) {
      return { email: savedEmail, displayName: 'Google 관리자' };
    }
    return null;
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(SPREADSHEET_STORAGE_KEY);
  });
  const [gasUrl, setGasUrl] = useState<string | null>(() => {
    return localStorage.getItem(GAS_URL_STORAGE_KEY);
  });
  const [showGasModal, setShowGasModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // 2. 직원 목록 상태 (관리자가 추가/관리)
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        employeeId: 'staff01',
        name: '김알바',
        password: '1234',
        hourlyRate: DEFAULT_HOURLY_RATE,
        active: true,
        createdAt: '2026-09-07 09:00:00'
      }
    ];
  });

  // 직원 목록 로컬 캐시 동기화
  useEffect(() => {
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
  }, [employees]);

  // 근무 기록 데이터
  const [workLogs, setWorkLogs] = useState<WorkLog[]>(() => {
    const saved = localStorage.getItem('alba_work_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: 'WL_1001',
        employeeId: 'staff01',
        employeeName: '김알바',
        workDate: '2026-09-07',
        startTime: '10:00',
        endTime: '12:30',
        minutesWorked: 150,
        workDescription: '강의자료 PPT 수정',
        createdAt: '2026-09-07 12:31:00'
      },
      {
        id: 'WL_1002',
        employeeId: 'staff01',
        employeeName: '김알바',
        workDate: '2026-09-09',
        startTime: '09:00',
        endTime: '11:00',
        minutesWorked: 120,
        workDescription: '블로그 자료 정리',
        createdAt: '2026-09-09 11:01:00'
      },
      {
        id: 'WL_1003',
        employeeId: 'staff01',
        employeeName: '김알바',
        workDate: '2026-09-09',
        startTime: '14:00',
        endTime: '17:00',
        minutesWorked: 180,
        workDescription: '카드뉴스 제작',
        createdAt: '2026-09-09 17:01:00'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('alba_work_logs', JSON.stringify(workLogs));
  }, [workLogs]);

  // 정산 데이터
  const [settlements, setSettlements] = useState<Settlement[]>(() => {
    const saved = localStorage.getItem('alba_settlements');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('alba_settlements', JSON.stringify(settlements));
  }, [settlements]);

  // 3. 앱 로그인 세션 (초기값 null 또는 기존 세션)
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });

  // 4. 모바일 뷰 탭
  const [currentTab, setCurrentTab] = useState<'staffHome' | 'staffAdd' | 'staffHistory' | 'adminHome' | 'adminEmployees' | 'adminSettings'>('staffHome');

  // 5. 날짜 기준 (현재 주간 계산)
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date('2026-09-09T00:00:00'));

  // 6. 로그인 폼 상태 (아이디/비밀번호 노출 금지 - 빈칸 시작)
  const [loginRole, setLoginRole] = useState<'staff' | 'admin'>('staff');
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // 7. 근무 입력 폼 상태
  const [inputDate, setInputDate] = useState('2026-09-09');
  const [inputStart, setInputStart] = useState('10:00');
  const [inputEnd, setInputEnd] = useState('12:30');
  const [inputDesc, setInputDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 8. 관리자 정산 모달
  const [selectedStaffForAdmin, setSelectedStaffForAdmin] = useState<string | null>(null);
  const [adminActualPayInput, setAdminActualPayInput] = useState('');

  // 9. 관리자 직원 추가 모달
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpPw, setNewEmpPw] = useState('');
  const [newEmpRate, setNewEmpRate] = useState('12000');

  // 10. 관리자 직원 비밀번호 확인 토글 상태 (직원별)
  const [visiblePwMap, setVisiblePwMap] = useState<Record<string, boolean>>({});

  // 11. 삭제 확인 모달
  const [logToDelete, setLogToDelete] = useState<WorkLog | null>(null);

  // 12. 시트 ID 수동 연결 입력
  const [manualSheetId, setManualSheetId] = useState('');

  // 토스트
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Google Sheets / Apps Script / 공개 링크 최신 데이터 동기화
  const syncWithGoogleSheets = useCallback(async (token?: string, sId?: string) => {
    // 1. Google Apps Script 연동이 활성화된 경우
    if (gasUrl) {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const data = await fetchGasData(gasUrl);
        if (data.employees.length > 0) {
          setEmployees(data.employees);
          localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(data.employees));
        }
        if (data.workLogs.length > 0) {
          setWorkLogs(data.workLogs);
        }
        setSettlements(data.settlements);
        showToast('Google Apps Script와 최신 데이터가 동기화되었습니다.');
      } catch (err: any) {
        console.error('GAS Sync Error:', err);
        setSyncError(err.message || 'Google Apps Script 동기화에 실패했습니다.');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const activeSheetId = sId || spreadsheetId;
    if (!activeSheetId) return;

    // 2. Google OAuth 인증 토큰이 있는 경우 (Google Sheets API v4)
    const activeToken = token || (await getAccessToken());
    setIsSyncing(true);
    setSyncError(null);

    if (activeToken) {
      try {
        let data;
        try {
          data = await fetchAllSheetData(activeToken, activeSheetId);
        } catch (firstErr: any) {
          // 시트 탭이 아직 구성되지 않은 경우 자동 초기화 후 재시도
          console.warn('Initial fetch failed, ensuring sheet tabs exist...', firstErr);
          await ensureSheetsInitialized(activeToken, activeSheetId);
          data = await fetchAllSheetData(activeToken, activeSheetId);
        }

        if (data.employees.length > 0) {
          setEmployees(data.employees);
          localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(data.employees));
        }
        if (data.workLogs.length > 0) {
          setWorkLogs(data.workLogs);
        }
        setSettlements(data.settlements);
        showToast('Google Sheets와 최신 데이터가 동기화되었습니다.');
      } catch (err: any) {
        console.error('Sheets Sync Error:', err);
        setSyncError(err.message || '시트 동기화 실패');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    // 3. 토큰이 없는 경우 (링크 연동): Google Visualization API(gviz)로 로그인 없이 즉시 읽기!
    try {
      const data = await fetchPublicSheetData(activeSheetId);
      if (data.employees.length > 0) {
        setEmployees(data.employees);
        localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(data.employees));
      }
      if (data.workLogs.length > 0) {
        setWorkLogs(data.workLogs);
      }
      if (data.settlements.length > 0) {
        setSettlements(data.settlements);
      }
      showToast('구글 시트 링크로부터 최신 데이터를 동기화했습니다.');
    } catch (err: any) {
      console.warn('Public sheets sync error:', err);
      setSyncError(
        '시트 데이터를 읽어오지 못했습니다. 구글 시트의 [공유] 설정에서 [링크가 있는 모든 사용자(뷰어 또는 편집자)]로 설정되어 있는지 확인해주세요.'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [spreadsheetId, gasUrl]);

  // Auth 초기화 및 리스너 등록
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (spreadsheetId) {
          syncWithGoogleSheets(token, spreadsheetId);
        }
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, [spreadsheetId, syncWithGoogleSheets]);

  // Google 계정 연동 및 자동 스프레드시트 생성
  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    setSyncError(null);
    try {
      const res = await googleSignIn();
      if (!res) return;
      setGoogleUser(res.user);
      if (res.user.email) {
        localStorage.setItem(GOOGLE_EMAIL_KEY, res.user.email);
      }

      let targetId = spreadsheetId;
      if (!targetId) {
        showToast('Google Drive에 "알바 주간정산" 스프레드시트를 생성 중입니다...');
        targetId = await createSpreadsheet(res.accessToken);
        setSpreadsheetId(targetId);
        localStorage.setItem(SPREADSHEET_STORAGE_KEY, targetId);
        showToast('새 구글 시트가 생성되어 연동되었습니다!');
      }

      await syncWithGoogleSheets(res.accessToken, targetId);
    } catch (err: any) {
      console.error('handleGoogleConnect error:', err);
      const errMsg = err.message || 'Google 연동 중 오류 발생';
      setSyncError(errMsg);
      showToast(errMsg);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // 새 스프레드시트 추가 생성
  const handleCreateNewSpreadsheet = async () => {
    setIsConnectingGoogle(true);
    setSyncError(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (!res) return;
        token = res.accessToken;
        setGoogleUser(res.user);
        if (res.user.email) {
          localStorage.setItem(GOOGLE_EMAIL_KEY, res.user.email);
        }
      }

      showToast('새 Google 스프레드시트를 생성 중입니다...');
      const targetId = await createSpreadsheet(token);
      setSpreadsheetId(targetId);
      localStorage.setItem(SPREADSHEET_STORAGE_KEY, targetId);
      showToast('새 구글 시트가 생성되어 연동되었습니다!');
      await syncWithGoogleSheets(token, targetId);
    } catch (err: any) {
      console.error('handleCreateNewSpreadsheet error:', err);
      const errMsg = err.message || '스프레드시트 생성에 실패했습니다.';
      setSyncError(errMsg);
      showToast(errMsg);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleManualSync = async () => {
    if (gasUrl) {
      await syncWithGoogleSheets();
      return;
    }
    const token = await getAccessToken();
    await syncWithGoogleSheets(token);
  };

  // 기존 구글 시트 URL 또는 ID, 또는 Google Apps Script 웹 앱 URL 연결
  const handleConnectManualSheet = async () => {
    const input = manualSheetId.trim();
    if (!input) {
      showToast('구글 시트 URL 또는 스프레드시트 ID를 입력해주세요.');
      return;
    }

    // 1. Google Apps Script Web App URL 감지
    if (input.includes('script.google.com')) {
      setIsConnectingGoogle(true);
      setSyncError(null);
      showToast('Google Apps Script 웹 앱 연결 확인 중...');
      try {
        const data = await fetchGasData(input);
        setGasUrl(input);
        localStorage.setItem(GAS_URL_STORAGE_KEY, input);
        setManualSheetId('');
        if (data.employees.length > 0) setEmployees(data.employees);
        if (data.workLogs.length > 0) setWorkLogs(data.workLogs);
        setSettlements(data.settlements);
        showToast('Google Apps Script가 성공적으로 연결되었습니다!');
      } catch (err: any) {
        console.error('GAS connection error:', err);
        const errMsg = 'Apps Script 연결 실패: ' + (err.message || '웹 앱 배포 상태를 확인해주세요.');
        setSyncError(errMsg);
        showToast(errMsg);
      } finally {
        setIsConnectingGoogle(false);
      }
      return;
    }

    // 2. 일반 Google 스프레드시트 ID 또는 URL
    const cleanId = extractSpreadsheetId(input);
    if (!cleanId) {
      showToast('유효한 스프레드시트 ID 또는 URL을 확인할 수 없습니다.');
      return;
    }

    setIsConnectingGoogle(true);
    setSyncError(null);
    showToast('구글 시트 링크 확인 및 연결 중...');

    try {
      setSpreadsheetId(cleanId);
      localStorage.setItem(SPREADSHEET_STORAGE_KEY, cleanId);
      setManualSheetId('');

      // A. 이미 인증된 Google OAuth 토큰이 있는 경우
      const token = await getAccessToken();
      if (token) {
        try {
          await ensureSheetsInitialized(token, cleanId);
          await syncWithGoogleSheets(token, cleanId);
          showToast('Google 계정으로 시트가 연동되었습니다!');
          return;
        } catch (authErr) {
          console.warn('OAuth init fallback to public read:', authErr);
        }
      }

      // B. 토큰이 없는 경우: 팝업을 강제하지 않고, gviz를 통해 링크로 바로 데이터 읽어오기 시도!
      try {
        const publicData = await fetchPublicSheetData(cleanId);
        if (publicData.employees.length > 0) {
          setEmployees(publicData.employees);
          localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(publicData.employees));
        }
        if (publicData.workLogs.length > 0) {
          setWorkLogs(publicData.workLogs);
        }
        if (publicData.settlements.length > 0) {
          setSettlements(publicData.settlements);
        }
        showToast('구글 시트 링크가 성공적으로 연결되었습니다! (데이터 동기화 완료)');
      } catch (publicErr: any) {
        console.warn('Public read note:', publicErr);
        // 시트가 비공개 설정인 경우 친절한 안내 제공
        setSyncError(
          `구글 시트 ID(${cleanId})가 연결되었습니다!\n` +
          `현재 시트가 [비공개]로 설정되어 있어 데이터를 바로 읽으려면: 구글 시트 우측 상단 [공유] > 일반 액세스를 [링크가 있는 모든 사용자 - 뷰어 또는 편집자]로 변경해주세요.`
        );
        showToast('시트 링크가 등록되었습니다. [공유] 설정을 확인해주세요.');
      }
    } catch (err: any) {
      console.error('handleConnectManualSheet error:', err);
      const errMsg = err.message || '스프레드시트 연결에 실패했습니다.';
      setSyncError(errMsg);
      showToast(errMsg);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectSpreadsheet = () => {
    setSpreadsheetId(null);
    localStorage.removeItem(SPREADSHEET_STORAGE_KEY);
    showToast('구글 시트 연결이 해제되었습니다.');
  };

  const handleCopyWorkLogsTsv = () => {
    const headers = ['id', '직원ID', '직원명', '근무일', '시작시간', '종료시간', '근무분', '업무내용', '등록일시'];
    const rows = workLogs.map(l => [
      l.id, l.employeeId, l.employeeName, l.workDate, l.startTime, l.endTime, l.minutesWorked, l.workDescription, l.createdAt
    ]);
    const tsv = formatAsTsv(headers, rows);
    navigator.clipboard.writeText(tsv);
    showToast('근무기록이 클립보드에 복사되었습니다! 구글 시트 A1 셀에 붙여넣기(Ctrl+V)하세요.');
  };

  const handleCopySettlementsTsv = () => {
    const headers = ['정산ID', '직원ID', '주간시작', '주간종료', '총근무분', '예상급여', '실제입금액', '상태', '정산일시'];
    const rows = settlements.map(s => [
      s.settlementId, s.employeeId, s.weekStart, s.weekEnd, s.totalMinutes, s.expectedPay, s.actualPay, s.status, s.settledAt
    ]);
    const tsv = formatAsTsv(headers, rows);
    navigator.clipboard.writeText(tsv);
    showToast('정산내역이 클립보드에 복사되었습니다! 구글 시트 A1 셀에 붙여넣기(Ctrl+V)하세요.');
  };

  const handleDownloadWorkLogsCsv = () => {
    const headers = ['id', '직원ID', '직원명', '근무일', '시작시간', '종료시간', '근무분', '업무내용', '등록일시'];
    const rows = workLogs.map(l => [
      l.id, l.employeeId, l.employeeName, l.workDate, l.startTime, l.endTime, l.minutesWorked, l.workDescription, l.createdAt
    ]);
    downloadCsv(`근무기록_${new Date().toISOString().substring(0, 10)}.csv`, headers, rows);
    showToast('근무기록 CSV 파일이 다운로드되었습니다.');
  };

  const handleDownloadSettlementsCsv = () => {
    const headers = ['정산ID', '직원ID', '주간시작', '주간종료', '총근무분', '예상급여', '실제입금액', '상태', '정산일시'];
    const rows = settlements.map(s => [
      s.settlementId, s.employeeId, s.weekStart, s.weekEnd, s.totalMinutes, s.expectedPay, s.actualPay, s.status, s.settledAt
    ]);
    downloadCsv(`주간정산_${new Date().toISOString().substring(0, 10)}.csv`, headers, rows);
    showToast('주간정산 CSV 파일이 다운로드되었습니다.');
  };

  const handleGasDisconnect = () => {
    setGasUrl(null);
    localStorage.removeItem(GAS_URL_STORAGE_KEY);
    showToast('Google Apps Script 연동이 해제되었습니다.');
  };

  const handleGoogleDisconnect = async () => {
    await googleSignOut();
    setGoogleUser(null);
    localStorage.removeItem(GOOGLE_EMAIL_KEY);
    showToast('Google 계정 연동이 해제되었습니다.');
  };

  // 주간 날짜 범위 계산
  const weekRange = useMemo(() => {
    const d = new Date(currentWeekDate);
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

    const formatYmd = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    };

    return {
      weekStart: formatYmd(mon),
      weekEnd: formatYmd(sun),
      displayLabel: `${mon.getMonth() + 1}월 ${mon.getDate()}일 ~ ${sun.getMonth() + 1}월 ${sun.getDate()}일`
    };
  }, [currentWeekDate]);

  const changeWeek = (delta: number) => {
    setCurrentWeekDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };

  const calcMinutes = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return (eH * 60 + eM) - (sH * 60 + sM);
  };

  const formatHoursAndMinutes = (minutes: number) => {
    const m = Math.max(0, minutes || 0);
    const hours = Math.floor(m / 60);
    const rem = m % 60;
    if (hours === 0 && rem === 0) return '0시간 0분';
    if (rem === 0) return `${hours}시간`;
    if (hours === 0) return `${rem}분`;
    return `${hours}시간 ${rem}분`;
  };

  const formatWon = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '-';
    return amount.toLocaleString('ko-KR') + '원';
  };

  // 현재 로그인 알바생 요약
  const staffSummary = useMemo(() => {
    if (!currentUser || currentUser.role !== 'staff') return null;

    const filteredLogs = workLogs.filter(l => 
      l.employeeId === currentUser.id &&
      l.workDate >= weekRange.weekStart &&
      l.workDate <= weekRange.weekEnd
    );

    const totalMinutes = filteredLogs.reduce((acc, cur) => acc + cur.minutesWorked, 0);
    const emp = employees.find(e => e.employeeId === currentUser.id);
    const hourlyRate = emp ? emp.hourlyRate : DEFAULT_HOURLY_RATE;
    const expectedPay = Math.round((totalMinutes / 60) * hourlyRate);

    const settlement = settlements.find(s => 
      s.employeeId === currentUser.id && s.weekStart === weekRange.weekStart
    );

    return {
      totalMinutes,
      expectedPay,
      logs: filteredLogs,
      settlement: settlement || { status: 'pending', actualPay: null }
    };
  }, [currentUser, workLogs, employees, settlements, weekRange]);

  // 관리자용 전체 직원 요약
  const adminStaffSummaries = useMemo(() => {
    return employees.map(emp => {
      const logs = workLogs.filter(l => 
        l.employeeId === emp.employeeId &&
        l.workDate >= weekRange.weekStart &&
        l.workDate <= weekRange.weekEnd
      );
      const totalMinutes = logs.reduce((acc, cur) => acc + cur.minutesWorked, 0);
      const expectedPay = Math.round((totalMinutes / 60) * emp.hourlyRate);
      const settlement = settlements.find(s => 
        s.employeeId === emp.employeeId && s.weekStart === weekRange.weekStart
      );

      return {
        emp,
        logs,
        totalMinutes,
        expectedPay,
        settlement: settlement || { status: 'pending', actualPay: null }
      };
    });
  }, [employees, workLogs, settlements, weekRange]);

  // 로그인 처리
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = loginId.trim();
    const pw = loginPw.trim();

    if (!id || !pw) {
      showToast('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (loginRole === 'admin') {
      // 고정 관리자 계정 검증
      if (id === FIXED_ADMIN_ID && pw === FIXED_ADMIN_PW) {
        const adminSession: UserSession = { role: 'admin', id: 'admin', name: '관리자', hourlyRate: 0 };
        setCurrentUser(adminSession);
        localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(adminSession));
        setCurrentTab('adminHome');
        setLoginId('');
        setLoginPw('');
        showToast('관리자로 로그인되었습니다.');
        return;
      } else {
        showToast('관리자 아이디 또는 비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    // 알바생 로그인 검증 (관리자가 등록한 직원 목록에서 확인)
    const emp = employees.find(e => e.employeeId === id);
    if (!emp) {
      showToast('등록되지 않은 알바생 아이디입니다. 관리자에게 등록을 요청하세요.');
      return;
    }

    if (emp.password !== pw) {
      showToast('비밀번호가 올바르지 않습니다.');
      return;
    }

    if (!emp.active) {
      showToast('현재 비활성화된 계정입니다. 관리자에게 문의하세요.');
      return;
    }

    const staffSession: UserSession = {
      role: 'staff',
      id: emp.employeeId,
      name: emp.name,
      hourlyRate: emp.hourlyRate
    };
    setCurrentUser(staffSession);
    localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(staffSession));
    setCurrentTab('staffHome');
    setLoginId('');
    setLoginPw('');
    showToast(`${emp.name}님 로그인되었습니다.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(USER_SESSION_STORAGE_KEY);
    setLoginId('');
    setLoginPw('');
    showToast('로그아웃되었습니다.');
  };

  // 알바생 근무 기록 저장 (Google Sheets WorkLogs 시트에 직접 기록)
  const handleSaveWorkLog = async () => {
    if (!currentUser) return;
    if (!inputDate) { showToast('근무 날짜를 선택해 주세요.'); return; }
    if (!inputStart || !inputEnd) { showToast('근무 시간을 입력해 주세요.'); return; }
    const minutes = calcMinutes(inputStart, inputEnd);
    if (minutes <= 0) { showToast('종료 시간을 시작 시간보다 늦게 설정해 주세요.'); return; }
    if (!inputDesc.trim()) { showToast('한 일(업무 내용)을 입력해 주세요.'); return; }

    if (staffSummary?.settlement.status === 'completed' && currentUser.role !== 'admin') {
      showToast('해당 주는 이미 정산 완료되어 근무 기록을 추가할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    const newLog: WorkLog = {
      id: `WL_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      workDate: inputDate,
      startTime: inputStart,
      endTime: inputEnd,
      minutesWorked: minutes,
      workDescription: inputDesc.trim(),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await appendWorkLogToSheet(token, spreadsheetId, newLog);
      }
      setWorkLogs(prev => [newLog, ...prev]);
      setInputDesc('');
      showToast(spreadsheetId ? '구글 시트에 근무 기록이 실시간 저장되었습니다!' : '근무 기록이 저장되었습니다.');
      setCurrentTab('staffHome');
    } catch (err: any) {
      console.error(err);
      showToast('저장 중 오류 발생: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 근무 기록 삭제 확정
  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await deleteWorkLogFromSheet(token, spreadsheetId, logToDelete.id);
      }
      setWorkLogs(prev => prev.filter(l => l.id !== logToDelete.id));
      showToast('근무 기록이 삭제되었습니다.');
      setLogToDelete(null);
    } catch (err: any) {
      console.error(err);
      showToast('삭제 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 정산 완료 (Google Sheets Settlements 시트에 직접 기록)
  const handleCompleteSettlement = async () => {
    if (!selectedStaffForAdmin) return;
    const summary = adminStaffSummaries.find(s => s.emp.employeeId === selectedStaffForAdmin);
    if (!summary) return;

    const actual = Number(adminActualPayInput);
    if (adminActualPayInput === '' || isNaN(actual) || actual < 0) {
      showToast('실제 입금액을 0원 이상의 숫자로 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const settlementData: Settlement = {
      settlementId: `SETTLE_${Date.now()}`,
      employeeId: summary.emp.employeeId,
      weekStart: weekRange.weekStart,
      weekEnd: weekRange.weekEnd,
      totalMinutes: summary.totalMinutes,
      expectedPay: summary.expectedPay,
      actualPay: actual,
      status: 'completed',
      settledAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await saveSettlementToSheet(token, spreadsheetId, settlementData);
      }
      setSettlements(prev => {
        const filtered = prev.filter(s => 
          !(s.employeeId === settlementData.employeeId && s.weekStart === settlementData.weekStart)
        );
        return [settlementData, ...filtered];
      });
      setSelectedStaffForAdmin(null);
      showToast(`정산 완료! (실제 입금액: ${formatWon(actual)}) Google Sheets 반영 완료`);
    } catch (err: any) {
      console.error(err);
      showToast('정산 저장 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 신규 알바생 등록
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEmpName.trim();
    const id = newEmpId.trim();
    const pw = newEmpPw.trim();
    const rate = Number(newEmpRate) || DEFAULT_HOURLY_RATE;

    if (!name || !id || !pw) {
      showToast('이름, 접속 아이디, 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (id === FIXED_ADMIN_ID || employees.some(e => e.employeeId === id)) {
      showToast('이미 사용 중인 아이디입니다. 다른 아이디를 지정해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const newEmp: Employee = {
      employeeId: id,
      name: name,
      password: pw,
      hourlyRate: rate,
      active: true,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await addEmployeeToSheet(token, spreadsheetId, newEmp);
      }
      setEmployees(prev => [...prev, newEmp]);
      setIsAddEmpModalOpen(false);
      setNewEmpName('');
      setNewEmpId('');
      setNewEmpPw('');
      setNewEmpRate('12000');
      showToast(`${name} 알바생이 등록되었습니다. 부여된 아이디(${id})로 로그인할 수 있습니다.`);
    } catch (err: any) {
      console.error(err);
      showToast('직원 추가 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 직원 상태 토글 (재직 / 비활성)
  const handleToggleEmpActive = async (empId: string, nextActive: boolean) => {
    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await toggleEmployeeActiveInSheet(token, spreadsheetId, empId, nextActive);
      }
      setEmployees(prev => prev.map(e => e.employeeId === empId ? { ...e, active: nextActive } : e));
      showToast(nextActive ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.');
    } catch (err: any) {
      showToast('상태 변경 실패: ' + err.message);
    }
  };

  // 직원 삭제
  const handleDeleteEmployee = (empId: string, empName: string) => {
    if (!window.confirm(`${empName} 직원을 삭제하시겠습니까? 등록된 근무 내역은 유지됩니다.`)) return;
    setEmployees(prev => prev.filter(e => e.employeeId !== empId));
    showToast(`${empName} 직원이 목록에서 삭제되었습니다.`);
  };

  const previewMinutes = calcMinutes(inputStart, inputEnd);
  const previewPay = Math.max(0, Math.round((previewMinutes / 60) * (currentUser?.hourlyRate || DEFAULT_HOURLY_RATE)));

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-between antialiased selection:bg-blue-100">
      {/* 실제 웹앱 본체 (최대 480px 컨테이너) */}
      <div className="flex-1 w-full max-w-md mx-auto bg-white shadow-xl flex flex-col relative min-h-screen">
        
        {/* 앱 상단 헤더 */}
        <header className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-neutral-900 tracking-tight flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600 stroke-[2.5]" />
              알바 주간정산
            </h1>
            {currentUser && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                currentUser.role === 'admin'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {currentUser.role === 'admin' ? '관리자' : '알바생'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* 새 탭에서 열기 바로가기 */}
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="text-[11px] text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-md font-medium flex items-center gap-1 transition-colors"
              title="새 창/새 탭에서 열기 (Google 연동 원활)"
            >
              <ExternalLink className="w-3 h-3 text-neutral-500" />
              <span className="hidden sm:inline">새 탭</span>
            </button>

            {currentUser && (
              <>
                {currentUser.role === 'admin' && spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-colors"
                    title="Google 시트 열기"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">시트</span>
                  </a>
                )}
                <span className="text-xs font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <User className="w-3 h-3 text-neutral-500" />
                  {currentUser.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-neutral-500 hover:text-neutral-900 p-1 font-semibold flex items-center gap-0.5 transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* iframe 내 실행 시 안내 배너 */}
        {isRunningInIframe() && (
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-3.5 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
            <span className="truncate font-medium">
              💡 Google 시트 연동 시 팝업 차단 방지: <b>새 탭</b>에서 열기 권장
            </span>
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
            >
              <span>새 탭 열기</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        {/* 메인 뷰 컨텐츠 */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          
          {/* ========================================================= */}
          {/* 1. 로그인 뷰 (계정 정보 일체 노출 금지, 깔끔한 폼)         */}
          {/* ========================================================= */}
          {!currentUser && (
            <div className="pt-6 space-y-6">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-2 border border-blue-100 shadow-2xs">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">로그인</h2>
                <p className="text-xs text-neutral-500">
                  근무 기록 작성 및 주간 급여 정산
                </p>
              </div>

              {/* 역할 선택 탭 */}
              <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('staff');
                    setLoginId('');
                    setLoginPw('');
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all ${
                    loginRole === 'staff' ? 'bg-white text-blue-600 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  알바생 로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('admin');
                    setLoginId('');
                    setLoginPw('');
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all ${
                    loginRole === 'admin' ? 'bg-white text-rose-600 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  관리자 로그인
                </button>
              </div>

              <form onSubmit={handleLogin} className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                    {loginRole === 'admin' ? '관리자 아이디' : '알바생 아이디'}
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={loginRole === 'admin' ? '관리자 아이디 입력' : '관리자에게 부여받은 아이디 입력'}
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600 transition-colors"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">비밀번호</label>
                  <div className="relative">
                    <input
                      type={showLoginPw ? 'text' : 'password'}
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                      placeholder="비밀번호 입력"
                      className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600 transition-colors"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw(!showLoginPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full h-12 rounded-xl font-bold text-sm text-white transition-all shadow-md active:scale-[0.98] ${
                    loginRole === 'admin' 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  {loginRole === 'admin' ? '관리자 로그인' : '알바생 로그인'}
                </button>
              </form>

              <div className="text-center text-xs text-neutral-400">
                {loginRole === 'staff' ? (
                  <p>알바생 계정은 관리자가 직접 등록하여 발급합니다.</p>
                ) : (
                  <p>관리자 전용 로그인 페이지입니다.</p>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. 알바생 - 홈 뷰                                         */}
          {/* ========================================================= */}
          {currentUser?.role === 'staff' && currentTab === 'staffHome' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-neutral-500">알바생 모바일 홈</span>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  안녕하세요, {currentUser.name}님
                </h2>
              </div>

              {/* 주간 이동 바 */}
              <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl p-2 shadow-2xs">
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                </button>
                <span className="text-xs font-bold text-neutral-900">{weekRange.displayLabel}</span>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5 transition-colors"
                >
                  다음 주 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 주간 정산 요약 카드 */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-3 border-l-4 border-l-blue-600">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500">이번 주 정산</span>
                  {staffSummary?.settlement.status === 'completed' ? (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      정산 완료
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      정산 전
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    <span className="text-[11px] font-semibold text-neutral-500 block mb-0.5">총 근무시간</span>
                    <span className="text-lg font-black text-blue-600">
                      {formatHoursAndMinutes(staffSummary?.totalMinutes || 0)}
                    </span>
                  </div>
                  <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    <span className="text-[11px] font-semibold text-neutral-500 block mb-0.5">예상 급여</span>
                    <span className="text-lg font-black text-neutral-900">
                      {formatWon(staffSummary?.expectedPay || 0)}
                    </span>
                  </div>
                </div>

                {/* 실제 입금액 */}
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-neutral-700 block">실제 입금액</span>
                    <span className="text-[10px] text-neutral-400">관리자 확정 지급액</span>
                  </div>
                  <div className="text-xl font-black text-emerald-600">
                    {staffSummary?.settlement.status === 'completed'
                      ? formatWon(staffSummary.settlement.actualPay)
                      : '-'}
                  </div>
                </div>
              </div>

              {/* 근무 기록 버튼 */}
              <button
                onClick={() => setCurrentTab('staffAdd')}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                오늘 근무 기록하기
              </button>

              {/* 이번 주 최근 기록 미리보기 */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-neutral-700">
                    이번 주 근무 ({staffSummary?.logs.length || 0}건)
                  </h3>
                  <button
                    onClick={() => setCurrentTab('staffHistory')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    전체보기 ›
                  </button>
                </div>

                {staffSummary?.logs && staffSummary.logs.length > 0 ? (
                  <div className="space-y-2">
                    {staffSummary.logs.slice(0, 3).map(log => (
                      <div key={log.id} className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-blue-600">{log.workDate}</span>
                          <span className="font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-800">
                            {formatHoursAndMinutes(log.minutesWorked)}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 mb-1">{log.startTime} ~ {log.endTime}</div>
                        <div className="text-xs bg-neutral-50 p-2 rounded-lg text-neutral-800">
                          {log.workDescription}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-white rounded-xl border border-neutral-200 text-neutral-400 text-xs">
                    <Clock className="w-7 h-7 mx-auto mb-1 text-neutral-300 stroke-[1.5]" />
                    <p className="font-bold text-neutral-600">이번 주에 등록된 근무 기록이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. 알바생 - 근무 기록 입력 뷰                             */}
          {/* ========================================================= */}
          {currentUser?.role === 'staff' && currentTab === 'staffAdd' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">근무 기록하기</h2>
                <p className="text-xs text-neutral-500">날짜와 시간, 한 일을 입력하여 저장하세요.</p>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">근무 날짜</label>
                  <input
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">근무 시간 (시작 ~ 종료)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-500 block mb-0.5">시작 시간</span>
                      <input
                        type="time"
                        value={inputStart}
                        onChange={(e) => setInputStart(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-500 block mb-0.5">종료 시간</span>
                      <input
                        type="time"
                        value={inputEnd}
                        onChange={(e) => setInputEnd(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">한 일 (업무 상세 내용)</label>
                  <textarea
                    rows={3}
                    value={inputDesc}
                    onChange={(e) => setInputDesc(e.target.value)}
                    placeholder="예: 강의자료 PPT 수정, 블로그 자료 정리, 카드뉴스 제작 등"
                    className="w-full p-3 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600 resize-none"
                  />
                </div>

                {/* 실시간 계산 박스 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
                  <span>계산 시간: <b className="text-blue-700">{formatHoursAndMinutes(previewMinutes)} ({previewMinutes}분)</b></span>
                  <span>예상: <b className="text-blue-700">{formatWon(previewPay)}</b></span>
                </div>

                <button
                  onClick={handleSaveWorkLog}
                  disabled={isSubmitting}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '근무 기록 저장하기'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. 알바생 - 내 기록 목록 뷰                               */}
          {/* ========================================================= */}
          {currentUser?.role === 'staff' && currentTab === 'staffHistory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl p-2 shadow-2xs">
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                </button>
                <span className="text-xs font-bold text-neutral-900">{weekRange.displayLabel}</span>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                >
                  다음 주 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {staffSummary?.logs && staffSummary.logs.length > 0 ? (
                <div className="space-y-2.5">
                  {staffSummary.logs.map(log => {
                    const isSettled = staffSummary.settlement.status === 'completed';
                    return (
                      <div key={log.id} className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-blue-600">{log.workDate}</span>
                          <span className="text-xs font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-800">
                            {formatHoursAndMinutes(log.minutesWorked)}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 mb-2">{log.startTime} ~ {log.endTime}</div>
                        <div className="text-xs bg-neutral-50 p-2.5 rounded-lg text-neutral-800 leading-relaxed">
                          {log.workDescription}
                        </div>
                        <div className="flex justify-end mt-2 pt-2 border-t border-neutral-100">
                          {isSettled ? (
                            <span className="text-[11px] text-neutral-400">정산 완료됨</span>
                          ) : (
                            <button
                              onClick={() => setLogToDelete(log)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> 삭제
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-neutral-200 text-neutral-400 text-xs">
                  <p className="font-bold text-neutral-600">등록된 근무 기록이 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. 관리자 - 주간 정산 홈                                  */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminHome' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-neutral-500">관리자 페이지</span>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">주간 정산 현황</h2>
              </div>

              {/* 주간 이동 바 */}
              <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl p-2 shadow-2xs">
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                </button>
                <span className="text-xs font-bold text-neutral-900">{weekRange.displayLabel}</span>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                >
                  다음 주 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 직원별 정산 카드 목록 */}
              <div className="space-y-3">
                {adminStaffSummaries.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-neutral-200 p-6 space-y-2">
                    <Users className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-sm font-bold text-neutral-700">등록된 알바생이 없습니다.</p>
                    <p className="text-xs text-neutral-400">하단 [직원 관리] 탭에서 알바생을 먼저 추가해주세요.</p>
                  </div>
                ) : (
                  adminStaffSummaries.map(({ emp, totalMinutes, expectedPay, settlement }) => {
                    const isSettled = settlement.status === 'completed';
                    return (
                      <div
                        key={emp.employeeId}
                        onClick={() => {
                          setSelectedStaffForAdmin(emp.employeeId);
                          setAdminActualPayInput(isSettled ? String(settlement.actualPay) : String(expectedPay));
                        }}
                        className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:border-blue-400 cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-neutral-900">{emp.name}</span>
                            <span className="text-xs text-neutral-400 font-mono">({emp.employeeId})</span>
                          </div>
                          {isSettled ? (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              정산 완료
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              정산 전
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                            <span className="text-[10px] text-neutral-500 block">총 근무시간</span>
                            <span className="text-sm font-bold text-blue-600">{formatHoursAndMinutes(totalMinutes)}</span>
                          </div>
                          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                            <span className="text-[10px] text-neutral-500 block">예상 급여</span>
                            <span className="text-sm font-bold text-neutral-900">{formatWon(expectedPay)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100">
                          <span className="text-neutral-500">
                            실제 지급액: <b className="text-emerald-600">{isSettled ? formatWon(settlement.actualPay) : '-'}</b>
                          </span>
                          <span className="text-blue-600 font-bold flex items-center gap-0.5">
                            상세/정산하기 <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. 관리자 - 직원 관리 (알바생 추가 및 계정 발급)          */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminEmployees' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">알바생 계정 관리</h2>
                  <p className="text-xs text-neutral-500">알바생 아이디, 비밀번호 발급 및 시급 설정</p>
                </div>
                <button
                  onClick={() => setIsAddEmpModalOpen(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" /> 알바생 추가
                </button>
              </div>

              <div className="space-y-3">
                {employees.map(emp => {
                  const isPwVisible = !!visiblePwMap[emp.employeeId];
                  return (
                    <div key={emp.employeeId} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 text-base">{emp.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                            }`}>
                              {emp.active ? '재직중' : '비활성'}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                            <span>아이디: <b className="font-mono text-neutral-800">{emp.employeeId}</b></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              비밀번호: 
                              <b className="font-mono text-neutral-800">
                                {isPwVisible ? (emp.password || '1234') : '••••'}
                              </b>
                              <button
                                onClick={() => setVisiblePwMap(prev => ({ ...prev, [emp.employeeId]: !prev[emp.employeeId] }))}
                                className="text-neutral-400 hover:text-neutral-600 ml-0.5"
                                title={isPwVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                              >
                                {isPwVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-neutral-400 block">시급</span>
                          <span className="text-sm font-black text-neutral-900">{formatWon(emp.hourlyRate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-100 text-xs">
                        <button
                          onClick={() => handleToggleEmpActive(emp.employeeId, !emp.active)}
                          className={`font-semibold hover:underline ${emp.active ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          {emp.active ? '계정 일시정지' : '계정 활성화'}
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.employeeId, emp.name)}
                          className="text-neutral-400 hover:text-rose-600 font-semibold"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. 관리자 - 설정 (Google Sheets 연동을 여기서 관리)        */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminSettings' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">시스템 및 구글 시트 연동</h2>
                <p className="text-xs text-neutral-500">Google Drive/Sheets 연동 상태 및 데이터 동기화</p>
              </div>

              {/* 구글 시트 연동 관리 카드 */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-neutral-800">Google Sheets 연동 관리</span>
                  </div>
                  {gasUrl ? (
                    <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                      Apps Script 연동 활성
                    </span>
                  ) : spreadsheetId ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      구글 시트 연동 활성
                    </span>
                  ) : (
                    <span className="text-xs bg-neutral-100 text-neutral-600 font-bold px-2.5 py-0.5 rounded-full">
                      미연결
                    </span>
                  )}
                </div>

                {/* 에러 발생 시 친절한 안내 배너 및 해결 버튼 */}
                {syncError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2.5">
                    <div className="font-bold flex items-center gap-1.5 text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>연동 안내</span>
                    </div>
                    <p className="leading-relaxed text-neutral-700 font-medium whitespace-pre-line">{syncError}</p>
                    
                    <div className="bg-white/90 p-2.5 rounded-lg border border-rose-200/60 text-[11px] text-neutral-600 space-y-1">
                      <p className="font-bold text-neutral-800 flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>구글 시트 링크 공유 설정 방법:</span>
                      </p>
                      <p>1. 연동할 구글 시트 우측 상단의 <b>[공유]</b> 버튼을 클릭합니다.</p>
                      <p>2. [일반 액세스]를 <b>'제한됨'</b>에서 <b>'링크가 있는 모든 사용자'</b> (뷰어 또는 편집자)로 변경합니다.</p>
                      <p>3. [완료]를 누른 후 아래 <b>[데이터 즉시 동기화]</b>를 누르면 로그인 없이 바로 연결됩니다.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>다시 동기화 시도</span>
                      </button>
                      <button
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>새 탭에서 열기</span>
                      </button>
                      <button
                        onClick={() => setSyncError(null)}
                        className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg text-xs transition-colors"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. 구글 시트 연동 활성 상태 (링크 또는 OAuth) */}
                {spreadsheetId ? (
                  <div className="space-y-3 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>연동된 구글 스프레드시트</span>
                      </div>
                      {isSyncing && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-bold">
                          <RefreshCw className="w-3 h-3 animate-spin" /> 동기화 중...
                        </span>
                      )}
                    </div>

                    <div className="truncate bg-white p-2 rounded-lg border border-neutral-200 text-[11px] font-mono text-neutral-700">
                      <b>ID:</b> <span className="select-all">{spreadsheetId}</span>
                      {googleUser && <span className="ml-2 text-neutral-400 font-sans">({googleUser.email})</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>시트 바로 열기</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>데이터 즉시 동기화</span>
                      </button>
                    </div>

                    {/* 구글 시트 붙여넣기 및 데이터 내보내기 도구 */}
                    <div className="mt-3 pt-3 border-t border-neutral-200/80 space-y-2">
                      <span className="font-bold text-neutral-700 block text-[11px]">
                        📋 구글 시트 전용 복사 및 내보내기 도구
                      </span>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        아래 [복사] 버튼을 누른 뒤 내 구글 시트의 <b>A1 셀</b>을 클릭하고 <b>Ctrl+V</b>로 붙여넣으면 모든 표와 데이터가 깔끔하게 입력됩니다.
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={handleCopyWorkLogsTsv}
                          className="bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-bold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-neutral-500" />
                          <span>근무기록 복사</span>
                        </button>
                        <button
                          onClick={handleCopySettlementsTsv}
                          className="bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-bold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-neutral-500" />
                          <span>정산내역 복사</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleDownloadWorkLogsCsv}
                          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3 text-neutral-500" />
                          <span>근무기록 CSV 받기</span>
                        </button>
                        <button
                          onClick={handleDownloadSettlementsCsv}
                          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium py-1.5 px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3 text-neutral-500" />
                          <span>주간정산 CSV 받기</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                      {!googleUser ? (
                        <button
                          onClick={handleGoogleConnect}
                          disabled={isConnectingGoogle}
                          className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                        >
                          <span>Google 계정 로그인 (자동 쓰기 활성화)</span>
                        </button>
                      ) : (
                        <span className="text-neutral-400 text-[11px]">계정 연동됨</span>
                      )}
                      <button
                        onClick={handleDisconnectSpreadsheet}
                        className="text-neutral-400 hover:text-rose-600 font-medium ml-auto"
                      >
                        시트 연결 해제
                      </button>
                    </div>
                  </div>
                ) : gasUrl ? (
                  /* 2. Google Apps Script 연동 활성 상태 */
                  <div className="space-y-3 text-xs text-neutral-600 bg-purple-50/60 p-3.5 rounded-xl border border-purple-200/70">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-purple-900 flex items-center gap-1.5">
                        <Code2 className="w-4 h-4 text-purple-600" />
                        <span>Google Apps Script 웹 앱 연결됨</span>
                      </div>
                      {isSyncing && (
                        <span className="text-[11px] text-purple-700 flex items-center gap-1 font-bold">
                          <RefreshCw className="w-3 h-3 animate-spin" /> 동기화 중...
                        </span>
                      )}
                    </div>
                    <div className="truncate">
                      <b>웹 앱 URL:</b> <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-purple-200 select-all">{gasUrl}</code>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>데이터 즉시 동기화</span>
                      </button>
                      <button
                        onClick={handleGasDisconnect}
                        className="bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors"
                      >
                        연결 해제
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 3. 미연결 상태: 링크 직접 연결 최우선 제공 */
                  <div className="space-y-3.5">
                    {/* [방법 1] 구글 시트 링크로 즉시 연결 */}
                    <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <LinkIcon className="w-4 h-4 text-emerald-700" />
                          <span>구글 시트 링크로 바로 연결 (가장 간편!)</span>
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                          로그인 불필요
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-600 leading-relaxed">
                        사용하시는 구글 스프레드시트의 <b>주소창 링크</b>(또는 ID)를 아래에 붙여넣으시면 즉시 연결됩니다.
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualSheetId}
                          onChange={(e) => setManualSheetId(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                          className="flex-1 h-9.5 px-3 bg-white border border-emerald-300 rounded-lg text-xs font-mono placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                        />
                        <button
                          onClick={handleConnectManualSheet}
                          disabled={isConnectingGoogle || isSyncing}
                          className="px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs shrink-0 disabled:opacity-50"
                        >
                          {isConnectingGoogle ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                          <span>시트 연결</span>
                        </button>
                      </div>

                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-200/60 text-[11px] text-neutral-600">
                        💡 <b>참고:</b> 구글 시트 우측 상단 <b>[공유]</b> 버튼을 눌러 일반 액세스를 <b>[링크가 있는 모든 사용자(뷰어/편집자)]</b>로 설정해두시면 로그인 승인 팝업 없이 데이터를 즉시 읽어옵니다.
                      </div>
                    </div>

                    {/* [방법 2] 1-클릭 Google 계정 로그인 (새 시트 자동 생성) */}
                    <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/70 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-800 flex items-center gap-1">
                          <span className="w-4 h-4 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">2</span>
                          Google 계정 로그인 (새 시트 자동 생성 및 자동 쓰기)
                        </span>
                        <button
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
                        >
                          <span>새 탭에서 열기</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-[11px] text-neutral-600 leading-relaxed">
                        Google 계정으로 로그인하면 내 Google 드라이브에 시트가 자동 생성되며, 실시간 자동 기록이 연동됩니다. (팝업 차단 방지를 위해 새 탭 열기 권장)
                      </p>

                      <button
                        onClick={handleGoogleConnect}
                        disabled={isConnectingGoogle}
                        className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-300 text-neutral-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-xs"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>
                          {isConnectingGoogle ? 'Google 계정 연결 및 시트 생성 중...' : 'Google 계정 로그인 및 시트 자동 연동'}
                        </span>
                      </button>
                    </div>

                    {/* [방법 3] Google Apps Script 웹 앱 연동 (선택사항) */}
                    <div className="p-3 bg-neutral-50/70 rounded-xl border border-neutral-200/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                          <Code2 className="w-3.5 h-3.5 text-purple-600" />
                          <span>Google Apps Script 웹 앱 연동 (고급 사용자용)</span>
                        </span>
                        <button
                          onClick={() => setShowGasModal(true)}
                          className="text-[11px] text-purple-700 hover:text-purple-900 font-bold underline underline-offset-2 flex items-center gap-0.5"
                        >
                          <span>스크립트 코드 & 가이드</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">
                        Apps Script 웹앱 배포 URL(`https://script.google.com/...`)을 위 입력창에 넣고 연결하셔도 됩니다. (배포 에러가 나는 경우 위의 [방법 1] 링크 연결을 이용하시면 됩니다)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 관리자 보안 정보 카드 */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs space-y-1">
                <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                  관리자 계정
                </span>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  관리자 아이디: <b className="text-neutral-800 font-mono">admin</b> / 관리자 고정 비밀번호 적용됨
                </p>
              </div>
            </div>
          )}
        </main>

        {/* 하단 내비게이션 바 (로그인 시에만 표시) */}
        {currentUser && (
          <nav className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-neutral-200 flex items-center justify-around px-2 z-40">
            {currentUser.role === 'staff' ? (
              <>
                <button
                  onClick={() => setCurrentTab('staffHome')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'staffHome' ? 'text-blue-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span>홈</span>
                </button>
                <button
                  onClick={() => setCurrentTab('staffAdd')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'staffAdd' ? 'text-blue-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  <span>근무 기록</span>
                </button>
                <button
                  onClick={() => setCurrentTab('staffHistory')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'staffHistory' ? 'text-blue-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span>내 기록</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('adminHome')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'adminHome' ? 'text-rose-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>주간 정산</span>
                </button>
                <button
                  onClick={() => setCurrentTab('adminEmployees')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'adminEmployees' ? 'text-rose-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span>직원 관리</span>
                </button>
                <button
                  onClick={() => setCurrentTab('adminSettings')}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    currentTab === 'adminSettings' ? 'text-rose-600' : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>설정</span>
                </button>
              </>
            )}
          </nav>
        )}

        {/* 관리자 정산 모달 */}
        {selectedStaffForAdmin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-end justify-center z-50">
            <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
              {(() => {
                const summary = adminStaffSummaries.find(s => s.emp.employeeId === selectedStaffForAdmin);
                if (!summary) return null;
                const isSettled = summary.settlement.status === 'completed';

                return (
                  <>
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-neutral-900">{summary.emp.name} 주간 정산</h3>
                        <span className="text-xs text-neutral-400">{weekRange.displayLabel}</span>
                      </div>
                      <button
                        onClick={() => setSelectedStaffForAdmin(null)}
                        className="w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[10px] text-neutral-500 block">총 근무시간</span>
                        <span className="text-sm font-black text-blue-600">
                          {formatHoursAndMinutes(summary.totalMinutes)}
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                        <span className="text-[10px] text-neutral-500 block">예상 급여</span>
                        <span className="text-sm font-black text-neutral-900">
                          {formatWon(summary.expectedPay)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-neutral-700 block mb-1.5">
                        상세 근무 기록 ({summary.logs.length}건)
                      </span>
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                        {summary.logs.length === 0 ? (
                          <div className="text-center py-4 text-neutral-400 text-xs">근무 내역이 없습니다.</div>
                        ) : (
                          summary.logs.map(l => (
                            <div key={l.id} className="bg-neutral-50 p-2.5 rounded-xl text-xs border border-neutral-100">
                              <div className="flex justify-between font-bold text-neutral-800">
                                <span>{l.workDate} ({l.startTime}~{l.endTime})</span>
                                <span className="text-blue-600">{formatHoursAndMinutes(l.minutesWorked)}</span>
                              </div>
                              <p className="text-neutral-600 mt-1">{l.workDescription}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 주간 정산 입력 카드 */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-emerald-900">실제 입금액 입력</span>
                        {isSettled ? (
                          <span className="text-[11px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                            정산 완료됨
                          </span>
                        ) : (
                          <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                            정산 대기
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] text-emerald-800 mb-1 font-medium">
                          실제 지급액 (보너스 등 포함 실제 입금할 금액)
                        </label>
                        <input
                          type="number"
                          value={adminActualPayInput}
                          onChange={(e) => setAdminActualPayInput(e.target.value)}
                          placeholder="예: 140000"
                          className="w-full h-12 px-3.5 rounded-xl border border-emerald-300 text-lg font-black text-emerald-900 bg-white focus:outline-none focus:border-emerald-600"
                        />
                        <span className="text-[10px] text-emerald-700 mt-1 block">
                          ※ 확정 시 Google Sheets의 Settlements 시트에 실시간 기록됩니다.
                        </span>
                      </div>

                      <button
                        onClick={handleCompleteSettlement}
                        disabled={isSubmitting}
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            정산 처리 중...
                          </>
                        ) : (
                          '이번 주 정산 완료'
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 신규 알바생 추가 모달 */}
        {isAddEmpModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-neutral-900">신규 알바생 등록</h3>
                <button onClick={() => setIsAddEmpModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 font-bold">✕</button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">알바생 이름</label>
                  <input
                    type="text"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="예: 이영희"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">접속 아이디 (로그인용)</label>
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="예: staff02"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">초기 비밀번호</label>
                  <input
                    type="text"
                    value={newEmpPw}
                    onChange={(e) => setNewEmpPw(e.target.value)}
                    placeholder="예: 5678"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">시급 (원)</label>
                  <input
                    type="number"
                    value={newEmpRate}
                    onChange={(e) => setNewEmpRate(e.target.value)}
                    placeholder="12000"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-sm font-bold"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddEmpModalOpen(false)}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
                  >
                    {isSubmitting ? '등록 중...' : '알바생 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 삭제 확인 모달 */}
        {logToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold">근무 기록 삭제 확인</h3>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                <b>{logToDelete.workDate} ({logToDelete.startTime} ~ {logToDelete.endTime})</b><br />
                "{logToDelete.workDescription}" 기록을 영구 삭제하시겠습니까?
              </p>
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setLogToDelete(null)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmDeleteLog}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
                >
                  {isSubmitting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Google Apps Script 연동 가이드 모달 */}
        {showGasModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl space-y-4 my-8 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2 text-purple-900">
                  <Code2 className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-bold">Google Apps Script (GAS) 연동 가이드</h3>
                </div>
                <button
                  onClick={() => setShowGasModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 font-bold p-1 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs text-neutral-700">
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-purple-950 leading-relaxed">
                  💡 <b>Apps Script 연동의 장점:</b> 브라우저 팝업 차단이나 Google OAuth 토큰 만료 문제 없이, 구글 스프레드시트와 100% 안정적으로 데이터를 실시간 입출력할 수 있습니다.
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                    스프레드시트에서 Apps Script 열기
                  </h4>
                  <p className="text-neutral-600 pl-5 leading-normal">
                    사용하실 구글 스프레드시트를 열고, 상단 메뉴에서 <b>[확장 프로그램] &gt; [Apps Script]</b>를 클릭합니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                    스크립트 코드 붙여넣기 및 저장
                  </h4>
                  <p className="text-neutral-600 pl-5 leading-normal">
                    편집기에 있는 기존 코드를 모두 지우고, 아래 코드를 복사하여 붙여넣은 뒤 <b>저장 (Ctrl+S 또는 Cmd+S)</b>합니다.
                  </p>
                  <div className="pl-5 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono text-neutral-500">Code.gs</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(GAS_SAMPLE_CODE);
                          showToast('Apps Script 코드가 클립보드에 복사되었습니다!');
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>코드 복사하기</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed select-all">
                      {GAS_SAMPLE_CODE}
                    </pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
                    웹 앱으로 배포하기
                  </h4>
                  <ul className="list-disc pl-9 text-neutral-600 space-y-1 leading-normal">
                    <li>Apps Script 우측 상단 <b>[배포] &gt; [새 배포]</b> 클릭</li>
                    <li>톱니바퀴 아이콘에서 <b>[웹 앱]</b> 선택</li>
                    <li>설명: <code className="bg-neutral-100 px-1 py-0.5 rounded">알바정산 API</code></li>
                    <li>다음 사용자 권한으로 실행: <b>나 (내 이메일)</b></li>
                    <li>액세스 권한: <b>모든 사용자 (Anyone)</b> (★필수★)</li>
                    <li>[배포] 클릭 후 권한 승인 완료</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center text-[10px]">4</span>
                    생성된 웹 앱 URL 복사 및 연결
                  </h4>
                  <p className="text-neutral-600 pl-5 leading-normal">
                    배포 완료 후 나타나는 <b>웹 앱 URL</b>(<code className="font-mono text-[10px] bg-neutral-100 px-1">https://script.google.com/macros/s/.../exec</code>)을 복사하여 본 앱의 [Google Apps Script 웹 앱 연동] 입력창에 붙여넣고 연결하시면 끝납니다!
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setShowGasModal(false)}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 토스트 알림 */}
        {toastMsg && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-50 pointer-events-none text-center max-w-[85%]">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
