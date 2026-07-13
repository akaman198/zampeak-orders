'use client';

import React, { useState } from 'react';
import { useApp, getPayPeriodLabel } from '../context/AppContext';
import { AttendanceStatus } from '../types';
import { 
  Calendar, 
  Check, 
  Clock, 
  X, 
  Users, 
  ShieldAlert,
  Search,
  CheckCircle2
} from 'lucide-react';

export default function AttendanceTab() {
  const { gamers, attendance, saveAttendance, role } = useApp();
  
  // Format today's date in local YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'gamer' | 'team_leader' | 'technical_manager'>('all');
  const [saveStatus, setSaveStatus] = useState<{ [gamerId: string]: 'saving' | 'success' | 'error' }>({});

  // Ensure only admin/Technical Manager (via UI checks) can see this
  if (role !== 'admin') {
    return (
      <div className="tactical-panel p-6 rounded clip-corners border border-cyber-red/30 bg-cyber-red/5 text-cyber-red font-mono text-center">
        <ShieldAlert className="mx-auto text-cyber-red mb-3 animate-pulse" size={40} />
        <h3 className="font-bold text-lg uppercase tracking-widest">[ACCESS DENIED]</h3>
        <p className="text-xs text-slate-400 mt-2">
          OPERATOR CLEARANCE LEVEL INSUFFICIENT. ONLY CENTRAL ADMINISTRATION MAY AUDIT ATTENDANCE LOGS.
        </p>
      </div>
    );
  }

  // Helper to get attendance record status for a gamer on the selected date
  const getGamerStatusForDate = (gamerId: string) => {
    const record = attendance.find(a => a.gamer_id === gamerId && a.date === selectedDate);
    return record?.status || null; // null means unmarked
  };

  const handleMarkAttendance = async (gamerId: string, status: AttendanceStatus) => {
    setSaveStatus(prev => ({ ...prev, [gamerId]: 'saving' }));
    const res = await saveAttendance(gamerId, selectedDate, status);
    if (res.success) {
      setSaveStatus(prev => ({ ...prev, [gamerId]: 'success' }));
      setTimeout(() => {
        setSaveStatus(prev => {
          const next = { ...prev };
          delete next[gamerId];
          return next;
        });
      }, 1000);
    } else {
      setSaveStatus(prev => ({ ...prev, [gamerId]: 'error' }));
      alert(`Error saving attendance: ${res.error}`);
    }
  };

  // Mark all filtered gamers present on-time in one click
  const handleMarkAllPresentOnTime = async () => {
    if (confirm(`Are you sure you want to mark all filtered operators Present (On-time) for ${selectedDate}?`)) {
      for (const gamer of filteredGamers) {
        const currentStatus = getGamerStatusForDate(gamer.id);
        if (currentStatus !== 'present_on_time') {
          await saveAttendance(gamer.id, selectedDate, 'present_on_time');
        }
      }
    }
  };

  // Filter gamers based on search term and role filter
  const filteredGamers = gamers
    .filter(g => g.status === 'active') // Only mark attendance for active employees
    .filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            g.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || g.gamer_role === roleFilter;
      
      return matchesSearch && matchesRole;
    });

  // Calculate statistics for the selected date
  const activeGamers = gamers.filter(g => g.status === 'active');
  const totalActive = activeGamers.length;
  const countPresentOnTime = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'present_on_time').length;
  const countPresentLate = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'present_late').length;
  const countAbsent = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'absent').length;
  const countUnmarked = totalActive - (countPresentOnTime + countPresentLate + countAbsent);

  // Formatted date label
  const getFormattedDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const payCycleLabel = getPayPeriodLabel(selectedDate);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Attendance Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Date Selector and Summary Card */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-cyan/30 lg:col-span-1 space-y-4">
          <h3 className="font-bold text-sm text-cyber-cyan uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-2 flex items-center gap-2">
            <Calendar size={16} />
            Dossier Period
          </h3>

          <div className="space-y-1.5">
            <label className="text-slate-400 uppercase tracking-wider block">Operational Date</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan text-center font-bold"
            />
          </div>

          <div className="p-3 border border-cyber-border/40 bg-slate-950/60 rounded space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Assigned Pay Cycle</div>
            <div className="text-sm font-bold text-slate-200 text-glow-cyan">{payCycleLabel || 'N/A'}</div>
            <div className="text-[9px] text-slate-500 uppercase">
              Shift: Mon-Sat, 9AM to 6PM
            </div>
          </div>

          <button
            onClick={handleMarkAllPresentOnTime}
            disabled={filteredGamers.length === 0}
            className="w-full py-2 bg-cyber-cyan hover:bg-cyan-400 text-slate-950 font-bold rounded shadow-neon-cyan/20 transition-all uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={14} className="text-slate-950" />
            Mark All On-Time
          </button>
        </div>

        {/* Tactical Roll-Call Metrics */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-3">
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex justify-between items-center">
            <span>Roll-Call Status Dashboard</span>
            <span className="text-[10px] font-normal text-slate-400 lowercase select-all">{getFormattedDateLabel(selectedDate)}</span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Stat: Present On-Time */}
            <div className="p-4 border border-cyber-green/20 rounded bg-slate-950/40 relative">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Check size={12} className="text-cyber-green" />
                On-Time
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-cyber-green text-glow-green">{countPresentOnTime}</span>
                <span className="text-[9px] text-slate-500">ops</span>
              </div>
              <div className="mt-1.5 w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-cyber-green h-full" 
                  style={{ width: `${totalActive > 0 ? (countPresentOnTime / totalActive) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Stat: Present Late */}
            <div className="p-4 border border-cyber-amber/20 rounded bg-slate-950/40 relative">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock size={12} className="text-cyber-amber" />
                Late arrival
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-cyber-amber text-glow-amber">{countPresentLate}</span>
                <span className="text-[9px] text-slate-500">ops</span>
              </div>
              <div className="mt-1.5 w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-cyber-amber h-full" 
                  style={{ width: `${totalActive > 0 ? (countPresentLate / totalActive) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Stat: Absent */}
            <div className="p-4 border border-cyber-red/20 rounded bg-slate-950/40 relative">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <X size={12} className="text-cyber-red" />
                Absent (Deducted)
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-cyber-red text-glow-red">{countAbsent}</span>
                <span className="text-[9px] text-slate-500">ops</span>
              </div>
              <div className="mt-1.5 w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-cyber-red h-full" 
                  style={{ width: `${totalActive > 0 ? (countAbsent / totalActive) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Stat: Unmarked */}
            <div className="p-4 border border-cyber-border rounded bg-slate-950/40 relative">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users size={12} className="text-slate-400" />
                Unmarked
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-400">{countUnmarked}</span>
                <span className="text-[9px] text-slate-500">ops</span>
              </div>
              <div className="mt-1.5 w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-slate-500 h-full" 
                  style={{ width: `${totalActive > 0 ? (countUnmarked / totalActive) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Roster List */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-cyber-border/40 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-cyber-cyan" />
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
              Operator Attendance Roster ({filteredGamers.length} Active)
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
              <input 
                type="text"
                placeholder="Search dossier name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-cyber-border rounded pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan text-xs cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="gamer">Gamers</option>
              <option value="team_leader">Team Leaders</option>
              <option value="technical_manager">Technical Managers</option>
            </select>
          </div>
        </div>

        {/* Table of operators */}
        {filteredGamers.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            NO ACTIVE OPERATORS MATCHING CRITERIA DETECTED.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cyber-border/60 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Operator Dossier</th>
                  <th className="py-3 px-3">Clearance ID</th>
                  <th className="py-3 px-3">Role / Level</th>
                  <th className="py-3 px-3 text-center w-80">Mark Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/20">
                {filteredGamers.map((gamer) => {
                  const currentStatus = getGamerStatusForDate(gamer.id);
                  const statusState = saveStatus[gamer.id];
                  
                  let roleBadgeColor = 'border-slate-700 bg-slate-900/60 text-slate-400';
                  let roleText = 'GAMER';
                  if (gamer.gamer_role === 'technical_manager') {
                    roleBadgeColor = 'border-cyber-red/35 bg-cyber-red/10 text-cyber-red text-glow-red';
                    roleText = 'TECH MGR';
                  } else if (gamer.gamer_role === 'team_leader') {
                    roleBadgeColor = 'border-cyber-amber/35 bg-cyber-amber/10 text-cyber-amber';
                    roleText = 'TEAM LDR';
                  }

                  return (
                    <tr key={gamer.id} className="hover:bg-slate-900/25 transition-all">
                      <td className="py-3.5 px-3 font-bold text-slate-200">
                        {gamer.name}
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 select-all font-mono">
                        {gamer.employee_id}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${roleBadgeColor}`}>
                            {roleText}
                          </span>
                          {gamer.gamer_role !== 'technical_manager' && (
                            <span className="text-slate-500 capitalize">{gamer.level}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-center gap-2">
                          {/* Present On-Time */}
                          <button
                            onClick={() => handleMarkAttendance(gamer.id, 'present_on_time')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              currentStatus === 'present_on_time'
                                ? 'bg-cyber-green text-slate-950 border-cyber-green font-black shadow-neon-green/20'
                                : 'border-cyber-border text-slate-400 hover:border-cyber-green hover:text-cyber-green hover:bg-cyber-green/5'
                            }`}
                          >
                            <Check size={10} />
                            On-Time
                          </button>

                          {/* Present Late */}
                          <button
                            onClick={() => handleMarkAttendance(gamer.id, 'present_late')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              currentStatus === 'present_late'
                                ? 'bg-cyber-amber text-slate-950 border-cyber-amber font-black shadow-neon-amber/20'
                                : 'border-cyber-border text-slate-400 hover:border-cyber-amber hover:text-cyber-amber hover:bg-cyber-amber/5'
                            }`}
                          >
                            <Clock size={10} />
                            Late
                          </button>

                          {/* Absent */}
                          <button
                            onClick={() => handleMarkAttendance(gamer.id, 'absent')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              currentStatus === 'absent'
                                ? 'bg-cyber-red text-slate-950 border-cyber-red font-black shadow-neon-red/20'
                                : 'border-cyber-border text-slate-400 hover:border-cyber-red hover:text-cyber-red hover:bg-cyber-red/5'
                            }`}
                          >
                            <X size={10} />
                            Absent
                          </button>

                          {/* Save Status Spinner/Tick */}
                          <div className="w-6 h-6 flex items-center justify-center text-[10px]">
                            {statusState === 'saving' && (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-cyber-cyan/15 border-t-cyber-cyan animate-spin"></div>
                            )}
                            {statusState === 'success' && (
                              <Check className="text-cyber-cyan animate-bounce" size={14} />
                            )}
                            {statusState === 'error' && (
                              <ShieldAlert className="text-cyber-red" size={14} />
                            )}
                          </div>
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
