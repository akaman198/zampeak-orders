'use client';

import React from 'react';
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
  const { orders, gamers, updateOrderStatus, isDemo } = useApp();

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

  // Recent Orders (Limit 5)
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 5);

  // Gamer stats for ranking
  const gamerStats = gamers.map(gamer => {
    const gamerOrders = orders.filter(o => o.gamer_id === gamer.id);
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

  // Quick Action Handler
  const handleQuickStatus = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus);
  };

  // 2. Custom SVG Doughnut Chart Calculation
  // Order breakdown by status
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
            Operational Command Center
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            TARGET: DELTA FORCE MOBILE — AGENT RECORDS & METRIC AUDITS
          </p>
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
            SYSTEM: ONLINE
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
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest">Total Missions</div>
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
          <div className="font-mono text-xs text-slate-400 uppercase tracking-widest font-bold">Total Expected Pay</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-cyber-green text-glow-green">K{totalEarnings}</span>
            <span className="text-xs text-slate-500 font-mono">Kwacha</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono flex justify-between">
            <span>Farmed: {totalAssetsFarmed}M Haval</span>
            <span className="text-cyber-green cursor-pointer hover:underline" onClick={() => onNavigate('reports')}>Reports &rarr;</span>
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
          {/* Visual progress bar */}
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
          {/* Visual progress bar */}
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
            <span className="text-xs text-slate-500 font-mono">Haval Coins</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            Target threshold: 10M - 120M
          </div>
        </div>
      </div>

      {/* Main Charts & Rankings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Widget: Mission Status Chart */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
              <span>Mission Status Audit</span>
              <span className="text-xs text-slate-500 font-normal">Breakdown</span>
            </h3>
            
            {chartTotal === 0 ? (
              <div className="h-48 flex items-center justify-center font-mono text-slate-500 text-xs">
                NO DATA LOGGED IN SYSTEM
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                {/* SVG Donut Chart */}
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

                {/* Chart Legends */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-6 w-full text-xs font-mono">
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

        {/* Center Widget: Gamer Rankings */}
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
                // Find highest earnings for width calculation
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
                        <span className="text-slate-400">{item.farmed}M Haval</span>
                        <span className="text-cyber-green font-bold">K{item.earnings}</span>
                      </div>
                    </div>
                    {/* Performance Bar */}
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

      {/* Bottom Row: Active/Recent Orders Queue */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40">
        <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
          <span>Active Command Queue (Quick Status Updates)</span>
          <span className="text-xs text-cyber-cyan font-mono cursor-pointer hover:underline" onClick={() => onNavigate('orders')}>Manage All Orders</span>
        </h3>

        {recentOrders.length === 0 ? (
          <div className="py-8 text-center font-mono text-slate-500 text-xs">
            NO ORDERS ASSIGNED YET. CLICK "ORDERS" TAB TO DEPLOY A NEW ORDER.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-cyber-border text-slate-400 bg-cyber-dark/40">
                  <th className="p-3">Order Code</th>
                  <th className="p-3">Assigned Gamer</th>
                  <th className="p-3 text-right">Size (Millions)</th>
                  <th className="p-3 text-right">Payout (K)</th>
                  <th className="p-3">Deployment Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/40">
                {recentOrders.map((order) => {
                  const assignedGamer = gamers.find(g => g.id === order.gamer_id);
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 text-cyber-cyan font-bold">{order.order_number}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-300">{assignedGamer ? assignedGamer.name : 'Unknown Gamer'}</div>
                        <div className="text-[10px] text-slate-500">{assignedGamer ? `ID: ${assignedGamer.employee_id}` : ''}</div>
                      </td>
                      <td className="p-3 text-right text-slate-300 font-bold">{order.size_millions}M</td>
                      <td className="p-3 text-right text-cyber-green font-bold">K{order.payout}</td>
                      <td className="p-3 text-slate-400">
                        {new Date(order.start_date).toLocaleDateString()} {new Date(order.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'Running' ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30' :
                          order.status === 'Completed' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30' :
                          order.status === 'Paused' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30' :
                          order.status === 'Violation' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/30 animate-pulse' :
                          'bg-slate-700/10 text-slate-400 border border-slate-600/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
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
