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

export default function ReportsTab() {
  const { gamers, orders, attendance, importBackupData, isDemo, calculatePayroll } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Generate list of cycles
  const getAvailablePayCycles = () => {
    const cyclesSet = new Set<string>();
    
    // Always include current month and next month's cycles as upcoming options
    const now = new Date();
    cyclesSet.add(getPayPeriodLabel(now.toISOString()));
    
    // Add next month cycle
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    cyclesSet.add(getPayPeriodLabel(nextMonthDate.toISOString()));

    // Add cycles from completed orders
    orders.forEach(o => {
      if (o.status === 'Completed') {
        cyclesSet.add(getPayPeriodLabel(o.start_date));
      }
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return Array.from(cyclesSet).sort((a, b) => {
      const parseDate = (label: string) => {
        const parts = label.replace(',', '').split(' '); // e.g. ["July", "15", "2026"]
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
    const parts = cycleLabel.replace(',', '').split(' '); // e.g. ["July", "15", "2026"]
    const monthIndex = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[2]);

    // Prev month index
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

  // 1. Calculations for Report (for the selected cycle)
  const activeOperators = gamers.filter(g => g.status === 'active');
  const payrollSummaries = activeOperators.map(g => calculatePayroll(g.id, selectedCycle));

  // Calculate Report Aggregates
  const totalBaseSalary = payrollSummaries.reduce((sum, p) => sum + p.baseSalary, 0);
  const totalBasePayEarned = payrollSummaries.reduce((sum, p) => sum + p.basePayEarned, 0);
  const totalDeductions = payrollSummaries.reduce((sum, p) => sum + p.deductions, 0);
  const totalAttendanceBonus = payrollSummaries.reduce((sum, p) => sum + p.attendanceBonus, 0);
  
  // Completed order stats for cycle
  const cycleOrders = orders.filter(
    o => o.status === 'Completed' && getOrderPeriodLabel(o.start_date) === selectedCycle
  );
  const totalCompletedMissions = cycleOrders.length;
  const totalAssetsFarmedAll = cycleOrders.reduce((sum, o) => sum + Number(o.size_millions), 0);
  const totalOrderPayout = cycleOrders.reduce((sum, o) => sum + Number(o.payout), 0);
  const totalTeamVolumeBonus = payrollSummaries.reduce((sum, p) => sum + p.teamVolumeBonus, 0);
  const totalPayAll = payrollSummaries.reduce((sum, p) => sum + p.totalPay, 0);

  // Daily Team Performance grouping
  const getDailyTeamPerformance = () => {
    const dailyRecords: {
      date: string;
      teamLeaderName: string;
      volume: number;
      bonus: number;
    }[] = [];

    // Group completed cycle orders by date and team leader
    const dayGroups: { [dateStr: string]: { [leaderId: string]: number } } = {};

    cycleOrders.forEach(o => {
      const d = new Date(o.start_date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const gamer = gamers.find(g => g.id === o.gamer_id);
      if (!gamer) return;

      // Find the team leader ID for this gamer (if they are a gamer, get team_leader_id. If they are a leader, get their own ID).
      const leaderId = gamer.gamer_role === 'team_leader' ? gamer.id : gamer.team_leader_id;
      if (!leaderId) return; // Unassigned gamers do not belong to any team

      if (!dayGroups[dateStr]) dayGroups[dateStr] = {};
      dayGroups[dateStr][leaderId] = (dayGroups[dateStr][leaderId] || 0) + Number(o.size_millions);
    });

    // Format results and calculate daily bonus
    Object.keys(dayGroups).sort().reverse().forEach(dateStr => {
      const leaders = dayGroups[dateStr];
      Object.keys(leaders).forEach(leaderId => {
        const leader = gamers.find(g => g.id === leaderId);
        if (!leader) return;

        const volume = leaders[leaderId];
        let bonus = 0;
        if (volume > 50) {
          const over = volume - 50;
          const tens = Math.floor(over / 10);
          if (tens > 0) {
            bonus = tens * 10;
          }
        }

        dailyRecords.push({
          date: dateStr,
          teamLeaderName: leader.name,
          volume,
          bonus
        });
      });
    });

    return dailyRecords;
  };

  const dailyTeamPerformance = getDailyTeamPerformance();

  // 2. Export functions
  const exportToCSV = () => {
    const headers = [
      'Gamer Name', 
      'Employee ID', 
      'Role', 
      'Level', 
      'Days Worked', 
      'Base Contract Salary', 
      'Base Salary Earned', 
      'Missed Day Deductions', 
      'Attendance Bonus (On-time)', 
      'Order Bonus', 
      'Team Volume Bonus', 
      'Total Net Pay (Kwacha K)'
    ];
    const rows = payrollSummaries.map(p => [
      p.gamerName,
      p.employeeId,
      p.gamerRole.replace('_', ' ').toUpperCase(),
      p.level.toUpperCase(),
      `${p.daysWorked}/26`,
      p.baseSalary,
      p.basePayEarned.toFixed(2),
      p.deductions.toFixed(2),
      p.attendanceBonus,
      p.orderBonus,
      p.teamVolumeBonus,
      p.totalPay
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

  // SQL Schema Script to create tables in Supabase
  const supabaseSQL = `-- 1. Create GAMERS Table
CREATE TABLE public.gamers (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create ORDERS Table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE RESTRICT NOT NULL,
    size_millions NUMERIC NOT NULL,
    asset_type TEXT NOT NULL DEFAULT 'Haval Coins',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Running',
    payout NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create ATTENDANCE Table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(gamer_id, date)
);

-- Enable Row Level Security (RLS) or add your security policies as needed
ALTER TABLE public.gamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Authenticated users access policy (Secure for authenticated employees/ops)
CREATE POLICY "Allow authenticated read access" ON public.gamers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.gamers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.attendance FOR ALL TO authenticated USING (true);

-- 6. RPC Secure Registration Validator (Bypasses RLS to verify codes safely)
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
          
          <div className="flex gap-3">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-border bg-slate-900 px-3 py-2 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              Export CSV
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
                      <th className="py-2.5 px-2">Clearance ID</th>
                      <th className="py-2.5 px-2">Role/Level</th>
                      <th className="py-2.5 px-2 text-center">Days Worked</th>
                      <th className="py-2.5 px-2 text-right">Base Salary</th>
                      <th className="py-2.5 px-2 text-right">Base Earned</th>
                      <th className="py-2.5 px-2 text-right text-cyber-red print:text-red-700 font-bold">Deductions</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">On-Time Bonus</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Orders Bonus</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Team Leader Bonus</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30 text-slate-300 print:text-black">
                    {payrollSummaries.map((p) => (
                      <tr key={p.gamerId} className="hover:bg-slate-900/20">
                        <td className="py-3 px-2 font-bold">{p.gamerName}</td>
                        <td className="py-3 px-2 text-slate-400 print:text-slate-600 font-mono">{p.employeeId}</td>
                        <td className="py-3 px-2 capitalize">{p.gamerRole.replace('_', ' ')} / {p.gamerRole === 'technical_manager' ? 'contract' : p.level}</td>
                        <td className="py-3 px-2 text-center font-bold">{p.daysWorked} / 26</td>
                        <td className="py-3 px-2 text-right">K{p.baseSalary}</td>
                        <td className="py-3 px-2 text-right">K{p.basePayEarned.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-cyber-red print:text-red-700 font-bold">K-{p.deductions.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700">K{p.attendanceBonus}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700">K{p.orderBonus}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700">K{p.teamVolumeBonus}</td>
                        <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">K{p.totalPay.toLocaleString()}</td>
                      </tr>
                    ))}
                    {/* Aggregates Summary Row */}
                    <tr className="border-t-2 border-cyber-cyan bg-cyber-dark/40 font-bold text-slate-200 print:text-black text-[10px]">
                      <td className="py-3 px-2 uppercase font-black" colSpan={3}>SYSTEM TOTALS</td>
                      <td className="py-3 px-2 text-center font-black">-</td>
                      <td className="py-3 px-2 text-right font-black">K{totalBaseSalary.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalBasePayEarned.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-red print:text-red-700 font-black">K-{totalDeductions.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalAttendanceBonus}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalOrderPayout.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalTeamVolumeBonus}</td>
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
                    {totalAssetsFarmedAll}M assets
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Expected Net Payroll</span>
                  <div className="text-lg font-bold text-cyber-cyan font-mono mt-0.5">
                    K{totalPayAll.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Daily Team Performance Ledger Section */}
              <div className="mt-8 pt-6 border-t border-cyber-border/40">
                <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest mb-4 flex justify-between items-center">
                  <span>Daily Team Volume Ledger</span>
                  <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">real-time team tracker</span>
                </h3>
                
                {dailyTeamPerformance.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border/30 rounded">
                    NO DAILY TEAM VOLUME DATA RECORDED FOR THIS CYCLE.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-cyber-border/30 rounded">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-cyber-border text-slate-400 font-bold uppercase text-[9px] bg-slate-950/60 select-none">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Team Leader</th>
                          <th className="py-2.5 px-3 text-right">Daily Team Volume</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green">Daily Leader Bonus</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                        {dailyTeamPerformance.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 font-mono">
                            <td className="py-2.5 px-3">{rec.date}</td>
                            <td className="py-2.5 px-3 font-bold">{rec.teamLeaderName}</td>
                            <td className="py-2.5 px-3 text-right font-bold">{rec.volume}M Assets</td>
                            <td className="py-2.5 px-3 text-right font-bold text-cyber-green">K{rec.bonus}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                rec.volume > 50 
                                  ? 'bg-cyber-green/10 text-cyber-green' 
                                  : 'bg-slate-800 text-slate-500'
                              }`}>
                                {rec.volume > 50 ? 'Threshold Exceeded' : 'Normal'}
                              </span>
                            </td>
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
