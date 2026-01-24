
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

export interface MonthlyAdjustment {
  baseSalary?: number;
  workingDaysPerMonth: number; // ย้ายมาอยู่ในนี้
  workingHoursPerDay: number;  // ย้ายมาอยู่ในนี้
  foodAllowance: number;
  diligenceAllowance: number;
  shiftAllowance: number;
  specialIncome: number;
  providentFundRate: number;
  enableSocialSecurity: boolean;
}

export interface UserSettings {
  baseSalary: number;
  yearlySalaries: Record<string, number>;
  // ค่ากลางจะถูกใช้เป็นค่าเริ่มต้นสำหรับเดือนใหม่เท่านั้น
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  foodAllowance: number;
  diligenceAllowance: number;
  shiftAllowance: number;
  specialIncome: number;
  providentFundRate: number;
  enableSocialSecurity: boolean;
  socialSecurityRate: number; 
  socialSecurityMax: number;
  monthlyAdjustments: Record<string, MonthlyAdjustment>;
}

export interface MonthlySummary {
  month: string; 
  totalHours: number;
  totalOTAmount: number;
  records: OTRecord[];
}
