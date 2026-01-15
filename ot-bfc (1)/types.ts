
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
  monthlySalaries?: Record<string, number>; // เก็บ { "2024-01": 25000, "2025-01": 28000 }
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  foodAllowance: number;
  diligenceAllowance: number;
  providentFundRate: number; // Percentage
  // Social Security Settings
  enableSocialSecurity: boolean;
  socialSecurityRate: number; // Default 5%
  socialSecurityMax: number; // Default 750
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  totalHours: number;
  totalOTAmount: number;
  records: OTRecord[];
}
