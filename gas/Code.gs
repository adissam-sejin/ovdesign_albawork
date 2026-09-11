/**
 * ====================================================================
 * 알바 주간정산 - Google Apps Script 백엔드 (Code.gs)
 * ====================================================================
 * 버전: 1.0.0
 * 시간대: Asia/Seoul
 * 대상: Google Apps Script Web App
 */

// ====================================================================
// 1. 전역 설정 및 상수 정의
// ====================================================================
var TIMEZONE = 'Asia/Seoul';
var DEFAULT_HOURLY_RATE = 12000;

// 시트 이름 상수
var SHEET_NAMES = {
  EMPLOYEES: 'Employees',
  WORK_LOGS: 'WorkLogs',
  SETTLEMENTS: 'Settlements'
};

// 각 시트별 헤더 정의
var HEADERS = {
  EMPLOYEES: ['employeeId', 'name', 'password', 'hourlyRate', 'active', 'createdAt'],
  WORK_LOGS: ['id', 'employeeId', 'employeeName', 'workDate', 'startTime', 'endTime', 'minutesWorked', 'workDescription', 'createdAt'],
  SETTLEMENTS: ['settlementId', 'employeeId', 'weekStart', 'weekEnd', 'totalMinutes', 'expectedPay', 'actualPay', 'status', 'settledAt']
};

/**
 * 활성 스프레드시트를 안전하게 가져옵니다.
 * 바인딩된 스프레드시트가 없으면 Script Properties의 SPREADSHEET_ID를 참조합니다.
 */
function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    // 컨테이너 독립형(Standalone) 프로젝트인 경우 아래에서 처리
  }
  
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  throw new Error('연결된 Google 스프레드시트가 없습니다. setupSpreadsheet()를 실행하거나 Script Properties에 SPREADSHEET_ID를 등록해주세요.');
}

// ====================================================================
// 2. Web App 엔트리포인트 (doGet)
// ====================================================================
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  var output = template.evaluate();
  
  output.setTitle('알바 주간정산');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  return output;
}

// ====================================================================
// 3. 초기 설정 및 셋업 함수 (setupSpreadsheet, setupAdmin, setupSampleData)
// ====================================================================

/**
 * 8. 초기 설정: 스프레드시트에 필수 시트 및 헤더 자동 생성
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet();
  
  Object.keys(SHEET_NAMES).forEach(function(key) {
    var sheetName = SHEET_NAMES[key];
    var sheet = ss.getSheetByName(sheetName);
    var headerList = HEADERS[key];
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headerList);
      
      // 헤더 스타일링 (가독성 향상)
      var headerRange = sheet.getRange(1, 1, 1, headerList.length);
      headerRange.setBackground('#1E293B');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    } else {
      // 시트가 이미 존재할 때 헤더가 비어있으면 채움
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headerList);
        var headerRange = sheet.getRange(1, 1, 1, headerList.length);
        headerRange.setBackground('#1E293B');
        headerRange.setFontColor('#FFFFFF');
        headerRange.setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
    }
  });
  
  return { success: true, message: 'Google Sheets 초기화가 완료되었습니다. (Employees, WorkLogs, Settlements)' };
}

/**
 * 5. 관리자 계정 초기 설정: PropertiesService에 관리자 정보 저장
 */
function setupAdmin() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'ADMIN_ID': 'admin',
    'ADMIN_PASSWORD': 'adi2026'
  });
  return { success: true, message: '관리자 계정이 성공적으로 설정되었습니다. (ID: admin)' };
}

/**
 * 35 & 36. 테스트용 샘플 직원 및 근무 기록 생성 함수
 */
function setupSampleData() {
  setupSpreadsheet();
  setupAdmin();
  
  var ss = getSpreadsheet();
  var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  var logSheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
  
  // 1. 직원 추가 (중복 확인)
  var empData = empSheet.getDataRange().getValues();
  var exists = false;
  for (var i = 1; i < empData.length; i++) {
    if (empData[i][0] === 'staff01') {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    empSheet.appendRow([
      'staff01',
      '알바생1',
      '1234',
      DEFAULT_HOURLY_RATE,
      true,
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
    ]);
  }
  
  // 2. 현재 주의 월요일, 수요일 구하기
  var now = new Date();
  var currentDay = now.getDay(); // 0: Sun, 1: Mon, ...
  var diffToMon = (currentDay === 0 ? -6 : 1 - currentDay);
  var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  var wednesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
  
  var monStr = Utilities.formatDate(monday, TIMEZONE, 'yyyy-MM-dd');
  var wedStr = Utilities.formatDate(wednesday, TIMEZONE, 'yyyy-MM-dd');
  var nowStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  
  // 샘플 기록 삽입 (테스트 1, 테스트 2 시나리오)
  var sampleLogs = [
    ['LOG_' + new Date().getTime() + '_1', 'staff01', '알바생1', monStr, '10:00', '12:30', 150, '강의자료 PPT 수정', nowStr],
    ['LOG_' + new Date().getTime() + '_2', 'staff01', '알바생1', wedStr, '09:00', '11:00', 120, '블로그 자료 정리', nowStr],
    ['LOG_' + new Date().getTime() + '_3', 'staff01', '알바생1', wedStr, '14:00', '17:00', 180, '카드뉴스 제작', nowStr]
  ];
  
  sampleLogs.forEach(function(row) {
    logSheet.appendRow(row);
  });
  
  return { success: true, message: '샘플 직원(staff01 / 1234) 및 근무 기록 3건이 성공적으로 생성되었습니다.' };
}

// ====================================================================
// 4. 인증 및 세션 관리 (로그인 검증)
// ====================================================================
function loginUser(id, password) {
  if (!id || !password) {
    return { success: false, message: '아이디와 비밀번호를 모두 입력해 주세요.' };
  }
  
  var cleanId = String(id).trim();
  var cleanPass = String(password).trim();
  
  // 1. 관리자 검증 (PropertiesService 확인)
  var props = PropertiesService.getScriptProperties();
  var adminId = props.getProperty('ADMIN_ID') || 'admin';
  var adminPassword = props.getProperty('ADMIN_PASSWORD') || 'adi2026';
  
  if (cleanId === adminId && cleanPass === adminPassword) {
    return {
      success: true,
      user: {
        role: 'admin',
        id: adminId,
        name: '관리자',
        hourlyRate: 0
      }
    };
  }
  
  // 2. 직원 계정 검증 (Employees 시트 확인)
  var ss = getSpreadsheet();
  var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  if (!empSheet) {
    setupSpreadsheet();
    empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
  }
  
  var data = empSheet.getDataRange().getValues();
  // data[0]은 헤더: ['employeeId', 'name', 'password', 'hourlyRate', 'active', 'createdAt']
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var empId = String(row[0]).trim();
    var empName = String(row[1]).trim();
    var empPw = String(row[2]).trim();
    var hourlyRate = Number(row[3]) || DEFAULT_HOURLY_RATE;
    var isActive = (row[4] === true || String(row[4]).toLowerCase() === 'true');
    
    if (empId === cleanId) {
      if (!isActive) {
        return { success: false, message: '비활성화된 계정입니다. 관리자에게 문의하세요.' };
      }
      if (empPw === cleanPass) {
        return {
          success: true,
          user: {
            role: 'staff',
            id: empId,
            name: empName,
            hourlyRate: hourlyRate
          }
        };
      } else {
        return { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };
      }
    }
  }
  
  return { success: false, message: '존재하지 않는 사용자 계정입니다.' };
}

function logoutUser() {
  return { success: true, message: '로그아웃되었습니다.' };
}

// ====================================================================
// 5. 날짜 및 시간 헬퍼 유틸리티
// ====================================================================
function calculateMinutes(startTime, endTime) {
  var startParts = startTime.split(':').map(Number);
  var endParts = endTime.split(':').map(Number);
  
  var startMin = startParts[0] * 60 + startParts[1];
  var endMin = endParts[0] * 60 + endParts[1];
  
  return endMin - startMin;
}

function getWeekRange(dateString) {
  var d;
  if (dateString) {
    var parts = dateString.split('-');
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    d = new Date();
  }
  
  var day = d.getDay(); // 0 (일) ~ 6 (토)
  var diffToMon = (day === 0 ? -6 : 1 - day); // 월요일 기준 계산
  
  var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
  var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  
  return {
    weekStart: Utilities.formatDate(mon, TIMEZONE, 'yyyy-MM-dd'),
    weekEnd: Utilities.formatDate(sun, TIMEZONE, 'yyyy-MM-dd')
  };
}

// ====================================================================
// 6. 근무 기록 관리 (WorkLogs)
// ====================================================================

/**
 * 11. 근무 기록 추가 (중복 방지 및 입력 검증 포함)
 */
function addWorkLog(data) {
  try {
    if (!data.employeeId || !data.workDate || !data.startTime || !data.endTime || !data.workDescription) {
      return { success: false, message: '모든 필수 항목을 입력해 주세요.' };
    }
    
    var desc = String(data.workDescription).trim();
    if (desc.length === 0) {
      return { success: false, message: '한 일을 입력해 주세요.' };
    }
    
    var minutesWorked = calculateMinutes(data.startTime, data.endTime);
    if (minutesWorked <= 0) {
      return { success: false, message: '종료 시간을 시작 시간보다 늦게 설정해 주세요.' };
    }
    
    // 정산 완료 여부 검사 (정산 완료된 주에는 직원이 추가할 수 없음)
    var week = getWeekRange(data.workDate);
    var settlement = getSettlement(data.employeeId, week.weekStart);
    if (settlement && settlement.status === 'completed' && data.role !== 'admin') {
      return { success: false, message: '해당 주는 이미 정산 완료되어 근무 기록을 추가할 수 없습니다.' };
    }
    
    var ss = getSpreadsheet();
    var logSheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
    var newId = 'WL_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
    var createdAt = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    
    // id, employeeId, employeeName, workDate, startTime, endTime, minutesWorked, workDescription, createdAt
    logSheet.appendRow([
      newId,
      data.employeeId,
      data.employeeName || '',
      data.workDate,
      data.startTime,
      data.endTime,
      minutesWorked,
      desc,
      createdAt
    ]);
    
    return {
      success: true,
      message: '근무 기록이 저장되었습니다.',
      logId: newId
    };
  } catch (err) {
    return { success: false, message: '근무 기록 저장 중 오류가 발생했습니다: ' + err.message };
  }
}

/**
 * 14 & 15. 주간 근무 기록 조회
 */
function getWeeklyWorkLogs(employeeId, weekStart) {
  try {
    var week = getWeekRange(weekStart);
    var ss = getSpreadsheet();
    var logSheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
    if (!logSheet || logSheet.getLastRow() <= 1) {
      return { success: true, logs: [], weekStart: week.weekStart, weekEnd: week.weekEnd };
    }
    
    var data = logSheet.getDataRange().getValues();
    var logs = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var empId = String(row[1]);
      var workDate = Utilities.formatDate(new Date(row[3]), TIMEZONE, 'yyyy-MM-dd');
      
      // employeeId 조건 검사 (employeeId가 전달되었을 때만 필터)
      if (employeeId && empId !== String(employeeId)) {
        continue;
      }
      
      // 날짜 범위 검사 (weekStart <= workDate <= weekEnd)
      if (workDate >= week.weekStart && workDate <= week.weekEnd) {
        logs.push({
          id: String(row[0]),
          employeeId: empId,
          employeeName: String(row[2]),
          workDate: workDate,
          startTime: String(row[4]),
          endTime: String(row[5]),
          minutesWorked: Number(row[6]),
          workDescription: String(row[7]),
          createdAt: String(row[8])
        });
      }
    }
    
    // 날짜 및 시작 시간 순 정렬
    logs.sort(function(a, b) {
      if (a.workDate === b.workDate) {
        return a.startTime.localeCompare(b.startTime);
      }
      return a.workDate.localeCompare(b.workDate);
    });
    
    return {
      success: true,
      logs: logs,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd
    };
  } catch (err) {
    return { success: false, message: '근무 기록을 불러오지 못했습니다. 다시 시도해 주세요.' };
  }
}

/**
 * 10 & 13. 알바생 주간 요약 통계 조회 (총 근무시간, 예상급여, 정산내역)
 */
function getWeeklySummary(employeeId, weekStart) {
  try {
    var logsResult = getWeeklyWorkLogs(employeeId, weekStart);
    if (!logsResult.success) return logsResult;
    
    var logs = logsResult.logs;
    var totalMinutes = 0;
    logs.forEach(function(l) {
      totalMinutes += Number(l.minutesWorked) || 0;
    });
    
    // 시급 조회
    var hourlyRate = DEFAULT_HOURLY_RATE;
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    if (empSheet) {
      var empData = empSheet.getDataRange().getValues();
      for (var i = 1; i < empData.length; i++) {
        if (String(empData[i][0]) === String(employeeId)) {
          hourlyRate = Number(empData[i][3]) || DEFAULT_HOURLY_RATE;
          break;
        }
      }
    }
    
    // 예상 급여 공식: totalMinutes / 60 * hourlyRate
    var expectedPay = Math.round((totalMinutes / 60) * hourlyRate);
    
    // 정산 상태 조회
    var settlement = getSettlement(employeeId, logsResult.weekStart);
    
    return {
      success: true,
      employeeId: employeeId,
      weekStart: logsResult.weekStart,
      weekEnd: logsResult.weekEnd,
      totalMinutes: totalMinutes,
      expectedPay: expectedPay,
      hourlyRate: hourlyRate,
      logsCount: logs.length,
      settlement: settlement || {
        status: 'pending',
        actualPay: null,
        settledAt: null
      }
    };
  } catch (err) {
    return { success: false, message: '주간 요약 정보를 불러오지 못했습니다.' };
  }
}

/**
 * 23. 근무 기록 수정
 */
function updateWorkLog(data) {
  try {
    if (!data.id || !data.workDate || !data.startTime || !data.endTime || !data.workDescription) {
      return { success: false, message: '모든 필수 항목을 입력해 주세요.' };
    }
    
    var minutesWorked = calculateMinutes(data.startTime, data.endTime);
    if (minutesWorked <= 0) {
      return { success: false, message: '종료 시간을 시작 시간보다 늦게 설정해 주세요.' };
    }
    
    var week = getWeekRange(data.workDate);
    var settlement = getSettlement(data.employeeId, week.weekStart);
    if (settlement && settlement.status === 'completed' && data.role !== 'admin') {
      return { success: false, message: '정산 완료된 주의 근무 기록은 수정할 수 없습니다.' };
    }
    
    var ss = getSpreadsheet();
    var logSheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
    var rows = logSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        targetRowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return { success: false, message: '해당 근무 기록을 찾을 수 없습니다.' };
    }
    
    logSheet.getRange(targetRowIndex, 4, 1, 5).setValues([[
      data.workDate,
      data.startTime,
      data.endTime,
      minutesWorked,
      String(data.workDescription).trim()
    ]]);
    
    return { success: true, message: '근무 기록이 수정되었습니다.' };
  } catch (err) {
    return { success: false, message: '근무 기록 수정 중 오류가 발생했습니다: ' + err.message };
  }
}

/**
 * 23. 근무 기록 삭제
 */
function deleteWorkLog(id, employeeId, role) {
  try {
    var ss = getSpreadsheet();
    var logSheet = ss.getSheetByName(SHEET_NAMES.WORK_LOGS);
    var rows = logSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var targetWorkDate = null;
    var targetEmpId = null;
    
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        targetRowIndex = i + 1;
        targetEmpId = String(rows[i][1]);
        targetWorkDate = Utilities.formatDate(new Date(rows[i][3]), TIMEZONE, 'yyyy-MM-dd');
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return { success: false, message: '삭제할 근무 기록을 찾을 수 없습니다.' };
    }
    
    if (role !== 'admin' && targetEmpId !== String(employeeId)) {
      return { success: false, message: '본인의 근무 기록만 삭제할 수 있습니다.' };
    }
    
    var week = getWeekRange(targetWorkDate);
    var settlement = getSettlement(targetEmpId, week.weekStart);
    if (settlement && settlement.status === 'completed' && role !== 'admin') {
      return { success: false, message: '정산 완료된 주의 근무 기록은 삭제할 수 없습니다.' };
    }
    
    logSheet.deleteRow(targetRowIndex);
    return { success: true, message: '근무 기록이 삭제되었습니다.' };
  } catch (err) {
    return { success: false, message: '근무 기록 삭제 중 오류가 발생했습니다.' };
  }
}

// ====================================================================
// 7. 주간 정산 관리 (Settlements)
// ====================================================================

/**
 * 특정 직원 및 특정 주의 정산 데이터 단건 조회
 */
function getSettlement(employeeId, weekStart) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTLEMENTS);
  if (!sheet || sheet.getLastRow() <= 1) return null;
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var eId = String(row[1]);
    var wStart = Utilities.formatDate(new Date(row[2]), TIMEZONE, 'yyyy-MM-dd');
    
    if (eId === String(employeeId) && wStart === String(weekStart)) {
      return {
        settlementId: String(row[0]),
        employeeId: eId,
        weekStart: wStart,
        weekEnd: Utilities.formatDate(new Date(row[3]), TIMEZONE, 'yyyy-MM-dd'),
        totalMinutes: Number(row[4]),
        expectedPay: Number(row[5]),
        actualPay: Number(row[6]),
        status: String(row[7]), // 'pending' | 'completed'
        settledAt: row[8] ? String(row[8]) : null
      };
    }
  }
  return null;
}

/**
 * 18, 19, 20. 관리자 주간 정산 완료 저장 (신규 또는 기존 행 업데이트)
 */
function saveSettlement(data) {
  try {
    if (!data.employeeId || !data.weekStart || data.actualPay === undefined || data.actualPay === null) {
      return { success: false, message: '필수 정산 정보가 누락되었습니다.' };
    }
    
    var actualPay = Number(data.actualPay);
    if (isNaN(actualPay) || actualPay < 0) {
      return { success: false, message: '실제 입금액은 0원 이상의 숫자로 입력해 주세요.' };
    }
    
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.SETTLEMENTS);
    if (!sheet) {
      setupSpreadsheet();
      sheet = ss.getSheetByName(SHEET_NAMES.SETTLEMENTS);
    }
    
    var week = getWeekRange(data.weekStart);
    var rows = sheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var settlementId = null;
    
    for (var i = 1; i < rows.length; i++) {
      var eId = String(rows[i][1]);
      var wStart = Utilities.formatDate(new Date(rows[i][2]), TIMEZONE, 'yyyy-MM-dd');
      if (eId === String(data.employeeId) && wStart === String(week.weekStart)) {
        targetRowIndex = i + 1; // 1-based
        settlementId = String(rows[i][0]);
        break;
      }
    }
    
    var settledAt = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    var expectedPay = Number(data.expectedPay) || 0;
    var totalMinutes = Number(data.totalMinutes) || 0;
    
    if (targetRowIndex > 0) {
      // 20. 기존 행 업데이트
      sheet.getRange(targetRowIndex, 1, 1, 9).setValues([[
        settlementId,
        data.employeeId,
        week.weekStart,
        week.weekEnd,
        totalMinutes,
        expectedPay,
        actualPay,
        'completed',
        settledAt
      ]]);
    } else {
      // 20. 신규 정산 행 추가
      settlementId = 'SETTLE_' + new Date().getTime();
      sheet.appendRow([
        settlementId,
        data.employeeId,
        week.weekStart,
        week.weekEnd,
        totalMinutes,
        expectedPay,
        actualPay,
        'completed',
        settledAt
      ]);
    }
    
    return {
      success: true,
      message: '정산이 완료되었습니다. 알바생에게 즉시 반영됩니다.',
      settlementId: settlementId,
      actualPay: actualPay,
      expectedPay: expectedPay,
      status: 'completed'
    };
  } catch (err) {
    return { success: false, message: '정산 처리 중 오류가 발생했습니다: ' + err.message };
  }
}

// ====================================================================
// 8. 관리자 직원 관리 (Employees)
// ====================================================================

/**
 * 16. 관리자용 직원 목록 및 각 직원의 이번 주 요약 현황 조회
 */
function getEmployeesWithWeeklySummary(weekStart) {
  try {
    var week = getWeekRange(weekStart);
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    if (!empSheet || empSheet.getLastRow() <= 1) {
      return { success: true, employees: [], weekStart: week.weekStart, weekEnd: week.weekEnd };
    }
    
    var data = empSheet.getDataRange().getValues();
    var results = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var empId = String(row[0]);
      var empName = String(row[1]);
      var rate = Number(row[3]) || DEFAULT_HOURLY_RATE;
      var active = (row[4] === true || String(row[4]).toLowerCase() === 'true');
      
      // 활성 직원만 또는 관리자가 볼 수 있게
      var summary = getWeeklySummary(empId, week.weekStart);
      
      results.push({
        employeeId: empId,
        name: empName,
        hourlyRate: rate,
        active: active,
        createdAt: String(row[5]),
        totalMinutes: summary.success ? summary.totalMinutes : 0,
        expectedPay: summary.success ? summary.expectedPay : 0,
        settlement: summary.success ? summary.settlement : { status: 'pending', actualPay: null }
      });
    }
    
    return {
      success: true,
      employees: results,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd
    };
  } catch (err) {
    return { success: false, message: '직원 목록을 불러오지 못했습니다.' };
  }
}

/**
 * 22. 신규 직원 추가 (기본 시급 12,000원)
 */
function addEmployee(data) {
  try {
    if (!data.employeeId || !data.name || !data.password) {
      return { success: false, message: '이름, 직원 ID, 비밀번호를 모두 입력해 주세요.' };
    }
    
    var cleanId = String(data.employeeId).trim();
    var cleanName = String(data.name).trim();
    var cleanPw = String(data.password).trim();
    var rate = Number(data.hourlyRate) || DEFAULT_HOURLY_RATE;
    
    if (cleanId.length < 3) {
      return { success: false, message: '직원 ID는 3글자 이상이어야 합니다.' };
    }
    
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    var rows = empSheet.getDataRange().getValues();
    
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === cleanId) {
        return { success: false, message: '이미 존재하는 직원 ID입니다. 다른 ID를 입력해 주세요.' };
      }
    }
    
    var createdAt = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    empSheet.appendRow([
      cleanId,
      cleanName,
      cleanPw,
      rate,
      true,
      createdAt
    ]);
    
    return { success: true, message: cleanName + ' 직원이 추가되었습니다.' };
  } catch (err) {
    return { success: false, message: '직원 추가 중 오류가 발생했습니다: ' + err.message };
  }
}

/**
 * 22. 직원 상태 수정 (active 토글 또는 시급 수정)
 */
function updateEmployee(data) {
  try {
    if (!data.employeeId) {
      return { success: false, message: '직원 ID가 필요합니다.' };
    }
    
    var ss = getSpreadsheet();
    var empSheet = ss.getSheetByName(SHEET_NAMES.EMPLOYEES);
    var rows = empSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.employeeId)) {
        targetRowIndex = i + 1;
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return { success: false, message: '해당 직원을 찾을 수 없습니다.' };
    }
    
    if (data.active !== undefined) {
      empSheet.getRange(targetRowIndex, 5).setValue(data.active);
    }
    if (data.hourlyRate !== undefined) {
      empSheet.getRange(targetRowIndex, 4).setValue(Number(data.hourlyRate));
    }
    if (data.name) {
      empSheet.getRange(targetRowIndex, 2).setValue(String(data.name).trim());
    }
    
    return { success: true, message: '직원 정보가 업데이트되었습니다.' };
  } catch (err) {
    return { success: false, message: '직원 정보 업데이트 중 오류가 발생했습니다.' };
  }
}
