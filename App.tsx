
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
  Calculator,
  LayoutGrid,
  List as ListIcon,
  AlertCircle,
  Clock,
  History,
  ShieldCheck
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

  const [formData, setFormData] = useState({
    date: formatLocalISO(new Date()),
    hours: 1,
    type: 1.5 as OTType,
    note: ''
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
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
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white border-b border-slate-200 shadow-sm">
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
                className="p-2.5 bg-slate-100 rounded-full ios-active"
             >
                {viewMode === 'list' ? <LayoutGrid className="w-5 h-5 text-slate-600" /> : <ListIcon className="w-5 h-5 text-slate-600" />}
             </button>
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 bg-slate-100 rounded-full ios-active"
             >
                <SettingsIcon className="w-5 h-5 text-slate-600" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 pb-32 overflow-y-auto">
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => changeMonth(-1)} className="p-2 ios-active"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
            <span className="font-bold text-slate-800 text-lg">รอบ {MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]}</span>
            <button onClick={() => changeMonth(1)} className="p-2 ios-active"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
          </div>
          <p className="text-center text-[10px] text-slate-400 font-bold mb-6 uppercase tracking-wider">{periodRange.label}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-50">
              <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">โอทีรอบนี้</p>
              <h2 className="text-xl font-bold text-blue-700">฿{monthlyStats.totalOT.toLocaleString()}</h2>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">ชั่วโมงสะสม</p>
              <h2 className="text-xl font-bold text-slate-700">{monthlyStats.totalHours} <span className="text-sm font-normal">ชม.</span></h2>
            </div>
          </div>

          <button 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full mt-3 bg-slate-900 text-white p-4 rounded-2xl font-bold flex justify-between items-center ios-active"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>สุทธิรับจริง (Net)</span>
            </div>
            <span>฿{monthlyStats.netSalary.toLocaleString()}</span>
          </button>
        </div>

        {showBreakdown && (
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 animate-in slide-in-from-top-4 duration-300">
             <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500">เงินเดือนรอบนี้</span><span className="font-bold text-black">฿{currentSalary.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-blue-600"><span className="font-medium">ค่าโอที</span><span className="font-bold">+ ฿{monthlyStats.totalOT.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-blue-600"><span className="font-medium">สวัสดิการอื่นๆ</span><span className="font-bold">+ ฿{monthlyStats.totalAdditions.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-red-500 border-t border-slate-50 pt-2">
                  <span className="font-medium">ประกันสังคม {settings.enableSocialSecurity ? `(${settings.socialSecurityRate}%)` : '(ปิดใช้งาน)'}</span>
                  <span className="font-bold">- ฿{calculatedSocialSecurity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-red-500"><span className="font-medium">กองทุนสำรองฯ ({settings.providentFundRate}%)</span><span className="font-bold">- ฿{monthlyStats.pvdAmount.toLocaleString()}</span></div>
             </div>
          </div>
        )}

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 mb-4 px-2 uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              ปฏิทินงาน
            </h3>
            <div className="grid grid-cols-7 gap-1.5">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-slate-400 py-2">{day}</div>
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
                      item.isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50/50'
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${item.isToday ? 'text-blue-600' : 'text-slate-500'}`}>{item.date.getDate()}</span>
                    {hasOT && (
                      <>
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-[8px] font-bold text-blue-600 mt-0.5">{totalHours}h</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                กราฟรายวัน
              </h3>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
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
              <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">รายการบันทึก</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2.5 py-1 rounded-full">{filteredRecords.length}</span>
              </div>
              {filteredRecords.map(record => (
                <div key={record.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 ios-active overflow-hidden">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-slate-600">{parseLocalDate(record.date).getDate()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">{MONTHS_TH[parseLocalDate(record.date).getMonth()].substring(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{record.hours} ชม.</span>
                      <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">x{record.type}</span>
                    </div>
                    {record.note && <p className="text-[10px] text-slate-400 truncate">{record.note}</p>}
                  </div>
                  <div className="text-right flex items-center gap-1">
                     <span className="text-sm font-bold text-black mr-1">฿{record.totalAmount.toLocaleString()}</span>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setRecordToDelete(record);
                       }} 
                       className="p-3 -mr-2 text-slate-300 hover:text-red-500 transition-colors"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pointer-events-none flex justify-center z-40">
        <button 
          onClick={() => {
            setFormData({ ...formData, date: formatLocalISO(new Date()) });
            setIsAdding(true);
          }}
          className="pointer-events-auto bg-blue-600 text-white w-16 h-16 rounded-full shadow-2xl shadow-blue-400 flex items-center justify-center ios-active"
        >
          <Plus className="w-9 h-9" />
        </button>
      </nav>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-300">
           <header className="px-6 py-4 pt-[env(safe-area-inset-top)] flex justify-between items-center border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">การตั้งค่า</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-blue-600 font-bold ios-active px-2">เสร็จสิ้น</button>
           </header>
           <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              <section className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3.5 h-3.5" />
                    ประวัติเงินเดือน ({currentViewMonth.split('-')[0]})
                </h4>
                <div className="bg-slate-50 rounded-3xl p-5 space-y-4">
                  <SettingInput 
                    label={`เงินเดือนรอบ ${MONTHS_TH[parseInt(currentViewMonth.split('-')[1]) - 1]}`} 
                    value={settings.monthlySalaries?.[currentViewMonth] || settings.baseSalary} 
                    onChange={(v) => updateSalaryForKey(currentViewMonth, v)} 
                    highlight 
                  />
                  <div className="h-px bg-slate-200 my-2"></div>
                  <SettingInput 
                    label="เงินเดือนหลัก (ค่าเริ่มต้น)" 
                    value={settings.baseSalary} 
                    onChange={v => setSettings({...settings, baseSalary: parseFloat(v) || 0})} 
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    รายการหัก (Deductions)
                </h4>
                <div className="bg-slate-50 rounded-3xl p-5 space-y-5">
                   {/* ประกันสังคม */}
                   <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-600">หักประกันสังคม</label>
                      <button 
                        onClick={() => setSettings({...settings, enableSocialSecurity: !settings.enableSocialSecurity})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${settings.enableSocialSecurity ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableSocialSecurity ? 'left-7' : 'left-1'}`}></div>
                      </button>
                   </div>
                   {settings.enableSocialSecurity && (
                     <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <SettingInput 
                           label="อัตราประกันสังคม (%)" 
                           value={settings.socialSecurityRate} 
                           onChange={v => setSettings({...settings, socialSecurityRate: parseFloat(v) || 0})} 
                        />
                        <SettingInput 
                           label="เพดานหักสูงสุด (บาท)" 
                           value={settings.socialSecurityMax} 
                           onChange={v => setSettings({...settings, socialSecurityMax: parseFloat(v) || 0})} 
                        />
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ยอดหักประกันสังคมรอบนี้</span>
                           <span className="text-sm font-bold text-red-500">฿{calculatedSocialSecurity.toLocaleString()}</span>
                        </div>
                     </div>
                   )}

                   <div className="h-px bg-slate-200 my-2"></div>

                   {/* กองทุนสำรองเลี้ยงชีพ */}
                   <div className="space-y-4">
                      <SettingInput 
                        label="กองทุนสำรองฯ (หัก %)" 
                        value={settings.providentFundRate} 
                        onChange={v => setSettings({...settings, providentFundRate: parseFloat(v) || 0})} 
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ยอดหักเข้ากองทุนรอบนี้</span>
                          <span className="text-sm font-bold text-red-500">฿{calculatedPvdAmount.toLocaleString()}</span>
                      </div>
                   </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">ข้อมูลการทำงานและสวัสดิการ</h4>
                <div className="bg-slate-50 rounded-3xl p-5 space-y-5">
                  <SettingInput label="วันทำงานต่อเดือน" value={settings.workingDaysPerMonth} onChange={v => setSettings({...settings, workingDaysPerMonth: parseInt(v) || 0})} />
                  <SettingInput label="ชั่วโมงทำงานต่อวัน" value={settings.workingHoursPerDay} onChange={v => setSettings({...settings, workingHoursPerDay: parseInt(v) || 0})} />
                  <SettingInput label="ค่าอาหาร" value={settings.foodAllowance} onChange={v => setSettings({...settings, foodAllowance: parseFloat(v) || 0})} />
                  <SettingInput label="เบี้ยขยัน" value={settings.diligenceAllowance} onChange={v => setSettings({...settings, diligenceAllowance: parseFloat(v) || 0})} />
                </div>
              </section>
           </div>
        </div>
      )}

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <div className="relative bg-white w-full rounded-t-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300 pb-[env(safe-area-inset-bottom)]">
            <div className="p-8">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">บันทึกโอที</h3>
                    <p className="text-[10px] text-blue-600 font-bold mt-1">อิงเงินเดือน: ฿{getSalaryForDate(formData.date).toLocaleString()}</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="bg-slate-100 p-2 rounded-full"><XCircle className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={handleAddRecord} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-2">วันที่ทำงาน</label>
                  <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-bold text-black" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-2">จำนวนชม.</label>
                    <input type="number" step="0.5" required value={formData.hours} onChange={e => setFormData({...formData, hours: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-bold text-black" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-2">เรทโอที</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: parseFloat(e.target.value) as OTType})} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-bold text-black">
                      {OT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase ml-2">หมายเหตุ</label>
                  <input type="text" placeholder="ระบุเพิ่มเติม..." value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-none text-black font-bold" />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 ios-active mt-2">บันทึกข้อมูล</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDayInfo(null)}></div>
          <div className="relative bg-white w-full rounded-t-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300 pb-[env(safe-area-inset-bottom)]">
            <div className="p-8">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">รายละเอียดวันที่ {parseLocalDate(selectedDayInfo.dateStr).getDate()}</h3>
                  <p className="text-[10px] font-bold text-blue-600 uppercase">ฐานคำนวณ: ฿{getSalaryForDate(selectedDayInfo.dateStr).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedDayInfo(null)} className="bg-slate-100 p-2 rounded-full"><XCircle className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-6">
                {selectedDayInfo.records.map(record => (
                  <div key={record.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">{record.hours} ชม.</span>
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">x{record.type}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1">รับสุทธิ: ฿{record.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-bold text-black">฿{record.totalAmount.toLocaleString()}</span>
                      <button onClick={() => setRecordToDelete(record)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                className="w-full bg-blue-50 text-blue-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 ios-active"
              >
                <Plus className="w-4 h-4" />
                เพิ่มโอทีของวันนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRecordToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">ลบรายการนี้?</h3>
              <div className="flex gap-3 w-full pt-2">
                <button onClick={() => setRecordToDelete(null)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-bold ios-active">ยกเลิก</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-bold ios-active">ลบ</button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingInput = ({ label, value, onChange, highlight }: { label: string, value: number, onChange: (v: string) => void, highlight?: boolean }) => (
  <div className="flex justify-between items-center">
    <label className={`text-xs font-bold ${highlight ? 'text-blue-600' : 'text-slate-600'}`}>{label}</label>
    <input 
      type="number" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className={`border rounded-xl p-2.5 text-right font-bold text-sm w-28 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
    />
  </div>
);

export default App;
