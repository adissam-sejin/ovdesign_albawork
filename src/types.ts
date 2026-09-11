export interface Employee {
  employeeId: string;
  name: string;
  password?: string;
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

export interface WorkLog {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  minutesWorked: number;
  workDescription: string;
  createdAt: string;
}

export interface Settlement {
  settlementId: string;
  employeeId: string;
  weekStart: string; // YYYY-MM-DD (Mon)
  weekEnd: string; // YYYY-MM-DD (Sun)
  totalMinutes: number;
  expectedPay: number;
  actualPay: number | null;
  status: 'pending' | 'completed';
  settledAt: string | null;
}

export interface UserSession {
  role: 'admin' | 'staff';
  id: string;
  name: string;
  hourlyRate: number;
}
