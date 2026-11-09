'use client';

import React, { useState } from 'react';
import { useApp, getPayPeriodLabel } from '../context/AppContext';
import { AttendanceStatus, ShiftType } from '../types';
import { 
  Calendar, 
  Check, 
  Clock, 
  X, 
  Users, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  Sun, 
  Moon 
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
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [saveStatus, setSaveStatus] = useState<{ [gamerId: string]: 'saving' | 'success' | 'error' }>({});
  const [localNormalOT, setLocalNormalOT] = useState<{ [gamerId: string]: string }>({});
  const [localHolidayOT, setLocalHolidayOT] = useState<{ [gamerId: string]: string }>({});

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setLocalNormalOT({});
    setLocalHolidayOT({});
  };

  // Ensure only admin or viewer (auditor) can see this
  if (role !== 'admin' && role !== 'viewer') {
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

  // Helper to get attendance record shift for a gamer on the selected date
  const getGamerShiftForDate = (gamerId: string): ShiftType => {
    const record = attendance.find(a => a.gamer_id === gamerId && a.date === selectedDate);
    return record?.shift || 'day';
  };

  const getGamerNormalOTForDate = (gamerId: string) => {
    if (localNormalOT[gamerId] !== undefined) {
      return localNormalOT[gamerId];
    }
    const record = attendance.find(a => a.gamer_id === gamerId && a.date === selectedDate);
    return record?.normal_overtime_hours !== undefined && record.normal_overtime_hours > 0 ? String(record.normal_overtime_hours) : '';
  };

  const getGamerHolidayOTForDate = (gamerId: string) => {
    if (localHolidayOT[gamerId] !== undefined) {
      return localHolidayOT[gamerId];
    }
    const record = attendance.find(a => a.gamer_id === gamerId && a.date === selectedDate);
    return record?.holiday_overtime_hours !== undefined && record.holiday_overtime_hours > 0 ? String(record.holiday_overtime_hours) : '';
  };

  const handleMarkAttendance = async (
    gamerId: string, 
    status: AttendanceStatus, 
    farmedMillions?: number,
    normalOT?: number,
    holidayOT?: number,
    shift?: ShiftType
  ) => {
    setSaveStatus(prev => ({ ...prev, [gamerId]: 'saving' }));
    const currentRecord = attendance.find(a => a.gamer_id === gamerId && a.date === selectedDate);
    const finalFarmed = farmedMillions !== undefined ? farmedMillions : (currentRecord?.farmed_millions || 0);
    const finalNormal = normalOT !== undefined ? normalOT : (currentRecord?.normal_overtime_hours || 0);
    const finalHoliday = holidayOT !== undefined ? holidayOT : (currentRecord?.holiday_overtime_hours || 0);
    const finalShift = shift !== undefined ? shift : (currentRecord?.shift || 'day');

    const res = await saveAttendance(gamerId, selectedDate, status, finalFarmed, finalNormal, finalHoliday, finalShift);
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

  // Toggle shift for an operator on this date
  const handleToggleShift = async (gamerId: string) => {
    const currentShift = getGamerShiftForDate(gamerId);
    const nextShift: ShiftType = currentShift === 'day' ? 'night' : 'day';
    const currentStatus = getGamerStatusForDate(gamerId) || 'present_on_time';
    await handleMarkAttendance(gamerId, currentStatus, undefined, undefined, undefined, nextShift);
  };

  // Mark all filtered gamers present on-time in one click
  const handleMarkAllPresentOnTime = async () => {
    if (confirm(`Are you sure you want to mark all filtered operators Present (On-time) for ${selectedDate}?`)) {
      for (const gamer of filteredGamers) {
        const currentStatus = getGamerStatusForDate(gamer.id);
        const currentRecord = attendance.find(a => a.gamer_id === gamer.id && a.date === selectedDate);
        if (currentStatus !== 'present_on_time') {
          await saveAttendance(gamer.id, selectedDate, 'present_on_time', currentRecord?.farmed_millions || 0);
        }
      }
    }
  };

  // Filter gamers based on search term, role filter, and shift filter
  const filteredGamers = gamers
    .filter(g => g.status === 'active') // Only mark attendance for active employees
    .filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            g.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || g.gamer_role === roleFilter;
      const matchesShift = shiftFilter === 'all' || getGamerShiftForDate(g.id) === shiftFilter;
      
      return matchesSearch && matchesRole && matchesShift;
    });

  // Calculate statistics for the selected date
  const activeGamers = gamers.filter(g => g.status === 'active');
  const totalActive = activeGamers.length;
  const countPresentOnTime = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'present_on_time').length;
  const countPresentLate = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'present_late').length;
  const countAbsent = activeGamers.filter(g => getGamerStatusForDate(g.id) === 'absent').length;
  const countUnmarked = totalActive - (countPresentOnTime + countPresentLate + countAbsent);

  const countDayShift = activeGamers.filter(g => getGamerShiftForDate(g.id) === 'day').length;
  const countNightShift = activeGamers.filter(g => getGamerShiftForDate(g.id) === 'night').length;

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
            <Calendar size={16} /> Audit Date Log
          </h3>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase">Select Target Date:</label>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyber-cyan font-bold"
            />
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-cyber-border/20 space-y-1">
            <div className="text-slate-300 font-bold">{getFormattedDateLabel(selectedDate)}</div>
            <div className="text-[10px] text-cyber-cyan">Cycle: {payCycleLabel}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-cyber-border/20">
              <span className="text-amber-400 flex items-center gap-0.5"><Sun size={10} /> {countDayShift} Day</span>
              <span className="text-indigo-300 flex items-center gap-0.5"><Moon size={10} /> {countNightShift} Night</span>
            </div>
          </div>

          {/* Quick Mark All Present */}
          {role === 'admin' && countUnmarked > 0 && (
            <button
              onClick={handleMarkAllPresentOnTime}
              className="w-full bg-cyber-green/15 hover:bg-cyber-green text-cyber-green hover:text-slate-950 border border-cyber-green/40 py-2 px-3 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 shadow-neon-green/10 cursor-pointer text-[11px]"
            >
              <CheckCircle2 size={14} />
              Mark All On-Time ({countUnmarked})
            </button>
          )}
        </div>

        {/* Daily Stats Overview Cards */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 lg:col-span-3">
          <h3 className="font-bold text-sm text-slate-200 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-4 flex items-center justify-between">
            <span>Operational Roster Attendance Status</span>
            <span className="text-[10px] text-cyber-cyan">{totalActive} Active Employees</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Present On-Time */}
            <div className="bg-slate-950/60 p-3.5 rounded border border-cyber-green/30 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Present (On-Time)</span>
                <Check className="text-cyber-green" size={12} />
              </div>
              <div className="text-xl font-bold text-cyber-green">{countPresentOnTime}</div>
              <div className="text-[9px] text-slate-500">Full Daily Base Earned</div>
            </div>

            {/* Present Late */}
            <div className="bg-slate-950/60 p-3.5 rounded border border-cyber-amber/30 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Present (Late)</span>
                <Clock className="text-cyber-amber" size={12} />
              </div>
              <div className="text-xl font-bold text-cyber-amber">{countPresentLate}</div>
              <div className="text-[9px] text-slate-500">No daily penalty</div>
            </div>

            {/* Absent */}
            <div className="bg-slate-950/60 p-3.5 rounded border border-cyber-red/30 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Absent</span>
                <X className="text-cyber-red" size={12} />
              </div>
              <div className="text-xl font-bold text-cyber-red">{countAbsent}</div>
              <div className="text-[9px] text-slate-500">No Daily Base Earned</div>
            </div>

            {/* Unmarked */}
            <div className="bg-slate-950/60 p-3.5 rounded border border-cyber-border/40 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Unlogged</span>
                <Users className="text-slate-500" size={12} />
              </div>
              <div className="text-xl font-bold text-slate-400">{countUnmarked}</div>
              <div className="text-[9px] text-slate-500">Pending audit for today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Attendance Table */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 space-y-4">
        
        {/* Table Controls (Search & Role Filter & Shift Filter) */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-cyber-border/30 pb-4">
          <div className="text-sm font-bold text-cyber-cyan uppercase tracking-wider flex items-center gap-2">
            <Users size={16} /> Operator Manifest
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
              <input 
                type="text"
                placeholder="Search dossier name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-cyber-border rounded pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
              />
            </div>

            {/* Shift Filter */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as any)}
              className="bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan text-xs cursor-pointer"
            >
              <option value="all">All Shifts</option>
              <option value="day">☀️ Day Shift Only</option>
              <option value="night">🌙 Night Shift Only</option>
            </select>

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
                  <th className="py-3 px-3 text-center">Shift</th>
                  <th className="py-3 px-3 w-44">Overtime Hours</th>
                  <th className="py-3 px-3 text-center w-72">Mark Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/20">
                {filteredGamers.map((gamer) => {
                  const currentStatus = getGamerStatusForDate(gamer.id);
                  const currentShift = getGamerShiftForDate(gamer.id);
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
                      {/* Name */}
                      <td className="py-3.5 px-3 font-bold text-slate-200">
                        {gamer.name}
                      </td>

                      {/* Employee ID */}
                      <td className="py-3.5 px-3 text-slate-400 select-all font-mono">
                        {gamer.employee_id}
                      </td>

                      {/* Role & Level */}
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

                      {/* Shift (Day vs Night Toggle) */}
                      <td className="py-3.5 px-3 text-center">
                        {role === 'admin' ? (
                          <button
                            onClick={() => handleToggleShift(gamer.id)}
                            title="Click to toggle between Day and Night shift"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all cursor-pointer ${
                              currentShift === 'night'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                            }`}
                          >
                            {currentShift === 'night' ? (
                              <>
                                <Moon size={11} /> <span>Night</span>
                              </>
                            ) : (
                              <>
                                <Sun size={11} /> <span>Day</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            currentShift === 'night' ? 'text-indigo-300' : 'text-amber-300'
                          }`}>
                            {currentShift === 'night' ? <Moon size={11} /> : <Sun size={11} />}
                            {currentShift === 'night' ? 'Night' : 'Day'}
                          </span>
                        )}
                      </td>

                      {/* Overtime (Normal 1.5x & Holiday 2.0x) */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 font-bold" title="Normal Approved Overtime (1.5x rate: K5.77/hr)">1.5x:</span>
                            <input 
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={role === 'viewer'}
                              value={getGamerNormalOTForDate(gamer.id)}
                              onChange={(e) => {
                                if (role === 'viewer') return;
                                setLocalNormalOT(prev => ({ ...prev, [gamer.id]: e.target.value }));
                              }}
                              onBlur={() => {
                                if (role === 'viewer') return;
                                const valStr = localNormalOT[gamer.id];
                                if (valStr === undefined) return;
                                const val = parseFloat(valStr) || 0;
                                handleMarkAttendance(gamer.id, currentStatus || 'present_on_time', undefined, val, undefined);
                                setLocalNormalOT(prev => {
                                  const next = { ...prev };
                                  delete next[gamer.id];
                                  return next;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              placeholder="0"
                              className="w-12 bg-slate-950 border border-cyber-border/40 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-cyber-cyan text-center text-xs"
                            />
                            <span className="text-[9px] text-slate-500">h</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 font-bold" title="Holiday / Rest Day Overtime (2.0x rate: K7.69/hr)">2.0x:</span>
                            <input 
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={role === 'viewer'}
                              value={getGamerHolidayOTForDate(gamer.id)}
                              onChange={(e) => {
                                if (role === 'viewer') return;
                                setLocalHolidayOT(prev => ({ ...prev, [gamer.id]: e.target.value }));
                              }}
                              onBlur={() => {
                                if (role === 'viewer') return;
                                const valStr = localHolidayOT[gamer.id];
                                if (valStr === undefined) return;
                                const val = parseFloat(valStr) || 0;
                                handleMarkAttendance(gamer.id, currentStatus || 'present_on_time', undefined, undefined, val);
                                setLocalHolidayOT(prev => {
                                  const next = { ...prev };
                                  delete next[gamer.id];
                                  return next;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              placeholder="0"
                              className="w-12 bg-slate-950 border border-cyber-border/40 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-cyber-cyan text-center text-xs"
                            />
                            <span className="text-[9px] text-slate-500">h</span>
                          </div>
                        </div>
                      </td>

                      {/* Attendance Status Buttons */}
                      <td className="py-3.5 px-3">
                        {role === 'admin' ? (
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
                        ) : (
                          <div className="flex items-center justify-center font-mono">
                            <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${
                              currentStatus === 'present_on_time' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30' :
                              currentStatus === 'present_late' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30' :
                              currentStatus === 'absent' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/30' :
                              'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}>
                              {currentStatus === 'present_on_time' ? 'Present (On-Time)' :
                               currentStatus === 'present_late' ? 'Present (Late)' :
                               currentStatus === 'absent' ? 'Absent' : 'Unmarked'}
                            </span>
                          </div>
                        )}
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