
import { OTType, UserSettings } from './types';

export const OT_TYPES: { value: OTType; label: string; color: string }[] = [
  { value: 1, label: '1 เท่า', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 1.5, label: '1.5 เท่า', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 2, label: '2 เท่า', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 3, label: '3 เท่า', color: 'bg-red-100 text-red-700 border-red-200' },
];

export const DEFAULT_SETTINGS: UserSettings = {
  baseSalary: 20000,
  workingDaysPerMonth: 30,
  workingHoursPerDay: 8,
  foodAllowance: 0,
  diligenceAllowance: 0,
  providentFundRate: 0,
  enableSocialSecurity: true,
  socialSecurityRate: 5,
  socialSecurityMax: 750,
};

export const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
