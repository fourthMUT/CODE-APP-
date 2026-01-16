
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
  Smartphone
} from 'lucide-react';
import { OTRecord, UserSettings, OTType } from './types.ts';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants.ts';

// คีย์หลักที่ใช้ในการเชื่อมต่อ (เปลี่ยนเพื่อรีเซ็ตกรณีพัง)
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
    <div className={`${className} flex items-center justify-center overflow-hidden bg-slate-50 border border-slate-100`}>
      {!error ? (
        <img 
          src="logo.png" 
          alt="BFC MONEY" 
          className="w-full h-full object-contain"
          onError={() => setError(true)}
        />
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
  
  const [currentViewMonth, setCurrentViewMonth] = useState(() => {
    const now = new Date();
    return getCycleMonthStr(formatLocalISO(now));
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ dateStr: string, records: OTRecord[] } | null>(null);

  // Sync Engine V4 States
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'offline'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncErrorLog, setSyncErrorLog] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncTimeoutRef = useRef<number | null>(null);

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  const [newYearInput, setNewYearInput] = useState(new Date().getFullYear().toString());
  const [newSalaryInput, setNewSalaryInput] = useState('0');

  // Monitor Connectivity
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const getSyncKey = (email: string) => {
    return `${CLOUD_NAMESPACE}_${btoa(email.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
  };

  // Improved Sync Engine
  const performCloudSync = useCallback(async (action: 'push' | 'pull', email: string, dataToPush?: any) => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return { success: false, error: 'Network Offline' };
    }

    setSyncStatus('syncing');
    setSyncErrorLog(null);
    const key = getSyncKey(email);
    const url = `https://kvdb.io/S3Vp4jFfC4r5qG8z9/${key}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: action === 'push' ? 'POST' : 'GET',
        headers: action === 'push' ? { 'Content-Type': 'application/json' } : {},
        body: action === 'push' ? JSON.stringify({ ...dataToPush, ts: Date.now() }) : undefined,
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = action === 'pull' ? await response.json() : null;
      
      setSyncStatus('success');
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      setTimeout(() => setSyncStatus('idle'), 3000);
      return { success: true, data };
    } catch (e: any) {
      console.error('Cloud Sync Error:', e);
      setSyncStatus('error');
      setSyncErrorLog(e.message || 'Unknown error');
      return { success: false, error: e.message };
    }
  }, []);

  const handlePullData = useCallback(async (email: string) => {
    const result = await performCloudSync('pull', email);
    if (result.success && result.data && result.data.records) {
      setRecords(result.data.records);
      setSettings(result.data.settings);
      return true;
    }
    return false;
  }, [performCloudSync]);

  const handlePushData = useCallback(async () => {
    if (!userEmail) return;
    await performCloudSync('push', userEmail, { records, settings });
  }, [userEmail, records, settings, performCloudSync]);

  // Initial Load Logic
  useEffect(() => {
    if (userEmail) {
      const init = async () => {
        const localRecs = localStorage.getItem(`ot_recs_${userEmail}`);
        const localSett = localStorage.getItem(`ot_sett_${userEmail}`);
        if (localRecs) setRecords(JSON.parse(localRecs));
        if (localSett) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localSett) });
        await handlePullData(userEmail);
        setIsFirstLoad(false);
      };
      init();
    }
  }, [userEmail, handlePullData]);

  // Persistent Save Logic
  useEffect(() => {
    if (userEmail && !isFirstLoad) {
      localStorage.setItem(`ot_recs_${userEmail}`, JSON.stringify(records));
      localStorage.setItem(`ot_sett_${userEmail}`, JSON.stringify(settings));
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
        handlePushData();
      }, 3000);
      return () => {
        if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
      };
    }
  }, [records, settings, userEmail, isFirstLoad, handlePushData]);

  const handleLogin = (e: React.FormEvent) => {
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
    setRecords([]);
  };

  const copyManualBackup = () => {
    const backupData = JSON.stringify({ records, settings });
    const encoded = btoa(unescape(encodeURIComponent(backupData)));
    navigator.clipboard.writeText(encoded);
    alert('คัดลอกรหัสข้อมูลแล้ว');
  };

  const getSalaryForYear = (year: string) => settings.yearlySalaries[year] || settings.baseSalary;
  const currentViewSalary = useMemo(() => getSalaryForYear(currentViewMonth.split('-')[0]), [settings, currentViewMonth]);

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
      days.push({ date: new Date(curr), dateStr, records: dayRecords, isToday: dateStr === todayStr });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [periodRange, filteredRecords]);

  const monthlySummaries = useMemo(() => {
    const summaries: Record<string, { totalOT: number, totalHours: number, count: number }> = {};
    records.forEach(r => {
      const cycleMonth = getCycleMonthStr(r.date);
      if (!summaries[cycleMonth]) summaries[cycleMonth] = { totalOT: 0, totalHours: 0, count: 0 };
      summaries[cycleMonth].totalOT += r.totalAmount;
      summaries[cycleMonth].totalHours += r.hours;
      summaries[cycleMonth].count += 1;
    });
    return Object.entries(summaries).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => ({ month, ...data }));
  }, [records]);

  const calculatedSocialSecurity = useMemo(() => {
    if (!settings.enableSocialSecurity) return 0;
    const baseForSS = currentViewSalary + settings.foodAllowance;
    return Math.min(settings.socialSecurityMax, Math.floor(baseForSS * (settings.socialSecurityRate / 100)));
  }, [currentViewSalary, settings]);

  const calculatedPvdAmount = useMemo(() => (currentViewSalary * (settings.providentFundRate || 0)) / 100, [currentViewSalary, settings.providentFundRate]);

  const monthlyStats = useMemo(() => {
    const totalOT = filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0);
    const gross = currentViewSalary + totalOT + settings.foodAllowance + settings.diligenceAllowance + settings.shiftAllowance + settings.specialIncome;
    const net = gross - (calculatedPvdAmount + calculatedSocialSecurity);
    return { totalOT, netSalary: net };
  }, [filteredRecords, currentViewSalary, settings, calculatedSocialSecurity, calculatedPvdAmount]);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const salaryAtTime = getSalaryForYear(formData.date.split('-')[0]);
    const hRate = salaryAtTime / (settings.workingDaysPerMonth * settings.workingHoursPerDay);
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

  if (!userEmail) {
    return (
      <div className="min-h-screen max-w-lg mx-auto bg-[#1e293b] flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="w-full space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center gap-6">
             <LogoImage className="w-24 h-24 rounded-[2rem] shadow-2xl p-1" />
             <div className="text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight">BFC MONEY</h1>
                <p className="text-[#38bdf8] font-bold text-[10px] uppercase tracking-[0.4em] mt-2">V4 RESILIENT CLOUD</p>
             </div>
          </div>
          <form onSubmit={handleLogin} className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">อีเมลผู้ใช้งาน</label>
               <input 
                 type="email" required placeholder="name@company.com" 
                 className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl font-bold text-black focus:border-blue-500 transition-all outline-none"
                 value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
               />
            </div>
            <button type="submit" className="w-full bg-[#1e3a8a] text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-2 ios-active shadow-xl shadow-blue-900/20">
               เข้าสู่ระบบและกู้ข้อมูล <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col overflow-hidden">
      {/* Unified Sticky Header Container */}
      <div className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        {/* Safe Area Spacer for iOS Notch */}
        <div style={{ height: 'env(safe-area-inset-top)' }} className="bg-white" />
        
        {/* Main Brand Header */}
        <header className="px-6 py-4 flex justify-between items-center h-16">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <LogoImage className="w-8 h-8 rounded-lg shadow-sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.1em] truncate block leading-none">{userEmail}</span>
                {syncStatus === 'syncing' ? <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin" /> : 
                 syncStatus === 'success' ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : 
                 syncStatus === 'offline' ? <WifiOff className="w-2.5 h-2.5 text-slate-400" /> :
                 syncStatus === 'error' ? <AlertCircle className="w-2.5 h-2.5 text-red-500" /> : 
                 <Cloud className="w-2.5 h-2.5 text-slate-300" />}
              </div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">BFC MONEY</h1>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
             <button onClick={() => setViewMode('summary')} className={`p-2 rounded-full ios-active ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <BarChart3 className="w-4.5 h-4.5" />
             </button>
             <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-2 bg-slate-100 rounded-full ios-active">
                {viewMode === 'list' ? <LayoutGrid className="w-4.5 h-4.5 text-slate-600" /> : <ListIcon className="w-4.5 h-4.5 text-slate-600" />}
             </button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-100 rounded-full ios-active">
                <SettingsIcon className="w-4.5 h-4.5 text-slate-600" />
             </button>
          </div>
        </header>

        {/* Sync Alert (Inside Sticky Header) */}
        {syncStatus === 'error' && (
          <div className="bg-red-500 text-white text-[10px] py-1.5 px-6 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
              <CloudOff className="w-3 h-3 shrink-0" />
              <span className="font-bold truncate">การเชื่อมต่อ Cloud ขัดข้อง ({syncErrorLog})</span>
            </div>
            <button onClick={() => handlePushData()} className="bg-white/20 px-3 py-0.5 rounded-full font-bold hover:bg-white/30 transition-colors shrink-0 ml-2">ลองใหม่</button>
          </div>
        )}
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
                            <div className="font-bold text-slate-800 text-sm">{record.hours} ชม. <span className="text-[10px] text-blue-600 ml-1 font-bold">x{record.type}</span></div>
                            {record.note && <div className="text-[10px] text-slate-400 font-medium">{record.note}</div>}
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="font-bold text-sm">฿{record.totalAmount.toLocaleString()}</div>
                          <button onClick={() => setRecords(prev => prev.filter(r => r.id !== record.id))} className="text-slate-300 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                ))}
                {filteredRecords.length === 0 && (
                  <div className="text-center py-12 text-slate-300 opacity-50 flex flex-col items-center">
                      <CalendarDays className="w-10 h-10 mb-2" />
                      <p className="text-xs font-bold">ยังไม่มีข้อมูลโอทีในรอบนี้</p>
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
                              if (item.records.length > 0) setSelectedDayInfo(item);
                              else { setFormData({...formData, date: item.dateStr}); setIsAdding(true); }
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
        ) : (
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2 mb-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-800">ประวัติรายเดือน</h2>
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
          </div>
        )}
      </main>

      {/* Action FAB */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none z-40">
         <button onClick={() => setIsAdding(true)} className="bg-[#1e3a8a] text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center pointer-events-auto ios-active transform transition-transform active:scale-90">
            <Plus className="w-8 h-8" />
         </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 bg-white border-b flex justify-between items-center shadow-sm">
              <div style={{ height: 'env(safe-area-inset-top)' }} className="w-full bg-white" />
              <div className="flex w-full justify-between items-center py-4">
                <h3 className="text-xl font-bold">การตั้งค่า</h3>
                <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 bg-blue-50 rounded-2xl ios-active">เสร็จสิ้น</button>
              </div>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              <SettingSection title="การเชื่อมโยงข้อมูล (Cloud V4)">
                 <div className="p-6 space-y-5">
                    <div className="flex items-center gap-4">
                       <div className={`p-4 rounded-2xl ${syncStatus === 'success' ? 'bg-green-50 text-green-600' : syncStatus === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                          {syncStatus === 'syncing' ? <RefreshCw className="w-6 h-6 animate-spin" /> : 
                           syncStatus === 'error' ? <CloudOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm">Cloud Backup</h4>
                          <p className="text-[10px] text-slate-500 truncate">
                             {syncStatus === 'error' ? `ผิดพลาด: ${syncErrorLog}` : `ซิงค์ล่าสุด: ${lastSyncTime || '-'}`}
                          </p>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handlePullData(userEmail!)} className="flex items-center justify-center gap-2 bg-white text-slate-700 p-4 rounded-2xl font-bold border shadow-sm ios-active">
                        <CloudDownload className="w-4 h-4" /> ดึงข้อมูล
                      </button>
                      <button onClick={() => handlePushData()} className="flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-2xl font-bold ios-active shadow-lg">
                        <CloudUpload className="w-4 h-4" /> ส่งข้อมูล
                      </button>
                    </div>
                 </div>
              </SettingSection>

              <SettingSection title="ข้อมูลเงินเดือน">
                 <SettingRow label="เงินเดือนหลัก" value={settings.baseSalary} onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} />
                 <SettingRow label="วันทำงาน/เดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseFloat(v) || 1})} />
                 <SettingRow label="ชม.ทำงาน/วัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseFloat(v) || 1})} />
              </SettingSection>

              <button onClick={handleLogoutAction} className={`w-full p-5 rounded-2xl font-bold border transition-all ${logoutConfirm ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {logoutConfirm ? 'ยืนยันออกจากระบบ' : 'ออกจากระบบ / สลับบัญชี'}
              </button>
           </div>
        </div>
      )}

      {/* Record Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
              <h3 className="text-2xl font-bold mb-6">บันทึกโอที</h3>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันที่</label>
                   <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ชั่วโมง</label>
                    <input type="number" step="0.5" value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">เรท</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border-0 font-bold">
                      {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl ios-active">บันทึกข้อมูล</button>
              </form>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDayInfo(null)}></div>
           <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full max-h-[80vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-900">รายละเอียดวันที่ {parseLocalDate(selectedDayInfo.dateStr).getDate()}</h3>
                 <button onClick={() => { setIsAdding(true); setFormData({...formData, date: selectedDayInfo.dateStr}); setSelectedDayInfo(null); }} className="p-2 bg-blue-50 text-blue-600 rounded-full ios-active"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 pb-12">
                 {selectedDayInfo.records.map(record => (
                    <div key={record.id} className="bg-slate-50 p-5 rounded-3xl flex justify-between items-center border border-slate-100 shadow-sm">
                       <div>
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-800 text-lg">{record.hours} ชม.</span>
                             <span className="text-[10px] bg-white px-2 py-1 rounded-full border border-slate-200 font-bold">x{record.type}</span>
                          </div>
                          {record.note && <p className="text-xs font-medium text-slate-500 mt-1">{record.note}</p>}
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-slate-900">฿{record.totalAmount.toLocaleString()}</span>
                          <button onClick={() => { setRecords(prev => prev.filter(r => r.id !== record.id)); setSelectedDayInfo(null); }} className="text-red-400 p-2 ios-active transition-colors"><Trash2 className="w-5 h-5" /></button>
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
