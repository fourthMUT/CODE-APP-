
export type OTType = 1 | 1.5 | 2 | 3;

export interface OTRecord {
  id: string;
  date: string;
  hours: number;
  type: OTType;
  hourlyRateAtTime: number;
  totalAmount: number;
  note?: string;
}

export interface UserSettings {
  baseSalary: number;
  yearlySalaries: Record<string, number>;
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  foodAllowance: number;
  diligenceAllowance: number;
  shiftAllowance: number; // เพิ่มค่ากะ
  specialIncome: number;   // เพิ่มรายรับพิเศษ
  providentFundRate: number; 
  enableSocialSecurity: boolean;
  socialSecurityRate: number; 
  socialSecurityMax: number; 
}

export interface MonthlySummary {
  month: string; 
  totalHours: number;
  totalOTAmount: number;
  records: OTRecord[];
}
