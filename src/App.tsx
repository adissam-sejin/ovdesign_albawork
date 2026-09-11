import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Table, FileCode, BookOpen, Copy, Check, LogOut, 
  Plus, Trash2, Calendar, Clock, DollarSign, CheckCircle2, 
  AlertCircle, ChevronLeft, ChevronRight, User, Shield, ArrowRight,
  RefreshCw, Sparkles, Database, ExternalLink, Info
} from 'lucide-react';
import { Employee, WorkLog, Settlement, UserSession } from './types';
import { CODE_GS_SOURCE } from './gasSource';

// 기본 시간대 및 기본 시급
const DEFAULT_HOURLY_RATE = 12000;

export default function App() {
  // 메인 상단 탭 (시뮬레이터 / 시트 뷰어 / GAS 소스코드 / 배포 가이드)
  const [activeTab, setActiveTab] = useState<'preview' | 'sheets' | 'code' | 'guide'>('preview');

  // 데이터베이스 상태 (Google Sheets 모방 로컬 스테이트)
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('alba_sim_employees');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{
      employeeId: 'staff01',
      name: '알바생1',
      password: '1234',
      hourlyRate: DEFAULT_HOURLY_RATE,
      active: true,
      createdAt: '2026-09-07 09:00:00'
    }];
  });

  const [workLogs, setWorkLogs] = useState<WorkLog[]>(() => {
    const saved = localStorage.getItem('alba_sim_worklogs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    // 기본 샘플 데이터 (테스트 1, 2, 3 시나리오)
    return [
      {
        id: 'WL_1001',
        employeeId: 'staff01',
        employeeName: '알바생1',
        workDate: '2026-09-07', // 월요일
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
        workDate: '2026-09-09', // 수요일
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
        workDate: '2026-09-09', // 수요일 (같은 날 2번째 근무)
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
        workDate: '2026-09-11', // 금요일 (추가 근무로 주 10시간 30분 완성)
        startTime: '13:00',
        endTime: '17:30',
        minutesWorked: 270,
        workDescription: '온라인 이벤트 페이지 검수 및 배포 지원',
        createdAt: '2026-09-11 17:32:00'
      }
    ];
  });

  const [settlements, setSettlements] = useState<Settlement[]>(() => {
    const saved = localStorage.getItem('alba_sim_settlements');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // 로컬 스토리지 동기화
  useEffect(() => {
    localStorage.setItem('alba_sim_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('alba_sim_worklogs', JSON.stringify(workLogs));
  }, [workLogs]);

  useEffect(() => {
    localStorage.setItem('alba_sim_settlements', JSON.stringify(settlements));
  }, [settlements]);

  // 시뮬레이터 내 현재 로그인 세션
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    return {
      role: 'staff',
      id: 'staff01',
      name: '알바생1',
      hourlyRate: 12000
    };
  });

  // 모바일 앱 내부 뷰 상태 ('staffHome' | 'staffAdd' | 'staffHistory' | 'adminHome' | 'adminEmployees' | 'adminSettings' | 'login')
  const [mobileView, setMobileView] = useState<string>('staffHome');

  // 기준 주간 계산 (월요일 기준)
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date('2026-09-09T00:00:00'));

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

  const changeWeek = (deltaWeeks: number) => {
    setCurrentWeekDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaWeeks * 7);
      return next;
    });
  };

  // 알바생 폼 입력 상태
  const [inputDate, setInputDate] = useState('2026-09-09');
  const [inputStart, setInputStart] = useState('10:00');
  const [inputEnd, setInputEnd] = useState('12:30');
  const [inputDesc, setInputDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 로그인 폼 입력 상태
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // 관리자 정산 모달 상태
  const [selectedStaffForAdmin, setSelectedStaffForAdmin] = useState<string | null>(null);
  const [adminActualPayInput, setAdminActualPayInput] = useState<string>('');

  // 복사 피드백 상태
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 시간 및 급여 계산 헬퍼
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

  // 현재 로그인된 알바생의 이번 주 통계
  const currentStaffSummary = useMemo(() => {
    if (!currentUser || currentUser.role !== 'staff') return null;

    const filteredLogs = workLogs.filter(log => {
      return log.employeeId === currentUser.id &&
             log.workDate >= weekRange.weekStart &&
             log.workDate <= weekRange.weekEnd;
    });

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

  // 관리자 정산 뷰용 직원 요약 목록
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
  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = loginId.trim();
    const pw = loginPw.trim();

    if (!id || !pw) {
      showToast('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (id === 'admin' && pw === 'adi2026') {
      const adminUser: UserSession = { role: 'admin', id: 'admin', name: '관리자', hourlyRate: 0 };
      setCurrentUser(adminUser);
      setMobileView('adminHome');
      showToast('관리자로 로그인되었습니다.');
      setLoginId('');
      setLoginPw('');
      return;
    }

    const emp = employees.find(e => e.employeeId === id && e.password === pw);
    if (emp) {
      if (!emp.active) {
        showToast('비활성화된 계정입니다. 관리자에게 문의하세요.');
        return;
      }
      const staffUser: UserSession = {
        role: 'staff',
        id: emp.employeeId,
        name: emp.name,
        hourlyRate: emp.hourlyRate
      };
      setCurrentUser(staffUser);
      setMobileView('staffHome');
      showToast(`${emp.name}님 환영합니다.`);
      setLoginId('');
      setLoginPw('');
    } else {
      showToast('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setMobileView('login');
    showToast('로그아웃되었습니다.');
  };

  // 빠른 계정 전환 (시뮬레이터 전용)
  const switchSessionFast = (role: 'staff' | 'admin') => {
    if (role === 'admin') {
      setCurrentUser({ role: 'admin', id: 'admin', name: '관리자', hourlyRate: 0 });
      setMobileView('adminHome');
      showToast('관리자(admin) 모드로 전환되었습니다.');
    } else {
      setCurrentUser({ role: 'staff', id: 'staff01', name: '알바생1', hourlyRate: 12000 });
      setMobileView('staffHome');
      showToast('알바생(staff01) 모드로 전환되었습니다.');
    }
  };

  // 근무 기록 저장
  const handleSaveWorkLog = () => {
    if (!currentUser) return;
    if (!inputDate) {
      showToast('근무 날짜를 선택해 주세요.');
      return;
    }
    if (!inputStart || !inputEnd) {
      showToast('시작 시간과 종료 시간을 입력해 주세요.');
      return;
    }
    const minutes = calcMinutes(inputStart, inputEnd);
    if (minutes <= 0) {
      showToast('종료 시간을 시작 시간보다 늦게 설정해 주세요.');
      return;
    }
    if (!inputDesc.trim()) {
      showToast('한 일을 입력해 주세요.');
      return;
    }

    // 정산 완료 여부 확인
    const isSettled = currentStaffSummary?.settlement.status === 'completed';
    if (isSettled && currentUser.role !== 'admin') {
      showToast('해당 주는 이미 정산 완료되어 근무 기록을 추가할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newLog: WorkLog = {
        id: `WL_${Date.now()}`,
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        workDate: inputDate,
        startTime: inputStart,
        endTime: inputEnd,
        minutesWorked: minutes,
        workDescription: inputDesc.trim(),
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      setWorkLogs(prev => [newLog, ...prev]);
      setInputDesc('');
      setIsSubmitting(false);
      showToast('근무 기록이 저장되었습니다.');
      setMobileView('staffHome');
    }, 400);
  };

  // 근무 기록 삭제
  const handleDeleteLog = (logId: string) => {
    if (!window.confirm('이 근무 기록을 삭제하시겠습니까?')) return;
    setWorkLogs(prev => prev.filter(l => l.id !== logId));
    showToast('근무 기록이 삭제되었습니다.');
  };

  // 관리자 정산 완료 저장
  const handleCompleteSettlement = () => {
    if (!selectedStaffForAdmin) return;
    const summary = adminStaffSummaries.find(s => s.emp.employeeId === selectedStaffForAdmin);
    if (!summary) return;

    const actual = Number(adminActualPayInput);
    if (adminActualPayInput === '' || isNaN(actual) || actual < 0) {
      showToast('실제 입금액을 0원 이상의 숫자로 올바르게 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newSettlement: Settlement = {
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

      setSettlements(prev => {
        const filtered = prev.filter(s => 
          !(s.employeeId === newSettlement.employeeId && s.weekStart === newSettlement.weekStart)
        );
        return [newSettlement, ...filtered];
      });

      setIsSubmitting(false);
      setSelectedStaffForAdmin(null);
      showToast(`정산이 완료되었습니다! (예상 ${formatWon(summary.expectedPay)} → 실제 입금 ${formatWon(actual)})`);
    }, 400);
  };

  // 테스트 시나리오 원클릭 주입 함수
  const injectScenarioData = () => {
    // 2026년 9월 7일 (월) ~ 9월 13일 (일) 주차 맞추기
    setCurrentWeekDate(new Date('2026-09-09T00:00:00'));

    const testLogs: WorkLog[] = [
      {
        id: 'WL_SCENARIO_1',
        employeeId: 'staff01',
        employeeName: '알바생1',
        workDate: '2026-09-07',
        startTime: '10:00',
        endTime: '12:30',
        minutesWorked: 150, // 2시간 30분
        workDescription: '강의자료 PPT 수정',
        createdAt: '2026-09-07 12:30:00'
      },
      {
        id: 'WL_SCENARIO_2_A',
        employeeId: 'staff01',
        employeeName: '알바생1',
        workDate: '2026-09-09',
        startTime: '09:00',
        endTime: '11:00',
        minutesWorked: 120, // 2시간
        workDescription: '블로그 자료 정리',
        createdAt: '2026-09-09 11:00:00'
      },
      {
        id: 'WL_SCENARIO_2_B',
        employeeId: 'staff01',
        employeeName: '알바생1',
        workDate: '2026-09-09',
        startTime: '14:00',
        endTime: '17:00',
        minutesWorked: 180, // 3시간
        workDescription: '카드뉴스 제작',
        createdAt: '2026-09-09 17:00:00'
      },
      {
        id: 'WL_SCENARIO_3_EXT',
        employeeId: 'staff01',
        employeeName: '알바생1',
        workDate: '2026-09-11',
        startTime: '13:00',
        endTime: '16:00',
        minutesWorked: 180, // 3시간 -> 총 630분 = 10시간 30분
        workDescription: '영상 자막 작업 및 유튜브 업로드',
        createdAt: '2026-09-11 16:00:00'
      }
    ];

    setWorkLogs(testLogs);
    // 아직 정산 전 상태로 초기화
    setSettlements([]);
    showToast('테스트 1, 2, 3 시나리오 데이터가 주입되었습니다! (총 10시간 30분, 예상 급여 126,000원)');
  };

  const previewMinutes = calcMinutes(inputStart, inputEnd);
  const previewPay = Math.max(0, Math.round((previewMinutes / 60) * (currentUser?.hourlyRate || DEFAULT_HOURLY_RATE)));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col antialiased">
      {/* 최상단 네비게이션 헤더 */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              알
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">알바 주간정산</h1>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                  GAS Web App
                </span>
              </div>
              <p className="text-xs text-slate-400">Google Sheets 연동 모바일 웹앱 풀스택 솔루션</p>
            </div>
          </div>

          {/* 중앙 탭 스위처 */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'preview' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              모바일 실시간 체험
            </button>
            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sheets' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Google Sheets 뷰어
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'code' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              GAS 전체 소스코드
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'guide' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              배포 및 가이드북 (1~18)
            </button>
          </div>

          {/* 우측 빠른 액션 버튼 */}
          <div className="flex items-center gap-2">
            <button 
              onClick={injectScenarioData}
              className="flex items-center gap-1.5 text-xs bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              title="테스트 1, 2, 3 시나리오 자동 주입"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              테스트 데이터 주입
            </button>
          </div>
        </div>
      </header>

      {/* 메인 탭 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col">
        {/* ============================================================== */}
        {/* TAB 1: 모바일 실시간 체험 (Interactive Mobile Simulator)     */}
        {/* ============================================================== */}
        {activeTab === 'preview' && (
          <div className="flex-1 bg-slate-900/60 py-6 px-4 flex flex-col items-center justify-center">
            {/* 시뮬레이터 상단 조작 컨트롤러 */}
            <div className="w-full max-w-md mb-3 flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">빠른 역할 전환:</span>
                <button
                  onClick={() => switchSessionFast('staff')}
                  className={`px-2 py-1 rounded-md font-bold transition-all ${
                    currentUser?.role === 'staff' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  알바생
                </button>
                <button
                  onClick={() => switchSessionFast('admin')}
                  className={`px-2 py-1 rounded-md font-bold transition-all ${
                    currentUser?.role === 'admin' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  관리자
                </button>
              </div>

              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[11px]">390px Mobile View</span>
              </div>
            </div>

            {/* 모바일 폰 목업 프레임 */}
            <div className="relative w-full max-w-[420px] h-[780px] bg-white rounded-[36px] shadow-2xl border-[8px] border-slate-800 overflow-hidden flex flex-col text-slate-900">
              {/* 스마트폰 상단 노치/스피커 바 */}
              <div className="w-full bg-slate-900 h-6 flex items-center justify-center relative select-none">
                <div className="w-20 h-3.5 bg-slate-950 rounded-b-xl" />
              </div>

              {/* 모바일 앱 본체 */}
              <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden relative">
                {/* 1. 모바일 앱 헤더 */}
                <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      currentUser?.role === 'admin' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : currentUser?.role === 'staff' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {currentUser ? (currentUser.role === 'admin' ? '관리자' : '직원') : '로그인 필요'}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">알바 주간정산</h2>
                  </div>

                  {currentUser && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {currentUser.name}
                      </span>
                      <button 
                        onClick={handleLogout}
                        className="text-xs text-slate-500 hover:text-slate-800 p-1"
                        title="로그아웃"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </header>

                {/* 2. 모바일 스크롤 뷰 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  {/* [A] 로그인 뷰 */}
                  {(!currentUser || mobileView === 'login') && (
                    <div className="pt-8">
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
                          <Clock className="w-7 h-7 stroke-[2.2]" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">알바 주간정산</h3>
                        <p className="text-xs text-slate-500 mt-1">간편한 근무 기록과 정확한 주간 급여 정산</p>
                      </div>

                      <form onSubmit={handleLoginSubmit} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">아이디</label>
                          <input 
                            type="text" 
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="아이디를 입력하세요" 
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">비밀번호</label>
                          <input 
                            type="password" 
                            value={loginPw}
                            onChange={(e) => setLoginPw(e.target.value)}
                            placeholder="비밀번호를 입력하세요" 
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
                        >
                          로그인
                        </button>
                      </form>

                      <div className="mt-4 p-3.5 bg-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
                        <div className="font-bold text-slate-700">💡 테스트 계정 안내</div>
                        <div>• 알바생: ID <code className="bg-white px-1 rounded text-blue-600 font-mono">staff01</code> / PW <code className="bg-white px-1 rounded font-mono">1234</code></div>
                        <div>• 관리자: ID <code className="bg-white px-1 rounded text-rose-600 font-mono">admin</code> / PW <code className="bg-white px-1 rounded font-mono">adi2026</code></div>
                      </div>
                    </div>
                  )}

                  {/* [B] 알바생 - 홈 뷰 */}
                  {currentUser?.role === 'staff' && mobileView === 'staffHome' && (
                    <div className="space-y-4">
                      {/* 인사말 */}
                      <div>
                        <span className="text-xs font-semibold text-slate-500">알바생 대시보드</span>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          안녕하세요, {currentUser.name}님
                        </h3>
                      </div>

                      {/* 주간 네비게이터 */}
                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
                        <button 
                          onClick={() => changeWeek(-1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                        </button>
                        <span className="text-xs font-bold text-slate-900">{weekRange.displayLabel}</span>
                        <button 
                          onClick={() => changeWeek(1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          다음 주 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 핵심 이번 주 요약 카드 */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 border-l-4 border-l-blue-600">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">이번 주 정산</span>
                          {currentStaffSummary?.settlement.status === 'completed' ? (
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
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">총 근무시간</span>
                            <span className="text-lg font-black text-blue-600">
                              {formatHoursAndMinutes(currentStaffSummary?.totalMinutes || 0)}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">예상 급여</span>
                            <span className="text-lg font-black text-slate-900">
                              {formatWon(currentStaffSummary?.expectedPay || 0)}
                            </span>
                          </div>
                        </div>

                        {/* 실제 입금액 표시 */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">실제 입금액</span>
                            <span className="text-[11px] text-slate-400">관리자 최종 정산 지급액</span>
                          </div>
                          <div className="text-xl font-black text-emerald-600">
                            {currentStaffSummary?.settlement.status === 'completed'
                              ? formatWon(currentStaffSummary.settlement.actualPay)
                              : '-'}
                          </div>
                        </div>
                      </div>

                      {/* 오늘 근무 기록하기 바로가기 버튼 */}
                      <button
                        onClick={() => setMobileView('staffAdd')}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        오늘 근무 기록하기
                      </button>

                      {/* 최근 근무 기록 미리보기 */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-700">이번 주 근무 기록 ({currentStaffSummary?.logs.length || 0}건)</h4>
                          <button 
                            onClick={() => setMobileView('staffHistory')}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            전체보기 ›
                          </button>
                        </div>

                        {currentStaffSummary?.logs && currentStaffSummary.logs.length > 0 ? (
                          <div className="space-y-2">
                            {currentStaffSummary.logs.slice(0, 3).map(log => (
                              <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-bold text-blue-600">{log.workDate}</span>
                                  <span className="font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                                    {formatHoursAndMinutes(log.minutesWorked)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mb-1.5">{log.startTime} ~ {log.endTime}</div>
                                <div className="text-xs bg-slate-50 p-2 rounded-lg text-slate-800">
                                  {log.workDescription}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                            <Clock className="w-8 h-8 mx-auto mb-1 text-slate-300 stroke-[1.5]" />
                            <p className="font-bold text-slate-600">이번 주에 아직 등록된 근무가 없습니다.</p>
                            <p className="text-[11px] mt-0.5">근무한 내용을 기록해 주세요.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* [C] 알바생 - 근무 기록 입력 뷰 */}
                  {currentUser?.role === 'staff' && mobileView === 'staffAdd' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">근무 기록하기</h3>
                        <p className="text-xs text-slate-500">날짜와 시간, 업무 내용을 등록하세요.</p>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">근무 날짜</label>
                          <input
                            type="date"
                            value={inputDate}
                            onChange={(e) => setInputDate(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">근무 시간 (시작 ~ 종료)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">시작 시간</span>
                              <input
                                type="time"
                                value={inputStart}
                                onChange={(e) => setInputStart(e.target.value)}
                                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block mb-0.5">종료 시간</span>
                              <input
                                type="time"
                                value={inputEnd}
                                onChange={(e) => setInputEnd(e.target.value)}
                                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">한 일 (업무 상세 내용)</label>
                          <textarea
                            rows={3}
                            value={inputDesc}
                            onChange={(e) => setInputDesc(e.target.value)}
                            placeholder="예: 카드뉴스 디자인 수정, 강의자료 PPT 수정, 영상 자막 작업 등"
                            className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-600 resize-none"
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
                            '근무 기록하기'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* [D] 알바생 - 내 기록 목록 뷰 */}
                  {currentUser?.role === 'staff' && mobileView === 'staffHistory' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
                        <button 
                          onClick={() => changeWeek(-1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                        </button>
                        <span className="text-xs font-bold text-slate-900">{weekRange.displayLabel}</span>
                        <button 
                          onClick={() => changeWeek(1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          다음 주 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {currentStaffSummary?.logs && currentStaffSummary.logs.length > 0 ? (
                        <div className="space-y-2.5">
                          {currentStaffSummary.logs.map(log => {
                            const isSettled = currentStaffSummary.settlement.status === 'completed';
                            return (
                              <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-bold text-blue-600">{log.workDate}</span>
                                  <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                                    {formatHoursAndMinutes(log.minutesWorked)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mb-2">{log.startTime} ~ {log.endTime}</div>
                                <div className="text-xs bg-slate-50 p-2.5 rounded-lg text-slate-800 leading-relaxed">
                                  {log.workDescription}
                                </div>
                                <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                                  {isSettled ? (
                                    <span className="text-[11px] text-slate-400">정산 완료 (수정 불가)</span>
                                  ) : (
                                    <button
                                      onClick={() => handleDeleteLog(log.id)}
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
                        <div className="text-center py-10 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                          <p className="font-bold text-slate-600">등록된 근무 기록이 없습니다.</p>
                          <p className="text-[11px] mt-0.5">해당 주차에 근무 기록이 존재하지 않습니다.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* [E] 관리자 - 정산 홈 뷰 */}
                  {currentUser?.role === 'admin' && mobileView === 'adminHome' && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-500">관리자 페이지</span>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          이번 주 정산
                        </h3>
                      </div>

                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
                        <button 
                          onClick={() => changeWeek(-1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> 이전 주
                        </button>
                        <span className="text-xs font-bold text-slate-900">{weekRange.displayLabel}</span>
                        <button 
                          onClick={() => changeWeek(1)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-0.5"
                        >
                          다음 주 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 직원별 카드 목록 */}
                      <div className="space-y-3">
                        {adminStaffSummaries.map(({ emp, logs, totalMinutes, expectedPay, settlement }) => {
                          const isSettled = settlement.status === 'completed';
                          return (
                            <div 
                              key={emp.employeeId}
                              onClick={() => {
                                setSelectedStaffForAdmin(emp.employeeId);
                                setAdminActualPayInput(isSettled ? String(settlement.actualPay) : String(expectedPay));
                              }}
                              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-blue-400 cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-slate-900">{emp.name}</span>
                                  <span className="text-xs text-slate-400 font-mono">({emp.employeeId})</span>
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
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-500 block">총 근무시간</span>
                                  <span className="text-sm font-bold text-blue-600">{formatHoursAndMinutes(totalMinutes)}</span>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <span className="text-[10px] text-slate-500 block">예상 급여</span>
                                  <span className="text-sm font-bold text-slate-900">{formatWon(expectedPay)}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                <span className="text-slate-500">
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

                  {/* [F] 관리자 - 직원 관리 뷰 */}
                  {currentUser?.role === 'admin' && mobileView === 'adminEmployees' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">직원 관리</h3>
                          <p className="text-xs text-slate-500">알바생 계정 및 기본 시급 관리</p>
                        </div>
                        <button
                          onClick={() => {
                            const name = prompt('추가할 직원의 이름을 입력하세요:');
                            if (!name) return;
                            const id = prompt('직원 ID를 입력하세요 (영문/숫자):');
                            if (!id) return;
                            const pw = prompt('초기 비밀번호를 입력하세요:');
                            if (!pw) return;
                            const newEmp: Employee = {
                              employeeId: id.trim(),
                              name: name.trim(),
                              password: pw.trim(),
                              hourlyRate: 12000,
                              active: true,
                              createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
                            };
                            setEmployees(prev => [...prev, newEmp]);
                            showToast(`${name} 직원이 추가되었습니다.`);
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" /> 직원 추가
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {employees.map(emp => (
                          <div key={emp.employeeId} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="font-bold text-slate-900 text-sm">{emp.name}</span>
                                <span className="text-xs text-slate-400 ml-1.5 font-mono">({emp.employeeId})</span>
                              </div>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                emp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {emp.active ? '재직중' : '비활성'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 mt-2">
                              <span>시급: <b className="text-slate-800">{formatWon(emp.hourlyRate)}</b></span>
                              <button
                                onClick={() => {
                                  setEmployees(prev => prev.map(e => 
                                    e.employeeId === emp.employeeId ? { ...e, active: !e.active } : e
                                  ));
                                  showToast(`${emp.name} 직원의 상태가 변경되었습니다.`);
                                }}
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

                  {/* [G] 관리자 - 설정 뷰 */}
                  {currentUser?.role === 'admin' && mobileView === 'adminSettings' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900">시스템 설정</h3>

                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        <span className="text-xs font-bold text-slate-700 block mb-1">관리자 계정 보안</span>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          관리자 아이디(<code className="bg-slate-100 px-1 rounded font-mono">admin</code>)와 비밀번호(<code className="bg-slate-100 px-1 rounded font-mono">adi2026</code>)는 
                          Google Apps Script 서버 측 <code>PropertiesService</code>에서 안전하게 격리 보관됩니다.
                        </p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">테스트 데이터 및 시트 초기화</span>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          테스트용 직원(staff01) 및 주간 근무 기록(월요일 10:00~12:30, 수요일 09:00~11:00, 14:00~17:00 등)을 재설정합니다.
                        </p>
                        <button
                          onClick={injectScenarioData}
                          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
                        >
                          샘플 테스트 데이터 재설정
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. 모바일 관리자 상세 & 정산 모달 */}
                {selectedStaffForAdmin && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-end z-50">
                    <div className="w-full bg-white rounded-t-3xl p-5 max-h-[85%] overflow-y-auto space-y-4 shadow-2xl">
                      {(() => {
                        const summary = adminStaffSummaries.find(s => s.emp.employeeId === selectedStaffForAdmin);
                        if (!summary) return null;
                        const isSettled = summary.settlement.status === 'completed';

                        return (
                          <>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div>
                                <h4 className="text-base font-bold text-slate-900">{summary.emp.name} 주간 정산</h4>
                                <span className="text-xs text-slate-400">{weekRange.displayLabel}</span>
                              </div>
                              <button
                                onClick={() => setSelectedStaffForAdmin(null)}
                                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-500 block">총 근무시간</span>
                                <span className="text-sm font-black text-blue-600">
                                  {formatHoursAndMinutes(summary.totalMinutes)}
                                </span>
                              </div>
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-500 block">예상 급여</span>
                                <span className="text-sm font-black text-slate-900">
                                  {formatWon(summary.expectedPay)}
                                </span>
                              </div>
                            </div>

                            {/* 근무 기록 목록 */}
                            <div>
                              <span className="text-xs font-bold text-slate-700 block mb-1.5">상세 근무 기록 ({summary.logs.length}건)</span>
                              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                                {summary.logs.map(l => (
                                  <div key={l.id} className="bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                                    <div className="flex justify-between font-bold text-slate-800">
                                      <span>{l.workDate} ({l.startTime}~{l.endTime})</span>
                                      <span className="text-blue-600">{formatHoursAndMinutes(l.minutesWorked)}</span>
                                    </div>
                                    <p className="text-slate-600 mt-1">{l.workDescription}</p>
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
                                  ※ 예상 급여({formatWon(summary.expectedPay)})와 실제 입금액은 각각 별도로 모두 저장됩니다.
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

                {/* 4. 모바일 하단 내비게이션 바 (직원: 3개 / 관리자: 3개) */}
                {currentUser && (
                  <nav className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40">
                    {currentUser.role === 'staff' ? (
                      <>
                        <button
                          onClick={() => setMobileView('staffHome')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'staffHome' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Clock className="w-5 h-5" />
                          <span>홈</span>
                        </button>
                        <button
                          onClick={() => setMobileView('staffAdd')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'staffAdd' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Plus className="w-5 h-5" />
                          <span>근무 기록</span>
                        </button>
                        <button
                          onClick={() => setMobileView('staffHistory')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'staffHistory' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Calendar className="w-5 h-5" />
                          <span>내 기록</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setMobileView('adminHome')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'adminHome' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <DollarSign className="w-5 h-5" />
                          <span>정산</span>
                        </button>
                        <button
                          onClick={() => setMobileView('adminEmployees')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'adminEmployees' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <User className="w-5 h-5" />
                          <span>직원</span>
                        </button>
                        <button
                          onClick={() => setMobileView('adminSettings')}
                          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                            mobileView === 'adminSettings' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Shield className="w-5 h-5" />
                          <span>설정</span>
                        </button>
                      </>
                    )}
                  </nav>
                )}

                {/* 모바일 토스트 알림 */}
                {toastMessage && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-bounce pointer-events-none text-center max-w-[85%]">
                    {toastMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: Google Sheets 실시간 데이터 뷰어 (Live DB Inspection)  */}
        {/* ============================================================== */}
        {activeTab === 'sheets' && (
          <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">Google Spreadsheet 실시간 연동 뷰어</h2>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Live Data 동기화
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  모바일 앱에서 저장하거나 정산한 내역이 아래 3개 시트에 실시간으로 기록되는 모습을 확인하세요.
                </p>
              </div>

              <button
                onClick={injectScenarioData}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                테스트 1/2/3 시나리오 데이터 로드
              </button>
            </div>

            {/* 시트 1: WorkLogs */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-sm font-bold text-white">[WorkLogs] 시트</h3>
                  <span className="text-xs text-slate-400">({workLogs.length}개의 기록)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  컬럼: id, employeeId, employeeName, workDate, startTime, endTime, minutesWorked, workDescription, createdAt
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="p-2.5 font-bold">id</th>
                      <th className="p-2.5 font-bold">employeeId</th>
                      <th className="p-2.5 font-bold">직원명</th>
                      <th className="p-2.5 font-bold">workDate</th>
                      <th className="p-2.5 font-bold">시작/종료</th>
                      <th className="p-2.5 font-bold">근무시간 (분)</th>
                      <th className="p-2.5 font-bold">한 일 (workDescription)</th>
                      <th className="p-2.5 font-bold">createdAt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {workLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="p-2.5 text-blue-400">{log.id}</td>
                        <td className="p-2.5">{log.employeeId}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-200">{log.employeeName}</td>
                        <td className="p-2.5 text-amber-300">{log.workDate}</td>
                        <td className="p-2.5">{log.startTime} ~ {log.endTime}</td>
                        <td className="p-2.5 text-emerald-400 font-bold">{log.minutesWorked}분 ({formatHoursAndMinutes(log.minutesWorked)})</td>
                        <td className="p-2.5 font-sans text-slate-200 max-w-xs truncate">{log.workDescription}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{log.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 시트 2: Settlements */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-white">[Settlements] 시트</h3>
                  <span className="text-xs text-slate-400">({settlements.length}건의 정산 내역)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  컬럼: settlementId, employeeId, weekStart, weekEnd, totalMinutes, expectedPay, actualPay, status, settledAt
                </span>
              </div>

              {settlements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <th className="p-2.5 font-bold">settlementId</th>
                        <th className="p-2.5 font-bold">employeeId</th>
                        <th className="p-2.5 font-bold">주간 기간 (weekStart ~ weekEnd)</th>
                        <th className="p-2.5 font-bold">총 근무시간</th>
                        <th className="p-2.5 font-bold text-blue-300">예상 급여 (expectedPay)</th>
                        <th className="p-2.5 font-bold text-emerald-300">실제 입금액 (actualPay)</th>
                        <th className="p-2.5 font-bold">상태 (status)</th>
                        <th className="p-2.5 font-bold">정산 일시 (settledAt)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {settlements.map(s => (
                        <tr key={s.settlementId} className="hover:bg-slate-900/40">
                          <td className="p-2.5 text-purple-400">{s.settlementId}</td>
                          <td className="p-2.5">{s.employeeId}</td>
                          <td className="p-2.5">{s.weekStart} ~ {s.weekEnd}</td>
                          <td className="p-2.5">{formatHoursAndMinutes(s.totalMinutes)}</td>
                          <td className="p-2.5 font-bold text-blue-400">{formatWon(s.expectedPay)}</td>
                          <td className="p-2.5 font-bold text-emerald-400">{formatWon(s.actualPay)}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {s.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500 text-[11px]">{s.settledAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/30 rounded-xl">
                  아직 관리자가 완료한 정산 내역이 없습니다. (모바일 시뮬레이터 관리자 화면에서 '이번 주 정산 완료'를 실행해 보세요)
                </div>
              )}
            </div>

            {/* 시트 3: Employees */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-bold text-white">[Employees] 시트</h3>
                  <span className="text-xs text-slate-400">({employees.length}명)</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  컬럼: employeeId, name, password, hourlyRate, active, createdAt
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="p-2.5 font-bold">employeeId</th>
                      <th className="p-2.5 font-bold">name</th>
                      <th className="p-2.5 font-bold">password</th>
                      <th className="p-2.5 font-bold">hourlyRate</th>
                      <th className="p-2.5 font-bold">active</th>
                      <th className="p-2.5 font-bold">createdAt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {employees.map(emp => (
                      <tr key={emp.employeeId} className="hover:bg-slate-900/40">
                        <td className="p-2.5 text-amber-300 font-bold">{emp.employeeId}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-200">{emp.name}</td>
                        <td className="p-2.5 text-slate-500">••••</td>
                        <td className="p-2.5 text-emerald-400 font-bold">{formatWon(emp.hourlyRate)}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            emp.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {String(emp.active)}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{emp.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: Google Apps Script 배포 전체 소스코드                   */}
        {/* ============================================================== */}
        {activeTab === 'code' && (
          <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Google Apps Script 배포 전체 소스코드</h2>
              <p className="text-xs text-slate-400 mt-1">
                Google Apps Script 편집기에 복사하여 바로 배포할 수 있는 100% 완전한 전체 코드입니다.
              </p>
            </div>

            {/* Code.gs 박스 */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
              <div className="bg-slate-900/80 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xs font-bold text-white">Code.gs</span>
                  <span className="text-[11px] text-slate-400">스프레드시트 DB 연동, 인증, CRUD 백엔드</span>
                </div>
                <button
                  onClick={() => copyToClipboard(CODE_GS_SOURCE, 'codegs')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copiedKey === 'codegs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'codegs' ? '복사 완료!' : 'Code.gs 전체 복사'}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 max-h-96 overflow-y-auto leading-relaxed bg-slate-950">
                {CODE_GS_SOURCE}
              </pre>
            </div>

            {/* Index.html 안내 */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Index.html 전체 코드</h3>
                <p className="text-xs text-slate-400">
                  프로젝트 내 <code className="text-blue-300">/gas/Index.html</code> 파일로 온전히 저장되어 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetch('/gas/Index.html')
                      .then(r => r.text())
                      .then(t => copyToClipboard(t, 'indexhtml'))
                      .catch(() => showToast('Index.html 로드 실패'));
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  {copiedKey === 'indexhtml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'indexhtml' ? 'Index.html 복사 완료!' : 'Index.html 전체 복사'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: 배포 및 사용 가이드북 (1~18)                            */}
        {/* ============================================================== */}
        {activeTab === 'guide' && (
          <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black text-white tracking-tight">
                알바 주간정산 웹앱 배포 및 운영 가이드 (1~18)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Google Sheets와 Google Apps Script 무료 웹앱을 활용한 완벽 배포 절차
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs font-bold text-blue-400">1. 전체 시스템 구조</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • <b>클라이언트:</b> HTML + CSS + Vanilla JS (Mobile First, 360~430px 기준, 최대 480px)<br />
                  • <b>백엔드:</b> Google Apps Script HTML Service (`google.script.run`)<br />
                  • <b>데이터베이스:</b> Google Spreadsheet (Employees, WorkLogs, Settlements 시트)<br />
                  • <b>인증/보안:</b> 관리자 계정은 <code>PropertiesService</code>에서 안전하게 격리 보관
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2">
                <span className="text-xs font-bold text-blue-400">2. Google Sheets 구조</span>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  • <b>[Employees]:</b> employeeId, name, password, hourlyRate, active, createdAt<br />
                  • <b>[WorkLogs]:</b> id, employeeId, employeeName, workDate, startTime, endTime, minutesWorked, workDescription, createdAt<br />
                  • <b>[Settlements]:</b> settlementId, employeeId, weekStart, weekEnd, totalMinutes, expectedPay, actualPay, status, settledAt
                </p>
              </div>
            </div>

            {/* 핵심 셋업 단계 카드 */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                단계별 배포 및 설정 (9단계 ~ 14단계)
              </h3>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <b className="text-white text-sm block mb-1">Step 1: Google Spreadsheet 생성 및 ID 연결</b>
                  <p className="mb-2">Google Drive에서 새 스프레드시트를 생성하고, URL 주소창에서 ID를 복사합니다:</p>
                  <code className="block bg-slate-950 p-2 rounded text-blue-300 font-mono text-[11px]">
                    https://docs.google.com/spreadsheets/d/<b>[여기에_있는_ID_문자열]</b>/edit
                  </code>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <b className="text-white text-sm block mb-1">Step 2: Apps Script 프로젝트 생성 및 파일 작성</b>
                  <p className="mb-2">
                    스프레드시트 상단 메뉴 [확장 프로그램] → [Apps Script] 클릭 후:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                    <li><code>Code.gs</code>에 제공된 전체 백엔드 코드를 복사하여 붙여넣습니다.</li>
                    <li>좌측 [+] 버튼 클릭 → [HTML] 선택 후 파일 이름을 <code>Index</code>로 입력합니다.</li>
                    <li><code>Index.html</code>에 제공된 프론트엔드 코드를 전체 복사하여 붙여넣고 저장(Ctrl+S)합니다.</li>
                  </ol>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <b className="text-white text-sm block mb-1">Step 3: setupSpreadsheet() 및 setupAdmin() 실행</b>
                  <p className="mb-2">
                    상단 함수 드롭다운에서 <code>setupSpreadsheet</code>를 선택하고 [실행] 버튼을 누릅니다.
                    최초 실행 시 Google 권한 승인 창이 뜨면 <b>[고급] → [안전하지 않은 페이지로 이동] → [허용]</b>을 누릅니다.
                    이어서 <code>setupAdmin</code>을 실행하여 관리자 계정(admin / adi2026)을 등록합니다.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800/80">
                  <b className="text-white text-sm block mb-1">Step 4: 웹 앱으로 배포 (새 배포)</b>
                  <p className="mb-2">
                    우측 상단 <b>[배포] → [새 배포]</b> 클릭:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                    <li>유형 선택: <b>웹 앱</b></li>
                    <li>다음 사용자 권한으로 실행: <b>나 (내 계정)</b></li>
                    <li>액세스 권한이 있는 사용자: <b>모든 사용자 (Anyone)</b> (알바생이 본인 기기에서 로그인할 수 있도록 설정)</li>
                    <li>[배포] 버튼 클릭 후 발급된 <b>웹 앱 URL</b>을 복사하여 알바생과 공유합니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
