
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Calendar as CalendarIcon, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  XCircle,
  LayoutGrid,
  List as ListIcon,
  Clock,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  PlusCircle,
  CalendarDays,
  Gift,
  MinusCircle,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react';
import { OTRecord, UserSettings, OTType } from './types.ts';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants.ts';

// Helper for Google JWT Decoding
function parseJwt(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

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

const SettingSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <div className="space-y-3">
    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">{title}</h4>
    <div className="bg-white rounded-3xl shadow-sm border divide-y overflow-hidden">{children}</div>
  </div>
);

const SettingRow = ({ label, value, onChange }: { label: string, value: number, onChange: (v: string) => void }) => (
  <div className="flex justify-between items-center px-6 py-5">
    <label className="text-sm font-bold text-slate-600">{label}</label>
    <input type="number" value={value} onChange={e => onChange(e.target.value)} className="text-right font-bold w-28 bg-transparent outline-none text-black" />
  </div>
);

const BreakdownRow = ({ label, value, isHighlight, isNegative }: { label: string, value: number, isHighlight?: boolean, isNegative?: boolean }) => (
  <div className="flex justify-between items-center">
    <span className={`text-sm ${isHighlight ? 'font-bold text-blue-600' : 'text-slate-500'}`}>{label}</span>
    <span className={`text-sm font-bold ${isNegative ? 'text-red-500' : 'text-slate-900'}`}>{isNegative ? '-' : ''}฿{Math.abs(value).toLocaleString()}</span>
  </div>
);

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(() => {
    const saved = localStorage.getItem('ot_bfc_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Data States (Loaded based on user email)
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentViewMonth, setCurrentViewMonth] = useState(() => {
    const now = new Date();
    const targetMonth = now.getDate() > 15 ? now.getMonth() + 1 : now.getMonth();
    const d = new Date(now.getFullYear(), targetMonth, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [now, setNow] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<OTRecord | null>(null);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ dateStr: string, records: OTRecord[] } | null>(null);

  const [customSalaryMonth, setCustomSalaryMonth] = useState(currentViewMonth);
  const [customSalaryAmount, setCustomSalaryAmount] = useState(0);

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  // Load user data whenever user changes
  useEffect(() => {
    if (user) {
      const email = user.email;
      const savedRecords = localStorage.getItem(`ot_records_${email}`);
      const savedSettings = localStorage.getItem(`user_settings_${email}`);
      
      setRecords(savedRecords ? JSON.parse(savedRecords) : []);
      
      const parsedSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...parsedSettings,
        monthlySalaries: parsedSettings.monthlySalaries || {}
      });
    }
  }, [user]);

  // Save data whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(`ot_records_${user.email}`, JSON.stringify(records));
    }
  }, [records, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`user_settings_${user.email}`, JSON.stringify(settings));
    }
  }, [settings, user]);

  // Google Login Setup
  useEffect(() => {
    /* global google */
    const handleCredentialResponse = (response: any) => {
      const decoded = parseJwt(response.credential);
      const userData = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      };
      setUser(userData);
      localStorage.setItem('ot_bfc_user', JSON.stringify(userData));
    };

    if (typeof window !== 'undefined' && !user) {
        const interval = setInterval(() => {
            if ((window as any).google) {
                (window as any).google.accounts.id.initialize({
                    client_id: "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER.apps.googleusercontent.com", // ในระบบจริงต้องใส่ Client ID
                    callback: handleCredentialResponse,
                });
                (window as any).google.accounts.id.renderButton(
                    document.getElementById("googleBtn"),
                    { theme: "outline", size: "large", width: 280, shape: "pill", text: "signin_with" }
                );
                clearInterval(interval);
            }
        }, 500);
        return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ot_bfc_user');
    window.location.reload();
  };

  const currentSalary = useMemo(() => {
    return settings.monthlySalaries?.[currentViewMonth] || settings.baseSalary;
  }, [settings, currentViewMonth]);

  const hourlyRate = useMemo(() => {
    return currentSalary / (settings.workingDaysPerMonth * settings.workingHoursPerDay);
  }, [currentSalary, settings.workingDaysPerMonth, settings.workingHoursPerDay]);

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

  const calculatedSocialSecurity = useMemo(() => {
    if (!settings.enableSocialSecurity) return 0;
    const rate = (settings.socialSecurityRate || 5) / 100;
    const max = settings.socialSecurityMax || 750;
    const baseForSS = currentSalary + (settings.foodAllowance || 0);
    return Math.min(max, Math.floor(baseForSS * rate));
  }, [currentSalary, settings.foodAllowance, settings.enableSocialSecurity, settings.socialSecurityRate, settings.socialSecurityMax]);

  const calculatedPvdAmount = useMemo(() => {
    return (currentSalary * (settings.providentFundRate || 0)) / 100;
  }, [currentSalary, settings.providentFundRate]);

  const filteredRecords = useMemo(() => {
    return records
      .filter(r => r.date >= periodRange.start && r.date <= periodRange.end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, periodRange]);

  const monthlyStats = useMemo(() => {
    const totalOT = filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalHours = filteredRecords.reduce((sum, r) => sum + r.hours, 0);
    const totalAdditions = (settings.foodAllowance || 0) + (settings.diligenceAllowance || 0);
    const totalDeductions = calculatedPvdAmount + calculatedSocialSecurity;
    const grossSalary = currentSalary + totalOT + totalAdditions;
    const netSalary = grossSalary - totalDeductions;

    return { totalOT, totalHours, totalAdditions, totalDeductions, grossSalary, netSalary };
  }, [filteredRecords, settings, currentSalary, calculatedSocialSecurity, calculatedPvdAmount]);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const salaryAtDate = settings.monthlySalaries?.[formData.date.substring(0, 7)] || settings.baseSalary;
    const hRate = salaryAtDate / (settings.workingDaysPerMonth * settings.workingHoursPerDay);
    const amount = formData.hours * hRate * formData.type;
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    const newRecord: OTRecord = {
      id,
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

  const changeMonth = (offset: number) => {
    const [year, month] = currentViewMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCurrentViewMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleDayClick = (day: { dateStr: string, records: OTRecord[] }) => {
    if (day.records.length > 0) {
      setSelectedDayInfo(day);
    } else {
      setFormData({ ...formData, date: day.dateStr });
      setIsAdding(true);
    }
  };

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen max-w-lg mx-auto bg-white flex flex-col items-center justify-center p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-blue-600 rounded-b-[4rem] -z-10 shadow-2xl"></div>
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/20 flex flex-col items-center w-full max-w-sm">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
             <Clock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">OT BFC</h1>
          <p className="text-slate-400 text-sm text-center mb-10 leading-relaxed">บันทึกชั่วโมงโอทีและรายได้ของคุณ<br/>ให้เป็นเรื่องง่ายและแม่นยำ</p>
          <div id="googleBtn" className="mb-6"></div>
          <p className="text-[10px] text-slate-300 uppercase font-bold tracking-widest text-center leading-loose">
            ลงชื่อเข้าใช้ด้วย Gmail เพื่อบันทึกข้อมูล<br/>และเข้าถึงได้จากทุกที่
          </p>
        </div>
        <div className="mt-10 flex flex-col items-center gap-2 opacity-30">
           <ShieldCheck className="w-5 h-5 text-slate-400" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Secure Data Storage</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col">
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">ยินดีต้อนรับคุณ {user.name.split(' ')[0]}</span>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">บันทึกเวลา</h1>
            <div className="mt-1 flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-[11px] font-medium">{now.toLocaleTimeString('th-TH')} น.</span>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-2.5 bg-slate-100 rounded-full ios-active">
                {viewMode === 'list' ? <LayoutGrid className="w-5 h-5 text-slate-600" /> : <ListIcon className="w-5 h-5 text-slate-600" />}
             </button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-0.5 border-2 border-white rounded-full shadow-sm ios-active overflow-hidden">
                <img src={user.picture} alt="profile" className="w-9 h-9 object-cover" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="flex items-center justify-between mb-4 relative">
            <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-50 rounded-full ios-active border border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <div className="text-center">
                <span className="font-bold text-slate-900 text-lg">{MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]} {parseInt(currentViewMonth.split('-')[0]) + 543}</span>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 bg-slate-50 rounded-full ios-active border border-slate-100"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
          <p className="text-center text-[9px] text-slate-400 font-bold mb-8 uppercase tracking-[0.15em]">{periodRange.label}</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50/80 rounded-3xl p-5 border border-slate-50 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">รายได้โอทีสะสม</span>
              <h2 className="text-xl font-bold text-slate-800">฿{monthlyStats.totalOT.toLocaleString()}</h2>
            </div>
            <div className="bg-blue-50/30 rounded-3xl p-5 border border-blue-50/50 flex flex-col items-center">
              <span className="text-[10px] font-bold text-blue-400 uppercase mb-2">เวลาสะสม</span>
              <h2 className="text-xl font-bold text-blue-600">{monthlyStats.totalHours} <span className="text-sm font-normal">ชม.</span></h2>
            </div>
          </div>
          <button onClick={() => setShowBreakdown(!showBreakdown)} className={`w-full p-6 rounded-3xl font-bold flex flex-col transition-all duration-300 ios-active ${showBreakdown ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}>
            <div className="flex justify-between items-center w-full mb-1">
                <div className="flex items-center gap-2">
                    <Wallet className={`w-4 h-4 ${showBreakdown ? 'text-blue-400' : 'text-blue-200'}`} />
                    <span className="text-xs uppercase tracking-widest opacity-80">ยอดสุทธิรับจริง</span>
                </div>
                <Info className="w-4 h-4 opacity-50" />
            </div>
            <div className="flex justify-between items-end w-full">
                <span className="text-3xl font-bold">฿{monthlyStats.netSalary.toLocaleString()}</span>
                <span className="text-[10px] opacity-60 mb-1">{showBreakdown ? 'แตะเพื่อย่อ' : 'ดูรายละเอียด'}</span>
            </div>
          </button>
        </div>

        {showBreakdown && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 animate-in slide-in-from-top-4 duration-500 relative">
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                    <ArrowUpCircle className="w-4 h-4" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายรับทั้งหมด</h3>
                </div>
                <div className="space-y-3 pl-6">
                    <BreakdownRow label="เงินเดือน" value={currentSalary} />
                    <BreakdownRow label="ค่าโอทีรวม" value={monthlyStats.totalOT} isHighlight />
                    <BreakdownRow label="ค่าอาหาร" value={settings.foodAllowance} />
                    <BreakdownRow label="เบี้ยขยัน" value={settings.diligenceAllowance} />
                </div>
             </div>
             <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-red-500">
                    <ArrowDownCircle className="w-4 h-4" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายการหัก</h3>
                </div>
                <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                        <BreakdownRow label="ประกันสังคม" value={-calculatedSocialSecurity} isNegative />
                        <p className="text-[9px] text-slate-400 italic">คำนวณจาก (เงินเดือน + ค่าอาหาร) x {settings.socialSecurityRate}%</p>
                    </div>
                    <BreakdownRow label="กองทุนสำรองฯ" value={-calculatedPvdAmount} isNegative />
                </div>
             </div>
          </div>
        )}

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
            <div className="grid grid-cols-7 gap-1.5">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-[9px] font-bold text-slate-300 py-2 uppercase">{day}</div>
              ))}
              {Array.from({ length: periodRange.startDayOfWeek }).map((_, i) => <div key={`pad-${i}`} className="aspect-square"></div>)}
              {calendarDays.map((item) => {
                const dayOTTotal = item.records.reduce((sum, r) => sum + r.totalAmount, 0);
                return (
                  <button key={item.dateStr} onClick={() => handleDayClick(item)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative border transition-all ios-active ${item.isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}>
                    <span className={`text-[10px] font-bold ${item.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{item.date.getDate()}</span>
                    {dayOTTotal > 0 && (
                      <span className="text-[7px] font-bold text-blue-600 leading-tight">
                        ฿{dayOTTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[9px] text-slate-300 mt-4 uppercase font-bold tracking-widest">แตะที่วันเพื่อดูรายละเอียดหรือเพิ่มรายการ</p>
          </div>
        ) : (
          <div className="space-y-3">
             {filteredRecords.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 ios-active overflow-hidden">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-900 leading-none">{parseLocalDate(record.date).getDate()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{record.hours} ชม.</span>
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">x{record.type}</span>
                    </div>
                    {record.note && <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{record.note}</p>}
                  </div>
                  <div className="text-right flex items-center gap-3">
                     <span className="text-base font-bold text-slate-900">฿{record.totalAmount.toLocaleString()}</span>
                     <button onClick={() => setRecords(prev => prev.filter(r => r.id !== record.id))} className="text-slate-200 hover:text-red-500 p-2 ios-active"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
             ))}
             {filteredRecords.length === 0 && (
               <div className="py-20 text-center opacity-20">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">ไม่มีรายการบันทึก</p>
               </div>
             )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] flex justify-center z-40">
        <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white w-20 h-20 rounded-full shadow-2xl flex items-center justify-center border-4 border-white ios-active">
          <Plus className="w-10 h-10" />
        </button>
      </nav>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center bg-white border-b border-slate-100">
              <h3 className="text-2xl font-bold">การตั้งค่า</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 ios-active">เสร็จสิ้น</button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-10">
              {/* User Profile Info */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border flex items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-50"></div>
                <img src={user.picture} alt="profile" className="w-16 h-16 rounded-2xl object-cover shadow-lg relative" />
                <div className="flex-1 relative">
                    <h4 className="font-bold text-slate-900">{user.name}</h4>
                    <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                </div>
                <button onClick={logout} className="p-3 bg-red-50 text-red-500 rounded-2xl ios-active"><LogOut className="w-5 h-5" /></button>
              </div>

              <SettingSection title="ข้อมูลรายได้">
                  <SettingRow label="เงินเดือนหลัก" value={settings.baseSalary} onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} />
                  <SettingRow label="ค่าอาหาร (คิดรวมประกันสังคม)" value={settings.foodAllowance} onChange={v => setSettings({...settings, foodAllowance: parseFloat(v) || 0})} />
                  <SettingRow label="เบี้ยขยัน" value={settings.diligenceAllowance} onChange={v => setSettings({...settings, diligenceAllowance: parseFloat(v) || 0})} />
              </SettingSection>

              <SettingSection title="รายการหัก">
                  <div className="flex justify-between items-center px-6 py-5">
                      <label className="text-sm font-bold text-slate-600">หักประกันสังคม (ฐานเงินเดือน+ค่าอาหาร)</label>
                      <button onClick={() => setSettings({...settings, enableSocialSecurity: !settings.enableSocialSecurity})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableSocialSecurity ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableSocialSecurity ? 'left-7' : 'left-1'}`}></div>
                      </button>
                  </div>
                  <SettingRow label="หักกองทุนสำรองฯ (%)" value={settings.providentFundRate} onChange={v => setSettings({...settings, providentFundRate: parseFloat(v) || 0})} />
              </SettingSection>

              <SettingSection title="พื้นฐานการคำนวณ">
                  <SettingRow label="วันทำงาน/เดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseInt(v) || 0})} />
                  <SettingRow label="ชั่วโมงทำงาน/วัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseInt(v) || 0})} />
              </SettingSection>
           </div>
        </div>
      )}

      {/* Add Record Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8"></div>
              <h3 className="text-2xl font-bold mb-6">บันทึกโอที</h3>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">วันที่ทำงาน</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">จำนวนชั่วโมง</label>
                    <input type="number" step="0.5" value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black" placeholder="ชั่วโมง" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">เรทโอที</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black">
                      {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">หมายเหตุ (ถ้ามี)</label>
                  <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border font-medium text-black" placeholder="เช่น ทำกะดึก, วันหยุดนักขัตฤกษ์" />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl ios-active">บันทึกข้อมูล</button>
              </form>
          </div>
        </div>
      )}

      {/* Selected Day Details Modal */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDayInfo(null)}></div>
           <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-h-[80vh] overflow-y-auto">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-6 px-2">
                 <h3 className="text-xl font-bold">วันที่ {parseLocalDate(selectedDayInfo.dateStr).getDate()} {MONTHS_TH[parseLocalDate(selectedDayInfo.dateStr).getMonth()]}</h3>
                 <button onClick={() => { setIsAdding(true); setFormData({...formData, date: selectedDayInfo.dateStr}); setSelectedDayInfo(null); }} className="p-3 bg-blue-50 text-blue-600 rounded-2xl ios-active"><Plus className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                 {selectedDayInfo.records.map(record => (
                    <div key={record.id} className="bg-slate-50 p-5 rounded-3xl flex justify-between items-center border border-slate-100">
                       <div className="flex-1">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-800 text-lg">{record.hours} ชม.</span>
                             <span className="text-[10px] bg-white px-2.5 py-1 rounded-full border border-slate-200 font-bold uppercase tracking-widest">x{record.type}</span>
                          </div>
                          {record.note && <p className="text-[11px] text-slate-400 mt-1 font-medium italic">{record.note}</p>}
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-slate-900">฿{record.totalAmount.toLocaleString()}</span>
                          <button onClick={() => { 
                             setRecords(prev => prev.filter(r => r.id !== record.id));
                             setSelectedDayInfo(prev => prev ? {...prev, records: prev.records.filter(r => r.id !== record.id)} : null);
                          }} className="text-red-400 p-2 ios-active"><Trash2 className="w-5 h-5" /></button>
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
