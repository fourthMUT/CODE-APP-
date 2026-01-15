
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
  Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { OTRecord, UserSettings, OTType } from './types';
import { OT_TYPES, DEFAULT_SETTINGS, MONTHS_TH } from './constants';

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

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    
    // ตรวจสอบว่าเป็น iOS และยังไม่ได้ติดตั้งเป็น App หรือไม่
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

  const chartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    filteredRecords.forEach(r => {
      dailyMap[r.date] = (dailyMap[r.date] || 0) + r.totalAmount;
    });

    const days = [];
    let curr = parseLocalDate(periodRange.start);
    const last = parseLocalDate(periodRange.end);
    while (curr <= last) {
      const dateStr = formatLocalISO(curr);
      days.push({
        date: `${curr.getDate()}`,
        amount: dailyMap[dateStr] || 0
      });
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [filteredRecords, periodRange]);

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

  const updateSalaryForKey = (key: string, val: string) => {
    const amount = parseFloat(val) || 0;
    setSettings({
      ...settings,
      monthlySalaries: {
        ...(settings.monthlySalaries || {}),
        [key]: amount
      }
    });
  };

  const thaiDate = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-slate-50 relative flex flex-col">
      {/* iOS Optimized Header with Glassmorphism */}
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
             <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
                className="p-2.5 bg-slate-100/80 rounded-full ios-active"
             >
                {viewMode === 'list' ? <LayoutGrid className="w-5 h-5 text-slate-600" /> : <ListIcon className="w-5 h-5 text-slate-600" />}
             </button>
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 bg-slate-100/80 rounded-full ios-active"
             >
                <SettingsIcon className="w-5 h-5 text-slate-600" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto scrolling-touch">
        {/* Main Stats Card */}
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

          <button 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className={`w-full p-6 rounded-3xl font-bold flex flex-col transition-all duration-300 ios-active ${
              showBreakdown ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'
            }`}
          >
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

        {/* Detailed Breakdown Section */}
        {showBreakdown && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 animate-in slide-in-from-top-4 fade-in duration-500 relative">
             <div className="absolute top-8 right-8">
                <Receipt className="w-12 h-12 text-slate-50 opacity-[0.05]" />
             </div>
             
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
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายได้ทั้งหมด (Incomes)</h3>
                </div>
                <div className="space-y-3 pl-6">
                    <BreakdownRow label="เงินเดือน" value={currentSalary} />
                    <BreakdownRow label="ค่าล่วงเวลา (OT)" value={monthlyStats.totalOT} isHighlight />
                    {settings.foodAllowance > 0 && <BreakdownRow label="ค่าอาหาร" value={settings.foodAllowance} />}
                    {settings.diligenceAllowance > 0 && <BreakdownRow label="เบี้ยขยัน" value={settings.diligenceAllowance} />}
                    <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">รวมรายได้ (ก่อนหัก)</span>
                        <span className="text-sm font-bold text-green-600">฿{monthlyStats.grossSalary.toLocaleString()}</span>
                    </div>
                </div>
             </div>

             <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-red-500">
                    <ArrowDownCircle className="w-4 h-4" />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest">รายการหัก (Deductions)</h3>
                </div>
                <div className="space-y-3 pl-6">
                    {settings.enableSocialSecurity && (
                        <BreakdownRow 
                            label="ประกันสังคม" 
                            subLabel={`${settings.socialSecurityRate}% ของเงินเดือน`} 
                            value={-calculatedSocialSecurity} 
                            isNegative 
                        />
                    )}
                    {settings.providentFundRate > 0 && (
                        <BreakdownRow 
                            label="กองทุนสำรองเลี้ยงชีพ" 
                            subLabel={`${settings.providentFundRate}% ของเงินเดือน`} 
                            value={-monthlyStats.pvdAmount} 
                            isNegative 
                        />
                    )}
                    <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">รวมรายการหัก</span>
                        <span className="text-sm font-bold text-red-500">- ฿{monthlyStats.totalDeductions.toLocaleString()}</span>
                    </div>
                </div>
             </div>

             <div className="pt-6 border-t-2 border-dashed border-slate-100">
                <div className="bg-slate-900 rounded-3xl p-6 text-white flex justify-between items-center shadow-lg">
                    <div>
                        <span className="text-[10px] font-bold uppercase opacity-50 block">สุทธิรับจริง</span>
                        <span className="text-xs opacity-70">Net Income</span>
                    </div>
                    <span className="text-2xl font-bold">฿{monthlyStats.netSalary.toLocaleString()}</span>
                </div>
             </div>
          </div>
        )}

        {/* View Selection: List or Calendar */}
        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 animate-in fade-in duration-300">
            <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
              ปฏิทินบันทึกงาน
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-[9px] font-bold text-slate-300 py-2 uppercase">{day}</div>
              ))}
              {Array.from({ length: periodRange.startDayOfWeek }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square bg-transparent"></div>
              ))}
              {calendarDays.map((item) => {
                const hasOT = item.records.length > 0;
                const totalHours = item.records.reduce((s, r) => s + r.hours, 0);
                return (
                  <button 
                    key={item.dateStr}
                    onClick={() => handleDayClick(item)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative border transition-all ios-active ${
                      item.isToday ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-50 bg-slate-50/50'
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${item.isToday ? 'text-blue-600' : 'text-slate-400'}`}>{item.date.getDate()}</span>
                    {hasOT && (
                      <div className="mt-1 flex flex-col items-center">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mb-0.5"></div>
                        <span className="text-[7px] font-bold text-blue-600">{totalHours}h</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-7 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                สถิติรายวัน
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Bar dataKey="amount" radius={[6, 6, 6, 6]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#3b82f6' : '#f1f5f9'} />
                      ))}
                    </Bar>
                    <XAxis dataKey="date" hide />
                    <Tooltip cursor={{fill: 'transparent'}} content={() => null} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">รายการล่าสุด</h3>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-3 py-1 rounded-full uppercase">{filteredRecords.length} รายการ</span>
              </div>
              {filteredRecords.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 ios-active group overflow-hidden relative">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center flex-shrink-0 border border-slate-100 group-active:bg-blue-50 transition-colors">
                    <span className="text-xs font-bold text-slate-900 leading-none">{parseLocalDate(record.date).getDate()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{record.hours} ชั่วโมง</span>
                      <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 uppercase">Rate x{record.type}</span>
                    </div>
                    {record.note && <p className="text-[10px] text-slate-400 truncate font-medium mt-0.5">{record.note}</p>}
                  </div>
                  <div className="text-right flex items-center gap-1">
                     <span className="text-base font-bold text-slate-900 mr-1">฿{record.totalAmount.toLocaleString()}</span>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setRecordToDelete(record);
                       }} 
                       className="p-3 -mr-2 text-slate-200 hover:text-red-500 transition-colors ios-active"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              ))}
              {filteredRecords.length === 0 && (
                  <div className="py-20 text-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <History className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">ยังไม่มีประวัติในรอบเดือนนี้</p>
                      <button 
                        onClick={() => setIsAdding(true)}
                        className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-6 py-3 rounded-full ios-active"
                      >
                        เริ่มบันทึกตอนนี้
                      </button>
                  </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* iOS Floating Hint for Install */}
      {showIOSInstall && (
        <div className="fixed bottom-32 left-4 right-4 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-700">
           <div className="bg-white/90 backdrop-blur-xl border border-blue-100 rounded-[2rem] p-6 shadow-2xl flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-200">
                <Download className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 leading-tight">ติดตั้งแอปเข้าหน้าโฮม</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] text-slate-500">แตะปุ่ม</span>
                  <Share className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] text-slate-500">แล้วเลือก "Add to Home Screen"</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowIOSInstall(false);
                  sessionStorage.setItem('ios_prompt_closed', 'true');
                }}
                className="p-2 text-slate-300 hover:text-slate-500"
              >
                <XCircle className="w-5 h-5" />
              </button>
           </div>
           {/* Arrow pointing to Safari share button (conceptually) */}
           <div className="w-4 h-4 bg-white/90 backdrop-blur-xl border-r border-b border-blue-100 rotate-45 mx-auto -mt-2 shadow-lg"></div>
        </div>
      )}

      {/* Floating Action Button */}
      <nav className="fixed bottom-0 left-0 right-0 p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pointer-events-none flex justify-center z-40">
        <button 
          onClick={() => {
            setFormData({ ...formData, date: formatLocalISO(new Date()) });
            setIsAdding(true);
          }}
          className="pointer-events-auto bg-blue-600 text-white w-20 h-20 rounded-full shadow-2xl shadow-blue-400 flex items-center justify-center ios-active group border-4 border-white"
        >
          <Plus className="w-10 h-10 group-hover:scale-110 transition-transform" />
        </button>
      </nav>

      {/* Settings Modal - Full Screen iOS Style */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 py-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-100">
              <h3 className="text-2xl font-bold text-slate-900">การตั้งค่า</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold px-4 py-2 rounded-full text-base ios-active">เสร็จสิ้น</button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-10 pb-[calc(4rem+env(safe-area-inset-bottom))]">
              <section className="space-y-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">ฐานเงินเดือน</h4>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                  <SettingRow label={`รอบ ${MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]}`} value={settings.monthlySalaries?.[currentViewMonth] || settings.baseSalary} onChange={(v) => updateSalaryForKey(currentViewMonth, v)} highlight />
                  <SettingRow label="เงินเดือนหลัก (Default)" value={settings.baseSalary} onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} />
                </div>
                <p className="text-[10px] text-slate-400 ml-4">* ระบบใช้เงินเดือนรายรอบในการคำนวณ OT</p>
              </section>

              <section className="space-y-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">รายการหัก (Deductions)</h4>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                   <div className="flex justify-between items-center px-6 py-5">
                      <label className="text-sm font-bold text-slate-700">หักประกันสังคม</label>
                      <button 
                        onClick={() => setSettings({...settings, enableSocialSecurity: !settings.enableSocialSecurity})}
                        className={`w-12 h-7 rounded-full transition-all relative ${settings.enableSocialSecurity ? 'bg-green-500' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all ${settings.enableSocialSecurity ? 'left-5.5' : 'left-0.5'}`}></div>
                      </button>
                   </div>
                   {settings.enableSocialSecurity && (
                     <>
                        <SettingRow label="อัตรา (%)" value={settings.socialSecurityRate} onChange={v => setSettings({...settings, socialSecurityRate: parseFloat(v) || 0})} />
                        <SettingRow label="เพดาน (บาท)" value={settings.socialSecurityMax} onChange={v => setSettings({...settings, socialSecurityMax: parseFloat(v) || 0})} />
                     </>
                   )}
                   <SettingRow label="กองทุนสำรองฯ (%)" value={settings.providentFundRate} onChange={v => setSettings({...settings, providentFundRate: parseFloat(v) || 0})} />
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">สวัสดิการ & เวลา</h4>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                   <SettingRow label="วันทำงาน/เดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseInt(v) || 0})} />
                   <SettingRow label="ชั่วโมง/วัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseInt(v) || 0})} />
                   <SettingRow label="ค่าอาหาร" value={settings.foodAllowance} onChange={v => setSettings({...settings, foodAllowance: parseFloat(v) || 0})} />
                   <SettingRow label="เบี้ยขยัน" value={settings.diligenceAllowance} onChange={v => setSettings({...settings, diligenceAllowance: parseFloat(v) || 0})} />
                </div>
              </section>
           </div>
        </div>
      )}

      {/* Add Record Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] shadow-2xl animate-in slide-in-from-bottom-full duration-500 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="p-8">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-bold text-slate-900">บันทึกเวลาโอที</h3>
                <button onClick={() => setIsAdding(false)} className="bg-slate-100 p-2 rounded-full ios-active"><XCircle className="w-6 h-6 text-slate-300" /></button>
              </div>
              
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">วันที่ทำงาน</label>
                    <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">จำนวนชั่วโมง</label>
                      <input type="number" step="0.5" required value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">เรทค่าจ้าง</label>
                      <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                        {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">หมายเหตุ</label>
                    <input type="text" placeholder="ระบุรายละเอียดสั้นๆ" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 ios-active mt-4">
                  ยืนยันบันทึกข้อมูล
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation iOS Alert Style */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRecordToDelete(null)}></div>
          <div className="relative bg-white/90 backdrop-blur-2xl w-full max-w-xs rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">ยืนยันการลบ?</h3>
                  <p className="text-sm text-slate-500">ข้อมูลนี้จะถูกลบออกจากเครื่องของคุณอย่างถาวร</p>
              </div>
              <div className="grid grid-cols-2 border-t border-slate-200 divide-x divide-slate-200">
                <button onClick={() => setRecordToDelete(null)} className="py-4 text-slate-600 font-medium ios-active">ยกเลิก</button>
                <button onClick={confirmDelete} className="py-4 text-red-500 font-bold ios-active">ลบรายการ</button>
              </div>
          </div>
        </div>
      )}

      {/* Detail for Specific Day Modal */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedDayInfo(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-t-[3rem] shadow-2xl animate-in slide-in-from-bottom-full duration-500 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="p-8">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">ประวัติบันทึก</h3>
                  <p className="text-xs text-blue-500 font-bold uppercase">{parseLocalDate(selectedDayInfo.dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</p>
                </div>
                <button onClick={() => setSelectedDayInfo(null)} className="bg-slate-100 p-2 rounded-full ios-active"><XCircle className="w-6 h-6 text-slate-300" /></button>
              </div>
              
              <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-8 pr-1 scrolling-touch">
                {selectedDayInfo.records.map(record => (
                  <div key={record.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-800">{record.hours} ชม.</span>
                        <span className="text-[8px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase">x{record.type}</span>
                      </div>
                      {record.note && <p className="text-[10px] text-slate-400 italic">{record.note}</p>}
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-base font-bold text-slate-900">฿{record.totalAmount.toLocaleString()}</span>
                      <button onClick={() => setRecordToDelete(record)} className="p-2 text-slate-300 hover:text-red-500 ios-active"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  setFormData({ ...formData, date: selectedDayInfo.dateStr });
                  setIsAdding(true);
                  setSelectedDayInfo(null);
                }}
                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 ios-active"
              >
                <Plus className="w-4 h-4" />
                เพิ่มบันทึกวันนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Components
const SettingRow = ({ label, value, onChange, highlight }: { label: string, value: number, onChange: (v: string) => void, highlight?: boolean }) => (
  <div className="flex justify-between items-center px-6 py-5 bg-white">
    <label className={`text-sm font-bold ${highlight ? 'text-blue-600' : 'text-slate-600'}`}>{label}</label>
    <input 
      type="number" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className={`text-right font-bold text-base outline-none w-28 bg-transparent ${highlight ? 'text-blue-600' : 'text-slate-900'}`}
    />
  </div>
);

const BreakdownRow = ({ label, subLabel, value, isHighlight, isNegative }: { label: string, subLabel?: string, value: number, isHighlight?: boolean, isNegative?: boolean }) => (
  <div className="flex justify-between items-start">
    <div className="flex flex-col">
        <span className={`text-sm font-medium ${isHighlight ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>{label}</span>
        {subLabel && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{subLabel}</span>}
    </div>
    <span className={`text-sm font-bold ${isNegative ? 'text-red-500' : (isHighlight ? 'text-blue-600' : 'text-slate-900')}`}>
        {isNegative ? `- ฿${Math.abs(value).toLocaleString()}` : `฿${value.toLocaleString()}`}
    </span>
  </div>
);

export default App;
