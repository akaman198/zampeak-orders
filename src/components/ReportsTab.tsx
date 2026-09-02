'use client';

import React, { useRef, useState } from 'react';
import { useApp, getPayPeriodLabel, getOrderPeriodLabel } from '../context/AppContext';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Upload, 
  Database,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

const formatM = (val: number) => {
  if (val % 1 === 0) return String(val);
  return val.toFixed(1);
};

export default function ReportsTab() {
  const { gamers, orders, attendance, importBackupData, calculatePayroll, getDailyGamerEarnings, role } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayStr);
  const [selectedGamerFilter, setSelectedGamerFilter] = useState<string>('all');

  // Generate list of cycles
  const getAvailablePayCycles = () => {
    const cyclesSet = new Set<string>();
    
    // Always include current month and next month's cycles
    const now = new Date();
    cyclesSet.add(getPayPeriodLabel(now.toISOString()));
    
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    cyclesSet.add(getPayPeriodLabel(nextMonthDate.toISOString()));

    // Add cycles from completed orders
    orders.forEach(o => {
      if (o.status === 'Completed') {
        cyclesSet.add(getOrderPeriodLabel(o.completed_date || o.start_date));
      }
    });

    // Add cycles from attendance records
    attendance.forEach(a => {
      cyclesSet.add(getPayPeriodLabel(a.date));
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return Array.from(cyclesSet).sort((a, b) => {
      const parseDate = (label: string) => {
        const parts = label.replace(',', '').split(' '); // e.g. ["September", "15", "2026"]
        const m = monthNames.indexOf(parts[0]);
        const d = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        return new Date(y, m, d).getTime();
      };
      return parseDate(b) - parseDate(a); // descending order
    });
  };

  const getCycleRangeLabel = (cycleLabel: string) => {
    if (!cycleLabel) return '';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const parts = cycleLabel.replace(',', '').split(' ');
    const monthIndex = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[2]);

    let prevMonthIndex = monthIndex - 1;
    let prevYear = year;
    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevYear -= 1;
    }

    return `Cycle period: ${monthNames[prevMonthIndex]} 16, ${prevYear} to ${parts[0]} 15, ${year}`;
  };

  const availableCycles = getAvailablePayCycles();
  const currentMonthCycle = getPayPeriodLabel(new Date().toISOString());
  const [selectedCycle, setSelectedCycle] = useState(
    availableCycles.includes(currentMonthCycle) ? currentMonthCycle : (availableCycles[0] || '')
  );

  // Active Gamers Payroll Calculations
  const activeOperators = gamers.filter(g => g.status === 'active');
  const payrollSummaries = activeOperators.map(g => calculatePayroll(g.id, selectedCycle));

  // Totals & Aggregates
  const totalDaysWorkedAll = payrollSummaries.reduce((sum, p) => sum + p.daysWorked, 0);
  const totalValidOrderUnitsAll = payrollSummaries.reduce((sum, p) => sum + (p.completedOrdersCount || 0), 0);
  const totalResponsibilitySalary = payrollSummaries.reduce((sum, p) => sum + (p.responsibilitySalary || 0), 0);
  const totalAttendanceSalary = payrollSummaries.reduce((sum, p) => sum + (p.attendanceSalary || 0), 0);
  const totalTransportAllowance = payrollSummaries.reduce((sum, p) => sum + (p.transportAllowance || 0), 0);
  const totalExcessOrderIncentive = payrollSummaries.reduce((sum, p) => sum + (p.excessOrderIncentive || 0), 0);
  const totalNormalOTHoursAll = payrollSummaries.reduce((sum, p) => sum + (p.normalOvertimeHours || 0), 0);
  const totalHolidayOTHoursAll = payrollSummaries.reduce((sum, p) => sum + (p.holidayOvertimeHours || 0), 0);
  const totalOvertimePayAll = payrollSummaries.reduce((sum, p) => sum + (p.overtimePay || 0), 0);
  const totalTLManagementAllowance = payrollSummaries.reduce((sum, p) => sum + (p.teamLeaderManagementAllowance || 0), 0);
  const totalTeamIncentive = payrollSummaries.reduce((sum, p) => sum + (p.teamIncentive || 0), 0);
  const totalPayAll = payrollSummaries.reduce((sum, p) => sum + p.totalPay, 0);

  // Operational metrics
  const cycleOrders = orders.filter(
    o => o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === selectedCycle
  );
  const totalCompletedMissions = cycleOrders.length;
  const cycleAttendance = attendance.filter(a => getPayPeriodLabel(a.date) === selectedCycle);
  const totalAssetsFarmedAll = cycleAttendance.reduce((sum, a) => sum + Number(a.farmed_millions || 0), 0);

  // Daily Gamer Earnings
  const dailyGamerEarnings = getDailyGamerEarnings(selectedCycle);
  const availableDailyDates = Array.from(new Set(dailyGamerEarnings.map(r => r.date))).sort().reverse();
  const filteredDailyEarnings = dailyGamerEarnings.filter(r => {
    const matchesDate = selectedDailyDate === 'all' || r.date === selectedDailyDate;
    const matchesGamer = selectedGamerFilter === 'all' || r.gamerId === selectedGamerFilter || r.gamerName === selectedGamerFilter;
    return matchesDate && matchesGamer;
  });

  // Export functions
  const exportToCSV = () => {
    const headers = [
      'Operator Name',
      'Days Worked',
      'Orders (26 Target)',
      'Responsibility Salary (K800 Base)',
      'Attendance Salary (K200 Base)',
      'Transport Allowance (K10/day)',
      'Excess Order Incentive',
      'Normal OT Hours (1.5x)',
      'Holiday OT Hours (2.0x)',
      'Total Overtime Pay',
      'TL Management Allowance',
      'Team Incentive',
      'Additional Performance Award',
      'Total Net Pay (Kwacha K)'
    ];

    const rows = payrollSummaries.map(p => [
      `"${p.gamerName}"`,
      `"${p.daysWorked}/26"`,
      p.completedOrdersCount || 0,
      (p.responsibilitySalary || 0).toFixed(2),
      (p.attendanceSalary || 0).toFixed(2),
      (p.transportAllowance || 0).toFixed(2),
      (p.excessOrderIncentive || 0).toFixed(2),
      p.normalOvertimeHours || 0,
      p.holidayOvertimeHours || 0,
      (p.overtimePay || 0).toFixed(2),
      (p.teamLeaderManagementAllowance || 0).toFixed(2),
      (p.teamIncentive || 0).toFixed(2),
      (p.additionalPerformanceAward || 0).toFixed(2),
      p.totalPay.toFixed(2)
    ]);

    // System Totals row
    rows.push([
      '"SYSTEM TOTALS"',
      `"${totalDaysWorkedAll}"`,
      totalValidOrderUnitsAll,
      totalResponsibilitySalary.toFixed(2),
      totalAttendanceSalary.toFixed(2),
      totalTransportAllowance.toFixed(2),
      totalExcessOrderIncentive.toFixed(2),
      totalNormalOTHoursAll,
      totalHolidayOTHoursAll,
      totalOvertimePayAll.toFixed(2),
      totalTLManagementAllowance.toFixed(2),
      totalTeamIncentive.toFixed(2),
      '0.00',
      totalPayAll.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_payroll_${selectedCycle.replace(' ', '_').replace(',', '')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDailyEarningsToCSV = () => {
    const headers = [
      'Date',
      'Gamer Name',
      'Employee ID',
      'Farmed Millions (M)',
      'Base Earned (K)',
      'Attendance Status',
      'Orders Bonus (K)',
      'Normal OT Hours (1.5x)',
      'Holiday OT Hours (2.0x)',
      'Overtime Pay (K)',
      'Team Volume Bonus (K)',
      'Daily Total Net (K)'
    ];

    const rows = filteredDailyEarnings.map(r => [
      `"${r.date}"`,
      `"${r.gamerName}"`,
      `"${r.employeeId}"`,
      formatM(r.farmedMillions),
      r.basePayEarned.toFixed(2),
      `"${r.attendanceStatus}"`,
      r.orderBonus.toFixed(2),
      r.normalOvertimeHours || 0,
      r.holidayOvertimeHours || 0,
      (r.overtimePay || 0).toFixed(2),
      r.teamVolumeBonus.toFixed(2),
      r.totalDailyEarned.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_daily_earnings_${selectedCycle.replace(' ', '_').replace(',', '')}_${selectedDailyDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBackupJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ gamers, orders, attendance }, null, 2)
    );
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `zampeak_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.gamers) && Array.isArray(parsed.orders)) {
            const res = await importBackupData(parsed.gamers, parsed.orders, parsed.attendance || []);
            if (res.success) {
              setImportStatus({ success: true, message: 'Dossier, Order and Attendance logs successfully restored!' });
            } else {
              setImportStatus({ success: false, message: res.error || 'Import failed.' });
            }
          } else {
            setImportStatus({ success: false, message: 'Invalid file format. Backup must contain gamers and orders.' });
          }
        } catch (err) {
          setImportStatus({ success: false, message: 'Failed to read backup file.' });
        }
      };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // SQL Schema Script to create / update tables in Supabase
  const supabaseSQL = `-- =========================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO UPDATE YOUR EXISTING TABLES
-- =========================================================================
-- 1. Update ORDERS table for milestone progress & dual runner support
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress_millions NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS co_gamer_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_date DATE;

-- 2. Update ATTENDANCE table for overtime hours tracking
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS normal_overtime_hours NUMERIC DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS holiday_overtime_hours NUMERIC DEFAULT 0;

-- 3. Update GAMERS table for status & custom adjustments
ALTER TABLE public.gamers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.gamers ADD COLUMN IF NOT EXISTS bonus_adjustment NUMERIC DEFAULT 0;

-- =========================================================================
-- FULL FRESH TABLE DEFINITIONS (If setting up a new project)
-- =========================================================================
-- 1. Create GAMERS Table
CREATE TABLE IF NOT EXISTS public.gamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    default_password TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    level TEXT NOT NULL DEFAULT 'beginner',
    gamer_role TEXT NOT NULL DEFAULT 'gamer',
    team_leader_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    bonus_adjustment NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create ORDERS Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE RESTRICT NOT NULL,
    co_gamer_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    size_millions NUMERIC NOT NULL,
    progress_millions NUMERIC DEFAULT 0,
    asset_type TEXT NOT NULL DEFAULT 'Haval Coins',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Running',
    payout NUMERIC NOT NULL,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create ATTENDANCE Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    farmed_millions NUMERIC NOT NULL DEFAULT 0,
    normal_overtime_hours NUMERIC DEFAULT 0,
    holiday_overtime_hours NUMERIC DEFAULT 0,
    team_leader_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(gamer_id, date)
);

-- Enable Row Level Security (RLS) or add your security policies as needed
ALTER TABLE public.gamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Authenticated users access policy
CREATE POLICY "Allow authenticated read access" ON public.gamers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.gamers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.attendance FOR ALL TO authenticated USING (true);

-- RPC Secure Registration Validator
CREATE OR REPLACE FUNCTION verify_gamer_registration(p_employee_id TEXT, p_default_password TEXT)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_gamer RECORD;
BEGIN
    SELECT * FROM public.gamers WHERE UPPER(employee_id) = UPPER(p_employee_id) INTO v_gamer;
    
    IF v_gamer.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is not registered in the system. Contact Admin.');
    END IF;
    
    IF v_gamer.default_password IS NULL OR v_gamer.default_password = '' THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is already registered. Please Sign In.');
    END IF;
    
    IF v_gamer.default_password <> p_default_password THEN
        RETURN json_build_object('success', false, 'error', 'Invalid default registration password.');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;`;

  const envTemplate = `NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key`;

  const copyToClipboard = (text: string, type: 'sql' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:bg-white print:text-black">
        {/* Action controls (Hidden during print) */}
        <div className="flex flex-wrap gap-3 items-center justify-between border-b border-cyber-border/40 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400 uppercase">Target Pay Cycle:</span>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-slate-950 border border-cyber-border rounded px-3 py-1.5 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
            >
              {availableCycles.map(cycle => (
                <option key={cycle} value={cycle}>{cycle}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-border bg-slate-900 px-3 py-2 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              Export Payroll CSV
            </button>
            <button 
              onClick={exportDailyEarningsToCSV}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-cyan/40 bg-cyber-cyan/10 px-3 py-2 rounded text-cyber-cyan hover:bg-cyber-cyan/20 transition-all cursor-pointer"
            >
              <Download size={14} />
              Export Daily Earnings CSV
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-border bg-slate-900 px-3 py-2 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <Printer size={14} />
              Print Report
            </button>
          </div>
        </div>

        {/* Report Document Box */}
        <div className="tactical-panel p-6 rounded clip-corners border border-cyber-border/40 bg-cyber-dark/30 relative">
          <div className="text-center font-mono border-b border-cyber-border/40 pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-widest text-cyber-cyan uppercase print:text-black">
              ZAMPEAK CORP PAYROLL LEDGER
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 print:text-slate-600">
              CYCLE: {selectedCycle} ({getCycleRangeLabel(selectedCycle)}) — GENERATED ON {new Date().toLocaleString()}
            </p>
          </div>

          {/* Table */}
          {payrollSummaries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              NO OPERATIONS LOADED IN THE SYSTEM.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-cyber-border text-slate-400 print:text-slate-700 font-bold uppercase text-[9px]">
                      <th className="py-2.5 px-2">Operator Name</th>
                      <th className="py-2.5 px-2 text-center">Days Worked</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan">Orders (26 Target)</th>
                      <th className="py-2.5 px-2 text-right">Responsibility (K800)</th>
                      <th className="py-2.5 px-2 text-right">Attendance (K200)</th>
                      <th className="py-2.5 px-2 text-right">Transport (K10/d)</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Excess Orders</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan print:text-cyan-700 font-bold">OT 1.5x (hrs)</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan print:text-cyan-700 font-bold">OT 2.0x (hrs)</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-bold">Overtime Pay</th>
                      <th className="py-2.5 px-2 text-right text-cyber-amber print:text-amber-700 font-bold">TL Allowance</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Team Incentive</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30 text-slate-300 print:text-black">
                    {payrollSummaries.map((p) => (
                      <tr key={p.gamerId} className="hover:bg-slate-900/20">
                        <td className="py-3 px-2 font-bold">{p.gamerName}</td>
                        <td className="py-3 px-2 text-center font-bold">{p.daysWorked} / 26</td>
                        <td className="py-3 px-2 text-center font-bold text-cyber-cyan">{p.completedOrdersCount || 0}</td>
                        <td className="py-3 px-2 text-right">K{(p.responsibilitySalary || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">K{(p.attendanceSalary || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">K{(p.transportAllowance || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-bold">
                          K{(p.excessOrderIncentive || 0).toFixed(2)}
                          {(p.excessOrdersCount || 0) > 0 && (
                            <span className="text-[9px] text-slate-500 block font-normal">+{p.excessOrdersCount} excess</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-200">
                          {p.normalOvertimeHours || 0} hrs
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-200">
                          {p.holidayOvertimeHours || 0} hrs
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-cyber-cyan">
                          K{(p.overtimePay || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-amber print:text-amber-700">
                          K{(p.teamLeaderManagementAllowance || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700">
                          K{(p.teamIncentive || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">
                          K{p.totalPay.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Aggregates Summary Row */}
                    <tr className="border-t-2 border-cyber-cyan bg-cyber-dark/40 font-bold text-slate-200 print:text-black text-[10px]">
                      <td className="py-3 px-2 uppercase font-black">SYSTEM TOTALS</td>
                      <td className="py-3 px-2 text-center font-black">{totalDaysWorkedAll}</td>
                      <td className="py-3 px-2 text-center font-black text-cyber-cyan">{totalValidOrderUnitsAll}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalResponsibilitySalary.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalAttendanceSalary.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalTransportAllowance.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalExcessOrderIncentive.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center text-cyber-cyan print:text-cyan-700 font-black">{totalNormalOTHoursAll} hrs</td>
                      <td className="py-3 px-2 text-center text-cyber-cyan print:text-cyan-700 font-black">{totalHolidayOTHoursAll} hrs</td>
                      <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">K{totalOvertimePayAll.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-amber print:text-amber-700 font-black">K{totalTLManagementAllowance.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalTeamIncentive.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black text-xs">
                        K{totalPayAll.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tactical summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-cyber-border/40 pt-4 print:hidden">
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Completion Success Ratio</span>
                  <div className="text-lg font-bold text-cyber-green font-mono mt-0.5">
                    {totalCompletedMissions} Completed Missions
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Total Farmed Value</span>
                  <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                    {formatM(totalAssetsFarmedAll)}M assets
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Expected Net Payroll</span>
                  <div className="text-lg font-bold text-cyber-cyan font-mono mt-0.5">
                    K{totalPayAll.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Daily Gamer Earnings Ledger Section */}
              <div className="mt-8 pt-6 border-t border-cyber-border/40">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest flex items-center gap-2">
                    <span>Daily Gamer Earnings Ledger</span>
                    <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">per-day gamer earnings breakdown</span>
                  </h3>

                  {/* Filter Controls (Gamer Name + Date) */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs print:hidden">
                    {/* Gamer Name Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Gamer:</span>
                      <select
                        value={selectedGamerFilter}
                        onChange={(e) => setSelectedGamerFilter(e.target.value)}
                        className="bg-slate-950 border border-cyber-border rounded px-2.5 py-1 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer max-w-[160px] truncate"
                      >
                        <option value="all">All Gamers</option>
                        {gamers.filter(g => g.status === 'active').map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({g.employee_id})</option>
                        ))}
                      </select>
                    </div>

                    {/* Date Filter Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Date:</span>
                      <select
                        value={selectedDailyDate}
                        onChange={(e) => setSelectedDailyDate(e.target.value)}
                        className="bg-slate-950 border border-cyber-border rounded px-2.5 py-1 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
                      >
                        <option value={todayStr}>Today ({todayStr})</option>
                        <option value="all">All Dates in Cycle</option>
                        {availableDailyDates.filter(d => d !== todayStr).map(date => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                {filteredDailyEarnings.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border/30 rounded">
                    NO DAILY GAMER EARNINGS RECORDED FOR {selectedGamerFilter === 'all' ? '' : 'SELECTED GAMER ON '}{selectedDailyDate === 'all' ? 'THIS CYCLE' : selectedDailyDate}.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-cyber-border/30 rounded">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-cyber-border text-slate-400 font-bold uppercase text-[9px] bg-slate-950/60 select-none">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Gamer Name</th>
                          <th className="py-2.5 px-3">Employee ID</th>
                          <th className="py-2.5 px-3 text-right">Farmed (M)</th>
                          <th className="py-2.5 px-3 text-right">Base Earned</th>
                          <th className="py-2.5 px-3 text-center">Attendance Status</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green">Orders Bonus</th>
                          <th className="py-2.5 px-3 text-center text-cyber-cyan">OT 1.5x</th>
                          <th className="py-2.5 px-3 text-center text-cyber-cyan">OT 2.0x</th>
                          <th className="py-2.5 px-3 text-right text-cyber-cyan">Overtime Pay</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green">Team Bonus</th>
                          <th className="py-2.5 px-3 text-right text-cyber-cyan font-black">Daily Total Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                        {filteredDailyEarnings.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 font-mono">
                            <td className="py-2.5 px-3 font-bold">{rec.date}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-100">{rec.gamerName}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{rec.employeeId}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-200">{formatM(rec.farmedMillions)}M</td>
                            <td className="py-2.5 px-3 text-right">K{rec.basePayEarned.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                rec.attendanceStatus === 'present_on_time' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                                rec.attendanceStatus === 'present_late' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20' :
                                rec.attendanceStatus === 'absent' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20' :
                                'bg-slate-800 text-slate-500'
                              }`}>
                                {rec.attendanceStatus === 'present_on_time' ? 'On Time' :
                                 rec.attendanceStatus === 'present_late' ? 'Late' :
                                 rec.attendanceStatus === 'absent' ? 'Absent' : 'No Log'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-green font-bold">K{rec.orderBonus}</td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                              {rec.normalOvertimeHours ? `${rec.normalOvertimeHours}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                              {rec.holidayOvertimeHours ? `${rec.holidayOvertimeHours}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-cyan font-bold">
                              K{(rec.overtimePay || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-green font-bold">K{rec.teamVolumeBonus}</td>
                            <td className="py-2.5 px-3 text-right text-cyber-cyan font-black">K{rec.totalDailyEarned.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cloud DB & Local Storage Settings panel (Hidden during print) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Backup / Restore Box */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 font-mono text-xs">
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-3 mb-4 flex items-center gap-2">
            <Database size={16} className="text-cyber-cyan" />
            Data Archiving & Backups
          </h3>
          
          <p className="text-slate-400 mb-4 leading-relaxed">
            Archive your current order tracker logs and gamer rosters locally on your computer, or restore a previous session backup file.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={exportBackupJSON}
              className="flex-1 flex items-center justify-center gap-1.5 border border-cyber-border bg-slate-950 px-3 py-2.5 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <Download size={14} />
              Export Backup (.json)
            </button>

            {role === 'admin' && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImportJSON}
                  accept=".json"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-cyber-border bg-slate-950 px-3 py-2.5 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  Restore Backup (.json)
                </button>
              </>
            )}
          </div>

          {importStatus && (
            <div className={`mt-4 p-3 border rounded flex items-center gap-2 ${
              importStatus.success 
                ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' 
                : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
            }`}>
              {importStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{importStatus.message}</span>
            </div>
          )}
        </div>

        {/* Supabase coupling instructions */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 font-mono text-xs">
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-3 mb-4 flex items-center gap-2">
            <Database size={16} className="text-cyber-cyan" />
            Supabase Cloud Coupling
          </h3>

          <div className="space-y-4">
            <p className="text-slate-400 leading-relaxed">
              To connect your tracking dashboard to a cloud database, follow these steps to configure your Supabase backend.
            </p>

            {/* Step 1: SQL Schema */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300 font-bold uppercase text-[10px]">
                <span>1. Run SQL Schema in Supabase Editor</span>
                <button 
                  onClick={() => copyToClipboard(supabaseSQL, 'sql')}
                  className="flex items-center gap-1 text-cyber-cyan hover:underline cursor-pointer"
                >
                  {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSql ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
              <pre className="p-2.5 bg-slate-950 border border-cyber-border/60 rounded text-[10px] text-slate-400 overflow-x-auto max-h-[120px] font-mono select-all">
                {supabaseSQL}
              </pre>
            </div>

            {/* Step 2: Env config */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300 font-bold uppercase text-[10px]">
                <span>2. Add Environment Variables to .env.local</span>
                <button 
                  onClick={() => copyToClipboard(envTemplate, 'env')}
                  className="flex items-center gap-1 text-cyber-cyan hover:underline cursor-pointer"
                >
                  {copiedEnv ? <Check size={12} /> : <Copy size={12} />}
                  {copiedEnv ? 'Copied!' : 'Copy Env'}
                </button>
              </div>
              <pre className="p-2.5 bg-slate-950 border border-cyber-border/60 rounded text-[10px] text-slate-400 overflow-x-auto font-mono select-all">
                {envTemplate}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
