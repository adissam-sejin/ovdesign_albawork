import { Employee, WorkLog, Settlement } from '../types';

export const SHEET_NAMES = {
  EMPLOYEES: 'Employees',
  WORK_LOGS: 'WorkLogs',
  SETTLEMENTS: 'Settlements'
};

export const HEADERS = {
  EMPLOYEES: ['employeeId', 'name', 'password', 'hourlyRate', 'active', 'createdAt'],
  WORK_LOGS: ['id', 'employeeId', 'employeeName', 'workDate', 'startTime', 'endTime', 'minutesWorked', 'workDescription', 'createdAt'],
  SETTLEMENTS: ['settlementId', 'employeeId', 'weekStart', 'weekEnd', 'totalMinutes', 'expectedPay', 'actualPay', 'status', 'settledAt']
};

/**
 * Google Sheets에 새 스프레드시트를 생성하고 필요한 시트(Employees, WorkLogs, Settlements) 및 헤더를 초기화합니다.
 */
export async function createSpreadsheet(accessToken: string): Promise<string> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: '알바 주간정산 - 근무기록 및 정산 데이터'
      },
      sheets: [
        { properties: { title: SHEET_NAMES.EMPLOYEES } },
        { properties: { title: SHEET_NAMES.WORK_LOGS } },
        { properties: { title: SHEET_NAMES.SETTLEMENTS } }
      ]
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || '스프레드시트 생성 실패');
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  // 헤더 및 기본 관리자 계정, 기본 알바생 계정 초기화
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: `${SHEET_NAMES.EMPLOYEES}!A1:F3`,
          values: [
            HEADERS.EMPLOYEES,
            ['admin', '관리자', 'adi2026', 0, true, new Date().toISOString().replace('T', ' ').substring(0, 19)],
            ['staff01', '알바생1', '1234', 12000, true, new Date().toISOString().replace('T', ' ').substring(0, 19)]
          ]
        },
        {
          range: `${SHEET_NAMES.WORK_LOGS}!A1:I1`,
          values: [HEADERS.WORK_LOGS]
        },
        {
          range: `${SHEET_NAMES.SETTLEMENTS}!A1:I1`,
          values: [HEADERS.SETTLEMENTS]
        }
      ]
    })
  });

  return spreadsheetId;
}

/**
 * 스프레드시트의 메타데이터와 시트 ID 목록을 조회합니다.
 */
export async function getSpreadsheetMeta(accessToken: string, spreadsheetId: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error('스프레드시트 정보를 불러오지 못했습니다. ID나 권한을 확인해주세요.');
  }
  return await res.json();
}

/**
 * 스프레드시트에서 3개 시트의 모든 데이터를 일괄 조회합니다.
 */
export async function fetchAllSheetData(accessToken: string, spreadsheetId: string): Promise<{
  employees: Employee[];
  workLogs: WorkLog[];
  settlements: Settlement[];
}> {
  const ranges = [
    `${SHEET_NAMES.EMPLOYEES}!A2:F500`,
    `${SHEET_NAMES.WORK_LOGS}!A2:I1000`,
    `${SHEET_NAMES.SETTLEMENTS}!A2:I500`
  ];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || '시트 데이터 조회 실패');
  }

  const json = await res.json();
  const valRanges = json.valueRanges || [];

  // 1. Employees 파싱
  const empRows = (valRanges[0]?.values || []) as any[][];
  const employees: Employee[] = empRows.map(row => ({
    employeeId: String(row[0] || '').trim(),
    name: String(row[1] || '').trim(),
    password: String(row[2] || '').trim(),
    hourlyRate: Number(row[3]) || 12000,
    active: row[4] === true || String(row[4]).toLowerCase() === 'true',
    createdAt: String(row[5] || '')
  })).filter(e => e.employeeId && e.employeeId !== 'admin');

  // 2. WorkLogs 파싱
  const logRows = (valRanges[1]?.values || []) as any[][];
  const workLogs: WorkLog[] = logRows.map(row => ({
    id: String(row[0] || ''),
    employeeId: String(row[1] || ''),
    employeeName: String(row[2] || ''),
    workDate: String(row[3] || ''),
    startTime: String(row[4] || ''),
    endTime: String(row[5] || ''),
    minutesWorked: Number(row[6]) || 0,
    workDescription: String(row[7] || ''),
    createdAt: String(row[8] || '')
  })).filter(l => l.id && l.workDate);

  // 3. Settlements 파싱
  const stRows = (valRanges[2]?.values || []) as any[][];
  const settlements: Settlement[] = stRows.map(row => ({
    settlementId: String(row[0] || ''),
    employeeId: String(row[1] || ''),
    weekStart: String(row[2] || ''),
    weekEnd: String(row[3] || ''),
    totalMinutes: Number(row[4]) || 0,
    expectedPay: Number(row[5]) || 0,
    actualPay: row[6] !== '' && row[6] !== undefined && row[6] !== null ? Number(row[6]) : null,
    status: (row[7] === 'completed' ? 'completed' : 'pending') as 'pending' | 'completed',
    settledAt: row[8] ? String(row[8]) : null
  })).filter(s => s.settlementId);

  return { employees, workLogs, settlements };
}

/**
 * WorkLogs 시트에 새 근무 기록 행을 직접 추가합니다.
 */
export async function appendWorkLogToSheet(
  accessToken: string, 
  spreadsheetId: string, 
  log: WorkLog
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.WORK_LOGS}!A1:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[
        log.id,
        log.employeeId,
        log.employeeName,
        log.workDate,
        log.startTime,
        log.endTime,
        log.minutesWorked,
        log.workDescription,
        log.createdAt
      ]]
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || '구글 시트에 근무 기록 저장 실패');
  }
}

/**
 * WorkLogs 시트에서 특정 기록 행을 삭제합니다.
 */
export async function deleteWorkLogFromSheet(
  accessToken: string,
  spreadsheetId: string,
  logId: string
): Promise<void> {
  // 먼저 WorkLogs 시트의 메타데이터에서 sheetId를 가져옵니다.
  const meta = await getSpreadsheetMeta(accessToken, spreadsheetId);
  const workLogsSheet = meta.sheets?.find((s: any) => s.properties?.title === SHEET_NAMES.WORK_LOGS);
  if (!workLogsSheet) throw new Error('WorkLogs 시트를 찾을 수 없습니다.');
  const sheetIdNum = workLogsSheet.properties.sheetId;

  // 전체 행을 읽어 logId와 일치하는 행 번호(1-indexed)를 찾습니다.
  const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.WORK_LOGS}!A1:A1000`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await readRes.json();
  const rows = (data.values || []) as any[][];

  let targetRowZeroIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(logId)) {
      targetRowZeroIndex = i;
      break;
    }
  }

  if (targetRowZeroIndex === -1) {
    throw new Error('구글 시트에서 해당 근무 기록을 찾을 수 없습니다.');
  }

  // batchUpdate로 행 삭제
  const deleteRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetIdNum,
              dimension: 'ROWS',
              startIndex: targetRowZeroIndex,
              endIndex: targetRowZeroIndex + 1
            }
          }
        }
      ]
    })
  });

  if (!deleteRes.ok) {
    const err = await deleteRes.json();
    throw new Error(err.error?.message || '구글 시트 행 삭제 실패');
  }
}

/**
 * Settlements 시트에 정산 내역을 업데이트하거나 신규 추가합니다.
 */
export async function saveSettlementToSheet(
  accessToken: string,
  spreadsheetId: string,
  settlement: Settlement
): Promise<void> {
  // Settlements 시트에서 기존 행이 있는지 조회
  const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.SETTLEMENTS}!A1:C500`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await readRes.json();
  const rows = (data.values || []) as any[][];

  let targetRowIndex = -1; // 1-indexed
  for (let i = 1; i < rows.length; i++) {
    const eId = String(rows[i][1] || '');
    const wStart = String(rows[i][2] || '');
    if (eId === settlement.employeeId && wStart === settlement.weekStart) {
      targetRowIndex = i + 1;
      break;
    }
  }

  const rowValues = [
    settlement.settlementId,
    settlement.employeeId,
    settlement.weekStart,
    settlement.weekEnd,
    settlement.totalMinutes,
    settlement.expectedPay,
    settlement.actualPay,
    settlement.status,
    settlement.settledAt
  ];

  if (targetRowIndex > 0) {
    // 기존 행 덮어쓰기
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.SETTLEMENTS}!A${targetRowIndex}:I${targetRowIndex}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [rowValues] })
    });
    if (!updateRes.ok) throw new Error('구글 시트 정산 업데이트 실패');
  } else {
    // 신규 행 추가
    const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.SETTLEMENTS}!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: [rowValues] })
    });
    if (!appendRes.ok) throw new Error('구글 시트 정산 추가 실패');
  }
}

/**
 * Employees 시트에 신규 직원을 추가합니다.
 */
export async function addEmployeeToSheet(
  accessToken: string,
  spreadsheetId: string,
  employee: Employee
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.EMPLOYEES}!A1:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[
        employee.employeeId,
        employee.name,
        employee.password || '1234',
        employee.hourlyRate,
        employee.active,
        employee.createdAt
      ]]
    })
  });
  if (!res.ok) throw new Error('구글 시트에 직원 추가 실패');
}

/**
 * Employees 시트에서 직원의 재직/비활성 상태를 토글합니다.
 */
export async function toggleEmployeeActiveInSheet(
  accessToken: string,
  spreadsheetId: string,
  employeeId: string,
  active: boolean
): Promise<void> {
  const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.EMPLOYEES}!A1:A500`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await readRes.json();
  const rows = (data.values || []) as any[][];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(employeeId)) {
      targetRowIndex = i + 1;
      break;
    }
  }

  if (targetRowIndex === -1) throw new Error('직원을 찾을 수 없습니다.');

  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAMES.EMPLOYEES}!E${targetRowIndex}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [[active]] })
  });
  if (!updateRes.ok) throw new Error('직원 상태 변경 실패');
}
