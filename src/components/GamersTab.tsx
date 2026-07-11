'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Gamer, Order } from '../types';
import { 
  UserPlus, 
  Phone, 
  Mail,
  Trash2, 
  Edit3, 
  X,
  User,
  Award
} from 'lucide-react';

export default function GamersTab() {
  const { gamers, orders, addGamer, updateGamer, deleteGamer } = useApp();

  // Component States
  const [selectedGamer, setSelectedGamer] = useState<Gamer | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<Gamer | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState('');

  // Reset fields
  const resetForm = () => {
    setName('');
    setEmployeeId('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setFormError('');
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeId.trim()) {
      setFormError('Name and Employee ID are required.');
      return;
    }

    const res = await addGamer(name.trim(), employeeId.trim(), phone.trim());
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

    const res = await updateGamer(isEditing.id, name.trim(), employeeId.trim(), phone.trim(), status);
    if (res.success) {
      if (selectedGamer?.id === isEditing.id) {
        setSelectedGamer({ ...selectedGamer, name, employee_id: employeeId, email, phone, status });
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

  const startEdit = (gamer: Gamer) => {
    setIsEditing(gamer);
    setName(gamer.name);
    setEmployeeId(gamer.employee_id);
    setEmail(gamer.email || '');
    setPhone(gamer.phone || '');
    setStatus(gamer.status);
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
      completionRate,
      violationRate
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Dossier Lists */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-1 flex flex-col">
        <div className="flex justify-between items-center border-b border-cyber-border/40 pb-3 mb-4">
          <h3 className="font-mono font-bold text-sm text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <User size={16} className="text-cyber-cyan" />
            Gamer Dossiers
          </h3>
          <button 
            onClick={() => { setIsAdding(true); setIsEditing(null); setSelectedGamer(null); resetForm(); }}
            className="flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-cyber-cyan border border-cyber-cyan/30 bg-cyber-cyan/5 px-2.5 py-1 rounded hover:bg-cyber-cyan/20 hover:border-cyber-cyan shadow-neon-cyan/10 hover:shadow-neon-cyan/20 transition-all cursor-pointer"
          >
            <UserPlus size={12} />
            Recruit Gamer
          </button>
        </div>

        {/* Gamers List */}
        {gamers.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs">
            NO GAMERS REGISTERED IN COMMAND DATA.
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
            {gamers.map((gamer) => {
              const metrics = getGamerProfileMetrics(gamer.id);
              const isSelected = selectedGamer?.id === gamer.id;

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
                      <div className="text-[10px] text-cyber-cyan/80 mt-0.5">ID: {gamer.employee_id}</div>
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
                  <label className="text-slate-400 uppercase tracking-wider">Email (For Gamer Login)</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. soap@zampeak.com"
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
                  <label className="text-slate-400 uppercase tracking-wider">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    <option value="active">Active (On Duty)</option>
                    <option value="inactive">Inactive (Suspended)</option>
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
                  <div className="font-mono text-xs text-cyber-cyan mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
                    <span>EMPLOYEE ID: {selectedGamer.employee_id}</span>
                    {selectedGamer.email && (
                      <span className="flex items-center gap-1 text-slate-400"><Mail size={12} /> {selectedGamer.email}</span>
                    )}
                    {selectedGamer.phone && (
                      <span className="flex items-center gap-1 text-slate-400"><Phone size={12} /> {selectedGamer.phone}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
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
              </div>

              {/* Personal Metrics Dossier */}
              {(() => {
                const metrics = getGamerProfileMetrics(selectedGamer.id);
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest">Total Deployed</div>
                        <div className="text-xl font-bold text-slate-200 mt-1">{metrics.totalCount} Missions</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-green">Success Ratio</div>
                        <div className="text-xl font-bold text-cyber-green mt-1">{metrics.completionRate}%</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-red">Violations</div>
                        <div className="text-xl font-bold text-cyber-red mt-1">{metrics.violationCount}</div>
                      </div>
                      <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest text-cyber-cyan">Net Earnings</div>
                        <div className="text-xl font-bold text-cyber-cyan mt-1">K{metrics.expectedPay}</div>
                      </div>
                    </div>

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
                                  <td className="py-2.5 text-right font-bold">{order.size_millions}M ({order.asset_type === 'Haval Coins' ? 'Haval' : 'Assets'})</td>
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
