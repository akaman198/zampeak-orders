'use client';

import React, { useState } from 'react';
import { useApp, getPayPeriodLabel } from '../context/AppContext';
import { Gamer, GamerLevel, GamerRole } from '../types';
import { 
  UserPlus, 
  Phone, 
  Trash2, 
  Edit3, 
  X,
  User,
  Award,
  Key,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Power
} from 'lucide-react';

const formatM = (val: number) => {
  if (val % 1 === 0) return String(val);
  return val.toFixed(1);
};

export default function GamersTab() {
  const { gamers, orders, addGamer, updateGamer, toggleGamerStatus, deleteGamer, resetGamerPassword, calculatePayroll, getDailyGamerEarnings, role } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);
  // Component States
  const [selectedGamer, setSelectedGamer] = useState<Gamer | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<Gamer | null>(null);
  const [dossierDailyDateFilter, setDossierDailyDateFilter] = useState<string>(todayStr);
  const [gamerRosterFilter, setGamerRosterFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [level, setLevel] = useState<GamerLevel>('beginner');
  const [gamerRole, setGamerRole] = useState<GamerRole>('gamer');
  const [teamLeaderId, setTeamLeaderId] = useState<string>('');
  const [formError, setFormError] = useState('');

  // Reset fields
  const resetForm = () => {
    setName('');
    setEmployeeId('');
    setDefaultPassword('');
    setPhone('');
    setStatus('active');
    setLevel('beginner');
    setGamerRole('gamer');
    setTeamLeaderId('');
    setFormError('');
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim()) {
      setFormError('Name and Employee ID are required.');
      return;
    }
    if (!defaultPassword.trim()) {
      setFormError('A Default Password is required for gamer registration.');
      return;
    }

    const res = await addGamer(
      name.trim(), 
      employeeId.trim(), 
      defaultPassword.trim(), 
      level, 
      gamerRole, 
      teamLeaderId || null, 
      phone.trim()
    );
    if (res.success) {
      setIsAdding(false);
      resetForm();
    } else {
      setFormError(res.error || 'Failed to recruit gamer.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    if (!name.trim() || !employeeId.trim()) {
      setFormError('Name and Employee ID are required.');
      return;
    }

    const res = await updateGamer(
      isEditing.id,
      name.trim(),
      employeeId.trim(),
      level,
      gamerRole,
      teamLeaderId || null,
      defaultPassword.trim() || undefined,
      phone.trim(),
      status
    );
    if (res.success) {
      if (selectedGamer?.id === isEditing.id) {
        setSelectedGamer({ 
          ...selectedGamer, 
          name, 
          employee_id: employeeId, 
          default_password: defaultPassword.trim() || selectedGamer.default_password,
          phone, 
          status,
          level,
          gamer_role: gamerRole,
          team_leader_id: teamLeaderId || null
        });
      }
      setIsEditing(null);
      resetForm();
    } else {
      setFormError(res.error || 'Failed to update gamer.');
    }
  };

  const handleDelete = async (gamerId: string) => {
    if (confirm('Are you sure you want to remove this gamer dossier?')) {
      const res = await deleteGamer(gamerId);
      if (res.success) {
        if (selectedGamer?.id === gamerId) {
          setSelectedGamer(null);
        }
      } else {
        alert(res.error);
      }
    }
  };
  const handleResetPassword = async (gamer: Gamer) => {
    const newPass = prompt(`Enter a new temporary default password for ${gamer.name} (Employee ID: ${gamer.employee_id}):`, 'gamer123');
    if (newPass === null) return;
    if (newPass.trim().length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    const res = await resetGamerPassword(gamer.id, newPass.trim());
    if (res.success) {
      alert(`Temporary password successfully reset to: ${newPass.trim()}. Inform the gamer!`);
      setSelectedGamer({ ...gamer, default_password: newPass.trim() });
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleToggleStatus = async (gamer: Gamer, newStatus: 'active' | 'inactive') => {
    const actionLabel = newStatus === 'inactive' ? 'DEACTIVATE' : 'REACTIVATE';
    const confirmMsg = newStatus === 'inactive'
      ? `Confirm ${actionLabel}: Mark ${gamer.name} (${gamer.employee_id}) as INACTIVE (Stopped Work)?\n\nThey will be excluded from new order assignments and daily roll-calls while keeping all previous stats and history.`
      : `Confirm ${actionLabel}: Reactivate ${gamer.name} (${gamer.employee_id}) and set account status to ACTIVE (On Duty)?`;
    
    if (!confirm(confirmMsg)) return;

    const res = await toggleGamerStatus(gamer.id, newStatus);
    if (res.success) {
      if (selectedGamer?.id === gamer.id) {
        setSelectedGamer({ ...selectedGamer, status: newStatus });
      }
    } else {
      alert(`Error updating operational status: ${res.error}`);
    }
  };
  const startEdit = (gamer: Gamer) => {
    setIsEditing(gamer);
    setName(gamer.name);
    setEmployeeId(gamer.employee_id);
    setDefaultPassword(''); // leave blank to keep unchanged
    setPhone(gamer.phone || '');
    setStatus(gamer.status);
    setLevel(gamer.level || 'beginner');
    setGamerRole(gamer.gamer_role || 'gamer');
    setTeamLeaderId(gamer.team_leader_id || '');
    setFormError('');
  };

  const getGamerProfileMetrics = (gamerId: string) => {
    const gamerOrders = orders.filter(o => o.gamer_id === gamerId);
    const completed = gamerOrders.filter(o => o.status === 'Completed');
    const running = gamerOrders.filter(o => o.status === 'Running').length;
    const paused = gamerOrders.filter(o => o.status === 'Paused').length;
    const violation = gamerOrders.filter(o => o.status === 'Violation').length;
    const cancelled = gamerOrders.filter(o => o.status === 'Cancelled').length;
    
    const assets = completed.reduce((sum, o) => sum + o.size_millions, 0);
    const expectedPay = completed.reduce((sum, o) => sum + o.payout, 0);
    
    // Calculate Net Expected Pay for the current cycle
    const currentCycle = getPayPeriodLabel(new Date().toISOString());
    const payroll = calculatePayroll(gamerId, currentCycle);
    const netExpectedPay = payroll.totalPay;
    
    const total = gamerOrders.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const violationRate = total > 0 ? Math.round((violation / total) * 100) : 0;

    return {
      orders: gamerOrders,
      totalCount: total,
      completedCount: completed.length,
      runningCount: running,
      pausedCount: paused,
      violationCount: violation,
      cancelledCount: cancelled,
      assetsFarmed: assets,
      expectedPay,
      netExpectedPay,
      completionRate,
      violationRate
    };
  };

  const activeGamersCount = gamers.filter(g => g.status === 'active').length;
  const inactiveGamersCount = gamers.filter(g => g.status === 'inactive').length;

  const filteredRosterGamers = gamers.filter(g => {
    if (gamerRosterFilter === 'active' && g.status !== 'active') return false;
    if (gamerRosterFilter === 'inactive' && g.status !== 'inactive') return false;
    if (rosterSearchQuery.trim()) {
      const q = rosterSearchQuery.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.employee_id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Dossier Lists */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-1 flex flex-col">
        <div className="flex justify-between items-center border-b border-cyber-border/40 pb-3 mb-3">
          <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <User size={16} className="text-cyber-cyan" />
            Gamer Dossiers
          </h3>
          {role === 'admin' ? (
            <button 
              onClick={() => { setIsAdding(true); setIsEditing(null); setSelectedGamer(null); resetForm(); }}
              className="flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-cyber-cyan border border-cyber-cyan/30 bg-cyber-cyan/5 px-2.5 py-1 rounded hover:bg-cyber-cyan/20 hover:border-cyber-cyan shadow-neon-cyan/10 hover:shadow-neon-cyan/20 transition-all cursor-pointer"
            >
              <UserPlus size={12} />
              Recruit Gamer
            </button>
          ) : (
            <span className="text-[9px] text-cyber-amber font-mono bg-cyber-amber/10 px-2 py-0.5 rounded border border-cyber-amber/30 font-bold">
              READ-ONLY
            </span>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="grid grid-cols-3 gap-1 mb-2.5 p-1 bg-slate-950 rounded border border-cyber-border/40 font-mono text-[10px]">
          <button
            onClick={() => setGamerRosterFilter('all')}
            className={`py-1 rounded font-bold uppercase transition-all cursor-pointer text-center ${
              gamerRosterFilter === 'all' ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({gamers.length})
          </button>
          <button
            onClick={() => setGamerRosterFilter('active')}
            className={`py-1 rounded font-bold uppercase transition-all cursor-pointer text-center ${
              gamerRosterFilter === 'active' ? 'bg-cyber-green text-slate-950 shadow-neon-green/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({activeGamersCount})
          </button>
          <button
            onClick={() => setGamerRosterFilter('inactive')}
            className={`py-1 rounded font-bold uppercase transition-all cursor-pointer text-center ${
              gamerRosterFilter === 'inactive' ? 'bg-cyber-red text-slate-950 shadow-neon-red/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inactive ({inactiveGamersCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 text-slate-500" size={12} />
          <input
            type="text"
            placeholder="Filter gamer name / ID..."
            value={rosterSearchQuery}
            onChange={(e) => setRosterSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-cyber-border/40 rounded pl-7 pr-3 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyber-cyan"
          />
        </div>

        {/* Gamers List */}
        {filteredRosterGamers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs">
            {gamers.length === 0 ? 'NO GAMERS REGISTERED IN COMMAND DATA.' : 'NO GAMERS MATCHING SELECTED FILTER.'}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
            {filteredRosterGamers.map((gamer) => {
              const metrics = getGamerProfileMetrics(gamer.id);
              const isSelected = selectedGamer?.id === gamer.id;

              let roleBadgeColor = 'text-slate-500 bg-slate-950 border-slate-800';
              let roleText = 'GAMER';
              if (gamer.gamer_role === 'technical_manager') {
                roleBadgeColor = 'text-cyber-red bg-cyber-red/10 border-cyber-red/20';
                roleText = 'TECH MGR';
              } else if (gamer.gamer_role === 'team_leader') {
                roleBadgeColor = 'text-cyber-amber bg-cyber-amber/10 border-cyber-amber/20';
                roleText = 'TEAM LDR';
              }

              return (
                <div 
                  key={gamer.id}
                  onClick={() => { setSelectedGamer(gamer); setIsAdding(false); setIsEditing(null); }}
                  className={`p-3 rounded border font-mono transition-all duration-200 cursor-pointer ${
                    isSelected 
                      ? 'border-cyber-cyan bg-cyber-cyan/10' 
                      : 'border-cyber-border/30 bg-slate-900/40 hover:bg-slate-900/80 hover:border-cyber-cyan/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${gamer.status === 'active' ? 'bg-cyber-green animate-pulse' : 'bg-slate-500'}`}></span>
                        <span className={gamer.status === 'active' ? 'text-slate-200' : 'text-slate-500'}>{gamer.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-cyber-cyan/80 font-bold">ID: {gamer.employee_id}</span>
                        <span className={`px-1.5 py-0.2 rounded border text-[8px] font-bold ${roleBadgeColor}`}>
                          {roleText}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                      gamer.status === 'active' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {gamer.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-slate-400 border-t border-cyber-border/20 pt-2">
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase">Missions</div>
                      <div className="font-bold text-slate-300">{metrics.totalCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase">Completed</div>
                      <div className="font-bold text-cyber-green">{metrics.completedCount}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase">Earnings</div>
                      <div className="font-bold text-cyber-cyan">K{metrics.expectedPay}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right 2 Columns: Add, Edit, or Details Panel */}
      <div className="lg:col-span-2">
        {/* State 1: Recruitment Form (Add) */}
        {isAdding && (
          <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/35 relative">
            <div className="hud-grid"></div>
            <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest border-b border-cyber-cyan/20 pb-3 mb-5 flex justify-between items-center">
              <span>Recruit New Gamer Dossier</span>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4 font-mono text-xs">
              {formError && (
                <div className="p-3 border border-cyber-red/30 bg-cyber-red/10 text-cyber-red rounded font-bold">
                  [ERROR]: {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John MacTavish"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Employee ID</label>
                  <input 
                    type="text" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. ZP-101"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Default Registration Password</label>
                  <input 
                    type="text" 
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Set temporary code (e.g. gamer123)"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Phone Details (Optional)</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +260971234567"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Operator Role</label>
                  <select 
                    value={gamerRole} 
                    onChange={(e) => {
                      const newRole = e.target.value as GamerRole;
                      setGamerRole(newRole);
                      if (newRole !== 'gamer') setTeamLeaderId('');
                    }}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                  >
                    <option value="gamer">Gamer (Operator)</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="technical_manager">Technical Manager</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Clearance Level</label>
                  <select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value as GamerLevel)}
                    disabled={gamerRole === 'technical_manager'}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer disabled:opacity-40 text-xs"
                  >
                    <option value="beginner">Beginner (Base K1,200)</option>
                    <option value="intermediate">Intermediate (Base K1,800)</option>
                    <option value="advanced">Advanced (Base K2,500)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Assigned Team Leader</label>
                  <select 
                    value={teamLeaderId} 
                    onChange={(e) => setTeamLeaderId(e.target.value)}
                    disabled={gamerRole !== 'gamer'}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer disabled:opacity-40 text-xs"
                  >
                    <option value="">No Team Leader</option>
                    {gamers
                      .filter(g => g.gamer_role === 'team_leader' && g.status === 'active' && g.id !== (isEditing?.id || ''))
                      .map(tl => {
                        const teamSize = gamers.filter(g => g.team_leader_id === tl.id && g.status === 'active').length;
                        return (
                          <option key={tl.id} value={tl.id}>
                            {tl.name} ({teamSize}/5 gamers)
                          </option>
                        );
                      })
                    }
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-400 rounded hover:bg-slate-900 cursor-pointer"
                >
                  ABORT
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-cyber-cyan text-slate-950 font-bold rounded hover:bg-cyan-400 transition-colors shadow-neon-cyan/20 cursor-pointer"
                >
                  SAVE DOSSIER
                </button>
              </div>
            </form>
          </div>
        )}

        {/* State 2: Modification Form (Edit) */}
        {isEditing && (
          <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/35 relative">
            <div className="hud-grid"></div>
            <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest border-b border-cyber-cyan/20 pb-3 mb-5 flex justify-between items-center">
              <span>Modify Gamer Dossier: {isEditing.name}</span>
              <button onClick={() => setIsEditing(null)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs">
              {formError && (
                <div className="p-3 border border-cyber-red/30 bg-cyber-red/10 text-cyber-red rounded font-bold">
                  [ERROR]: {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Employee ID</label>
                  <input 
                    type="text" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Reset Password (Optional)</label>
                  <input 
                    type="text" 
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Leave blank to keep same"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Phone / Contact</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Operational Status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                  >
                    <option value="active">Active (On Duty)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Operator Role</label>
                  <select 
                    value={gamerRole} 
                    onChange={(e) => {
                      const newRole = e.target.value as GamerRole;
                      setGamerRole(newRole);
                      if (newRole !== 'gamer') setTeamLeaderId('');
                    }}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                  >
                    <option value="gamer">Gamer (Operator)</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="technical_manager">Technical Manager</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Clearance Level</label>
                  <select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value as GamerLevel)}
                    disabled={gamerRole === 'technical_manager'}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer disabled:opacity-40 text-xs"
                  >
                    <option value="beginner">Beginner (Base K1,200)</option>
                    <option value="intermediate">Intermediate (Base K1,800)</option>
                    <option value="advanced">Advanced (Base K2,500)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Assigned Team Leader</label>
                  <select 
                    value={teamLeaderId} 
                    onChange={(e) => setTeamLeaderId(e.target.value)}
                    disabled={gamerRole !== 'gamer'}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer disabled:opacity-40 text-xs"
                  >
                    <option value="">No Team Leader</option>
                    {gamers
                      .filter(g => g.gamer_role === 'team_leader' && g.status === 'active' && g.id !== (isEditing?.id || ''))
                      .map(tl => {
                        const teamSize = gamers.filter(g => g.team_leader_id === tl.id && g.status === 'active').length;
                        return (
                          <option key={tl.id} value={tl.id}>
                            {tl.name} ({teamSize}/5 gamers)
                          </option>
                        );
                      })
                    }
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsEditing(null)}
                  className="px-4 py-2 border border-slate-700 text-slate-400 rounded hover:bg-slate-900 cursor-pointer"
                >
                  ABORT
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-cyber-cyan text-slate-950 font-bold rounded hover:bg-cyan-400 transition-colors shadow-neon-cyan/20 cursor-pointer"
                >
                  UPDATE DOSSIER
                </button>
              </div>
            </form>
          </div>
        )}

        {/* State 3: Gamer Detail Dossier View */}
        {selectedGamer && !isAdding && !isEditing && (
          <div className="space-y-6">
            <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/30 relative">
              <div className="hud-grid"></div>
              
              <div className="flex justify-between items-start border-b border-cyber-border/40 pb-4 mb-4">
                <div>
                  <h3 className="font-mono font-black text-xl text-slate-200 tracking-wider flex items-center gap-2 uppercase">
                    {selectedGamer.name}
                  </h3>
                  <div className="font-mono text-xs text-cyber-cyan mt-1.5 flex flex-wrap gap-x-6 gap-y-2">
                    <span>EMPLOYEE ID: {selectedGamer.employee_id}</span>
                    <span className="uppercase text-slate-300">ROLE: {selectedGamer.gamer_role?.replace('_', ' ') || 'GAMER'}</span>
                    {selectedGamer.gamer_role !== 'technical_manager' && (
                      <span className="uppercase text-slate-300">LEVEL: {selectedGamer.level || 'beginner'}</span>
                    )}
                    {selectedGamer.gamer_role === 'gamer' && selectedGamer.team_leader_id && (
                      <span className="uppercase text-slate-300">
                        TEAM LEADER: {gamers.find(g => g.id === selectedGamer.team_leader_id)?.name || 'Unknown'}
                      </span>
                    )}
                    
                    {/* Status Display Pill */}
                    {selectedGamer.status === 'inactive' ? (
                      <span className="flex items-center gap-1 text-cyber-red bg-cyber-red/10 border border-cyber-red/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                        <UserX size={10} /> INACTIVE (STOPPED WORK)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyber-green bg-cyber-green/10 border border-cyber-green/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                        <UserCheck size={10} /> ACTIVE (ON DUTY)
                      </span>
                    )}

                    {/* Default Password / Roster Status Display */}
                    {selectedGamer.default_password ? (
                      <span className="flex items-center gap-1 text-cyber-amber bg-cyber-amber/10 border border-cyber-amber/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        <Key size={10} /> REGISTRATION CODE: {selectedGamer.default_password}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-cyber-green bg-cyber-green/10 border border-cyber-green/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        <ShieldCheck size={10} /> DOSSIER REGISTERED
                      </span>
                    )}

                    {selectedGamer.phone && (
                      <span className="flex items-center gap-1 text-slate-400"><Phone size={12} /> {selectedGamer.phone}</span>
                    )}
                  </div>
                </div>
                
                {role === 'admin' ? (
                  <div className="flex gap-2 items-center">
                    {/* 1-Click Activate / Deactivate Toggle */}
                    {selectedGamer.status === 'active' ? (
                      <button 
                        onClick={() => handleToggleStatus(selectedGamer, 'inactive')}
                        className="p-2 border border-cyber-border hover:border-cyber-red rounded bg-slate-950 hover:bg-cyber-red/10 text-slate-400 hover:text-cyber-red transition-all cursor-pointer flex items-center gap-1.5"
                        title="Deactivate Gamer Account (Mark as Stopped Work)"
                      >
                        <UserX size={14} />
                        <span className="text-[10px] font-bold uppercase hidden sm:inline">Deactivate</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleToggleStatus(selectedGamer, 'active')}
                        className="p-2 border border-cyber-green/40 hover:border-cyber-green rounded bg-cyber-green/10 hover:bg-cyber-green/20 text-cyber-green transition-all cursor-pointer flex items-center gap-1.5 shadow-neon-green/10"
                        title="Reactivate Gamer Account (Set Active On Duty)"
                      >
                        <UserCheck size={14} />
                        <span className="text-[10px] font-bold uppercase hidden sm:inline">Reactivate</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleResetPassword(selectedGamer)}
                      className="p-2 border border-cyber-border hover:border-cyber-amber rounded bg-slate-950 hover:bg-cyber-amber/10 text-slate-400 hover:text-cyber-amber transition-all cursor-pointer"
                      title="Reset Access Password"
                    >
                      <Key size={14} />
                    </button>
                    <button 
                      onClick={() => startEdit(selectedGamer)}
                      className="p-2 border border-cyber-border hover:border-cyber-cyan rounded bg-slate-950 hover:bg-cyber-cyan/10 text-slate-300 hover:text-cyber-cyan transition-all cursor-pointer"
                      title="Edit Gamer Info"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedGamer.id)}
                      className="p-2 border border-cyber-border hover:border-cyber-red rounded bg-slate-950 hover:bg-cyber-red/10 text-slate-300 hover:text-cyber-red transition-all cursor-pointer"
                      title="Delete Gamer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono bg-slate-900/80 px-2.5 py-1 rounded border border-cyber-border/40 font-bold uppercase select-none">
                    Auditor View
                  </span>
                )}
              </div>

              {/* Personal Metrics Dossier */}
              {(() => {
                const metrics = getGamerProfileMetrics(selectedGamer.id);
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 font-mono text-center md:text-left">
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30 col-span-1">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest">Total Deployed</div>
                        <div className="text-xl font-bold text-slate-200 mt-1">{metrics.totalCount} Missions</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30 col-span-1">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-green">Success Ratio</div>
                        <div className="text-xl font-bold text-cyber-green mt-1">{metrics.completionRate}%</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30 col-span-1">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-red">Violations</div>
                        <div className="text-xl font-bold text-cyber-red mt-1">{metrics.violationCount}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30 col-span-1">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-cyan">Order Earnings</div>
                        <div className="text-xl font-bold text-cyber-cyan mt-1">K{metrics.expectedPay.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-cyan/35 col-span-1">
                        <div className="text-[9px] text-cyber-cyan uppercase tracking-widest font-black">Net Expected Pay</div>
                        <div className="text-xl font-black text-cyber-green mt-1">K{metrics.netExpectedPay.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Team Members List (For Team Leaders) */}
                    {selectedGamer.gamer_role === 'team_leader' && (
                      <div className="mt-4 p-4 border border-cyber-border/40 bg-slate-950/60 rounded">
                        <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-cyber-cyan mb-2">
                          Team Members Managed ({gamers.filter(g => g.team_leader_id === selectedGamer.id && g.status === 'active').length}/5 active)
                        </h4>
                        {gamers.filter(g => g.team_leader_id === selectedGamer.id).length === 0 ? (
                          <div className="text-[10px] text-slate-500 uppercase">No team members assigned to this Leader yet.</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                            {gamers.filter(g => g.team_leader_id === selectedGamer.id).map(member => (
                              <div key={member.id} className="flex justify-between p-2 rounded border border-cyber-border/20 bg-slate-900/40">
                                <span className="font-bold text-slate-300">{member.name}</span>
                                <span className="text-slate-500 font-mono">ID: {member.employee_id} ({member.status})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mission History */}
                    <div>
                      <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 border-b border-cyber-border/20 pb-2">
                        Assigned Mission Log
                      </h4>

                      {metrics.orders.length === 0 ? (
                        <div className="py-6 text-center text-slate-500 font-mono text-xs">
                          NO MISSIONS ASSIGNED TO THIS GAMER YET.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-mono text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-cyber-border/40 text-slate-500 uppercase">
                                <th className="py-2">Code</th>
                                <th className="py-2 text-right">Size</th>
                                <th className="py-2 text-right">Pay</th>
                                <th className="py-2">Deployed On</th>
                                <th className="py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                              {metrics.orders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-900/40">
                                  <td className="py-2.5 font-bold text-cyber-cyan">{order.order_number}</td>
                                  <td className="py-2.5 text-right font-bold">{formatM(order.size_millions)}M ({order.asset_type === 'Haval Coins' ? 'Haval' : 'Assets'})</td>
                                  <td className="py-2.5 text-right text-cyber-green font-bold">K{order.payout}</td>
                                  <td className="py-2.5 text-slate-400">
                                    {new Date(order.start_date).toLocaleDateString()}
                                  </td>
                                  <td className="py-2.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      order.status === 'Running' ? 'bg-cyber-cyan/10 text-cyber-cyan' :
                                      order.status === 'Completed' ? 'bg-cyber-green/10 text-cyber-green' :
                                      order.status === 'Paused' ? 'bg-cyber-amber/10 text-cyber-amber' :
                                      order.status === 'Violation' ? 'bg-cyber-red/10 text-cyber-red' :
                                      'bg-slate-700/10 text-slate-400'
                                    }`}>
                                      {order.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Gamer Daily Earnings Breakdown */}
                    <div className="mt-6 pt-4 border-t border-cyber-border/30">
                      {(() => {
                        const currentCycle = getPayPeriodLabel(new Date().toISOString());
                        const allGamerDailyLogs = getDailyGamerEarnings(currentCycle, selectedGamer.id);
                        const availableDates = Array.from(new Set(allGamerDailyLogs.map(r => r.date))).sort().reverse();
                        const filteredGamerDailyLogs = dossierDailyDateFilter === 'all'
                          ? allGamerDailyLogs
                          : allGamerDailyLogs.filter(r => r.date === dossierDailyDateFilter);

                        return (
                          <>
                            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                              <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-cyber-cyan flex items-center gap-2">
                                <span>Daily Earnings Ledger (Current Cycle)</span>
                                <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">per-day pay audit</span>
                              </h4>

                              <div className="flex items-center gap-2 font-mono text-[9px]">
                                <span className="text-slate-400 uppercase font-bold">Filter Date:</span>
                                <select
                                  value={dossierDailyDateFilter}
                                  onChange={(e) => setDossierDailyDateFilter(e.target.value)}
                                  className="bg-slate-950 border border-cyber-border rounded px-2 py-0.5 text-cyber-cyan text-[9px] font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
                                >
                                  <option value={todayStr}>Today ({todayStr})</option>
                                  <option value="all">All Dates in Cycle</option>
                                  {availableDates.filter(d => d !== todayStr).map(date => (
                                    <option key={date} value={date}>{date}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {filteredGamerDailyLogs.length === 0 ? (
                              <div className="py-4 text-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border/20 rounded">
                                NO DAILY EARNINGS LOGGED FOR {dossierDailyDateFilter === 'all' ? 'THIS CYCLE' : dossierDailyDateFilter}.
                              </div>
                            ) : (
                              <div className="overflow-x-auto border border-cyber-border/30 rounded max-h-48">
                                <table className="w-full text-left font-mono text-[11px] border-collapse">
                                  <thead>
                                    <tr className="border-b border-cyber-border/40 text-slate-400 uppercase bg-slate-950/60 select-none sticky top-0">
                                      <th className="py-2 px-2.5">Date</th>
                                      <th className="py-2 px-2.5 text-right">Farmed (M)</th>
                                      <th className="py-2 px-2.5 text-right">Base Earned</th>
                                      <th className="py-2 px-2.5 text-center">Status</th>
                                      <th className="py-2 px-2.5 text-right text-cyber-green">Orders Bonus</th>
                                      <th className="py-2 px-2.5 text-right text-cyber-green">Team Bonus</th>
                                      <th className="py-2 px-2.5 text-right text-cyber-cyan font-bold">Daily Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                                    {filteredGamerDailyLogs.map((r, i) => (
                                      <tr key={i} className="hover:bg-slate-900/40 font-mono">
                                        <td className="py-2 px-2.5 font-bold">{r.date}</td>
                                        <td className="py-2 px-2.5 text-right font-bold text-slate-200">{formatM(r.farmedMillions)}M</td>
                                        <td className="py-2 px-2.5 text-right">K{r.basePayEarned.toFixed(2)}</td>
                                        <td className="py-2 px-2.5 text-center">
                                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${
                                            r.attendanceStatus === 'present_on_time' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                                            r.attendanceStatus === 'present_late' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20' :
                                            r.attendanceStatus === 'absent' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20' :
                                            'bg-slate-800 text-slate-500'
                                          }`}>
                                            {r.attendanceStatus === 'present_on_time' ? 'On Time' :
                                             r.attendanceStatus === 'present_late' ? 'Late' :
                                             r.attendanceStatus === 'absent' ? 'Absent' : 'No Log'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2.5 text-right text-cyber-green font-bold">K{r.orderBonus}</td>
                                        <td className="py-2 px-2.5 text-right text-cyber-green font-bold">K{r.teamVolumeBonus}</td>
                                        <td className="py-2 px-2.5 text-right text-cyber-cyan font-bold">K{r.totalDailyEarned.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* State 4: Default Dossier Placeholder */}
        {!selectedGamer && !isAdding && !isEditing && (
          <div className="tactical-panel p-8 rounded clip-corners border border-cyber-border/30 h-full flex flex-col items-center justify-center text-center py-20 relative">
            <div className="hud-grid"></div>
            <Award size={48} className="text-cyber-cyan/20 mb-4" />
            <h4 className="font-mono text-sm text-slate-400 uppercase tracking-widest font-bold">No Gamer Selected</h4>
            <p className="font-mono text-xs text-slate-600 mt-2 max-w-xs">
              Select a gamer dossier from the left dashboard log or recruit a new gamer to view performance metrics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
