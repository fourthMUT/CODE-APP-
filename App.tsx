
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
  WifiOff,
  ShieldCheck,
  Zap,
  ExternalLink,
  Smartphone,
  Loader2
} from 'lucide-react';
import { OTRecord, UserSettings, OTType, MonthlyAdjustment } from './types.ts';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants.ts';

const CLOUD_NAMESPACE = 'bfc_v4_resilient';

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
    if (cycleMonth > 11) { cycleMonth = 0; cycleYear += 1; }
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
    <div className={`${className} flex items-center justify-center overflow-hidden bg-slate-50 border border-slate-100`}>
      {!error ? (
        <img src="logo.png" alt="BFC MONEY" className="w-full h-full object-contain" onError={() => setError(true)} />
      ) : (
        <div className="w-full h-full bg-blue-600 flex flex-col items-center justify-center text-white p-1 text-center">
          <TrendingUp className="w-4 h-4" />
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
  const [currentViewMonth, setCurrentViewMonth] = useState(() => getCycleMonthStr(formatLocalISO(new Date())));

  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ dateStr: string, records: OTRecord[] } | null>(null);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'offline'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncErrorLog, setSyncErrorLog] = useState<string | null>(null);
  const [isPullingInitial, setIsPullingInitial] = useState(false);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const syncTimeoutRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({ date: formatLocalISO(new Date()), hours: 1, type: 1.5 as OTType, note: '' });
  const [newYearInput, setNewYearInput] = useState(new Date().getFullYear().toString());
  const [newSalaryInput, setNewSalaryInput] = useState('0');

  // ดึงค่าสวัสดิการและข้อมูลการทำงานของเดือนนั้นๆ
  const getMonthlyWelfare = useCallback((monthStr: string): MonthlyAdjustment => {
    const adj = settings.monthlyAdjustments?.[monthStr];
    if (adj) return { ...adj };
    
    // หากไม่มีการตั้งค่าเดือนนั้น ให้ใช้ค่าจาก Global เป็นค่าเริ่มต้น
    return {
      baseSalary: undefined,
      workingDaysPerMonth: settings.workingDaysPerMonth,
      workingHoursPerDay: settings.workingHoursPerDay,
      foodAllowance: settings.foodAllowance,
      diligenceAllowance: settings.diligenceAllowance,
      shiftAllowance: settings.shiftAllowance,
      specialIncome: settings.specialIncome,
      providentFundRate: settings.providentFundRate,
      enableSocialSecurity: settings.enableSocialSecurity
    };
  }, [settings]);

  // ดึงเงินเดือนที่มีผลบังคับใช้ในเดือนนั้นๆ
  const getEffectiveSalary = useCallback((monthStr: string) => {
    const adj = settings.monthlyAdjustments?.[monthStr];
    if (adj?.baseSalary !== undefined && adj.baseSalary > 0) return adj.baseSalary;
    const yearStr = monthStr.split('-')[0];
    return settings.yearlySalaries[yearStr] || settings.baseSalary;
  }, [settings]);

  // คำนวณค่าโอทีโดยดึง วันทำงาน/ชม.ทำงาน จาก Monthly Adjustment ของเดือนนั้นๆ
  const calculateOTAmount = useCallback((record: OTRecord, salary: number, monthStr: string) => {
    const welfare = getMonthlyWelfare(monthStr);
    const hRate = salary / (welfare.workingDaysPerMonth * welfare.workingHoursPerDay);
    return record.hours * hRate * record.type;
  }, [getMonthlyWelfare]);

  const updateMonthlySetting = (field: keyof MonthlyAdjustment, value: any) => {
    const currentAdj = getMonthlyWelfare(currentViewMonth);
    setSettings({
      ...settings,
      monthlyAdjustments: {
        ...settings.monthlyAdjustments,
        [currentViewMonth]: { ...currentAdj, [field]: value }
      }
    });
  };

  const performCloudSync = useCallback(async (action: 'push' | 'pull', email: string, dataToPush?: any) => {
    if (!navigator.onLine) { setSyncStatus('offline'); return { success: false, error: 'Offline' }; }
    setSyncStatus('syncing');
    const key = `bfc_v4_resilient_${btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
    const url = `https://kvdb.io/S3Vp4jFfC4r5qG8z9/${key}`;
    try {
      const response = await fetch(url, {
        method: action === 'push' ? 'POST' : 'GET',
        headers: action === 'push' ? { 'Content-Type': 'application/json' } : {},
        body: action === 'push' ? JSON.stringify({ ...dataToPush, ts: Date.now() }) : undefined,
      });
      if (!response.ok && action === 'pull' && response.status === 404) { setSyncStatus('idle'); return { success: true, data: null }; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = action === 'pull' ? await response.json() : null;
      setSyncStatus('success');
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      setTimeout(() => setSyncStatus('idle'), 3000);
      return { success: true, data };
    } catch (e: any) { setSyncStatus('error'); setSyncErrorLog(e.message); return { success: false, error: e.message }; }
  }, []);

  const handlePullData = useCallback(async (email: string) => {
    const result = await performCloudSync('pull', email);
    if (result.success && result.data && result.data.records) {
      setRecords(result.data.records);
      setSettings({ ...DEFAULT_SETTINGS, ...result.data.settings });
      return true;
    }
    return false;
  }, [performCloudSync]);

  const handlePushData = useCallback(async () => {
    if (!userEmail || !isSyncReady) return;
    await performCloudSync('push', userEmail, { records, settings });
  }, [userEmail, records, settings, isSyncReady, performCloudSync]);

  useEffect(() => {
    if (userEmail) {
      const init = async () => {
        setIsPullingInitial(true);
        const localRecs = localStorage.getItem(`ot_recs_${userEmail}`);
        const localSett = localStorage.getItem(`ot_sett_${userEmail}`);
        if (localRecs) setRecords(JSON.parse(localRecs));
        if (localSett) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localSett) });
        await handlePullData(userEmail);
        setIsPullingInitial(false);
        setIsSyncReady(true);
      };
      init();
    }
  }, [userEmail, handlePullData]);

  useEffect(() => {
    if (userEmail && isSyncReady) {
      localStorage.setItem(`ot_recs_${userEmail}`, JSON.stringify(records));
      localStorage.setItem(`ot_sett_${userEmail}`, JSON.stringify(settings));
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => handlePushData(), 3000);
      return () => { if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current); };
    }
  }, [records, settings, userEmail, isSyncReady, handlePushData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.includes('@')) {
      const email = emailInput.toLowerCase().trim();
      localStorage.setItem('ot_bfc_user_email', email);
      setUserEmail(email);
    }
  };

  const handleLogoutAction = () => {
    if (!logoutConfirm) { setLogoutConfirm(true); setTimeout(() => setLogoutConfirm(false), 5000); return; }
    localStorage.removeItem('ot_bfc_user_email');
    setUserEmail(null); setIsSettingsOpen(false); setIsSyncReady(false); setRecords([]);
  };

  const currentViewSalary = useMemo(() => getEffectiveSalary(currentViewMonth), [getEffectiveSalary, currentViewMonth]);
  const periodRange = useMemo(() => {
    const [year, month] = currentViewMonth.split('-').map(Number);
    const startDate = new Date(year, month - 2, 16);
    const endDate = new Date(year, month - 1, 15);
    return { start: formatLocalISO(startDate), end: formatLocalISO(endDate), startDayOfWeek: startDate.getDay() };
  }, [currentViewMonth]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => r.date >= periodRange.start && r.date <= periodRange.end).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, periodRange]);

  const calendarDays = useMemo(() => {
    const days = [];
    let curr = parseLocalDate(periodRange.start);
    const last = parseLocalDate(periodRange.end);
    const todayStr = formatLocalISO(new Date());
    while (curr <= last) {
      const dateStr = formatLocalISO(curr);
      const dayRecords = filteredRecords.filter(r => r.date === dateStr);
      days.push({ date: new Date(curr), dateStr, records: dayRecords, isToday: dateStr === todayStr });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [periodRange, filteredRecords]);

  // สถิติรายเดือน
  const monthlyStats = useMemo(() => {
    const welfare = getMonthlyWelfare(currentViewMonth);
    const mainSalary = currentViewSalary;
    
    const totalOT = filteredRecords.reduce((sum, r) => {
      const cycleMonthOfRecord = getCycleMonthStr(r.date);
      const salaryForRecord = getEffectiveSalary(cycleMonthOfRecord);
      return sum + calculateOTAmount(r, salaryForRecord, cycleMonthOfRecord);
    }, 0);
    
    const pvd = (mainSalary * welfare.providentFundRate) / 100;
    let ss = 0;
    if (welfare.enableSocialSecurity) {
      const baseForSS = mainSalary + welfare.foodAllowance;
      ss = Math.min(settings.socialSecurityMax, Math.floor(baseForSS * (settings.socialSecurityRate / 100)));
    }
    const gross = mainSalary + totalOT + welfare.foodAllowance + welfare.diligenceAllowance + welfare.shiftAllowance + welfare.specialIncome;
    return { totalOT, netSalary: gross - (pvd + ss), welfare, pvd, ss };
  }, [filteredRecords, currentViewSalary, currentViewMonth, getMonthlyWelfare, getEffectiveSalary, calculateOTAmount, settings]);

  const monthlySummaries = useMemo(() => {
    const summaries: Record<string, { totalOT: number, totalHours: number, count: number }> = {};
    records.forEach(r => {
      const cycleMonth = getCycleMonthStr(r.date);
      if (!summaries[cycleMonth]) summaries[cycleMonth] = { totalOT: 0, totalHours: 0, count: 0 };
      const salaryForRecord = getEffectiveSalary(cycleMonth);
      summaries[cycleMonth].totalOT += calculateOTAmount(r, salaryForRecord, cycleMonth);
      summaries[cycleMonth].totalHours += r.hours;
      summaries[cycleMonth].count += 1;
    });
    return Object.entries(summaries).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => ({ month, ...data }));
  }, [records, getEffectiveSalary, calculateOTAmount]);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const cycleMonth = getCycleMonthStr(formData.date);
    const salaryForDate = getEffectiveSalary(cycleMonth);
    const welfare = getMonthlyWelfare(cycleMonth);
    const hRate = salaryForDate / (welfare.workingDaysPerMonth * welfare.workingHoursPerDay);
    const newRecord: OTRecord = {
      id: Date.now().toString(),
      date: formData.date,
      hours: formData.hours,
      type: formData.type,
      hourlyRateAtTime: hRate,
      totalAmount: formData.hours * hRate * formData.type,
      note: formData.note
    };
    setRecords(prev => [newRecord, ...prev]);
    setIsAdding(false);
    setFormData({ ...formData, note: '' });
  };

  const currentWelfare = monthlyStats.welfare;

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col overflow-hidden">
      {isPullingInitial && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-6" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">กำลังโหลด...</h2>
        </div>
      )}

      <div className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-white" />
        <header className="px-6 py-4 flex justify-between items-center h-16">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <LogoImage className="w-8 h-8 rounded-lg shadow-sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.1em] truncate block leading-none">{userEmail}</span>
                {syncStatus === 'syncing' ? <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" /> : 
                 syncStatus === 'success' ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : 
                 syncStatus === 'error' ? <AlertCircle className="w-2.5 h-2.5 text-red-500" /> : 
                 <Cloud className="w-2.5 h-2.5 text-slate-300" />}
              </div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">BFC MONEY</h1>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
             <button onClick={() => setViewMode('summary')} className={`p-2 rounded-full ios-active ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><BarChart3 className="w-4.5 h-4.5" /></button>
             <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-2 bg-slate-100 rounded-full ios-active">{viewMode === 'list' ? <LayoutGrid className="w-4.5 h-4.5 text-slate-600" /> : <ListIcon className="w-4.5 h-4.5 text-slate-600" />}</button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-100 rounded-full ios-active"><SettingsIcon className="w-4.5 h-4.5 text-slate-600" /></button>
          </div>
        </header>
      </div>

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto">
        {viewMode !== 'summary' ? (
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
              <button onClick={() => setShowBreakdown(!showBreakdown)} className="w-full bg-[#1e3a8a] text-white p-6 rounded-3xl font-bold flex flex-col items-center ios-active shadow-xl shadow-blue-900/10 transition-all">
                <span className="text-xs opacity-80 mb-1">ยอดสุทธิรับจริง</span>
                <span className="text-3xl font-bold">฿{monthlyStats.netSalary.toLocaleString()}</span>
              </button>
            </div>

            {showBreakdown && (
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-3 animate-in slide-in-from-top-4">
                <BreakdownRow label="เงินเดือนประจำเดือน" value={currentViewSalary} />
                <BreakdownRow label="ค่าล่วงเวลา (OT)" value={monthlyStats.totalOT} isHighlight />
                <BreakdownRow label="ค่าอาหาร" value={currentWelfare.foodAllowance} />
                <BreakdownRow label="เบี้ยขยัน" value={currentWelfare.diligenceAllowance} />
                <BreakdownRow label="ค่ากะ" value={currentWelfare.shiftAllowance} />
                <BreakdownRow label="รายรับพิเศษ" value={currentWelfare.specialIncome} />
                <div className="border-t pt-3 mt-1 space-y-1">
                    <BreakdownRow label="หักประกันสังคม" value={-monthlyStats.ss} isNegative />
                    <BreakdownRow label="หักกองทุนสำรองฯ" value={-monthlyStats.pvd} isNegative />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredRecords.map(record => {
                const cycleMonthOfRecord = getCycleMonthStr(record.date);
                const salaryForRecord = getEffectiveSalary(cycleMonthOfRecord);
                const amount = calculateOTAmount(record, salaryForRecord, cycleMonthOfRecord);
                return (
                  <div key={record.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center font-bold">
                          <span className="text-xs">{parseLocalDate(record.date).getDate()}</span>
                          <span className="text-[8px] text-slate-400 uppercase">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0,3)}</span>
                        </div>
                        <div><div className="font-bold text-slate-800 text-sm">{record.hours} ชม. <span className="text-[10px] text-blue-600 ml-1 font-bold">x{record.type}</span></div>{record.note && <div className="text-[10px] text-slate-400 font-medium">{record.note}</div>}</div>
                    </div>
                    <div className="flex items-center gap-3"><div className="font-bold text-sm">฿{amount.toLocaleString()}</div><button onClick={() => setRecords(prev => prev.filter(r => r.id !== record.id))} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-4">
             {monthlySummaries.map((s) => {
               const [y, m] = s.month.split('-').map(Number);
               return (
                <button key={s.month} onClick={() => { setCurrentViewMonth(s.month); setViewMode('list'); }} className="w-full bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center ios-active text-left">
                  <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">วิก</span><h3 className="text-lg font-bold text-slate-800">{MONTHS_TH[m - 1]} {y + 543}</h3></div>
                  <div className="text-right"><span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">OT รวม</span><span className="text-xl font-bold text-blue-600">฿{s.totalOT.toLocaleString()}</span></div>
                </button>
               );
             })}
          </div>
        )}
      </main>

      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none z-40">
         <button onClick={() => setIsAdding(true)} className="bg-[#1e3a8a] text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center pointer-events-auto ios-active"><Plus className="w-8 h-8" /></button>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 bg-white border-b shadow-sm">
              <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-white" />
              <div className="flex justify-between items-center py-4">
                <h3 className="text-xl font-bold">การตั้งค่า</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 bg-blue-50 rounded-2xl ios-active">เสร็จสิ้น</button>
              </div>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              <SettingSection title={`ข้อมูลเดือน ${MONTHS_TH[parseInt(currentViewMonth.split('-')[1])-1]}`}>
                <div className="bg-blue-50/30 px-6 py-4 border-b border-blue-50">
                  <p className="text-[10px] font-bold text-blue-600 leading-relaxed uppercase">ตั้งค่าเฉพาะเดือนนี้: เงินเดือน, วันทำงาน, ชม.ทำงาน และสวัสดิการ</p>
                </div>
                <SettingRow label="เงินเดือนเดือนนี้" value={currentWelfare.baseSalary || 0} onChange={v => updateMonthlySetting('baseSalary', parseFloat(v) || 0)} />
                <SettingRow label="วันทำงาน/เดือน" value={currentWelfare.workingDaysPerMonth} onChange={v => updateMonthlySetting('workingDaysPerMonth', parseFloat(v) || 1)} />
                <SettingRow label="ชม.ทำงาน/วัน" value={currentWelfare.workingHoursPerDay} onChange={v => updateMonthlySetting('workingHoursPerDay', parseFloat(v) || 1)} />
                <SettingRow label="ค่าอาหาร" value={currentWelfare.foodAllowance} onChange={v => updateMonthlySetting('foodAllowance', parseFloat(v) || 0)} />
                <SettingRow label="เบี้ยขยัน" value={currentWelfare.diligenceAllowance} onChange={v => updateMonthlySetting('diligenceAllowance', parseFloat(v) || 0)} />
                <SettingRow label="ค่ากะ" value={currentWelfare.shiftAllowance} onChange={v => updateMonthlySetting('shiftAllowance', parseFloat(v) || 0)} />
                <SettingRow label="รายรับพิเศษ" value={currentWelfare.specialIncome} onChange={v => updateMonthlySetting('specialIncome', parseFloat(v) || 0)} />
                <SettingRow label="กองทุน (%)" value={currentWelfare.providentFundRate} onChange={v => updateMonthlySetting('providentFundRate', parseFloat(v) || 0)} />
                <div className="flex justify-between items-center px-6 py-5">
                    <label className="text-sm font-bold text-slate-600">หักประกันสังคม</label>
                    <button onClick={() => updateMonthlySetting('enableSocialSecurity', !currentWelfare.enableSocialSecurity)} className={`w-12 h-6 rounded-full transition-colors relative ${currentWelfare.enableSocialSecurity ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentWelfare.enableSocialSecurity ? 'left-7' : 'left-1'}`}></div>
                    </button>
                 </div>
              </SettingSection>

              <SettingSection title="ข้อมูลหลัก & ปี">
                <div className="p-6 space-y-4">
                  <div className="space-y-1 mb-4">
                     <label className="text-[10px] font-bold text-slate-400 uppercase">เงินเดือนพื้นฐาน (Global)</label>
                     <input type="number" value={settings.baseSalary} onChange={e => setSettings({...settings, baseSalary: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-3 rounded-xl font-bold" />
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="ปี ค.ศ." value={newYearInput} onChange={e => setNewYearInput(e.target.value)} className="w-24 bg-slate-50 p-3 rounded-xl font-bold" />
                    <input type="number" placeholder="เงินเดือนปีนี้" value={newSalaryInput} onChange={e => setNewSalaryInput(e.target.value)} className="flex-1 bg-slate-50 p-3 rounded-xl font-bold" />
                    <button onClick={() => { if (!newYearInput || !newSalaryInput) return; setSettings({...settings, yearlySalaries: {...settings.yearlySalaries, [newYearInput]: parseFloat(newSalaryInput)}}); setNewSalaryInput('0'); }} className="bg-blue-600 text-white p-3 rounded-xl"><Save className="w-5 h-5" /></button>
                  </div>
                  {Object.entries(settings.yearlySalaries).sort((a,b) => b[0].localeCompare(a[0])).map(([year, sal]) => (
                    <div key={year} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl"><span className="font-bold text-sm">ปี {year}</span><div className="flex items-center gap-3"><span className="font-bold text-blue-600">฿{sal.toLocaleString()}</span><button onClick={() => { const next = {...settings.yearlySalaries}; delete next[year]; setSettings({...settings, yearlySalaries: next}); }} className="text-red-400 p-1"><Trash2 className="w-4 h-4" /></button></div></div>
                  ))}
                </div>
              </SettingSection>

              <SettingSection title="Cloud Sync">
                 <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                       <div className={`p-4 rounded-2xl ${syncStatus === 'success' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{syncStatus === 'syncing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Cloud className="w-6 h-6" />}</div>
                       <div><h4 className="font-bold text-sm">สถานะ</h4><p className="text-[10px] text-slate-500">{lastSyncTime ? `ซิงค์: ${lastSyncTime}` : 'ไม่ระบุ'}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => handlePullData(userEmail!)} className="flex items-center justify-center gap-2 bg-white text-slate-700 p-4 rounded-2xl font-bold border shadow-sm ios-active"><CloudDownload className="w-4 h-4" /> ดึงข้อมูล</button>
                       <button onClick={() => handlePushData()} className="flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-2xl font-bold ios-active shadow-lg"><CloudUpload className="w-4 h-4" /> ส่งข้อมูล</button>
                    </div>
                 </div>
              </SettingSection>

              <button onClick={handleLogoutAction} className={`w-full p-5 rounded-2xl font-bold border transition-all ${logoutConfirm ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-600 border-red-100'}`}>{logoutConfirm ? 'ยืนยันออกจากระบบ' : 'ออกจากระบบ / สลับบัญชี'}</button>
           </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
              <h3 className="text-2xl font-bold mb-6">บันทึกโอที</h3>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันที่</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold" /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ชั่วโมง</label><input type="number" step="0.5" value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">เรท</label><select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold">{OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div></div>
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl ios-active">บันทึกข้อมูล</button>
              </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
