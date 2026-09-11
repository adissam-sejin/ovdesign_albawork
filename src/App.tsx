import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Clock, Calendar, Plus, Trash2, CheckCircle2, 
  ChevronLeft, ChevronRight, User, Shield, 
  RefreshCw, Sparkles, ExternalLink, 
  LogOut, Settings, Users, FileSpreadsheet, Check, AlertTriangle
} from 'lucide-react';
import { Employee, WorkLog, Settlement, UserSession } from './types';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from './services/auth';
import { 
  createSpreadsheet, 
  fetchAllSheetData, 
  appendWorkLogToSheet, 
  deleteWorkLogFromSheet, 
  saveSettlementToSheet, 
  addEmployeeToSheet, 
  toggleEmployeeActiveInSheet 
} from './services/sheetsService';
import type { User as FirebaseUser } from 'firebase/auth';

const DEFAULT_HOURLY_RATE = 12000;
const SPREADSHEET_STORAGE_KEY = 'alba_connected_spreadsheet_id';

export default function App() {
  // 1. Google 계정 및 구글 시트 연동 상태
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(SPREADSHEET_STORAGE_KEY);
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // 2. 인앱 데이터 상태 (스프레드시트와 실시간 동기화)
  const [employees, setEmployees] = useState<Employee[]>([
    {
      employeeId: 'staff01',
      name: '알바생1',
      password: '1234',
      hourlyRate: DEFAULT_HOURLY_RATE,
      active: true,
      createdAt: '2026-09-07 09:00:00'
    }
  ]);

  const [workLogs, setWorkLogs] = useState<WorkLog[]>([
    {
      id: 'WL_1001',
      employeeId: 'staff01',
      employeeName: '알바생1',
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
      employeeName: '알바생1',
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
      employeeName: '알바생1',
      workDate: '2026-09-09',
      startTime: '14:00',
      endTime: '17:00',
      minutesWorked: 180,
      workDescription: '카드뉴스 제작',
      createdAt: '2026-09-09 17:01:00'
    },
    {
      id: 'WL_1004',
      employeeId: 'staff01',
      employeeName: '알바생1',
      workDate: '2026-09-11',
      startTime: '13:00',
      endTime: '16:00',
      minutesWorked: 180,
      workDescription: '영상 자막 작업 및 유튜브 업로드',
      createdAt: '2026-09-11 16:01:00'
    }
  ]);

  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // 3. 앱 로그인 세션 (알바생 or 관리자)
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('alba_user_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      role: 'staff',
      id: 'staff01',
      name: '알바생1',
      hourlyRate: 12000
    };
  });

  // 4. 모바일 뷰 탭
  const [currentTab, setCurrentTab] = useState<'staffHome' | 'staffAdd' | 'staffHistory' | 'adminHome' | 'adminEmployees' | 'adminSettings'>('staffHome');

  // 5. 날짜 기준 (현재 주간 계산)
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date('2026-09-09T00:00:00'));

  // 6. UI 입력 폼 상태
  const [loginRole, setLoginRole] = useState<'staff' | 'admin'>('staff');
  const [loginId, setLoginId] = useState('staff01');
  const [loginPw, setLoginPw] = useState('1234');

  const [inputDate, setInputDate] = useState('2026-09-09');
  const [inputStart, setInputStart] = useState('10:00');
  const [inputEnd, setInputEnd] = useState('12:30');
  const [inputDesc, setInputDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 관리자 정산 모달
  const [selectedStaffForAdmin, setSelectedStaffForAdmin] = useState<string | null>(null);
  const [adminActualPayInput, setAdminActualPayInput] = useState('');

  // 직원 추가 모달
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpPw, setNewEmpPw] = useState('1234');
  const [newEmpRate, setNewEmpRate] = useState('12000');

  // 삭제 확인 모달 (Workspace Integration 필수 요건)
  const [logToDelete, setLogToDelete] = useState<WorkLog | null>(null);

  // 시트 직접 연결 수동 입력 상태
  const [manualSheetId, setManualSheetId] = useState('');

  // 토스트
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Google Sheets에서 최신 데이터 불러오기 함수
  const syncWithGoogleSheets = useCallback(async (token?: string, sId?: string) => {
    const activeToken = token || (await getAccessToken());
    const activeSheetId = sId || spreadsheetId;
    if (!activeToken || !activeSheetId) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await fetchAllSheetData(activeToken, activeSheetId);
      if (data.employees.length > 0) setEmployees(data.employees);
      if (data.workLogs.length > 0) setWorkLogs(data.workLogs);
      setSettlements(data.settlements);
      showToast('구글 시트와 실시간 동기화 완료');
    } catch (err: any) {
      console.error('Sheets Sync Error:', err);
      setSyncError(err.message || '시트 동기화 실패');
    } finally {
      setIsSyncing(false);
    }
  }, [spreadsheetId]);

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

      // 기존 연결된 시트가 있는지 확인
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
      console.error(err);
      setSyncError(err.message || 'Google 연동 중 오류 발생');
      showToast('Google 연동에 실패했습니다.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await googleSignOut();
    setGoogleUser(null);
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

  // 시간 및 통계 계산
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

  // 관리자용 직원별 요약 목록
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

  // 로그인 핸들러
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = loginId.trim();
    const pw = loginPw.trim();

    if (!id || !pw) {
      showToast('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (id === 'admin' && pw === 'adi2026') {
      const adminSession: UserSession = { role: 'admin', id: 'admin', name: '관리자', hourlyRate: 0 };
      setCurrentUser(adminSession);
      localStorage.setItem('alba_user_session', JSON.stringify(adminSession));
      setCurrentTab('adminHome');
      showToast('관리자로 로그인되었습니다.');
      return;
    }

    const emp = employees.find(e => e.employeeId === id && e.password === pw);
    if (emp) {
      if (!emp.active) {
        showToast('비활성화된 계정입니다. 관리자에게 문의하세요.');
        return;
      }
      const staffSession: UserSession = {
        role: 'staff',
        id: emp.employeeId,
        name: emp.name,
        hourlyRate: emp.hourlyRate
      };
      setCurrentUser(staffSession);
      localStorage.setItem('alba_user_session', JSON.stringify(staffSession));
      setCurrentTab('staffHome');
      showToast(`${emp.name}님 환영합니다.`);
    } else {
      showToast('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('alba_user_session');
    showToast('로그아웃되었습니다.');
  };

  // 근무 기록 저장 (Google Sheets에 직접 추가)
  const handleSaveWorkLog = async () => {
    if (!currentUser) return;
    if (!inputDate) { showToast('근무 날짜를 선택해 주세요.'); return; }
    if (!inputStart || !inputEnd) { showToast('근무 시간을 입력해 주세요.'); return; }
    const minutes = calcMinutes(inputStart, inputEnd);
    if (minutes <= 0) { showToast('종료 시간을 시작 시간보다 늦게 설정해 주세요.'); return; }
    if (!inputDesc.trim()) { showToast('한 일을 입력해 주세요.'); return; }

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
      showToast(spreadsheetId ? 'Google Sheets에 근무 기록이 실시간 저장되었습니다!' : '근무 기록이 저장되었습니다.');
      setCurrentTab('staffHome');
    } catch (err: any) {
      console.error(err);
      showToast('저장 중 오류: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제 확정 (Google Sheets에서도 실제 행 삭제)
  const handleConfirmDeleteLog = async () => {
    if (!logToDelete) return;
    setIsSubmitting(true);
    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await deleteWorkLogFromSheet(token, spreadsheetId, logToDelete.id);
      }
      setWorkLogs(prev => prev.filter(l => l.id !== logToDelete.id));
      showToast(spreadsheetId ? '구글 시트에서 근무 기록이 삭제되었습니다.' : '근무 기록이 삭제되었습니다.');
      setLogToDelete(null);
    } catch (err: any) {
      console.error(err);
      showToast('삭제 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 정산 완료 (Google Sheets Settlements 시트에 직접 저장)
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
      showToast(`정산 완료! (예상 ${formatWon(summary.expectedPay)} → 실제 입금 ${formatWon(actual)}) Google Sheets 반영됨`);
    } catch (err: any) {
      console.error(err);
      showToast('정산 저장 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 직원 추가 (Google Sheets Employees 시트에 직접 저장)
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim() || !newEmpId.trim() || !newEmpPw.trim()) {
      showToast('모든 항목을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const newEmp: Employee = {
      employeeId: newEmpId.trim(),
      name: newEmpName.trim(),
      password: newEmpPw.trim(),
      hourlyRate: Number(newEmpRate) || 12000,
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
      showToast(`${newEmp.name} 직원이 추가되었습니다.`);
    } catch (err: any) {
      console.error(err);
      showToast('직원 추가 실패: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 직원 상태 토글 (Google Sheets Employees 시트에 직접 수정)
  const handleToggleEmpActive = async (empId: string, nextActive: boolean) => {
    try {
      const token = await getAccessToken();
      if (token && spreadsheetId) {
        await toggleEmployeeActiveInSheet(token, spreadsheetId, empId, nextActive);
      }
      setEmployees(prev => prev.map(e => e.employeeId === empId ? { ...e, active: nextActive } : e));
      showToast('직원 재직 상태가 변경되었습니다.');
    } catch (err: any) {
      showToast('상태 변경 실패: ' + err.message);
    }
  };

  const previewMinutes = calcMinutes(inputStart, inputEnd);
  const previewPay = Math.max(0, Math.round((previewMinutes / 60) * (currentUser?.hourlyRate || DEFAULT_HOURLY_RATE)));

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col justify-between antialiased">
      {/* 1. 최상단: Google Sheets 연동 상태 배너 */}
      <div className="bg-neutral-900 text-white text-xs px-4 py-2.5 border-b border-neutral-800">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {googleUser ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="flex items-center gap-1 text-emerald-400 font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                구글 시트 연동됨
              </span>
              <span className="text-neutral-400 truncate max-w-[110px]" title={googleUser.email || ''}>
                {googleUser.email}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-300">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Google Sheets 실시간 연동</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {googleUser && spreadsheetId ? (
              <>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600/90 hover:bg-emerald-600 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 transition-colors"
                  title="실제 Google Sheets 새 탭으로 열기"
                >
                  <span>시트 열기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => syncWithGoogleSheets()}
                  disabled={isSyncing}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors"
                  title="데이터 새로고침"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              </>
            ) : (
              <button
                onClick={handleGoogleConnect}
                disabled={isConnectingGoogle}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 rounded-md transition-all flex items-center gap-1.5 shadow-xs"
              >
                {isConnectingGoogle ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    연결 중...
                  </>
                ) : (
                  'Google 시트 연결'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 실제 모바일 웹앱 본체 (최대 480px) */}
      <div className="flex-1 w-full max-w-md mx-auto bg-white shadow-lg flex flex-col relative min-h-[calc(100vh-41px)]">
        {/* 앱 상단 헤더 */}
        <header className="bg-white border-b border-neutral-200 px-4 py-3.5 sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              currentUser?.role === 'admin'
                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                : currentUser?.role === 'staff'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-neutral-100 text-neutral-600'
            }`}>
              {currentUser ? (currentUser.role === 'admin' ? '관리자' : '알바생') : '로그인 필요'}
            </span>
            <h1 className="text-base font-bold text-neutral-900 tracking-tight">알바 주간정산</h1>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                <User className="w-3 h-3 text-neutral-500" />
                {currentUser.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs text-neutral-500 hover:text-neutral-800 p-1 font-medium flex items-center gap-0.5"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          ) : null}
        </header>

        {/* 메인 화면 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          {/* ========================================================= */}
          {/* A. 비로그인 화면 (알바생/관리자 로그인)                    */}
          {/* ========================================================= */}
          {!currentUser && (
            <div className="pt-4 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-3 border border-blue-100 shadow-xs">
                  <Clock className="w-7 h-7 stroke-[2.2]" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">알바 주간정산</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  근무 기록 자동 집계 및 주간 급여 정산 모바일 웹앱
                </p>
              </div>

              {/* 역할 선택 탭 */}
              <div className="grid grid-cols-2 gap-1 bg-neutral-100 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setLoginRole('staff');
                    setLoginId('staff01');
                    setLoginPw('1234');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    loginRole === 'staff' ? 'bg-white text-blue-600 shadow-xs' : 'text-neutral-500'
                  }`}
                >
                  알바생 로그인
                </button>
                <button
                  onClick={() => {
                    setLoginRole('admin');
                    setLoginId('admin');
                    setLoginPw('adi2026');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    loginRole === 'admin' ? 'bg-white text-rose-600 shadow-xs' : 'text-neutral-500'
                  }`}
                >
                  관리자 로그인
                </button>
              </div>

              <form onSubmit={handleLogin} className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-xs space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">아이디</label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="아이디 입력"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5">비밀번호</label>
                  <input
                    type="password"
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full h-12 rounded-xl font-bold text-base text-white transition-all shadow-md active:scale-[0.98] ${
                    loginRole === 'admin' 
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  {loginRole === 'admin' ? '관리자로 로그인' : '알바생으로 로그인'}
                </button>
              </form>

              {/* 간편 테스트 계정 힌트 */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-xs text-neutral-600 space-y-1.5">
                <div className="font-bold text-neutral-800">💡 기본 계정 정보</div>
                <div className="flex justify-between items-center">
                  <span>알바생: <b>staff01</b> / <b>1234</b></span>
                  <button
                    onClick={() => {
                      setLoginRole('staff');
                      setLoginId('staff01');
                      setLoginPw('1234');
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    입력하기
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span>관리자: <b>admin</b> / <b>adi2026</b></span>
                  <button
                    onClick={() => {
                      setLoginRole('admin');
                      setLoginId('admin');
                      setLoginPw('adi2026');
                    }}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    입력하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* B. 알바생 - 홈 뷰                                         */}
          {/* ========================================================= */}
          {currentUser?.role === 'staff' && currentTab === 'staffHome' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-neutral-500">알바생 모바일 대시보드</span>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                  안녕하세요, {currentUser.name}님
                </h2>
              </div>

              {/* 주간 네비게이터 */}
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

              {/* 핵심 요약 카드 */}
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
                    <span className="text-[10px] text-neutral-400">관리자 최종 정산 지급액</span>
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

              {/* 최근 기록 미리보기 */}
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
                    <p className="font-bold text-neutral-600">이번 주에 등록된 근무가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* C. 알바생 - 근무 기록 입력 뷰                             */}
          {/* ========================================================= */}
          {currentUser?.role === 'staff' && currentTab === 'staffAdd' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">근무 기록하기</h2>
                <p className="text-xs text-neutral-500">
                  {spreadsheetId ? '저장 시 Google Sheets에 즉시 실시간 기록됩니다.' : '날짜와 시간, 업무 내용을 등록하세요.'}
                </p>
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

                {/* 실시간 계산 배너 */}
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
          {/* D. 알바생 - 내 기록 목록 뷰                               */}
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
                            <span className="text-[11px] text-neutral-400">정산 완료 (수정 불가)</span>
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
          {/* E. 관리자 - 정산 홈 뷰                                    */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminHome' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-neutral-500">관리자 정산 페이지</span>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">이번 주 정산</h2>
              </div>

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
                {adminStaffSummaries.map(({ emp, totalMinutes, expectedPay, settlement }) => {
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
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* F. 관리자 - 직원 관리                                      */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminEmployees' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">직원 관리</h2>
                  <p className="text-xs text-neutral-500">알바생 등록 및 시급 관리</p>
                </div>
                <button
                  onClick={() => setIsAddEmpModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> 직원 추가
                </button>
              </div>

              <div className="space-y-2.5">
                {employees.map(emp => (
                  <div key={emp.employeeId} className="bg-white rounded-xl border border-neutral-200 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-bold text-neutral-900 text-sm">{emp.name}</span>
                        <span className="text-xs text-neutral-400 ml-1.5 font-mono">({emp.employeeId})</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {emp.active ? '재직중' : '비활성'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-100 mt-2">
                      <span>시급: <b className="text-neutral-800">{formatWon(emp.hourlyRate)}</b></span>
                      <button
                        onClick={() => handleToggleEmpActive(emp.employeeId, !emp.active)}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        {emp.active ? '비활성화하기' : '활성화하기'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* G. 관리자 - 설정                                           */}
          {/* ========================================================= */}
          {currentUser?.role === 'admin' && currentTab === 'adminSettings' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-neutral-900">시스템 및 구글 시트 설정</h2>

              {/* 구글 시트 연결 현황 카드 */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-neutral-800">Google Sheets 연결 상태</span>
                  </div>
                  {googleUser && spreadsheetId ? (
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      실시간 연동중
                    </span>
                  ) : (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      미연결
                    </span>
                  )}
                </div>

                {googleUser && spreadsheetId ? (
                  <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                    <div><b>연결 계정:</b> {googleUser.email}</div>
                    <div className="truncate"><b>시트 ID:</b> <code className="font-mono text-[11px]">{spreadsheetId}</code></div>
                    <div className="pt-2 flex gap-2">
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg text-center flex items-center justify-center gap-1"
                      >
                        <span>구글 시트 바로가기</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={handleGoogleDisconnect}
                        className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold px-3 py-2 rounded-lg"
                      >
                        연결 해제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Google 계정으로 로그인하면 내 Google Drive에 <b>[알바 주간정산]</b> 스프레드시트가 자동 생성되어 모든 근무 기록과 정산 내역이 실시간으로 영구 저장됩니다.
                    </p>
                    <button
                      onClick={handleGoogleConnect}
                      disabled={isConnectingGoogle}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Google 계정 연동 및 시트 생성하기
                    </button>
                  </div>
                )}

                {/* 다른 스프레드시트 ID 연결 수동 입력 */}
                <div className="pt-3 border-t border-neutral-100">
                  <span className="text-xs font-bold text-neutral-700 block mb-1">기존 스프레드시트 ID로 변경</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualSheetId}
                      onChange={(e) => setManualSheetId(e.target.value)}
                      placeholder="구글 시트 ID 붙여넣기"
                      className="flex-1 h-9 px-3 border border-neutral-300 rounded-lg text-xs font-mono"
                    />
                    <button
                      onClick={() => {
                        const id = manualSheetId.trim();
                        if (!id) return;
                        setSpreadsheetId(id);
                        localStorage.setItem(SPREADSHEET_STORAGE_KEY, id);
                        syncWithGoogleSheets(undefined, id);
                        setManualSheetId('');
                        showToast('스프레드시트 ID가 변경되었습니다.');
                      }}
                      className="px-3 bg-neutral-800 text-white font-bold text-xs rounded-lg hover:bg-neutral-700"
                    >
                      연결
                    </button>
                  </div>
                </div>
              </div>

              {/* 관리자 계정 정보 카드 */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-2xs">
                <span className="text-xs font-bold text-neutral-700 block mb-1">관리자 계정 보안</span>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  관리자 아이디: <code className="font-mono font-bold bg-neutral-100 px-1 rounded">admin</code> / 비밀번호: <code className="font-mono font-bold bg-neutral-100 px-1 rounded">adi2026</code>
                </p>
              </div>
            </div>
          )}
        </main>

        {/* 3. 모바일 하단 내비게이션 바 */}
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
                  <span>정산</span>
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

        {/* 4. 관리자 정산 모달 */}
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

                    {/* 근무 기록 목록 */}
                    <div>
                      <span className="text-xs font-bold text-neutral-700 block mb-1.5">
                        상세 근무 기록 ({summary.logs.length}건)
                      </span>
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                        {summary.logs.map(l => (
                          <div key={l.id} className="bg-neutral-50 p-2.5 rounded-xl text-xs border border-neutral-100">
                            <div className="flex justify-between font-bold text-neutral-800">
                              <span>{l.workDate} ({l.startTime}~{l.endTime})</span>
                              <span className="text-blue-600">{formatHoursAndMinutes(l.minutesWorked)}</span>
                            </div>
                            <p className="text-neutral-600 mt-1">{l.workDescription}</p>
                          </div>
                        ))}
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
                          ※ 예상 급여({formatWon(summary.expectedPay)})와 실제 입금액은 Google Sheets의 Settlements 시트에 각각 보관됩니다.
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

        {/* 5. 직원 추가 모달 */}
        {isAddEmpModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-neutral-900">신규 직원 추가</h3>
                <button onClick={() => setIsAddEmpModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">직원 이름</label>
                  <input
                    type="text"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">직원 ID (로그인용)</label>
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="예: hong01"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">초기 비밀번호</label>
                  <input
                    type="password"
                    value={newEmpPw}
                    onChange={(e) => setNewEmpPw(e.target.value)}
                    placeholder="예: 1234"
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
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
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm font-bold"
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
                    {isSubmitting ? '추가 중...' : '직원 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. 삭제 확인 모달 (Workspace Integration 필수 요건) */}
        {logToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold">근무 기록 삭제 확인</h3>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                <b>{logToDelete.workDate} ({logToDelete.startTime} ~ {logToDelete.endTime})</b><br />
                "{logToDelete.workDescription}" 기록을 Google Sheets 및 앱에서 삭제하시겠습니까?
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

        {/* 토스트 알림 */}
        {toastMsg && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-50 pointer-events-none text-center max-w-[85%] animate-fade-in">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
