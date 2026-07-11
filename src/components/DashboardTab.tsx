'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Shield, 
  Gamepad2, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  Play,
  Pause,
  CheckCircle,
  Clock
} from 'lucide-react';
import { OrderStatus } from '../types';

export default function DashboardTab({ 
  onNavigate 
}: { 
  onNavigate: (tab: 'dashboard' | 'gamers' | 'orders' | 'reports') => void 
}) {
  const { orders: allOrders, gamers, updateOrderStatus, role, gamerProfile, isDemo, user } = useApp();

  // Filter orders if user is a gamer
  const orders = role === 'gamer' && gamerProfile
    ? allOrders.filter(o => o.gamer_id === gamerProfile.id)
    : allOrders;

  // Helper to calculate pay period label from a date string
  const getPayPeriodLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    let year = date.getFullYear();
    let month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    if (day >= 15) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month]} 15, ${year}`;
  };

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
    allOrders.forEach(o => {
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

    return `Cycle period: ${monthNames[prevMonthIndex]} 15, ${prevYear} to ${parts[0]} 14, ${year}`;
  };

  const availableCycles = getAvailablePayCycles();
  const currentMonthCycle = getPayPeriodLabel(new Date().toISOString());
  const [selectedCycle, setSelectedCycle] = useState(
    availableCycles.includes(currentMonthCycle) ? currentMonthCycle : (availableCycles[0] || '')
  );

  const getOrdersInCycle = (cycleLabel: string) => {
    const completedOrders = orders.filter(o => o.status === 'Completed');
    return completedOrders.filter(o => getPayPeriodLabel(o.start_date) === cycleLabel);
  };

  // 1. Calculations
  const totalOrders = orders.length;
  const completedOrders = orders.filter(o => o.status === 'Completed').length;
  const runningOrders = orders.filter(o => o.status === 'Running').length;
  const pausedOrders = orders.filter(o => o.status === 'Paused').length;
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
  const violationOrders = orders.filter(o => o.status === 'Violation').length;
  const activeOrders = runningOrders + pausedOrders;

  const totalEarnings = orders
    .filter(o => o.status === 'Completed')
    .reduce((sum, o) => sum + o.payout, 0);

  const totalAssetsFarmed = orders
    .filter(o => o.status === 'Completed')
    .reduce((sum, o) => sum + o.size_millions, 0);

  const averageOrderSize = totalOrders > 0 
    ? Math.round(orders.reduce((sum, o) => sum + o.size_millions, 0) / totalOrders)
    : 0;

  const completionRate = totalOrders > 0 
    ? Math.round((completedOrders / totalOrders) * 100) 
    : 0;

  const violationRate = totalOrders > 0 
    ? Math.round((violationOrders / totalOrders) * 100) 
    : 0;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 5);

  // Gamer stats for ranking (Only shown to Admin)
  const gamerStats = gamers.map(gamer => {
    const gamerOrders = allOrders.filter(o => o.gamer_id === gamer.id);
    const completed = gamerOrders.filter(o => o.status === 'Completed');
    const earnings = completed.reduce((sum, o) => sum + o.payout, 0);
    const farmed = completed.reduce((sum, o) => sum + o.size_millions, 0);
    return {
      gamer,
      total: gamerOrders.length,
      completed: completed.length,
      earnings,
      farmed
    };
  })
  .filter(g => g.total > 0)
  .sort((a, b) => b.earnings - a.earnings)
  .slice(0, 4);

  const handleQuickStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (role === 'admin') {
      await updateOrderStatus(orderId, newStatus);
    }
  };

  // 2. Custom SVG Doughnut Chart Calculation
  const statuses = [
    { name: 'Running', count: runningOrders, color: '#00f0ff', strokeDash: '' },
    { name: 'Completed', count: completedOrders, color: '#10b981', strokeDash: '' },
    { name: 'Paused', count: pausedOrders, color: '#f59e0b', strokeDash: '' },
    { name: 'Violation', count: violationOrders, color: '#ef4444', strokeDash: '' },
    { name: 'Cancelled', count: cancelledOrders, color: '#6b7280', strokeDash: '' },
  ].filter(s => s.count > 0);

  const chartTotal = statuses.reduce((sum, s) => sum + s.count, 0);
  let accumulatedPercent = 0;

  const processedStatuses = statuses.map(s => {
    const percent = chartTotal > 0 ? (s.count / chartTotal) * 100 : 0;
    const offset = (accumulatedPercent * 251.2) / 100;
    accumulatedPercent += percent;
    return {
      ...s,
      percent,
      strokeDasharray: `${(percent * 251.2) / 100} 251.2`,
      strokeDashoffset: -offset
    };
  });

  return (
    <div className="space-y-6">
      {/* HUD Info Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-l-4 border-cyber-cyan bg-cyber-dark/60 backdrop-blur rounded-r clip-corners-sm border border-cyber-border">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wider text-cyber-cyan uppercase flex items-center gap-2">
            <span className="h-2 w-2 bg-cyber-cyan rounded-full animate-ping"></span>
            {role === 'admin' ? 'Operational Command Center' : 'Gamer Data Access terminal'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            TARGET: DELTA FORCE MOBILE — {role === 'admin' ? 'AGENT RECORDS & METRIC AUDITS' : `MY PERFORMANCE PORTFOLIO ID: ${gamerProfile?.employee_id}`}
          </p>
          <div className="text-[11px] font-mono text-slate-300 mt-2 flex items-center gap-1.5">
            <span className="text-slate-500 uppercase">OPERATOR:</span>
            <span className="text-cyber-green font-bold uppercase">{role === 'gamer' && gamerProfile ? gamerProfile.name : (user?.email || 'admin')}</span>
          </div>
        </div>
        <div className="mt-3 md:mt-0 font-mono text-xs flex gap-3 text-slate-400">
          <span className="px-2 py-1 bg-slate-900 border border-cyber-border rounded">
            DATABASE: {isDemo ? (
              <span className="text-cyber-amber font-bold">LOCAL DEMO MODE</span>
            ) : (
              <span className="text-cyber-green font-bold">SUPABASE CLOUD COUPLING</span>
            )}
          </span>
          <span className="px-2 py-1 bg-slate-900 border border-cyber-border rounded text-slate-300">
            ACCESS: {role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Orders */}
        <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 relative overflow-hidden group">
          <div className="absolute right-2 bottom-2 text-cyber-cyan/10 group-hover:text-cyber-cyan/20 transition-colors">
            <Gamepad2 size={64} />
          </div>
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest">{role === 'admin' ? 'Total Missions' : 'My Missions'}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-cyber-cyan text-glow-cyan">{totalOrders}</span>
            <span className="text-xs text-slate-500 font-mono">Assigned</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono flex justify-between">
            <span>Active: {activeOrders}</span>
            <span className="text-cyber-cyan cursor-pointer hover:underline" onClick={() => onNavigate('orders')}>View &rarr;</span>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 relative overflow-hidden group">
          <div className="absolute right-2 bottom-2 text-cyber-green/10 group-hover:text-cyber-green/20 transition-colors">
            <DollarSign size={64} />
          </div>
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest font-bold">{role === 'admin' ? 'Total Expected Pay' : 'My Earnings'}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-cyber-green text-glow-green">K{totalEarnings}</span>
            <span className="text-xs text-slate-500 font-mono">Kwacha</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono flex justify-between">
            <span>Farmed: {totalAssetsFarmed}M</span>
            {role === 'admin' && (
              <span className="text-cyber-green cursor-pointer hover:underline" onClick={() => onNavigate('reports')}>Reports &rarr;</span>
            )}
          </div>
        </div>

        {/* Completion Rate */}
        <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 relative overflow-hidden group">
          <div className="absolute right-2 bottom-2 text-cyber-green/10 group-hover:text-cyber-green/20 transition-colors">
            <TrendingUp size={64} />
          </div>
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest">Success Rate</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-cyber-green text-glow-green">{completionRate}%</span>
            <span className="text-xs text-slate-500 font-mono">Completed</span>
          </div>
          <div className="mt-3 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-cyber-green h-full rounded-full" style={{ width: `${completionRate}%` }}></div>
          </div>
        </div>

        {/* Violation Rate */}
        <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 relative overflow-hidden group">
          <div className="absolute right-2 bottom-2 text-cyber-red/10 group-hover:text-cyber-red/20 transition-colors">
            <AlertTriangle size={64} />
          </div>
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest">Violation Rate</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-cyber-red" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}>{violationRate}%</span>
            <span className="text-xs text-slate-500 font-mono">Violations</span>
          </div>
          <div className="mt-3 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
            <div className="bg-cyber-red h-full rounded-full" style={{ width: `${violationRate}%` }}></div>
          </div>
        </div>

        {/* Average Order Size */}
        <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 relative overflow-hidden group">
          <div className="absolute right-2 bottom-2 text-cyber-cyan/10 group-hover:text-cyber-cyan/20 transition-colors">
            <Shield size={64} />
          </div>
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest">Avg Order Size</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-slate-200">{averageOrderSize}M</span>
            <span className="text-xs text-slate-500 font-mono">Assets</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            Metric scale threshold: 10M - 120M
          </div>
        </div>
      </div>

      {/* Expected Payroll Calculator Section */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 space-y-4">
        <div className="hud-grid"></div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-cyber-border/40 pb-3 gap-3">
          <div>
            <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest flex items-center gap-1.5">
              <span>Expected Pay & Payroll Cycles</span>
              <span className="text-[10px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">automated</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
              {getCycleRangeLabel(selectedCycle)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400 uppercase">Target Pay Date:</span>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-slate-950 border border-cyber-border rounded px-3 py-1 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
            >
              {availableCycles.map(cycle => (
                <option key={cycle} value={cycle}>{cycle}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Expected Pay Cards/Table depending on role */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Payout Summary */}
          <div className="lg:col-span-1 border border-cyber-border/20 rounded p-4 bg-slate-950/40 relative">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Expected Payout</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-black text-cyber-green text-glow-green">
                K{getOrdersInCycle(selectedCycle).reduce((sum, o) => sum + o.payout, 0).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-500 font-mono uppercase">Kwacha</span>
            </div>
            <div className="mt-2 font-mono text-[9px] text-slate-500 flex justify-between">
              <span>Orders Completed:</span>
              <span className="text-slate-300 font-bold">{getOrdersInCycle(selectedCycle).length}</span>
            </div>
            <div className="mt-1 font-mono text-[9px] text-slate-500 flex justify-between">
              <span>Completed Volume:</span>
              <span className="text-slate-300 font-bold">
                {getOrdersInCycle(selectedCycle).reduce((sum, o) => sum + o.size_millions, 0)}M
              </span>
            </div>
          </div>

          {/* Card 2: List (Depending on Role) */}
          <div className="lg:col-span-3 border border-cyber-border/20 rounded p-4 bg-slate-950/40">
            {role === 'admin' ? (
              // Admin View: Breakdown per Gamer
              <div className="space-y-2">
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider pb-1.5 border-b border-cyber-border/20">Gamer Payroll Breakdown</div>
                {gamers.length === 0 ? (
                  <div className="text-center py-4 font-mono text-[10px] text-slate-500 uppercase">No gamers recruited.</div>
                ) : (
                  <div className="max-h-28 overflow-y-auto divide-y divide-cyber-border/20 pr-1">
                    {gamers.map(g => {
                      const gamerOrders = getOrdersInCycle(selectedCycle).filter(o => o.gamer_id === g.id);
                      const totalPayout = gamerOrders.reduce((sum, o) => sum + o.payout, 0);
                      
                      return (
                        <div key={g.id} className="flex justify-between items-center py-1.5 text-[10px] font-mono hover:bg-slate-900/40">
                          <div>
                            <span className="font-bold text-slate-300">{g.name}</span>
                            <span className="text-[9px] text-slate-500 ml-1.5">ID: {g.employee_id}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-slate-400">{gamerOrders.length} orders</span>
                            <span className="font-bold text-cyber-green">K{totalPayout.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Gamer View: List of Contributing Orders
              <div className="space-y-2">
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider pb-1.5 border-b border-cyber-border/20">Your Contributing Orders</div>
                {getOrdersInCycle(selectedCycle).length === 0 ? (
                  <div className="text-center py-4 font-mono text-[10px] text-slate-500 uppercase">No completed orders in this period.</div>
                ) : (
                  <div className="max-h-28 overflow-y-auto divide-y divide-cyber-border/20 pr-1">
                    {getOrdersInCycle(selectedCycle).map(order => (
                      <div key={order.id} className="flex justify-between items-center py-1.5 text-[10px] font-mono hover:bg-slate-900/40">
                        <div>
                          <span className="font-bold text-cyber-cyan">{order.order_number}</span>
                          <span className="text-[9px] text-slate-500 ml-2">
                            {new Date(order.start_date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-slate-400">{order.size_millions}M</span>
                          <span className="font-bold text-cyber-green">K{order.payout.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart (Expanded to full width if gamer, to keep layout beautiful) */}
        <div className={`tactical-panel p-5 rounded clip-corners border border-cyber-border/40 flex flex-col justify-between ${
          role === 'admin' ? 'lg:col-span-1' : 'lg:col-span-3'
        }`}>
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
              <span>Mission Status Audit</span>
              <span className="text-xs text-slate-500 font-normal">Breakdown</span>
            </h3>
            
            {chartTotal === 0 ? (
              <div className="h-48 flex items-center justify-center font-mono text-slate-500 text-xs">
                NO ACTIVE ASSIGNED MISSIONS DETECTED
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <div className="relative h-32 w-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="transparent" 
                      stroke="#080f21" 
                      strokeWidth="12" 
                    />
                    {processedStatuses.map((s, idx) => (
                      <circle
                        key={idx}
                        cx="50" cy="50" r="40"
                        fill="transparent"
                        stroke={s.color}
                        strokeWidth="12"
                        strokeDasharray={s.strokeDasharray}
                        strokeDashoffset={s.strokeDashoffset}
                        className="transition-all duration-1000 ease-out"
                        style={{
                          filter: `drop-shadow(0 0 3px ${s.color}44)`
                        }}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-mono font-bold text-slate-100">{totalOrders}</span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Missions</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-6 w-full text-xs font-mono max-w-md">
                  {processedStatuses.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                      <span className="text-slate-400">{s.name}:</span>
                      <span className="font-bold text-slate-200 ml-auto">{s.count} ({Math.round(s.percent)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Widget: Gamer Rankings (Only shown to Admin) */}
        {role === 'admin' && (
          <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-2">
            <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
              <span>Gamers Earnings Leaderboard</span>
              <span className="text-xs text-cyber-cyan font-mono cursor-pointer hover:underline" onClick={() => onNavigate('gamers')}>View All Gamers</span>
            </h3>

            {gamerStats.length === 0 ? (
              <div className="h-48 flex items-center justify-center font-mono text-slate-500 text-xs">
                NO ACTIVE GAMERS WITH COMPLETED MISSIONS FOUND
              </div>
            ) : (
              <div className="space-y-4">
                {gamerStats.map((item, idx) => {
                  const maxEarnings = Math.max(...gamerStats.map(g => g.earnings)) || 1;
                  const widthPercent = Math.max(15, Math.round((item.earnings / maxEarnings) * 100));

                  return (
                    <div key={item.gamer.id} className="space-y-1">
                      <div className="flex justify-between items-center font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                            idx === 0 ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan' :
                            idx === 1 ? 'bg-cyber-green/20 border-cyber-green text-cyber-green' :
                            idx === 2 ? 'bg-cyber-amber/20 border-cyber-amber text-cyber-amber' :
                            'bg-slate-900 border-slate-700 text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200">{item.gamer.name}</span>
                          <span className="text-slate-500 text-[10px]">(ID: {item.gamer.employee_id})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{item.farmed}M Farmed</span>
                          <span className="text-cyber-green font-bold">K{item.earnings}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950/80 h-3 rounded border border-cyber-border/40 overflow-hidden relative">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out ${
                            idx === 0 ? 'bg-cyber-cyan' :
                            idx === 1 ? 'bg-cyber-green' :
                            'bg-slate-700'
                          }`} 
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Row: Active/Recent Orders Queue */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40">
        <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
          <span>{role === 'admin' ? 'Active Command Queue (Quick Status Updates)' : 'My Active Missions'}</span>
          <span className="text-xs text-cyber-cyan font-mono cursor-pointer hover:underline" onClick={() => onNavigate('orders')}>Manage All Orders</span>
        </h3>

        {recentOrders.length === 0 ? (
          <div className="py-8 text-center font-mono text-slate-500 text-xs">
            NO DEPLOYED MISSION LOGS DETECTED.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-cyber-border text-slate-400 bg-cyber-dark/40">
                  <th className="p-3">Order Code</th>
                  {role === 'admin' && <th className="p-3">Assigned Gamer</th>}
                  <th className="p-3 text-right">Size</th>
                  <th className="p-3 text-right">Payout (K)</th>
                  <th className="p-3">Deployment Date</th>
                  <th className="p-3">Status</th>
                  {role === 'admin' && <th className="p-3 text-center">Quick Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/40">
                {recentOrders.map((order) => {
                  const assignedGamer = gamers.find(g => g.id === order.gamer_id);
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 text-cyber-cyan font-bold">{order.order_number}</td>
                      {role === 'admin' && (
                        <td className="p-3">
                          <div className="font-bold text-slate-300">{assignedGamer ? assignedGamer.name : 'Unknown Gamer'}</div>
                          <div className="text-[10px] text-slate-500">{assignedGamer ? `ID: ${assignedGamer.employee_id}` : ''}</div>
                        </td>
                      )}
                      <td className="p-3 text-right text-slate-300 font-bold">
                        {order.size_millions}M
                        <span className="text-[9px] text-slate-500 font-normal block">{order.asset_type || 'Haval Coins'}</span>
                      </td>
                      <td className="p-3 text-right text-cyber-green font-bold">K{order.payout}</td>
                      <td className="p-3 text-slate-400">
                        {new Date(order.start_date).toLocaleDateString()} {new Date(order.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'Running' ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30' :
                          order.status === 'Completed' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30' :
                          order.status === 'Paused' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30' :
                          order.status === 'Violation' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/30' :
                          'bg-slate-700/10 text-slate-400 border border-slate-600/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1">
                            {order.status === 'Running' && (
                              <>
                                <button 
                                  onClick={() => handleQuickStatus(order.id, 'Paused')}
                                  title="Pause Order"
                                  className="p-1 hover:bg-cyber-amber/20 rounded border border-cyber-amber/30 text-cyber-amber transition-colors"
                                >
                                  <Pause size={12} />
                                </button>
                                <button 
                                  onClick={() => handleQuickStatus(order.id, 'Completed')}
                                  title="Complete Order"
                                  className="p-1 hover:bg-cyber-green/20 rounded border border-cyber-green/30 text-cyber-green transition-colors"
                                >
                                  <CheckCircle size={12} />
                                </button>
                                <button 
                                  onClick={() => handleQuickStatus(order.id, 'Violation')}
                                  title="Mark Violation"
                                  className="p-1 hover:bg-cyber-red/20 rounded border border-cyber-red/30 text-cyber-red transition-colors"
                                >
                                  <AlertTriangle size={12} />
                                </button>
                              </>
                            )}
                            {order.status === 'Paused' && (
                              <>
                                <button 
                                  onClick={() => handleQuickStatus(order.id, 'Running')}
                                  title="Resume Order"
                                  className="p-1 hover:bg-cyber-cyan/20 rounded border border-cyber-cyan/30 text-cyber-cyan transition-colors"
                                >
                                  <Play size={12} />
                                </button>
                                <button 
                                  onClick={() => handleQuickStatus(order.id, 'Completed')}
                                  title="Complete Order"
                                  className="p-1 hover:bg-cyber-green/20 rounded border border-cyber-green/30 text-cyber-green transition-colors"
                                >
                                  <CheckCircle size={12} />
                                </button>
                              </>
                            )}
                            {order.status !== 'Running' && order.status !== 'Paused' && (
                              <span className="text-[10px] text-slate-500 font-mono">No Actions</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
