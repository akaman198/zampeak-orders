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
  const { orders: allOrders, gamers, updateOrderStatus, role, gamerProfile, isDemo, user, calculatePayroll } = useApp();

  const isManager = role === 'admin' || (role === 'gamer' && gamerProfile?.gamer_role === 'technical_manager');

  // Filter orders if user is a gamer
  const orders = role === 'gamer' && gamerProfile && gamerProfile.gamer_role !== 'technical_manager'
    ? allOrders.filter(o => o.gamer_id === gamerProfile.id)
    : allOrders;

  // Helper to calculate pay period label from a date string
  const getPayPeriodLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const normalizedStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
    const date = new Date(normalizedStr);
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

  // Group/Team calculations for the cycle
  const teamLeaders = gamers.filter(g => g.gamer_role === 'team_leader' && g.status === 'active');
  
  const teamSummaries = teamLeaders.map(tl => {
    const members = gamers.filter(g => g.team_leader_id === tl.id);
    const teamIds = [tl.id, ...members.map(m => m.id)];
    const teamOrders = allOrders.filter(
      o => o.status === 'Completed' && teamIds.includes(o.gamer_id) && getPayPeriodLabel(o.start_date) === selectedCycle
    );
    const totalAssets = teamOrders.reduce((sum, o) => sum + Number(o.size_millions), 0);
    const totalPayout = teamOrders.reduce((sum, o) => sum + Number(o.payout), 0);

    return {
      leaderId: tl.id,
      leaderName: tl.name,
      gamer_role: tl.gamer_role,
      level: tl.level,
      memberCount: members.length,
      totalAssetsFarmed: totalAssets,
      totalPayout,
      gamerDetails: teamIds.map(id => {
        const g = gamers.find(gam => gam.id === id)!;
        const gOrders = teamOrders.filter(o => o.gamer_id === id);
        const assets = gOrders.reduce((sum, o) => sum + Number(o.size_millions), 0);
        const payout = gOrders.reduce((sum, o) => sum + Number(o.payout), 0);
        return {
          gamerId: id,
          gamerName: g?.name || 'Unknown',
          employeeId: g?.employee_id || 'N/A',
          assetsFarmed: assets,
          payout
        };
      })
    };
  });

  // Gamers rankings (Assets Farmed in Millions during this cycle)
  const cycleOrders = allOrders.filter(
    o => o.status === 'Completed' && getPayPeriodLabel(o.start_date) === selectedCycle
  );
  const gamerFarmedStats = gamers
    .map(g => {
      const gOrders = cycleOrders.filter(o => o.gamer_id === g.id);
      const farmed = gOrders.reduce((sum, o) => sum + Number(o.size_millions), 0);
      return { gamer: g, farmed };
    })
    .filter(g => g.farmed > 0)
    .sort((a, b) => b.farmed - a.farmed)
    .slice(0, 4);

  // Teams rankings (Assets Farmed in Millions during this cycle)
  const teamFarmedStats = teamSummaries
    .filter(t => t.totalAssetsFarmed > 0)
    .sort((a, b) => b.totalAssetsFarmed - a.totalAssetsFarmed)
    .slice(0, 4);

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

  const handleQuickStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (isManager) {
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
            {isManager ? 'Operational Command Center' : 'Gamer Data Access terminal'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            TARGET: DELTA FORCE MOBILE — {isManager ? 'AGENT RECORDS & METRIC AUDITS' : `MY PERFORMANCE PORTFOLIO ID: ${gamerProfile?.employee_id}`}
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
            {(() => {
              if (isManager) {
                const activeOperators = gamers.filter(g => g.status === 'active' && g.gamer_role !== 'technical_manager');
              const allPayrolls = activeOperators.map(g => calculatePayroll(g.id, selectedCycle));
              const centralExpectedPayout = allPayrolls.reduce((sum, p) => sum + p.totalPay, 0);
              const centralTotalOrdersCount = getOrdersInCycle(selectedCycle).length;
              const centralCompletedVolume = getOrdersInCycle(selectedCycle).reduce((sum, o) => sum + o.size_millions, 0);

              return (
                <div className="lg:col-span-1 border border-cyber-border/20 rounded p-4 bg-slate-950/40 relative">
                  <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Expected Group Payroll</div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-mono font-black text-cyber-green text-glow-green">
                      K{centralExpectedPayout.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono uppercase">Kwacha</span>
                  </div>
                  <div className="mt-2 font-mono text-[9px] text-slate-500 flex justify-between">
                    <span>Missions Completed:</span>
                    <span className="text-slate-300 font-bold">{centralTotalOrdersCount}</span>
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-slate-500 flex justify-between">
                    <span>Farmed Volume:</span>
                    <span className="text-slate-300 font-bold">
                      {centralCompletedVolume}M
                    </span>
                  </div>
                </div>
              );
            } else {
              const payroll = calculatePayroll(gamerProfile!.id, selectedCycle);
              return (
                <div className="lg:col-span-1 border border-cyber-border/20 rounded p-4 bg-slate-950/40 relative font-mono text-xs">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Your Expected Payout</div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-cyber-green text-glow-green">
                      K{payroll.totalPay.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase">Kwacha</span>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-500 flex justify-between">
                    <span>Days Worked:</span>
                    <span className="text-slate-300 font-bold">{payroll.daysWorked} / 26 days</span>
                  </div>
                  <div className="mt-1 text-[9px] text-slate-500 flex justify-between">
                    <span>Completed Orders:</span>
                    <span className="text-slate-300 font-bold">{getOrdersInCycle(selectedCycle).length}</span>
                  </div>
                </div>
              );
            }
          })()}

            {/* Card 2: List (Depending on Role) */}
            <div className="lg:col-span-3 border border-cyber-border/20 rounded p-4 bg-slate-950/40">
              {isManager ? (
                // Admin View: Breakdown per Gamer
              <div className="space-y-2">
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider pb-1.5 border-b border-cyber-border/20">Operational Payroll Ledger</div>
                {gamers.length === 0 ? (
                  <div className="text-center py-4 font-mono text-[10px] text-slate-500 uppercase">No operators recruited.</div>
                ) : (
                  <div className="max-h-28 overflow-y-auto divide-y divide-cyber-border/20 pr-1">
                    {gamers.filter(g => g.status === 'active').map(g => {
                      const payroll = calculatePayroll(g.id, selectedCycle);
                      return (
                        <div key={g.id} className="flex justify-between items-center py-1.5 text-[10px] font-mono hover:bg-slate-900/40">
                          <div>
                            <span className="font-bold text-slate-300">{g.name}</span>
                            <span className="text-[9px] text-slate-500 ml-1.5 capitalize">({g.gamer_role?.replace('_', ' ')} - {g.level})</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-slate-400">{payroll.daysWorked}/26 days</span>
                            <span className="font-bold text-cyber-green">K{payroll.totalPay.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Gamer View: Personal HR details panel
              (() => {
                const payroll = calculatePayroll(gamerProfile!.id, selectedCycle);
                return (
                  <div className="space-y-2 font-mono text-[10px] text-slate-300">
                    <div className="text-slate-400 uppercase tracking-wider pb-1.5 border-b border-cyber-border/20 flex justify-between">
                      <span>Personal HR Portfolio</span>
                      <span className="text-cyber-cyan text-[9px]">Shift: 9AM - 6PM (8H + 1H Lunch)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 py-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Contract Base Pay:</span>
                        <span className="font-bold text-slate-300">K{payroll.baseSalary} ({gamerProfile!.level} {gamerProfile!.gamer_role === 'team_leader' ? 'TL' : gamerProfile!.gamer_role === 'technical_manager' ? 'TM' : 'Gamer'})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Daily Attendance Rate:</span>
                        <span className="font-bold text-slate-300">K{payroll.dailyRate.toFixed(2)} per day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Days Present base:</span>
                        <span className="font-bold text-cyber-green">K{payroll.basePayEarned.toFixed(2)} ({payroll.daysWorked} days)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Missed Day Deductions:</span>
                        <span className="font-bold text-cyber-red">K-{(payroll.deductions - payroll.lateDeduction).toFixed(2)} ({Math.max(0, 26 - payroll.daysWorked)} days)</span>
                      </div>
                      {payroll.lateDeduction > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Late Attendance Deductions (K20/day):</span>
                          <span className="font-bold text-cyber-red">K-{payroll.lateDeduction.toFixed(2)} ({Math.round(payroll.lateDeduction / 20)} days)</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">On-Time Perfect Bonus:</span>
                        <span className="font-bold text-cyber-green">K{payroll.attendanceBonus} (On-time: {payroll.onTimeDays}/26 days)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Orders completed bonus:</span>
                        <span className="font-bold text-cyber-green">K{payroll.orderBonus.toLocaleString()}</span>
                      </div>
                      {gamerProfile!.gamer_role === 'team_leader' && (
                        <div className="flex justify-between col-span-2 border-t border-cyber-border/20 pt-1.5">
                          <span className="text-slate-500">Team volume bonus (&gt;50M/day):</span>
                          <span className="font-bold text-cyber-green">K{payroll.teamVolumeBonus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart (Expanded to full width if gamer, to keep layout beautiful) */}
        <div className={`tactical-panel p-5 rounded clip-corners border border-cyber-border/40 flex flex-col justify-between ${
          isManager ? 'lg:col-span-1' : 'lg:col-span-3'
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

        {/* Center Widget: Gamer & Team Rankings (Only shown to Admin & Technical Manager) */}
        {isManager && (
          <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Gamers Leaderboard */}
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
                <span>Best Performing Gamers</span>
                <span className="text-xs text-cyber-cyan font-mono cursor-pointer hover:underline" onClick={() => onNavigate('gamers')}>View Dossiers</span>
              </h3>

              {gamerFarmedStats.length === 0 ? (
                <div className="h-48 flex items-center justify-center font-mono text-slate-500 text-xs">
                  NO ACTIVE DIVISION RECORDS DETECTED
                </div>
              ) : (
                <div className="space-y-4">
                  {gamerFarmedStats.map((item, idx) => {
                    const maxFarmed = Math.max(...gamerFarmedStats.map(g => g.farmed)) || 1;
                    const widthPercent = Math.max(15, Math.round((item.farmed / maxFarmed) * 100));

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
                          </div>
                          <span className="text-cyber-green font-bold">{item.farmed}M Farmed</span>
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

            {/* Teams Leaderboard */}
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
                <span>Best Performing Teams</span>
                <span className="text-[10px] text-slate-500 font-normal">Group Totals</span>
              </h3>

              {teamFarmedStats.length === 0 ? (
                <div className="h-48 flex items-center justify-center font-mono text-slate-500 text-xs">
                  NO ACTIVE TEAM VOLUME DETECTED
                </div>
              ) : (
                <div className="space-y-4">
                  {teamFarmedStats.map((item, idx) => {
                    const maxTeamFarmed = Math.max(...teamFarmedStats.map(t => t.totalAssetsFarmed)) || 1;
                    const widthPercent = Math.max(15, Math.round((item.totalAssetsFarmed / maxTeamFarmed) * 100));

                    return (
                      <div key={item.leaderId} className="space-y-1">
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
                            <span className="font-bold text-slate-200">Team {item.leaderName.split(' ')[0]}</span>
                          </div>
                          <span className="text-cyber-cyan font-bold">{item.totalAssetsFarmed}M Farmed</span>
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

          </div>
        )}
      </div>

      {/* Team Leader Managed Team Panel */}
      {role === 'gamer' && gamerProfile?.gamer_role === 'team_leader' && (
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 mt-6">
          <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
            <span>My Managed Team Matrix</span>
            <span className="text-xs text-cyber-cyan font-normal uppercase">Cycle: {selectedCycle}</span>
          </h3>
          {(() => {
            const myTeamSummary = teamSummaries.find(t => t.leaderId === gamerProfile.id);
            if (!myTeamSummary) return <div className="text-slate-500 font-mono text-xs uppercase">No team assigned.</div>;
            
            return (
              <div className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                    <div className="text-[8px] text-slate-500 uppercase tracking-widest">Active Members</div>
                    <div className="text-lg font-bold text-slate-200 mt-1">{myTeamSummary.memberCount} Operators</div>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                    <div className="text-[8px] text-slate-500 uppercase tracking-widest text-cyber-green">Team Total Farmed</div>
                    <div className="text-lg font-bold text-cyber-green mt-1">{myTeamSummary.totalAssetsFarmed}M Coins</div>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                    <div className="text-[8px] text-slate-500 uppercase tracking-widest text-cyber-cyan">Team Total Payout</div>
                    <div className="text-lg font-bold text-cyber-cyan mt-1">K{myTeamSummary.totalPayout.toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="overflow-x-auto border border-cyber-border/30 rounded">
                  <table className="w-full text-left border-collapse text-[10px] bg-slate-950/20">
                    <thead>
                      <tr className="border-b border-cyber-border/45 text-slate-500 uppercase bg-slate-950/60">
                        <th className="py-2.5 px-3">Member Name</th>
                        <th className="py-2.5 px-3">Clearance ID</th>
                        <th className="py-2.5 px-3 text-right">Farmed Assets</th>
                        <th className="py-2.5 px-3 text-right text-cyber-green">Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                      {myTeamSummary.gamerDetails.map(member => (
                        <tr key={member.gamerId} className="hover:bg-slate-900/40 transition-all">
                          <td className="py-2.5 px-3 font-bold">{member.gamerName} {member.gamerId === gamerProfile.id && "(You)"}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{member.employeeId}</td>
                          <td className="py-2.5 px-3 text-right font-bold">{member.assetsFarmed}M</td>
                          <td className="py-2.5 px-3 text-right font-bold text-cyber-green">K{member.payout.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Bottom Row: Active/Recent Orders Queue */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40">
        <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
          <span>{isManager ? 'Active Command Queue (Quick Status Updates)' : 'My Active Missions'}</span>
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
                  {isManager && <th className="p-3">Assigned Gamer</th>}
                  <th className="p-3 text-right">Size</th>
                  <th className="p-3 text-right">Payout (K)</th>
                  <th className="p-3">Deployment Date</th>
                  <th className="p-3">Status</th>
                  {isManager && <th className="p-3 text-center">Quick Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/40">
                {recentOrders.map((order) => {
                  const assignedGamer = gamers.find(g => g.id === order.gamer_id);
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 text-cyber-cyan font-bold">{order.order_number}</td>
                      {isManager && (
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
                      {isManager && (
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
