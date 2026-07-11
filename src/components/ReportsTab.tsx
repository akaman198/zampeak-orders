'use client';

import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
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
import { GamerPerformance } from '../types';

export default function ReportsTab() {
  const { gamers, orders, importBackupData, isDemo } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // 1. Calculations for Report
  const gamerPerformances: GamerPerformance[] = gamers.map(gamer => {
    const gamerOrders = orders.filter(o => o.gamer_id === gamer.id);
    const completed = gamerOrders.filter(o => o.status === 'Completed');
    const running = gamerOrders.filter(o => o.status === 'Running').length;
    const paused = gamerOrders.filter(o => o.status === 'Paused').length;
    const cancelled = gamerOrders.filter(o => o.status === 'Cancelled').length;
    const violation = gamerOrders.filter(o => o.status === 'Violation').length;

    const totalAssetsFarmed = completed.reduce((sum, o) => sum + o.size_millions, 0);
    const totalPayoutExpected = completed.reduce((sum, o) => sum + o.payout, 0);

    const total = gamerOrders.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const violationRate = total > 0 ? Math.round((violation / total) * 100) : 0;

    return {
      gamer,
      totalOrders: total,
      completedOrders: completed.length,
      runningOrders: running,
      pausedOrders: paused,
      cancelledOrders: cancelled,
      violationOrders: violation,
      totalAssetsFarmed,
      totalPayoutExpected,
      completionRate,
      violationRate
    };
  });

  // Calculate Report Aggregates
  const totalCompletedMissions = gamerPerformances.reduce((sum, g) => sum + g.completedOrders, 0);
  const totalAssetsFarmedAll = gamerPerformances.reduce((sum, g) => sum + g.totalAssetsFarmed, 0);
  const totalPayoutAll = gamerPerformances.reduce((sum, g) => sum + g.totalPayoutExpected, 0);

  // 2. Export functions
  const exportToCSV = () => {
    const headers = ['Gamer Name', 'Employee ID', 'Total Deployed', 'Completed Missions', 'Violation Count', 'Total Assets/Coins Farmed (Millions)', 'Expected Payout (Kwacha K)'];
    const rows = gamerPerformances.map(gp => [
      gp.gamer.name,
      gp.gamer.employee_id,
      gp.totalOrders,
      gp.completedOrders,
      gp.violationOrders,
      gp.totalAssetsFarmed,
      gp.totalPayoutExpected
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_gamer_performance_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBackupJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ gamers, orders }, null, 2)
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
            const res = await importBackupData(parsed.gamers, parsed.orders);
            if (res.success) {
              setImportStatus({ success: true, message: 'Dossier and Order logs successfully restored!' });
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

  // SQL Schema Script to create tables in Supabase (with employee_id and asset_type)
  const supabaseSQL = `-- 1. Create GAMERS Table
CREATE TABLE public.gamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    default_password TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
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

-- Enable Row Level Security (RLS) or add your security policies as needed
ALTER TABLE public.gamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Authenticated users access policy (Secure for authenticated employees/ops)
CREATE POLICY "Allow authenticated read access" ON public.gamers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.gamers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.orders FOR ALL TO authenticated USING (true);

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
        <div className="flex flex-wrap gap-3 justify-end border-b border-cyber-border/40 pb-4 print:hidden">
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

        {/* Report Document Box */}
        <div className="tactical-panel p-6 rounded clip-corners border border-cyber-border/40 bg-cyber-dark/30 relative">
          <div className="text-center font-mono border-b border-cyber-border/40 pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-widest text-cyber-cyan uppercase print:text-black">
              ZAMPEAK PERFORMANCE AUDIT REPORT
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 print:text-slate-600">
              GAME METRICS: DELTA FORCE MOBILE — GENERATED ON {new Date().toLocaleString()}
            </p>
          </div>

          {/* Table */}
          {gamerPerformances.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              NO OPERATIONS LOADED IN THE SYSTEM.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-cyber-border text-slate-400 print:text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-2">Gamer Name</th>
                      <th className="py-2.5 px-2">ID</th>
                      <th className="py-2.5 px-2 text-right">Deployed</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Completed</th>
                      <th className="py-2.5 px-2 text-right text-cyber-red print:text-red-700 font-bold">Violations</th>
                      <th className="py-2.5 px-2 text-right">Farmed Assets</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">Expected Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30 text-slate-300 print:text-black">
                    {gamerPerformances.map((gp) => (
                      <tr key={gp.gamer.id} className="hover:bg-slate-900/20">
                        <td className="py-3 px-2 font-bold">{gp.gamer.name}</td>
                        <td className="py-3 px-2 text-slate-400 print:text-slate-600">ID: {gp.gamer.employee_id}</td>
                        <td className="py-3 px-2 text-right">{gp.totalOrders}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-bold">{gp.completedOrders}</td>
                        <td className="py-3 px-2 text-right text-cyber-red print:text-red-700 font-bold">{gp.violationOrders}</td>
                        <td className="py-3 px-2 text-right font-bold">{gp.totalAssetsFarmed}M</td>
                        <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">K{gp.totalPayoutExpected}</td>
                      </tr>
                    ))}
                    {/* Aggregates Summary Row */}
                    <tr className="border-t-2 border-cyber-cyan bg-cyber-dark/40 font-bold text-slate-200 print:text-black">
                      <td className="py-3 px-2 uppercase" colSpan={2}>SYSTEM TOTALS</td>
                      <td className="py-3 px-2 text-right font-bold">
                        {gamerPerformances.reduce((sum, g) => sum + g.totalOrders, 0)}
                      </td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-bold">
                        {totalCompletedMissions}
                      </td>
                      <td className="py-3 px-2 text-right text-cyber-red print:text-red-700 font-bold">
                        {gamerPerformances.reduce((sum, g) => sum + g.violationOrders, 0)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold">
                        {totalAssetsFarmedAll}M Total
                      </td>
                      <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black text-sm">
                        K{totalPayoutAll}
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
                    {totalCompletedMissions} of {orders.length} Missions ({orders.length > 0 ? Math.round((totalCompletedMissions / orders.length) * 100) : 0}%)
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Total Farmed Value</span>
                  <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                    {totalAssetsFarmedAll}M assets
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Total Capital Payouts</span>
                  <div className="text-lg font-bold text-cyber-cyan font-mono mt-0.5">
                    K{totalPayoutAll} Expected Payouts
                  </div>
                </div>
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
