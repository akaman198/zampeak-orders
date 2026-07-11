'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import DashboardTab from '../components/DashboardTab';
import GamersTab from '../components/GamersTab';
import OrdersTab from '../components/OrdersTab';
import ReportsTab from '../components/ReportsTab';
import { 
  LayoutDashboard, 
  Users, 
  Gamepad2, 
  FileBarChart2, 
  Terminal,
  Activity,
  LogOut,
  ChevronRight,
  Database
} from 'lucide-react';

export default function Home() {
  const { loading, isDemo } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gamers' | 'orders' | 'reports'>('dashboard');

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cyber-bg text-cyber-cyan font-mono min-h-screen">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Animated loading gears / circles */}
          <div className="absolute inset-0 rounded-full border-4 border-cyber-cyan/10 border-t-cyber-cyan animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-cyber-green/10 border-b-cyber-green animate-spin animate-reverse"></div>
          <Terminal className="text-cyber-cyan animate-pulse" size={32} />
        </div>
        <p className="mt-6 text-sm uppercase tracking-widest animate-pulse">
          Establishing Command Interface...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* HUD Header */}
      <header className="sticky top-0 z-40 bg-cyber-dark/85 backdrop-blur-md border-b border-cyber-cyan/20 px-4 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo & Call Sign */}
          <div className="flex items-center gap-3">
            <div className="bg-cyber-cyan/10 p-1.5 rounded border border-cyber-cyan/35 flex items-center justify-center text-cyber-cyan glow-pulse-cyan">
              <Gamepad2 size={24} />
            </div>
            <div>
              <h1 className="font-mono font-black text-lg tracking-widest text-slate-100 uppercase flex items-center gap-1.5 select-none">
                ZAMPEAK <span className="text-cyber-cyan text-glow-cyan text-[11px] font-bold tracking-normal bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">OS v1.0</span>
              </h1>
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                Delta Force Mobile Order Tracking Command
              </p>
            </div>
          </div>

          {/* Operational Metrics Ticker */}
          <div className="hidden lg:flex items-center gap-6 font-mono text-[10px] text-slate-400 bg-slate-950/60 border border-cyber-border/40 px-4 py-1.5 rounded">
            <div className="flex items-center gap-1.5">
              <Activity className="text-cyber-green animate-pulse" size={12} />
              <span>COMS: <span className="text-cyber-green font-bold uppercase">SECURE</span></span>
            </div>
            <div className="h-3 w-px bg-cyber-border"></div>
            <div>
              <span>SECTOR: <span className="text-slate-300 font-bold">DELTA FORCE MOBILE</span></span>
            </div>
            <div className="h-3 w-px bg-cyber-border"></div>
            <div className="flex items-center gap-1.5">
              <Database size={12} className={isDemo ? 'text-cyber-amber' : 'text-cyber-cyan'} />
              <span>DB FEED: {isDemo ? (
                <span className="text-cyber-amber font-bold">DEMO (LOCAL)</span>
              ) : (
                <span className="text-cyber-green font-bold">CLOUD CLUSTER</span>
              )}</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded border border-cyber-border">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/25' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard size={12} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('gamers')}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'gamers' 
                  ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/25' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users size={12} />
              Gamers
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'orders' 
                  ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/25' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Gamepad2 size={12} />
              Orders
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'reports' 
                  ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/25' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileBarChart2 size={12} />
              Reports
            </button>
          </nav>
        </div>
      </header>

      {/* Main Command Dashboard Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeTab === 'dashboard' && <DashboardTab onNavigate={(tab) => setActiveTab(tab)} />}
        {activeTab === 'gamers' && <GamersTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </main>

      {/* Footer Ticker */}
      <footer className="bg-cyber-dark/45 border-t border-cyber-border/40 py-2.5 px-4 font-mono text-[9px] text-slate-500 text-center tracking-widest uppercase select-none print:hidden mt-auto">
        <span>© {new Date().getFullYear()} ZAMPEAK CORP // TACTICAL DATA MATRIX SECURED // ALL SYSTEMS NOMINAL</span>
      </footer>
    </div>
  );
}
