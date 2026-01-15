
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Calendar as CalendarIcon, 
  Trash2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Info,
  XCircle,
  LayoutGrid,
  List as ListIcon,
  AlertCircle,
  Clock,
  History,
  ShieldCheck,
  Wallet,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Share,
  Download,
  PlusCircle,
  CalendarDays,
  Gift,
  MinusCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { OTRecord, UserSettings, OTType } from './types.ts';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants.ts';

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

// Moved helper components to the top and made children optional to avoid hoisting issues and fix TS missing prop error
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
  const [records, setRecords] = useState<OTRecord[]>(() => {
    const saved = localStorage.getItem('ot_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('user_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      monthlySalaries: parsed.monthlySalaries || {}
    };
  });

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
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  // State for adding custom monthly salary
  const [customSalaryMonth, setCustomSalaryMonth] = useState(currentViewMonth);
  const [customSalaryAmount, setCustomSalaryAmount] = useState(0);

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isIOS && !isStandalone) {
      const hasClosedPrompt = sessionStorage.getItem('ios_prompt_closed');
      if (!hasClosedPrompt) {
        setShowIOSInstall(true);
      }
    }

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('ot_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('user_settings', JSON.stringify(settings));
  }, [settings]);

  const getSalaryForDate = (dateStr: string) => {
    const [y, m] = dateStr.split('-');
    const key = `${y}-${m}`;
    return settings.monthlySalaries?.[key] || settings.baseSalary;
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
    return Math.min(max, Math.floor(currentSalary * rate));
  }, [currentSalary, settings.enableSocialSecurity, settings.socialSecurityRate, settings.socialSecurityMax]);

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

    return { totalOT, totalHours, totalAdditions, totalDeductions, pvdAmount: calculatedPvdAmount, grossSalary, netSalary };
  }, [filteredRecords, settings, currentSalary, calculatedSocialSecurity, calculatedPvdAmount]);

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const salaryAtDate = getSalaryForDate(formData.date);
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
    setSelectedDayInfo(null);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      if (selectedDayInfo) {
        setSelectedDayInfo(prev => prev ? {
            ...prev,
            records: prev.records.filter(r => r.id !== recordToDelete.id)
        } : null);
      }
      setRecordToDelete(null);
    }
  };

  const changeMonth = (offset: number) => {
    const [year, month] = currentViewMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCurrentViewMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
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

  const handleDayClick = (day: { dateStr: string, records: OTRecord[] }) => {
    if (day.records.length > 0) {
      setSelectedDayInfo(day);
    } else {
      setFormData({ ...formData, date: day.dateStr });
      setIsAdding(true);
    }
  };

  const addCustomSalary = () => {
    if (customSalaryAmount <= 0) return;
    setSettings({
      ...settings,
      monthlySalaries: {
        ...(settings.monthlySalaries || {}),
        [customSalaryMonth]: customSalaryAmount
      }
    });
    setCustomSalaryAmount(0);
  };

  const removeCustomSalary = (key: string) => {
    const newSalaries = { ...(settings.monthlySalaries || {}) };
    delete newSalaries[key];
    setSettings({
      ...settings,
      monthlySalaries: newSalaries
    });
  };

  const thaiDate = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col">
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">OT BFC TRACKER</span>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">บันทึกเวลา</h1>
            <div className="mt-1 flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-[11px] font-medium">{thaiDate} • {thaiTime} น.</span>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
             <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')} className="p-2.5 bg-slate-100/80 rounded-full ios-active">
                {viewMode === 'list' ? <LayoutGrid className="w-5 h-5 text-slate-600" /> : <ListIcon className="w-5 h-5 text-slate-600" />}
             </button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-100/80 rounded-full ios-active">
                <SettingsIcon className="w-5 h-5 text-slate-600" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto scrolling-touch">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="flex items-center justify-between mb-4 relative">
            <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-50 rounded-full ios-active border border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <div className="text-center">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-0.5">รอบเดือน</span>
                <span className="font-bold text-slate-900 text-lg">{MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]} {parseInt(currentViewMonth.split('-')[0]) + 543}</span>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 bg-slate-50 rounded-full ios-active border border-slate-100"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
          <p className="text-center text-[9px] text-slate-400 font-bold mb-8 uppercase tracking-[0.15em]">{periodRange.label}</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50/80 rounded-3xl p-5 border border-slate-50 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">รายได้สะสม</span>
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
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 animate-in slide-in-from-top-4 fade-in duration-500 relative">
             <div className="bg-slate-50/50 rounded-2xl p-4 flex justify-between items-center border border-dashed border-slate-200">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">อัตราจ้างต่อชั่วโมง</span>
                </div>
                <span className="text-sm font-bold text-slate-600">฿{hourlyRate.toFixed(2)} / ชม.</span>
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                    <ArrowUpCircle className="w-4 h-4" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายได้ทั้งหมด</h3>
                </div>
                <div className="space-y-3 pl-6">
                    <BreakdownRow label="เงินเดือน" value={currentSalary} />
                    <BreakdownRow label="ค่าล่วงเวลา (OT)" value={monthlyStats.totalOT} isHighlight />
                    {settings.foodAllowance > 0 && <BreakdownRow label="ค่าอาหาร" value={settings.foodAllowance} />}
                    {settings.diligenceAllowance > 0 && <BreakdownRow label="เบี้ยขยัน" value={settings.diligenceAllowance} />}
                    <div className="pt-3 border-t border-slate-50 flex justify-between items-center font-bold">
                        <span className="text-xs">รวมรายได้</span>
                        <span className="text-sm text-green-600">฿{monthlyStats.grossSalary.toLocaleString()}</span>
                    </div>
                </div>
             </div>
             <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-red-500">
                    <ArrowDownCircle className="w-4 h-4" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายการหัก</h3>
                </div>
                <div className="space-y-3 pl-6">
                    {settings.enableSocialSecurity && <BreakdownRow label="ประกันสังคม" value={-calculatedSocialSecurity} isNegative />}
                    {settings.providentFundRate > 0 && <BreakdownRow label="กองทุนสำรองเลี้ยงชีพ" value={-calculatedPvdAmount} isNegative />}
                    <div className="pt-3 border-t border-slate-50 flex justify-between items-center font-bold">
                        <span className="text-xs">รวมรายการหัก</span>
                        <span className="text-sm text-red-500">- ฿{monthlyStats.totalDeductions.toLocaleString()}</span>
                    </div>
                </div>
             </div>
          </div>
        )}

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
            <div className="grid grid-cols-7 gap-2">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-[9px] font-bold text-slate-300 py-2 uppercase">{day}</div>
              ))}
              {Array.from({ length: periodRange.startDayOfWeek }).map((_, i) => <div key={`pad-${i}`} className="aspect-square"></div>)}
              {calendarDays.map((item) => (
                <button key={item.dateStr} onClick={() => handleDayClick(item)} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative border transition-all ios-active ${item.isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50/50'}`}>
                  <span className={`text-[10px] font-bold ${item.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{item.date.getDate()}</span>
                  {item.records.length > 0 && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1"></div>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
             {filteredRecords.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 ios-active group overflow-hidden relative">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center flex-shrink-0 border border-slate-100">
                    <span className="text-xs font-bold text-slate-900 leading-none">{parseLocalDate(record.date).getDate()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{record.hours} ชั่วโมง</span>
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">x{record.type}</span>
                    </div>
                    {record.note && <p className="text-[10px] text-slate-400 truncate mt-0.5">{record.note}</p>}
                  </div>
                  <div className="text-right flex items-center gap-1">
                     <span className="text-base font-bold text-slate-900">฿{record.totalAmount.toLocaleString()}</span>
                     <button onClick={() => setRecordToDelete(record)} className="p-3 text-slate-200 hover:text-red-500 ios-active"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
             ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pointer-events-none flex justify-center z-40">
        <button onClick={() => { setFormData({ ...formData, date: formatLocalISO(new Date()) }); setIsAdding(true); }} className="pointer-events-auto bg-blue-600 text-white w-20 h-20 rounded-full shadow-2xl flex items-center justify-center ios-active border-4 border-white">
          <Plus className="w-10 h-10" />
        </button>
      </nav>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center bg-white border-b border-slate-100">
              <h3 className="text-2xl font-bold text-slate-900">การตั้งค่า</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 ios-active">เสร็จสิ้น</button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-10">
              
              {/* Summary Block in Settings */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-3xl p-5 border border-green-100">
                      <div className="flex items-center gap-2 mb-2">
                          <Gift className="w-3 h-3 text-green-600" />
                          <span className="text-[10px] font-bold text-green-600 uppercase">รวมสวัสดิการ</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">฿{(settings.foodAllowance + settings.diligenceAllowance).toLocaleString()}</span>
                  </div>
                  <div className="bg-red-50 rounded-3xl p-5 border border-red-100">
                      <div className="flex items-center gap-2 mb-2">
                          <MinusCircle className="w-3 h-3 text-red-600" />
                          <span className="text-[10px] font-bold text-red-600 uppercase">รวมรายการหัก</span>
                      </div>
                      <span className="text-lg font-bold text-red-700">฿{calculatedSocialSecurity + calculatedPvdAmount > 0 ? (calculatedSocialSecurity + calculatedPvdAmount).toLocaleString() : '0'}</span>
                  </div>
              </div>

              <SettingSection title="ข้อมูลรายได้พื้นฐาน">
                  <SettingRow label="เงินเดือนหลัก (ปัจจุบัน)" value={settings.baseSalary} onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} />
                  <SettingRow label="ค่าอาหาร" value={settings.foodAllowance} onChange={v => setSettings({...settings, foodAllowance: parseFloat(v) || 0})} />
                  <SettingRow label="เบี้ยขยัน" value={settings.diligenceAllowance} onChange={v => setSettings({...settings, diligenceAllowance: parseFloat(v) || 0})} />
              </SettingSection>

              <SettingSection title="ประวัติเงินเดือน (ย้อนหลัง)">
                  <div className="p-6 space-y-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-relaxed">
                        ระบุเงินเดือนเฉพาะเดือนที่แตกต่างจากเงินเดือนหลัก (เช่น เงินเดือนปีที่แล้ว) เดือนที่ไม่ได้ระบุจะใช้ "เงินเดือนหลัก" อัตโนมัติ
                      </p>
                      <div className="flex gap-2 items-center">
                          <input type="month" value={customSalaryMonth} onChange={e => setCustomSalaryMonth(e.target.value)} className="flex-1 bg-slate-50 border p-3 rounded-2xl text-sm font-bold text-black" />
                          <input type="number" value={customSalaryAmount} onChange={e => setCustomSalaryAmount(parseFloat(e.target.value) || 0)} placeholder="จำนวนเงิน" className="w-28 bg-slate-50 border p-3 rounded-2xl text-sm font-bold text-right text-black" />
                          <button onClick={addCustomSalary} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg ios-active"><PlusCircle className="w-5 h-5" /></button>
                      </div>
                      <div className="pt-4 space-y-2">
                          {Object.entries(settings.monthlySalaries || {}).sort((a,b) => b[0].localeCompare(a[0])).map(([key, amount]) => (
                            <div key={key} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-600">{key.split('-')[0]} / {MONTHS_TH[parseInt(key.split('-')[1])-1]}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-900">฿{amount.toLocaleString()}</span>
                                    <button onClick={() => removeCustomSalary(key)} className="text-red-400 ios-active"><XCircle className="w-4 h-4" /></button>
                                </div>
                            </div>
                          ))}
                      </div>
                  </div>
              </SettingSection>

              <SettingSection title="การคำนวณพื้นฐาน">
                  <SettingRow label="วันทำงาน/เดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseInt(v) || 0})} />
                  <SettingRow label="ชั่วโมงทำงาน/วัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseInt(v) || 0})} />
              </SettingSection>

              <SettingSection title="รายการหัก">
                  <div className="flex justify-between items-center px-6 py-5">
                      <label className="text-sm font-bold text-slate-600">หักประกันสังคม</label>
                      <button 
                        onClick={() => setSettings({...settings, enableSocialSecurity: !settings.enableSocialSecurity})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableSocialSecurity ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableSocialSecurity ? 'left-7' : 'left-1'}`}></div>
                      </button>
                  </div>
                  {settings.enableSocialSecurity && (
                    <>
                      <SettingRow label="อัตราหัก (%)" value={settings.socialSecurityRate} onChange={v => setSettings({...settings, socialSecurityRate: parseFloat(v) || 0})} />
                      <SettingRow label="สูงสุดไม่เกิน (บาท)" value={settings.socialSecurityMax} onChange={v => setSettings({...settings, socialSecurityMax: parseFloat(v) || 0})} />
                    </>
                  )}
                  <SettingRow label="หักกองทุนสำรองฯ (%)" value={settings.providentFundRate} onChange={v => setSettings({...settings, providentFundRate: parseFloat(v) || 0})} />
              </SettingSection>
           </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8"></div>
              <h3 className="text-2xl font-bold mb-6">บันทึกเวลาโอที</h3>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.5" value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black" placeholder="ชั่วโมง" />
                  <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border font-bold text-black">
                    {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold shadow-xl">บันทึกข้อมูล</button>
              </form>
          </div>
        </div>
      )}

      {recordToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xs rounded-[2rem] overflow-hidden text-center p-8 space-y-6">
              <h3 className="text-lg font-bold">ยืนยันการลบ?</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setRecordToDelete(null)} className="py-3 bg-slate-100 rounded-xl font-medium">ยกเลิก</button>
                <button onClick={confirmDelete} className="py-3 bg-red-500 text-white rounded-xl font-bold">ลบ</button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
