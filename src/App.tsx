import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Clock, Calendar, Plus, Trash2, CheckCircle2, 
  ChevronLeft, ChevronRight, User, Shield, 
  RefreshCw, ExternalLink, Eye, EyeOff,
  LogOut, Settings, Users, FileSpreadsheet, AlertTriangle, KeyRound
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
const EMPLOYEES_STORAGE_KEY = 'alba_employees_list';
const USER_SESSION_STORAGE_KEY = 'alba_user_session';

// 고정 관리자 계정 정보
const FIXED_ADMIN_ID = 'admin';
const FIXED_ADMIN_PW = 'adi2026';

export default function App() {
  // 1. Google 계정 및 구글 시트 연동 상태 (관리자 설정에서 관리)
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(SPREADSHEET_STORAGE_KEY);
  });
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

  // Google Sheets 최신 데이터 동기화
  const syncWithGoogleSheets = useCallback(async (token?: string, sId?: string) => {
    const activeToken = token || (await getAccessToken());
    const activeSheetId = sId || spreadsheetId;
    if (!activeToken || !activeSheetId) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await fetchAllSheetData(activeToken, activeSheetId);
      if (data.employees.length > 0) {
        setEmployees(data.employees);
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

          {currentUser ? (
            <div className="flex items-center gap-2">
              {currentUser.role === 'admin' && googleUser && spreadsheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-colors"
                  title="Google 시트 열기"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">시트</span>
                  <ExternalLink className="w-3 h-3" />
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
            </div>
          ) : null}
        </header>

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
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-neutral-800">Google Sheets 연동</span>
                  </div>
                  {googleUser && spreadsheetId ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      실시간 연동됨
                    </span>
                  ) : (
                    <span className="text-xs bg-neutral-100 text-neutral-600 font-bold px-2.5 py-0.5 rounded-full">
                      미연결
                    </span>
                  )}
                </div>

                {googleUser && spreadsheetId ? (
                  <div className="space-y-2.5 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
                    <div><b>연동 계정:</b> {googleUser.email}</div>
                    <div className="truncate"><b>스프레드시트 ID:</b> <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-neutral-200">{spreadsheetId}</code></div>
                    <div className="pt-2 flex gap-2">
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Google 시트 새 창 열기</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => syncWithGoogleSheets()}
                        disabled={isSyncing}
                        className="bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
                        title="데이터 동기화"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>새로고침</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Google 계정으로 로그인하면 내 Google Drive에 <b>[알바 주간정산]</b> 스프레드시트가 자동으로 생성되어 모든 알바생의 근무 기록과 주간 정산 내역이 영구 보관됩니다.
                    </p>
                    <button
                      onClick={handleGoogleConnect}
                      disabled={isConnectingGoogle}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      {isConnectingGoogle ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Google 연결 중...</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Google 계정 연동 및 시트 생성하기</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 다른 스프레드시트 수동 연결 */}
                <div className="pt-3 border-t border-neutral-100">
                  <span className="text-xs font-bold text-neutral-700 block mb-1">기존 스프레드시트 ID 연결</span>
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
                        showToast('스프레드시트 ID가 연결되었습니다.');
                      }}
                      className="px-3 bg-neutral-800 text-white font-bold text-xs rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                      연결
                    </button>
                  </div>
                </div>

                {googleUser && (
                  <div className="pt-2 text-right">
                    <button
                      onClick={handleGoogleDisconnect}
                      className="text-xs text-neutral-400 hover:text-rose-600 font-semibold"
                    >
                      Google 계정 연결 해제
                    </button>
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
