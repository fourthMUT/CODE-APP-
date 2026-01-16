
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  LayoutGrid,
  List as ListIcon,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  LogOut,
  User,
  Mail,
  ArrowRight,
  AlertCircle,
  Calendar as CalendarIcon,
  Save,
  BarChart3,
  History,
  TrendingUp,
  Copy,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Database,
  Cloud,
  CloudOff,
  CloudDownload,
  CloudUpload,
  Wifi,
  WifiOff
} from 'lucide-react';
import { OTRecord, UserSettings, OTType } from './types.ts';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants.ts';

// ใช้ Bucket ID ที่มีความเสถียรและรองรับ Public CORS
const CLOUD_BUCKET_ID = 'bfc_storage_v3_stable'; 

const formatLocalISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getCycleMonthStr = (dateStr: string) => {
  const date = parseLocalDate(dateStr);
  const day = date.getDate();
  let cycleMonth = date.getMonth();
  let cycleYear = date.getFullYear();

  if (day > 15) {
    cycleMonth += 1;
    if (cycleMonth > 11) {
      cycleMonth = 0;
      cycleYear += 1;
    }
  }
  return `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
};

const SettingSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <div className="space-y-3">
    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">{title}</h4>
    <div className="bg-white rounded-3xl shadow-sm border divide-y overflow-hidden">{children}</div>
  </div>
);

const SettingRow = ({ label, value, onChange }: { label: string, value: number, onChange: (v: string) => void }) => (
  <div className="flex justify-between items-center px-6 py-5">
    <label className="text-sm font-bold text-slate-600">{label}</label>
    <input 
      type="number" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="text-right font-bold w-28 bg-transparent outline-none text-black" 
      style={{ color: 'black', WebkitTextFillColor: 'black' }}
    />
  </div>
);

const BreakdownRow = ({ label, value, isHighlight, isNegative }: { label: string, value: number, isHighlight?: boolean, isNegative?: boolean }) => (
  <div className="flex justify-between items-center py-1">
    <span className={`text-sm ${isHighlight ? 'font-bold text-blue-600' : 'text-slate-600'}`}>{label}</span>
    <span className={`text-sm font-bold ${isNegative ? 'text-red-500' : 'text-slate-900'}`}>{isNegative ? '-' : ''}฿{Math.abs(value).toLocaleString()}</span>
  </div>
);

const LogoImage = ({ className }: { className?: string }) => {
  const [error, setError] = useState(false);
  return (
    <div className={`${className} flex items-center justify-center overflow-hidden`}>
      {!error ? (
        <img 
          src="logo.png" 
          alt="BFC MONEY" 
          className="w-full h-full object-contain"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full bg-blue-600 flex flex-col items-center justify-center text-white p-2">
          <TrendingUp className="w-1/2 h-1/2" />
          <span className="text-[8px] font-bold mt-1">BFC</span>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('ot_bfc_user_email'));
  const [emailInput, setEmailInput] = useState('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'summary'>('list');
  
  const [currentViewMonth, setCurrentViewMonth] = useState(() => {
    const now = new Date();
    return getCycleMonthStr(formatLocalISO(now));
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ dateStr: string, records: OTRecord[] } | null>(null);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const retryCount = useRef(0);

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  const [newYearInput, setNewYearInput] = useState(new Date().getFullYear().toString());
  const [newSalaryInput, setNewSalaryInput] = useState('0');

  // ฟังก์ชันสร้าง Storage Key ที่ปลอดภัย
  const getSafeKey = (email: string) => {
    return btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '');
  };

  // ฟังก์ชัน Cloud Sync - บันทึก (ปรับปรุงใหม่)
  const saveToCloud = useCallback(async (dataToSave: { records: OTRecord[], settings: UserSettings }) => {
    if (!userEmail) return;
    setSyncStatus('syncing');
    
    try {
      const emailKey = getSafeKey(userEmail);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`https://kvdb.io/${CLOUD_BUCKET_ID}/${emailKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dataToSave, lastUpdated: new Date().toISOString() }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        setSyncStatus('success');
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        retryCount.current = 0;
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        throw new Error('Server returned error');
      }
    } catch (e) {
      console.error('Sync Error:', e);
      setSyncStatus('error');
      // พยายาม Retry อัตโนมัติสูงสุด 3 ครั้ง
      if (retryCount.current < 3) {
        retryCount.current += 1;
        setTimeout(() => saveToCloud(dataToSave), 5000);
      }
    }
  }, [userEmail]);

  // ฟังก์ชัน Cloud Sync - ดึงข้อมูล (ปรับปรุงใหม่)
  const loadFromCloud = useCallback(async (email: string) => {
    setSyncStatus('syncing');
    try {
      const emailKey = getSafeKey(email);
      const response = await fetch(`https://kvdb.io/${CLOUD_BUCKET_ID}/${emailKey}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.records) {
          setRecords(data.records);
          setSettings(data.settings);
          setSyncStatus('success');
          setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
          setTimeout(() => setSyncStatus('idle'), 3000);
          return true;
        }
      }
      setSyncStatus('idle');
      return false;
    } catch (e) {
      console.error('Load Error:', e);
      setSyncStatus('error');
      return false;
    }
  }, []);

  // โหลดข้อมูลครั้งแรก
  useEffect(() => {
    if (userEmail) {
      const init = async () => {
        const success = await loadFromCloud(userEmail);
        if (!success) {
          const savedRecords = localStorage.getItem(`ot_records_${userEmail}`);
          const savedSettings = localStorage.getItem(`user_settings_${userEmail}`);
          if (savedRecords) setRecords(JSON.parse(savedRecords));
          if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        }
        setIsFirstLoad(false);
      };
      init();
    }
  }, [userEmail, loadFromCloud]);

  // บันทึกลง Local และ Cloud
  useEffect(() => {
    if (userEmail && !isFirstLoad) {
      localStorage.setItem(`ot_records_${userEmail}`, JSON.stringify(records));
      localStorage.setItem(`user_settings_${userEmail}`, JSON.stringify(settings));
      
      const timer = setTimeout(() => {
        saveToCloud({ records, settings });
      }, 2000); // เพิ่มหน่วงเวลาเป็น 2 วิ เพื่อลดภาระเซิร์ฟเวอร์
      
      return () => clearTimeout(timer);
    }
  }, [records, settings, userEmail, isFirstLoad, saveToCloud]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.includes('@')) {
      const email = emailInput.toLowerCase().trim();
      localStorage.setItem('ot_bfc_user_email', email);
      setUserEmail(email);
    }
  };

  const handleLogoutAction = () => {
    if (!logoutConfirm) {
      setLogoutConfirm(true);
      setTimeout(() => setLogoutConfirm(false), 5000);
      return;
    }
    localStorage.removeItem('ot_bfc_user_email');
    setUserEmail(null);
    setIsSettingsOpen(false);
    setIsFirstLoad(true);
  };

  const getSalaryForYear = (year: string) => {
    return settings.yearlySalaries[year] || settings.baseSalary;
  };

  const currentViewSalary = useMemo(() => {
    const year = currentViewMonth.split('-')[0];
    return getSalaryForYear(year);
  }, [settings, currentViewMonth]);

  const periodRange = useMemo(() => {
    const [year, month] = currentViewMonth.split('-').map(Number);
    const startDate = new Date(year, month - 2, 16);
    const endDate = new Date(year, month - 1, 15);
    
    return {
      start: formatLocalISO(startDate),
      end: formatLocalISO(endDate),
      label: `${startDate.getDate()} ${MONTHS_TH[startDate.getMonth()]} - ${endDate.getDate()} ${MONTHS_TH[endDate.getMonth()]} ${endDate.getFullYear() + 543}`,
      startDayOfWeek: startDate.getDay()
    };
  }, [currentViewMonth]);

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => r.date >= periodRange.start && r.date <= periodRange.end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, periodRange]);

  const calendarDays = useMemo(() => {
    const days = [];
    let curr = parseLocalDate(periodRange.start);
    const last = parseLocalDate(periodRange.end);
    const todayStr = formatLocalISO(new Date());

    while (curr <= last) {
      const dateStr = formatLocalISO(curr);
      const dayRecords = filteredRecords.filter(r => r.date === dateStr);
      days.push({
        date: new Date(curr),
        dateStr,
        records: dayRecords,
        isToday: dateStr === todayStr
      });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [periodRange, filteredRecords]);

  const monthlySummaries = useMemo(() => {
    const summaries: Record<string, { totalOT: number, totalHours: number, count: number }> = {};
    
    records.forEach(r => {
      const cycleMonth = getCycleMonthStr(r.date);
      if (!summaries[cycleMonth]) {
        summaries[cycleMonth] = { totalOT: 0, totalHours: 0, count: 0 };
      }
      summaries[cycleMonth].totalOT += r.totalAmount;
      summaries[cycleMonth].totalHours += r.hours;
      summaries[cycleMonth].count += 1;
    });

    return Object.entries(summaries)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({
        month,
        ...data
      }));
  }, [records]);

  const calculatedSocialSecurity = useMemo(() => {
    if (!settings.enableSocialSecurity) return 0;
    const rate = settings.socialSecurityRate / 100;
    const max = settings.socialSecurityMax;
    const baseForSS = currentViewSalary + settings.foodAllowance;
    return Math.min(max, Math.floor(baseForSS * rate));
  }, [currentViewSalary, settings]);

  const calculatedPvdAmount = useMemo(() => {
    return (currentViewSalary * (settings.providentFundRate || 0)) / 100;
  }, [currentViewSalary, settings.providentFundRate]);

  const monthlyStats = useMemo(() => {
    const totalOT = filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalHours = filteredRecords.reduce((sum, r) => sum + r.hours, 0);
    const grossSalary = currentViewSalary + totalOT + settings.foodAllowance + settings.diligenceAllowance + settings.shiftAllowance + settings.specialIncome;
    const netSalary = grossSalary - (calculatedPvdAmount + calculatedSocialSecurity);
    return { totalOT, totalHours, netSalary };
  }, [filteredRecords, currentViewSalary, settings, calculatedSocialSecurity, calculatedPvdAmount]);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const yearOfDate = formData.date.split('-')[0];
    const salaryAtTime = getSalaryForYear(yearOfDate);
    const hRate = salaryAtTime / (settings.workingDaysPerMonth * settings.workingHoursPerDay);
    const amount = formData.hours * hRate * formData.type;
    
    const newRecord: OTRecord = {
      id: Date.now().toString(),
      date: formData.date,
      hours: formData.hours,
      type: formData.type,
      hourlyRateAtTime: hRate,
      totalAmount: amount,
      note: formData.note
    };
    
    setRecords(prev => [newRecord, ...prev]);
    setIsAdding(false);
    setFormData({ ...formData, note: '' });
  };

  const addYearlySalary = () => {
    if (!newYearInput || !newSalaryInput) return;
    setSettings({
      ...settings,
      yearlySalaries: {
        ...settings.yearlySalaries,
        [newYearInput]: parseFloat(newSalaryInput)
      }
    });
    setNewSalaryInput('0');
  };

  const deleteYearlySalary = (year: string) => {
    const newSalaries = { ...settings.yearlySalaries };
    delete newSalaries[year];
    setSettings({ ...settings, yearlySalaries: newSalaries });
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen max-w-lg mx-auto bg-[#1e293b] flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="w-full space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center gap-6">
             <LogoImage className="w-32 h-32 bg-[#0ea5e9]/10 rounded-[2.5rem] shadow-2xl p-1" />
             <div className="text-center">
                <h1 className="text-4xl font-bold text-white tracking-tight">BFC MONEY</h1>
                <p className="text-[#0ea5e9] font-bold text-xs uppercase tracking-[0.3em] mt-2">REAL-TIME CLOUD SYNC</p>
             </div>
          </div>
          <form onSubmit={handleLogin} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-white/10 space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">บัญชีผู้ใช้งาน</label>
               <input 
                 type="email" required placeholder="example@gmail.com" 
                 className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl font-bold text-black focus:border-blue-500 focus:bg-white transition-all outline-none"
                 value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
               />
            </div>
            <button type="submit" className="w-full bg-[#1e3a8a] text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-2 ios-active shadow-lg shadow-blue-900/20">
               เข้าสู่ระบบและซิงค์ข้อมูล <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <Cloud className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                ใช้เมลเดิมเพื่อดึงข้อมูลอัตโนมัติ ข้อมูลจะลิงก์กันแบบเรียลไทม์ทุกอุปกรณ์ที่คุณล็อกอิน
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col overflow-hidden">
      <header className="sticky top-0 z-30 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm px-6 pb-4 flex justify-between items-center">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <LogoImage className="w-8 h-8 rounded-lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.15em] truncate block leading-none">{userEmail}</span>
              {syncStatus === 'syncing' ? <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" /> : 
               syncStatus === 'success' ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : 
               syncStatus === 'error' ? <CloudOff className="w-2.5 h-2.5 text-red-500" /> : 
               <Cloud className="w-2.5 h-2.5 text-slate-300" />}
            </div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">BFC MONEY</h1>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setViewMode('summary')} className={`p-2.5 rounded-full ios-active ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <BarChart3 className="w-5 h-5" />
           </button>
           <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-2.5 bg-slate-100 rounded-full ios-active">
              {viewMode === 'list' ? <LayoutGrid className="w-5 h-5 text-slate-600" /> : <ListIcon className="w-5 h-5 text-slate-600" />}
           </button>
           <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-100 rounded-full ios-active">
              <SettingsIcon className="w-5 h-5 text-slate-600" />
           </button>
        </div>
      </header>

      {syncStatus === 'error' && (
        <div className="bg-red-500 text-white text-[10px] font-bold py-1 px-4 flex items-center justify-between animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CloudOff className="w-3 h-3" />
            <span>การเชื่อมต่อ Cloud มีปัญหา ข้อมูลจะถูกเก็บไว้ในเครื่องก่อน</span>
          </div>
          <button onClick={() => saveToCloud({records, settings})} className="underline">ลองใหม่</button>
        </div>
      )}

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto">
        {viewMode !== 'summary' && (
          <>
            <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => {
                  const [y, m] = currentViewMonth.split('-').map(Number);
                  const d = new Date(y, m - 2, 1);
                  setCurrentViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="p-2 bg-slate-50 rounded-full ios-active"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">รอบตัดวิก (16-15)</div>
                  <div className="font-bold text-slate-900">{MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]} {parseInt(currentViewMonth.split('-')[0]) + 543}</div>
                </div>
                <button onClick={() => {
                  const [y, m] = currentViewMonth.split('-').map(Number);
                  const d = new Date(y, m, 1);
                  setCurrentViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }} className="p-2 bg-slate-50 rounded-full ios-active"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-3xl p-5 text-center border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">โอทีรอบนี้</span>
                  <h2 className="text-xl font-bold text-slate-800">฿{monthlyStats.totalOT.toLocaleString()}</h2>
                </div>
                <div className="bg-blue-50 rounded-3xl p-5 text-center border border-blue-100">
                  <span className="text-[10px] font-bold text-blue-400 uppercase mb-1 block">เงินเดือนวิกนี้</span>
                  <h2 className="text-xl font-bold text-blue-600">฿{currentViewSalary.toLocaleString()}</h2>
                </div>
              </div>

              <button onClick={() => setShowBreakdown(!showBreakdown)} className="w-full bg-[#1e3a8a] text-white p-6 rounded-3xl font-bold flex flex-col items-center ios-active shadow-xl shadow-blue-900/10 transition-all active:bg-[#1a365d]">
                <span className="text-xs opacity-80 mb-1">ยอดสุทธิรับจริง (หักภาษี/ปปส. แล้ว)</span>
                <span className="text-3xl font-bold">฿{monthlyStats.netSalary.toLocaleString()}</span>
              </button>
            </div>

            {showBreakdown && (
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-3 animate-in slide-in-from-top-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-2">รายละเอียดรายรับ-รายหัก</h3>
                <BreakdownRow label={`เงินเดือนประจำปี ${currentViewMonth.split('-')[0]}`} value={currentViewSalary} />
                <BreakdownRow label="ค่าล่วงเวลา (OT)" value={monthlyStats.totalOT} isHighlight />
                <BreakdownRow label="ค่าอาหาร" value={settings.foodAllowance} />
                <BreakdownRow label="เบี้ยขยัน" value={settings.diligenceAllowance} />
                <BreakdownRow label="ค่ากะ" value={settings.shiftAllowance} />
                <BreakdownRow label="รายรับพิเศษ" value={settings.specialIncome} />
                <div className="border-t pt-3 mt-1 space-y-1">
                    <BreakdownRow label="หักประกันสังคม (5%)" value={-calculatedSocialSecurity} isNegative />
                    <BreakdownRow label="หักกองทุนสำรองฯ" value={-calculatedPvdAmount} isNegative />
                </div>
              </div>
            )}

            {viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredRecords.map(record => (
                    <div key={record.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center font-bold">
                            <span className="text-xs">{parseLocalDate(record.date).getDate()}</span>
                            <span className="text-[8px] text-slate-400 uppercase">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0,3)}</span>
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{record.hours} ชม. <span className="text-[10px] text-blue-600 ml-1">x{record.type}</span></div>
                            {record.note && <div className="text-[10px] text-slate-400">{record.note}</div>}
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="font-bold">฿{record.totalAmount.toLocaleString()}</div>
                          <button onClick={() => setRecords(prev => prev.filter(r => r.id !== record.id))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                ))}
                {filteredRecords.length === 0 && (
                  <div className="text-center py-12 text-slate-400 opacity-50">
                      <CalendarDays className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm font-bold">ไม่มีรายการโอทีในรอบนี้</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="grid grid-cols-7 gap-1">
                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                      <div key={day} className="text-center text-[9px] font-bold text-slate-300 py-2 uppercase">{day}</div>
                    ))}
                    {Array.from({ length: periodRange.startDayOfWeek }).map((_, i) => <div key={`pad-${i}`} className="aspect-square"></div>)}
                    {calendarDays.map((item) => {
                      const dayTotal = item.records.reduce((sum, r) => sum + r.totalAmount, 0);
                      return (
                          <button 
                            key={item.dateStr} 
                            onClick={() => {
                              if (item.records.length > 0) {
                                setSelectedDayInfo(item);
                              } else {
                                setFormData({...formData, date: item.dateStr});
                                setIsAdding(true);
                              }
                            }}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-all ios-active ${item.isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}
                          >
                            <span className={`text-[10px] font-bold ${item.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{item.date.getDate()}</span>
                            {dayTotal > 0 && (
                                <span className="text-[7px] font-bold text-blue-600 leading-tight">
                                  ฿{dayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            )}
                          </button>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}

        {viewMode === 'summary' && (
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2 mb-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-800">ประวัติรายรอบเดือน</h2>
             </div>
             {monthlySummaries.map((s) => {
               const [y, m] = s.month.split('-').map(Number);
               return (
                <button 
                  key={s.month} 
                  onClick={() => { setCurrentViewMonth(s.month); setViewMode('list'); }}
                  className="w-full bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center ios-active"
                >
                  <div className="text-left">
                     <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">รอบการตัดวิก</span>
                     <h3 className="text-lg font-bold text-slate-800">{MONTHS_TH[m - 1]} {y + 543}</h3>
                     <p className="text-xs text-slate-500">{s.count} รายการ • {s.totalHours} ชั่วโมง</p>
                  </div>
                  <div className="text-right">
                     <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">ยอดรวมโอที</span>
                     <span className="text-xl font-bold text-blue-600">฿{s.totalOT.toLocaleString()}</span>
                  </div>
                </button>
               );
             })}
             {monthlySummaries.length === 0 && (
               <div className="text-center py-20 text-slate-300">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">ยังไม่มีประวัติการบันทึก</p>
               </div>
             )}
          </div>
        )}
      </main>

      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none">
         <button onClick={() => setIsAdding(true)} className="bg-[#1e3a8a] text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center pointer-events-auto ios-active">
            <Plus className="w-8 h-8" />
         </button>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-right">
           <header className="px-6 py-6 bg-white border-b flex justify-between items-center pt-[calc(2rem+env(safe-area-inset-top))] pb-4 shadow-sm">
              <h3 className="text-xl font-bold">การตั้งค่า</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 bg-blue-50 rounded-2xl">เสร็จสิ้น</button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              
              <SettingSection title="Cloud Sync Status">
                 <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className={`p-3 rounded-2xl ${syncStatus === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                          {syncStatus === 'syncing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : 
                           syncStatus === 'error' ? <CloudOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-800">สำรองข้อมูลอัตโนมัติ</h4>
                          <p className="text-[10px] text-slate-500">
                            {syncStatus === 'syncing' ? 'กำลังส่งข้อมูล...' : 
                             syncStatus === 'error' ? 'การเชื่อมต่อผิดพลาด (เก็บในเครื่องชั่วคราว)' : 
                             `อัปเดตล่าสุด: ${lastSyncTime || 'เพิ่งเริ่มใช้งาน'}`}
                          </p>
                       </div>
                    </div>
                    <button 
                      onClick={() => loadFromCloud(userEmail!)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 p-4 rounded-2xl font-bold ios-active border border-blue-100"
                    >
                      <RefreshCw className="w-4 h-4" /> ดึงข้อมูลใหม่จาก Cloud
                    </button>
                 </div>
              </SettingSection>

              <SettingSection title="เงินเดือนแยกตามปี">
                 <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                       <input type="number" placeholder="ปี (ค.ศ.)" value={newYearInput} onChange={e => setNewYearInput(e.target.value)} className="w-24 bg-slate-50 p-3 rounded-xl" />
                       <input type="number" placeholder="เงินเดือน" value={newSalaryInput} onChange={e => setNewSalaryInput(e.target.value)} className="flex-1 bg-slate-50 p-3 rounded-xl" />
                       <button onClick={addYearlySalary} className="bg-blue-600 text-white p-3 rounded-xl"><Save className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-2">
                       {Object.entries(settings.yearlySalaries).map(([year, sal]) => (
                          <div key={year} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                             <span className="font-bold">ปี {year}</span>
                             <div className="flex items-center gap-3">
                                <span className="font-bold text-blue-600">฿{sal.toLocaleString()}</span>
                                <button onClick={() => deleteYearlySalary(year)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                             </div>
                          </div>
                       ))}
                       {Object.keys(settings.yearlySalaries).length === 0 && <p className="text-center text-[10px] text-slate-400 italic">ยังไม่มีประวัติเงินเดือนรายปี ระบบจะใช้เงินเดือนพื้นฐานแทน</p>}
                    </div>
                 </div>
              </SettingSection>

              <SettingSection title="ข้อมูลพื้นฐาน">
                 <SettingRow label="เงินเดือนพื้นฐาน" value={settings.baseSalary} onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} />
                 <SettingRow label="วันทำงาน/เดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseFloat(v) || 1})} />
                 <SettingRow label="ชม.ทำงาน/วัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseFloat(v) || 1})} />
              </SettingSection>

              <SettingSection title="สวัสดิการและรายรับอื่นๆ">
                 <SettingRow label="ค่าอาหาร" value={settings.foodAllowance} onChange={v => setSettings({...settings, foodAllowance: parseFloat(v) || 0})} />
                 <SettingRow label="เบี้ยขยัน" value={settings.diligenceAllowance} onChange={v => setSettings({...settings, diligenceAllowance: parseFloat(v) || 0})} />
                 <SettingRow label="ค่ากะ" value={settings.shiftAllowance} onChange={v => setSettings({...settings, shiftAllowance: parseFloat(v) || 0})} />
                 <SettingRow label="รายรับพิเศษ" value={settings.specialIncome} onChange={v => setSettings({...settings, specialIncome: parseFloat(v) || 0})} />
              </SettingSection>

              <SettingSection title="รายหัก">
                 <SettingRow label="กองทุนสำรองฯ (%)" value={settings.providentFundRate} onChange={v => setSettings({...settings, providentFundRate: parseFloat(v) || 0})} />
                 <div className="flex justify-between items-center px-6 py-5">
                    <label className="text-sm font-bold text-slate-600">หักประกันสังคม (5%)</label>
                    <button onClick={() => setSettings({...settings, enableSocialSecurity: !settings.enableSocialSecurity})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableSocialSecurity ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableSocialSecurity ? 'left-7' : 'left-1'}`}></div>
                    </button>
                 </div>
              </SettingSection>

              <button onClick={handleLogoutAction} className={`w-full p-5 rounded-2xl font-bold border transition-all ${logoutConfirm ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {logoutConfirm ? 'ยืนยันออกจากระบบ' : 'ออกจากระบบ / สลับบัญชี'}
              </button>
           </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
              <h3 className="text-2xl font-bold mb-6">บันทึกเวลาโอที</h3>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันที่</label>
                   <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">จำนวน ชม.</label>
                    <input type="number" step="0.5" value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">เรทค่าแรง</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold">
                      {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <input type="text" placeholder="หมายเหตุ" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold" />
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl ios-active">บันทึกข้อมูล</button>
              </form>
          </div>
        </div>
      )}

      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDayInfo(null)}></div>
           <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-h-[80vh] overflow-y-auto">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-900">รายละเอียด {parseLocalDate(selectedDayInfo.dateStr).getDate()} {MONTHS_TH[parseLocalDate(selectedDayInfo.dateStr).getMonth()]}</h3>
                 <button onClick={() => { setIsAdding(true); setFormData({...formData, date: selectedDayInfo.dateStr}); setSelectedDayInfo(null); }} className="p-2 bg-blue-50 text-blue-600 rounded-full ios-active transition-transform active:scale-90"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 pb-10">
                 {selectedDayInfo.records.map(record => (
                    <div key={record.id} className="bg-slate-50 p-5 rounded-3xl flex justify-between items-center border border-slate-100">
                       <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-800 text-lg">{record.hours} ชม.</span>
                             <span className="text-[10px] bg-white px-2 py-1 rounded-full border border-slate-200 font-bold">x{record.type}</span>
                          </div>
                          {record.note && <p className="text-[11px] font-bold text-black mt-1 opacity-70">{record.note}</p>}
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-black">฿{record.totalAmount.toLocaleString()}</span>
                          <button onClick={() => { setRecords(prev => prev.filter(r => r.id !== record.id)); setSelectedDayInfo(null); }} className="text-red-400 p-2 ios-active"><Trash2 className="w-5 h-5" /></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
