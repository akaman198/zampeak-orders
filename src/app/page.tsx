'use client';

import React, { useState, useEffect } from 'react';
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
  Database,
  Lock
} from 'lucide-react';

export default function Home() {
  const { user, role, loading, authLoading, isDemo, signIn, signUp, signOut } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gamers' | 'orders' | 'reports'>('dashboard');

  // Auth Screen States
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Redirect if gamer tries to access forbidden tabs
  useEffect(() => {
    if (role === 'gamer' && (activeTab === 'gamers' || activeTab === 'reports')) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError('Email and Password fields are required.');
      return;
    }
    setAuthError('');
    setAuthSubmitting(true);

    try {
      const res = authMode === 'signin' 
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

      if (!res.success) {
        setAuthError(res.error || 'Authentication failed.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Loading Screen
  if (authLoading || (user && loading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cyber-bg text-cyber-cyan font-mono min-h-screen">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-cyber-cyan/10 border-t-cyber-cyan animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-cyber-green/10 border-b-cyber-green animate-spin animate-reverse"></div>
          <Terminal className="text-cyber-cyan animate-pulse" size={32} />
        </div>
        <p className="mt-6 text-sm uppercase tracking-widest animate-pulse">
          Decrypting Security Clearance...
        </p>
      </div>
    );
  }

  // Authentication Required Screen (Login)
  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cyber-bg min-h-screen p-4 relative overflow-hidden font-mono">
        <div className="absolute inset-0 bg-cyber-grid pointer-events-none"></div>
        
        <div className="absolute w-96 h-96 rounded-full bg-cyber-cyan/5 blur-3xl -top-20 -left-20"></div>
        <div className="absolute w-96 h-96 rounded-full bg-cyber-green/5 blur-3xl -bottom-20 -right-20"></div>

        <div className="w-full max-w-md tactical-panel p-6 rounded clip-corners border border-cyber-cyan/30 bg-cyber-dark/80 relative z-10 shadow-2xl">
          <div className="hud-grid"></div>

          <div className="text-center border-b border-cyber-border/40 pb-5 mb-6">
            <div className="mx-auto w-12 h-12 bg-cyber-cyan/15 rounded border border-cyber-cyan/35 flex items-center justify-center text-cyber-cyan glow-pulse-cyan mb-3">
              <Lock size={20} />
            </div>
            <h2 className="text-xl font-black tracking-widest text-slate-100 uppercase flex items-center justify-center gap-1.5">
              ZAMPEAK <span className="text-cyber-cyan text-glow-cyan text-[10px] font-bold tracking-normal bg-cyber-cyan/15 px-1.5 py-0.5 rounded border border-cyber-cyan/20">OS</span>
            </h2>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">
              Delta Force Mobile Operations Portal
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
            {authError && (
              <div className="p-3 border border-cyber-red/30 bg-cyber-red/10 text-cyber-red rounded font-bold text-center">
                [ACCESS DENIED]: {authError}
              </div>
            )}

            {isDemo && (
              <div className="p-3 border border-cyber-amber/35 bg-cyber-amber/5 text-cyber-amber rounded text-[10px] leading-relaxed space-y-1">
                <div><strong>DEMO AUTH ACTIVE:</strong> Sign in with:</div>
                <div><span className="text-slate-300 font-bold">Admin:</span> admin@zampeak.com / admin123</div>
                <div><span className="text-slate-300 font-bold">Gamer:</span> Recruit a gamer email (e.g. ghost@zampeak.com), and sign in using password <span className="text-slate-300 font-bold">gamer123</span></div>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider block">Terminal Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@zampeak.com"
                required
                className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-slate-400 uppercase tracking-wider block">Access Key Code</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyber-cyan"
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 bg-cyber-cyan hover:bg-cyan-400 text-slate-950 font-bold rounded shadow-neon-cyan/20 transition-all font-mono tracking-widest cursor-pointer uppercase mt-2 text-center flex items-center justify-center gap-1.5"
            >
              {authSubmitting ? 'Authenticating...' : authMode === 'signin' ? 'Sign In Operations' : 'Register Operator'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 text-center text-[10px] text-slate-500 border-t border-cyber-border/20 pt-4">
            {authMode === 'signin' ? (
              <span>
                First deployment?{' '}
                <button 
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="text-cyber-cyan hover:underline font-bold cursor-pointer uppercase"
                >
                  Register Callsign
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button 
                  onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                  className="text-cyber-cyan hover:underline font-bold cursor-pointer uppercase"
                >
                  Sign In Operator
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Interface (Logged In)
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* HUD Header */}
      <header className="sticky top-0 z-40 bg-cyber-dark/85 backdrop-blur-md border-b border-cyber-cyan/20 px-4 py-3 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo */}
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
              <span>OPERATOR: <span className="text-slate-200 font-bold select-all">{user.email}</span> ({role.toUpperCase()})</span>
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

          {/* Tab Navigation & Log Out */}
          <div className="flex items-center gap-3">
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
              
              {role === 'admin' && (
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
              )}

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

              {role === 'admin' && (
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
              )}
            </nav>

            {/* Log Out Button */}
            <button 
              onClick={signOut}
              title="Log Out Terminal"
              className="p-2 border border-cyber-border hover:border-cyber-red rounded bg-slate-950 hover:bg-cyber-red/10 text-slate-400 hover:text-cyber-red transition-all cursor-pointer"
            >
              <LogOut size={14} />
            </button>
          </div>
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
