'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Gamer, 
  Order, 
  OrderStatus, 
  AssetType, 
  GamerLevel, 
  GamerRole, 
  AttendanceStatus, 
  AttendanceRecord, 
  PayrollSummary,
  DailyGamerEarnings,
  ShiftType,
  OrderDailyProgress
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  role: 'admin' | 'viewer' | 'gamer';
  gamerProfile: Gamer | null;
  gamers: Gamer[];
  orders: Order[];
  attendance: AttendanceRecord[];
  loading: boolean;
  authLoading: boolean;
  isDemo: boolean;
  signIn: (emailOrEmpId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (emailOrEmpId: string, password: string, defaultPassword?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  addGamer: (
    name: string,
    employeeId: string,
    defaultPassword: string,
    level: GamerLevel,
    gamerRole: GamerRole,
    teamLeaderId: string | null,
    phone?: string
  ) => Promise<{ success: boolean; error?: string }>;
  updateGamer: (
    id: string,
    name: string,
    employeeId: string,
    level: GamerLevel,
    gamerRole: GamerRole,
    teamLeaderId: string | null,
    defaultPassword?: string,
    phone?: string,
    status?: 'active' | 'inactive'
  ) => Promise<{ success: boolean; error?: string }>;
  toggleGamerStatus: (id: string, status: 'active' | 'inactive') => Promise<{ success: boolean; error?: string }>;
  deleteGamer: (id: string) => Promise<{ success: boolean; error?: string }>;
  resetGamerPassword: (id: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  addOrder: (
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number,
    progressMillions?: number,
    coGamerId?: string | null,
    assignedGamerIds?: string[],
    dailyProgress?: OrderDailyProgress[]
  ) => Promise<{ success: boolean; error?: string }>;
  updateOrder: (
    id: string,
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number,
    progressMillions?: number,
    coGamerId?: string | null,
    assignedGamerIds?: string[],
    dailyProgress?: OrderDailyProgress[]
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<{ success: boolean; error?: string }>;
  logOrderDailyProgress: (
    orderId: string,
    entry: Omit<OrderDailyProgress, 'id' | 'order_id' | 'created_at'>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOrderDailyProgress: (
    orderId: string,
    logId: string
  ) => Promise<{ success: boolean; error?: string }>;
  saveAttendance: (
    gamerId: string, 
    date: string, 
    status: AttendanceStatus, 
    farmedMillions?: number,
    normalOvertimeHours?: number,
    holidayOvertimeHours?: number,
    shift?: ShiftType
  ) => Promise<{ success: boolean; error?: string }>;
  calculatePayroll: (gamerId: string, cycleLabel: string) => PayrollSummary;
  getDailyGamerEarnings: (cycleLabel: string, targetGamerId?: string) => DailyGamerEarnings[];
  importBackupData: (gamers: Gamer[], orders: Order[], attendance?: AttendanceRecord[]) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
  isMaintenanceMode: boolean;
  setMaintenanceMode: (active: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn('sessionStorage is blocked or unavailable:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('sessionStorage setItem is blocked or unavailable:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('sessionStorage removeItem is blocked or unavailable:', e);
    }
  }
};

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage is blocked or unavailable:', e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('localStorage setItem is blocked or unavailable:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('localStorage removeItem is blocked or unavailable:', e);
    }
  }
};

const getEmailFromInput = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed.toLowerCase()}@gamers.zampeak.com`;
};

export const getAttendancePeriodLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const dateOnly = dateStr.slice(0, 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Transition rule:
  // Attendance prior to September 15, 2026 was under the legacy 16th-to-15th structure (ending Sep 15, 2026)
  if (dateOnly < '2026-09-15') {
    const normalizedStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
    const date = new Date(normalizedStr);
    let year = date.getFullYear();
    let month = date.getMonth();
    const day = date.getDate();
    if (day >= 16) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return `${monthNames[month]} 15, ${year}`;
  }

  // Transition cycle: From Sept 15, 2026 until the new monthly cycle begins on Oct 1, 2026
  if (dateOnly < '2026-10-01') {
    return 'October 1, 2026';
  }

  // From Oct 1, 2026 onwards: Cycle period is from the 1st of each month to the 1st of the next month
  // E.g., Oct 1 - Oct 31 rolls into November 1, 2026 (target pay date)
  // E.g., Nov 1 - Nov 30 rolls into December 1, 2026
  const parts = dateOnly.split('-');
  let year = parseInt(parts[0], 10) || 2026;
  let month = (parseInt(parts[1], 10) || 1) - 1; // 0-indexed month

  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  return `${monthNames[month]} 1, ${year}`;
};

export const getOrderPeriodLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const dateOnly = dateStr.slice(0, 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Transition rule:
  // Orders completed prior to September 14, 2026 belonged to the Sep 15, 2026 cycle or prior
  if (dateOnly < '2026-09-14') {
    const normalizedStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
    const date = new Date(normalizedStr);
    let year = date.getFullYear();
    let month = date.getMonth();
    const day = date.getDate();
    if (day >= 15) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return `${monthNames[month]} 15, ${year}`;
  }

  // Transition cycle: From Sept 14, 2026 until the new monthly cycle begins on Oct 1, 2026
  if (dateOnly < '2026-10-01') {
    return 'October 1, 2026';
  }

  // From Oct 1, 2026 onwards: Cycle period is from the 1st of each month to the 1st of the next month
  // E.g., Oct 1 - Oct 31 rolls into November 1, 2026 (target pay date)
  // E.g., Nov 1 - Nov 30 rolls into December 1, 2026
  const parts = dateOnly.split('-');
  let year = parseInt(parts[0], 10) || 2026;
  let month = (parseInt(parts[1], 10) || 1) - 1;

  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  return `${monthNames[month]} 1, ${year}`;
};

export const getPayPeriodLabel = getAttendancePeriodLabel;

export const isNewSalaryStructureCycle = (cycleLabel: string): boolean => {
  if (!cycleLabel) return true;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const parts = cycleLabel.replace(',', '').split(' '); // e.g. ["September", "5", "2026"] or ["October", "5", "2026"]
  if (parts.length < 3) return false;
  const monthIndex = monthNames.indexOf(parts[0]);
  const day = parseInt(parts[1]) || 5;
  const year = parseInt(parts[2]) || 2026;
  const cycleEndDate = new Date(year, monthIndex, day);
  // Cutoff is August 15, 2026. Cycles ending AFTER August 15, 2026 use the new salary structure.
  const cutoffDate = new Date(2026, 7, 15);
  return cycleEndDate.getTime() > cutoffDate.getTime();
};

/**
 * Helper to get all runner IDs assigned to or contributing to an order
 */
export const getOrderRunners = (order: Order): string[] => {
  const set = new Set<string>();
  if (order.gamer_id) set.add(order.gamer_id);
  if (order.co_gamer_id) set.add(order.co_gamer_id);
  if (order.assigned_gamer_ids && Array.isArray(order.assigned_gamer_ids)) {
    order.assigned_gamer_ids.forEach(id => { if (id) set.add(id); });
  }
  if (order.daily_progress && Array.isArray(order.daily_progress)) {
    order.daily_progress.forEach(l => { if (l.gamer_id) set.add(l.gamer_id); });
  }
  return Array.from(set);
};

/**
 * Checks if a gamer is assigned to or has logged volume on an order
 */
export const isGamerOnOrder = (order: Order, gamerId: string): boolean => {
  if (order.gamer_id === gamerId || order.co_gamer_id === gamerId) return true;
  if (order.assigned_gamer_ids && order.assigned_gamer_ids.includes(gamerId)) return true;
  if (order.daily_progress && order.daily_progress.some(l => l.gamer_id === gamerId && Number(l.volume_millions) > 0)) return true;
  return false;
};

/**
 * Computes progress summary: total volume made, remaining, percentage, and per-gamer breakdown
 */
export const getOrderProgressSummary = (order: Order) => {
  const size = Number(order.size_millions || 0);
  const logs = order.daily_progress || [];
  
  let totalMade = 0;
  if (logs.length > 0) {
    totalMade = logs.reduce((sum, l) => sum + Number(l.volume_millions || 0), 0);
  } else {
    totalMade = order.status === 'Completed' ? size : Number(order.progress_millions || 0);
  }

  const remaining = Math.max(0, size - totalMade);
  const percentage = size > 0 ? Math.min(100, Math.round((totalMade / size) * 100)) : 0;

  // Breakdown per gamer
  const gamerTotals: Record<string, { volume: number; dayVolume: number; nightVolume: number; homeVolume: number; logsCount: number }> = {};
  
  logs.forEach(log => {
    if (!gamerTotals[log.gamer_id]) {
      gamerTotals[log.gamer_id] = { volume: 0, dayVolume: 0, nightVolume: 0, homeVolume: 0, logsCount: 0 };
    }
    const vol = Number(log.volume_millions || 0);
    gamerTotals[log.gamer_id].volume += vol;
    gamerTotals[log.gamer_id].logsCount += 1;
    if (log.shift === 'day') gamerTotals[log.gamer_id].dayVolume += vol;
    else if (log.shift === 'night') gamerTotals[log.gamer_id].nightVolume += vol;
    else if (log.shift === 'home') gamerTotals[log.gamer_id].homeVolume += vol;
  });

  return {
    totalMade,
    remaining,
    percentage,
    gamerTotals,
    isCompleted: order.status === 'Completed' || (size > 0 && totalMade >= size)
  };
};

/**
 * Calculates the valid completed order count (in 10M units, supporting decimals e.g. 25M = 2.5 orders):
 * - Target Rule: For Orders (26 Target), only count completed orders from the 14th of September 2026 onwards.
 * - Non-completed orders (Running, Paused) or orders completed prior to Sept 14th return 0 for target unit counting.
 * - When daily_progress logs exist, awards units proportional to each runner's actual logged volume (1 unit per 10M, e.g. 25M = 2.5 units).
 * - When no daily_progress logs exist, splits units equally across assigned runners (e.g. 25M solo = 2.5 units).
 */
export const calculateOrderUnits = (order: Order, forGamerId?: string): number => {
  const size = Number(order.size_millions || 0);
  if (size <= 0) return 0;

  // Only count orders that have been Completed
  if (order.status !== 'Completed') {
    return 0;
  }

  const compDate = (order.completed_date || order.start_date || order.created_at || '').slice(0, 10);
  if (!compDate || compDate < '2026-09-14') {
    return 0;
  }

  const assignedRunners = getOrderRunners(order);

  if (forGamerId) {
    if (!isGamerOnOrder(order, forGamerId)) {
      return 0;
    }
  }

  const formatUnits = (val: number): number => {
    // Avoid floating point precision issues, clean to 2 decimal places e.g. 2.5
    return Number((Math.round(val * 100) / 100).toFixed(2));
  };

  // 1. If daily progress logs exist for this order, allocate units based on actual volume contributed!
  const logs = order.daily_progress || [];
  if (logs.length > 0) {
    if (forGamerId) {
      const gamerVolume = logs
        .filter(l => l.gamer_id === forGamerId)
        .reduce((sum, l) => sum + Number(l.volume_millions || 0), 0);
      return formatUnits(gamerVolume / 10);
    } else {
      const totalFarmed = logs.reduce((sum, l) => sum + Number(l.volume_millions || 0), 0);
      return formatUnits(Math.min(size, totalFarmed) / 10);
    }
  }

  // 2. Multi-runner order without daily logs (splits equally among assigned runners)
  if (assignedRunners.length > 1) {
    if (forGamerId) {
      const runnerShareVolume = size / assignedRunners.length;
      return formatUnits(runnerShareVolume / 10);
    } else {
      return formatUnits(size / 10);
    }
  }

  // 3. Single runner
  return formatUnits(size / 10);
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer' | 'gamer'>('admin');
  const [gamerProfile, setGamerProfile] = useState<Gamer | null>(null);
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured);
  const [isMaintenanceMode, setIsMaintenanceModeState] = useState<boolean>(() => {
    const saved = safeLocalStorage.getItem('zampeak_maintenance_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // Default to true (Maintenance Mode ON)
  });

  const setMaintenanceMode = (active: boolean) => {
    setIsMaintenanceModeState(active);
    safeLocalStorage.setItem('zampeak_maintenance_mode', active ? 'true' : 'false');
  };

  // Initialize and check auth session
  useEffect(() => {
    const initializeAuth = async () => {
      setAuthLoading(true);
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          setUser(session?.user ?? null);

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser((prevUser) => {
              if (prevUser?.id === session?.user?.id) return prevUser;
              return session?.user ?? null;
            });
          });

          setAuthLoading(false);
          return () => subscription.unsubscribe();
        } catch (err) {
          console.error('Supabase Auth error, falling back to local auth:', err);
          setIsDemo(true);
          checkLocalSession();
        }
      } else {
        setIsDemo(true);
        checkLocalSession();
      }
      setAuthLoading(false);
    };

    initializeAuth();
  }, []);

  const checkLocalSession = () => {
    const sessionUser = safeSessionStorage.getItem('zampeak_user');
    if (sessionUser) {
      try {
        setUser(JSON.parse(sessionUser));
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setGamers([]);
      setOrders([]);
      setAttendance([]);
      setRole('admin');
      setGamerProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const emailLower = user.email?.toLowerCase() || '';
      const matchedGamer = gamers.find(g => g.email?.toLowerCase() === emailLower);
      const isViewer = emailLower.startsWith('viewer@') || 
                       emailLower.startsWith('auditor@') || 
                       emailLower.startsWith('view@') ||
                       emailLower.includes('+viewer') || 
                       emailLower.includes('+auditor') || 
                       (user.user_metadata as any)?.role === 'viewer' || 
                       (user.user_metadata as any)?.role === 'auditor' ||
                       (user.app_metadata as any)?.role === 'viewer' ||
                       (user.app_metadata as any)?.role === 'auditor';

      if (matchedGamer) {
        setRole('gamer');
        setGamerProfile(matchedGamer);
      } else if (isViewer) {
        setRole('viewer');
        setGamerProfile(null);
      } else {
        setRole('admin');
        setGamerProfile(null);
      }
    }
  }, [gamers, user]);

  const applySept14ResetMigration = (rawOrders: Order[]): Order[] => {
    const migrationDone = safeLocalStorage.getItem('zampeak_orders_reset_sept14_v3');
    if (migrationDone) {
      return rawOrders;
    }

    // Reset existing completed orders so their completed_date is '2026-09-13' (belonging to previous cycle)
    // while keeping their milestone target and progress intact
    const updated = rawOrders.map(o => {
      if (o.status === 'Completed') {
        return {
          ...o,
          completed_date: '2026-09-13'
        };
      }
      return o;
    });

    safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
    safeLocalStorage.setItem('zampeak_orders_reset_sept14_v3', 'true');

    if (!isDemo && isSupabaseConfigured && supabase) {
      const client = supabase;
      rawOrders.filter(o => o.status === 'Completed').forEach(async (o) => {
        try {
          await client.from('orders').update({ completed_date: '2026-09-13' }).eq('id', o.id);
        } catch (e) {}
      });
    }

    return updated;
  };

  const loadData = async () => {
    setLoading(true);
    if (!isDemo && isSupabaseConfigured && supabase) {
      try {
        const { data: gamersData, error: gamersErr } = await supabase
          .from('gamers')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: ordersData, error: ordersErr } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: attendanceData, error: attendanceErr } = await supabase
          .from('attendance')
          .select('*')
          .order('date', { ascending: false });

        if (gamersErr || ordersErr || attendanceErr) {
          console.error('Database read error:', gamersErr?.message || ordersErr?.message || attendanceErr?.message);
          setIsDemo(true);
          loadLocalStorage();
        } else {
          // Merge local cache for unmigrated fields (progress_millions, co_gamer_id, assigned_gamer_ids, daily_progress)
          const savedOrdersStr = safeLocalStorage.getItem('zampeak_orders');
          const localOrdersMap = new Map();
          if (savedOrdersStr) {
            try {
              const parsed: Order[] = JSON.parse(savedOrdersStr);
              parsed.forEach(o => localOrdersMap.set(o.id, o));
            } catch (e) {}
          }

          const mergedOrders = (ordersData || []).map(o => {
            const local = localOrdersMap.get(o.id);
            const assigned = (o.assigned_gamer_ids && o.assigned_gamer_ids.length > 0) 
              ? o.assigned_gamer_ids 
              : (local?.assigned_gamer_ids && local.assigned_gamer_ids.length > 0)
                ? local.assigned_gamer_ids
                : (o.co_gamer_id ? [o.gamer_id, o.co_gamer_id] : [o.gamer_id]);
            const progressLogs = (o.daily_progress && Array.isArray(o.daily_progress))
              ? o.daily_progress
              : (local?.daily_progress && Array.isArray(local.daily_progress))
                ? local.daily_progress
                : [];

            return {
              ...o,
              progress_millions: o.progress_millions !== undefined ? Number(o.progress_millions) : (local?.progress_millions !== undefined ? Number(local.progress_millions) : (o.status === 'Completed' ? Number(o.size_millions) : 0)),
              co_gamer_id: o.co_gamer_id !== undefined ? o.co_gamer_id : (local?.co_gamer_id || null),
              assigned_gamer_ids: assigned,
              daily_progress: progressLogs
            };
          });

          // Also merge attendance shift from local storage if not in DB
          const savedAttStr = safeLocalStorage.getItem('zampeak_attendance');
          const localAttMap = new Map();
          if (savedAttStr) {
            try {
              const parsedAtt: AttendanceRecord[] = JSON.parse(savedAttStr);
              parsedAtt.forEach(a => localAttMap.set(`${a.gamer_id}_${a.date}`, a));
            } catch (e) {}
          }
          const mergedAttendance = (attendanceData || []).map(a => {
            const local = localAttMap.get(`${a.gamer_id}_${a.date}`);
            return {
              ...a,
              shift: a.shift || local?.shift || 'day'
            };
          });

          const finalOrders = applySept14ResetMigration(mergedOrders);

          setGamers(gamersData || []);
          setOrders(finalOrders);
          setAttendance(mergedAttendance);
          safeLocalStorage.setItem('zampeak_orders', JSON.stringify(finalOrders));
          safeLocalStorage.setItem('zampeak_attendance', JSON.stringify(mergedAttendance));
        }
      } catch (err) {
        console.error('Failed to load from Supabase, falling back to local storage:', err);
        setIsDemo(true);
        loadLocalStorage();
      }
    } else {
      loadLocalStorage();
    }
    setLoading(false);
  };

  const loadLocalStorage = () => {
    const savedGamers = safeLocalStorage.getItem('zampeak_gamers');
    const savedOrders = safeLocalStorage.getItem('zampeak_orders');
    const savedAttendance = safeLocalStorage.getItem('zampeak_attendance');

    if (savedGamers && savedOrders) {
      const rawOrders: Order[] = JSON.parse(savedOrders);
      const finalOrders = applySept14ResetMigration(rawOrders);
      setGamers(JSON.parse(savedGamers));
      setOrders(finalOrders);
      setAttendance(savedAttendance ? JSON.parse(savedAttendance) : []);
    } else {
      setGamers([]);
      setOrders([]);
      setAttendance([]);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify([]));
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify([]));
      safeLocalStorage.setItem('zampeak_attendance', JSON.stringify([]));
    }
  };

  const refreshData = async () => {
    if (user) {
      await loadData();
    }
  };

  // Auth Operations
  const signIn = async (emailOrEmpId: string, password: string) => {
    const loginEmail = getEmailFromInput(emailOrEmpId);

    // Maintenance Mode Check: block non-admins from logging in
    if (isMaintenanceMode) {
      const isGamerOrViewer = loginEmail.endsWith('@gamers.zampeak.com') || 
                              loginEmail.startsWith('viewer@') || 
                              loginEmail.startsWith('auditor@');
      if (isGamerOrViewer) {
        return { 
          success: false, 
          error: 'SYSTEM MAINTENANCE ACTIVE: Operator and auditor access is temporarily suspended. Only Central Administration may access the terminal.' 
        };
      }
    }

    if (!isDemo && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        setUser(data.user);
        return { success: true };
      } catch (err: any) {
        console.error('Login error:', err);
        return { success: false, error: err.message };
      }
    } else {
      if (loginEmail === 'admin@zampeak.com' && password === 'admin123') {
        const mockUser = { id: 'demo-user-id', email: loginEmail } as User;
        setUser(mockUser);
        safeSessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
        return { success: true };
      } else if ((loginEmail === 'viewer@zampeak.com' || loginEmail === 'auditor@zampeak.com') && (password === 'viewer123' || password === 'admin123')) {
        const mockUser = { id: 'demo-viewer-id', email: loginEmail, user_metadata: { role: 'viewer' } } as unknown as User;
        setUser(mockUser);
        safeSessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
        return { success: true };
      } else {
        const savedGamers = safeLocalStorage.getItem('zampeak_gamers');
        if (savedGamers) {
          const localGamers: Gamer[] = JSON.parse(savedGamers);
          const matched = localGamers.find(g => g.email?.toLowerCase() === loginEmail.toLowerCase());
          if (matched && password === (matched.default_password || 'gamer123')) {
            if (matched.status === 'inactive') {
              return { 
                success: false, 
                error: 'ACCOUNT INACTIVE: Your operator dossier is marked as inactive (stopped work). Contact Central Administration.' 
              };
            }
            const mockUser = { id: matched.id, email: loginEmail } as User;
            setUser(mockUser);
            safeSessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
            return { success: true };
          }
        }
        return { success: false, error: 'Invalid credentials. Demo admin: admin@zampeak.com / admin123, Demo viewer: viewer@zampeak.com / viewer123, or Gamer employee ID with password.' };
      }
    }
  };

  const signUp = async (emailOrEmpId: string, password: string, defaultPassword?: string) => {
    const signupEmail = getEmailFromInput(emailOrEmpId);
    const isGamer = signupEmail.endsWith('@gamers.zampeak.com');

    if (isGamer) {
      const empId = emailOrEmpId.trim().toUpperCase();

      if (!isDemo && supabase) {
        try {
          const { data, error } = await supabase.rpc('verify_gamer_registration', {
            p_employee_id: empId,
            p_default_password: defaultPassword || ''
          });
          
          if (error) throw error;
          
          const verification = data as { success: boolean; error?: string };
          if (!verification.success) {
            return { success: false, error: verification.error };
          }
        } catch (err: any) {
          return { success: false, error: `Database validation error: ${err.message}` };
        }
      } else {
        const savedGamers = safeLocalStorage.getItem('zampeak_gamers');
        let matchedGamer: Gamer | undefined = undefined;
        if (savedGamers) {
          const localGamers: Gamer[] = JSON.parse(savedGamers);
          matchedGamer = localGamers.find(g => g.employee_id.toUpperCase() === empId);
        }

        // Gamer validation rules locally
        if (!matchedGamer) {
          return { success: false, error: `Employee ID "${empId}" is not registered in the system. Contact Admin.` };
        }

        if (!matchedGamer.default_password) {
          return { success: false, error: `Employee ID "${empId}" is already registered. Please Sign In.` };
        }

        if (matchedGamer.default_password !== defaultPassword) {
          return { success: false, error: 'Invalid default password code provided by Admin.' };
        }
      }
    }

    if (!isDemo && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({ email: signupEmail, password });
        if (error) throw error;
        if (data.user) {
          setUser(data.user);
          // Securely clear default password in gamers table after successful signup!
          const empId = emailOrEmpId.trim().toUpperCase();
          await supabase.from('gamers').update({ default_password: null }).eq('employee_id', empId);
        }
        return { success: true };
      } catch (err: any) {
        console.error('Registration error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const mockUser = { id: Math.random().toString(), email: signupEmail } as User;
      setUser(mockUser);
      safeSessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));

      // Clear local default password
      const empId = emailOrEmpId.trim().toUpperCase();
      const updatedGamers = gamers.map(g => g.employee_id === empId ? { ...g, default_password: '' } : g);
      setGamers(updatedGamers);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updatedGamers));

      return { success: true };
    }
  };

  const signOut = async () => {
    if (!isDemo && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Logout error:', err);
      }
    } else {
      safeSessionStorage.removeItem('zampeak_user');
    }
    setUser(null);
  };

  const updatePassword = async (newPassword: string) => {
    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        
        if (role === 'gamer' && gamerProfile) {
          await supabase.from('gamers').update({ default_password: null }).eq('id', gamerProfile.id);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    } else {
      if (role === 'gamer' && gamerProfile) {
        const updated = gamers.map(g => g.id === gamerProfile.id ? { ...g, default_password: '' } : g);
        setGamers(updated);
        safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      }
      return { success: true };
    }
  };

  const resetGamerPassword = async (id: string, newPassword: string) => {
    if (!isDemo) {
      try {
        const response = await fetch('/api/reset-gamer-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id, newPassword }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to reset password');
        }

        setGamers((prev) =>
          prev.map((g) => (g.id === id ? { ...g, default_password: newPassword } : g))
        );
        return { success: true };
      } catch (err: any) {
        console.error('API error, resetting password:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = gamers.map((g) => (g.id === id ? { ...g, default_password: newPassword } : g));
      setGamers(updated);
      localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  // Gamers operations
  const addGamer = async (
    name: string, 
    employeeId: string, 
    defaultPassword: string, 
    level: GamerLevel,
    gamerRole: GamerRole,
    teamLeaderId: string | null,
    phone?: string
  ) => {
    if (!isDemo) {
      try {
        const response = await fetch('/api/create-gamer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            name, 
            employeeId, 
            defaultPassword, 
            phone,
            level,
            gamer_role: gamerRole,
            team_leader_id: teamLeaderId
          }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to create gamer');
        }

        setGamers((prev) => [data.gamer, ...prev]);
        return { success: true };
      } catch (err: any) {
        console.error('API error, adding gamer:', err);
        return { success: false, error: err.message };
      }
    } else {
      const cleanEmpId = employeeId.trim().toUpperCase();
      const syntheticEmail = `${cleanEmpId.toLowerCase()}@gamers.zampeak.com`;
      const newGamer: Gamer = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        name,
        employee_id: cleanEmpId,
        email: syntheticEmail,
        default_password: defaultPassword,
        phone: phone || '',
        status: 'active',
        level,
        gamer_role: gamerRole,
        team_leader_id: teamLeaderId,
        created_at: new Date().toISOString(),
      };
      const updated = [newGamer, ...gamers];
      setGamers(updated);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  const updateGamer = async (
    id: string,
    name: string,
    employeeId: string,
    level: GamerLevel,
    gamerRole: GamerRole,
    teamLeaderId: string | null,
    defaultPassword?: string,
    phone?: string,
    status?: 'active' | 'inactive'
  ) => {
    const cleanEmpId = employeeId.trim().toUpperCase();
    const syntheticEmail = `${cleanEmpId.toLowerCase()}@gamers.zampeak.com`;

    if (!isDemo && supabase) {
      try {
        const updates: Partial<Gamer> = { 
          name, 
          employee_id: cleanEmpId, 
          email: syntheticEmail,
          level,
          gamer_role: gamerRole,
          team_leader_id: teamLeaderId,
          phone: phone || '' 
        };
        if (defaultPassword) updates.default_password = defaultPassword;
        if (status) updates.status = status;

        const { error } = await supabase.from('gamers').update(updates).eq('id', id);
        if (error) throw error;

        setGamers((prev) =>
          prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
        );
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, updating gamer:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = gamers.map((g) =>
        g.id === id
          ? { 
              ...g, 
              name, 
              employee_id: cleanEmpId, 
              email: syntheticEmail,
              default_password: defaultPassword || g.default_password,
              phone: phone || '', 
              status: status || g.status,
              level,
              gamer_role: gamerRole,
              team_leader_id: teamLeaderId
            }
          : g
      );
      setGamers(updated);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  const toggleGamerStatus = async (id: string, newStatus: 'active' | 'inactive') => {
    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('gamers').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        setGamers((prev) =>
          prev.map((g) => (g.id === id ? { ...g, status: newStatus } : g))
        );
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, updating gamer status:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = gamers.map((g) => (g.id === id ? { ...g, status: newStatus } : g));
      setGamers(updated);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  const deleteGamer = async (id: string) => {
    const hasOrders = orders.some((o) => o.gamer_id === id);
    if (hasOrders) {
      return { success: false, error: 'Cannot delete gamer who has assigned orders. Deactivate them instead.' };
    }

    if (!isDemo) {
      try {
        const response = await fetch('/api/delete-gamer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || 'Failed to delete gamer');
        }

        setGamers((prev) => prev.filter((g) => g.id !== id));
        return { success: true };
      } catch (err: any) {
        console.error('API error, deleting gamer:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = gamers.filter((g) => g.id !== id);
      setGamers(updated);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  // Orders operations
  const addOrder = async (
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number,
    progressMillions?: number,
    coGamerId?: string | null,
    assignedGamerIds?: string[],
    dailyProgress?: OrderDailyProgress[]
  ) => {
    const defaultPayout = sizeMillions;
    const finalPayout = payoutOverride !== undefined ? payoutOverride : defaultPayout;

    const todayDateStr = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const completedDate = status === 'Completed' ? todayDateStr() : undefined;

    const resolvedAssigned: string[] = assignedGamerIds && assignedGamerIds.length > 0
      ? Array.from(new Set(assignedGamerIds))
      : Array.from(new Set([gamerId, ...(coGamerId ? [coGamerId] : [])]));

    const finalPrimaryGamer = resolvedAssigned[0] || gamerId;
    const finalCoGamer = resolvedAssigned.length > 1 ? resolvedAssigned[1] : (coGamerId || null);

    const initialLogs = dailyProgress || [];
    const calculatedProgress = initialLogs.length > 0
      ? initialLogs.reduce((s, l) => s + Number(l.volume_millions || 0), 0)
      : (progressMillions !== undefined ? progressMillions : (status === 'Completed' ? sizeMillions : 0));

    const newOrder: Order = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      order_number: orderNumber,
      gamer_id: finalPrimaryGamer,
      co_gamer_id: finalCoGamer,
      assigned_gamer_ids: resolvedAssigned,
      size_millions: sizeMillions,
      progress_millions: calculatedProgress,
      daily_progress: initialLogs,
      asset_type: assetType,
      start_date: startDate || new Date().toISOString(),
      status,
      payout: finalPayout,
      completed_date: completedDate,
      created_at: new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        let { error } = await supabase.from('orders').insert([newOrder]);
        if (error && (
          error.message?.includes('assigned_gamer_ids') || 
          error.message?.includes('daily_progress') || 
          error.message?.includes('co_gamer_id') || 
          error.message?.includes('progress_millions') || 
          error.message?.includes('schema cache')
        )) {
          // Graceful fallback retry if custom columns haven't been added to Supabase table yet
          const fallbackOrder: any = { ...newOrder };
          delete fallbackOrder.assigned_gamer_ids;
          delete fallbackOrder.daily_progress;
          delete fallbackOrder.co_gamer_id;
          delete fallbackOrder.progress_millions;
          const retryRes = await supabase.from('orders').insert([fallbackOrder]);
          error = retryRes.error;
        }
        if (error) throw error;
        setOrders((prev) => {
          const updated = [newOrder, ...prev];
          safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
          return updated;
        });
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, adding order:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = [newOrder, ...orders];
      setOrders(updated);
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const updateOrder = async (
    id: string,
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number,
    progressMillions?: number,
    coGamerId?: string | null,
    assignedGamerIds?: string[],
    dailyProgress?: OrderDailyProgress[]
  ) => {
    const defaultPayout = sizeMillions;
    const finalPayout = payoutOverride !== undefined ? payoutOverride : defaultPayout;

    const existing = orders.find(o => o.id === id);
    const todayDateStr = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const completedDate = status === 'Completed' 
      ? (existing?.completed_date || todayDateStr()) 
      : undefined;

    const resolvedAssigned: string[] = assignedGamerIds && assignedGamerIds.length > 0
      ? Array.from(new Set(assignedGamerIds))
      : (coGamerId !== undefined 
          ? Array.from(new Set([gamerId, ...(coGamerId ? [coGamerId] : [])]))
          : (existing?.assigned_gamer_ids || [gamerId]));

    const finalPrimaryGamer = resolvedAssigned[0] || gamerId;
    const finalCoGamer = resolvedAssigned.length > 1 ? resolvedAssigned[1] : (coGamerId !== undefined ? coGamerId : (existing?.co_gamer_id || null));
    const finalDailyProgress = dailyProgress !== undefined ? dailyProgress : (existing?.daily_progress || []);

    const finalProgress = progressMillions !== undefined 
      ? progressMillions 
      : (finalDailyProgress.length > 0 
          ? finalDailyProgress.reduce((s, l) => s + Number(l.volume_millions || 0), 0)
          : (status === 'Completed' ? sizeMillions : (existing?.progress_millions || 0)));

    if (!isDemo && supabase) {
      try {
        const updates: any = {
          order_number: orderNumber,
          gamer_id: finalPrimaryGamer,
          co_gamer_id: finalCoGamer,
          assigned_gamer_ids: resolvedAssigned,
          daily_progress: finalDailyProgress,
          size_millions: sizeMillions,
          progress_millions: finalProgress,
          asset_type: assetType,
          start_date: startDate,
          status,
          payout: finalPayout,
          completed_date: completedDate || null
        };

        let { error } = await supabase.from('orders').update(updates).eq('id', id);
        if (error && (
          error.message?.includes('assigned_gamer_ids') || 
          error.message?.includes('daily_progress') || 
          error.message?.includes('co_gamer_id') || 
          error.message?.includes('progress_millions') || 
          error.message?.includes('schema cache')
        )) {
          // Graceful fallback retry if custom columns haven't been added to Supabase table yet
          delete updates.assigned_gamer_ids;
          delete updates.daily_progress;
          delete updates.co_gamer_id;
          delete updates.progress_millions;
          const retryRes = await supabase.from('orders').update(updates).eq('id', id);
          error = retryRes.error;
        }
        if (error) throw error;

        setOrders((prev) => {
          const updated = prev.map((o) => (o.id === id ? { 
            ...o, 
            ...updates, 
            gamer_id: finalPrimaryGamer,
            co_gamer_id: finalCoGamer,
            assigned_gamer_ids: resolvedAssigned,
            daily_progress: finalDailyProgress,
            progress_millions: finalProgress, 
            completed_date: completedDate || undefined 
          } : o));
          safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
          return updated;
        });
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, updating order:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = orders.map((o) =>
        o.id === id
          ? {
              ...o,
              order_number: orderNumber,
              gamer_id: finalPrimaryGamer,
              co_gamer_id: finalCoGamer,
              assigned_gamer_ids: resolvedAssigned,
              daily_progress: finalDailyProgress,
              size_millions: sizeMillions,
              progress_millions: finalProgress,
              asset_type: assetType,
              start_date: startDate,
              status,
              payout: finalPayout,
              completed_date: completedDate || undefined
            }
          : o
      );
      setOrders(updated);
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const deleteOrder = async (id: string) => {
    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw error;
        setOrders((prev) => prev.filter((o) => o.id !== id));
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, deleting order:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = orders.filter((o) => o.id !== id);
      setOrders(updated);
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${yyyy}-${mm}-${dd}`;
    const completedDate = status === 'Completed' ? todayDateStr : null;

    if (!isDemo && supabase) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status, completed_date: completedDate })
          .eq('id', id);
        if (error) throw error;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status, completed_date: completedDate || undefined } : o))
        );
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, updating status:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = orders.map((o) => (o.id === id ? { ...o, status, completed_date: completedDate || undefined } : o));
      setOrders(updated);
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const logOrderDailyProgress = async (
    orderId: string,
    entry: Omit<OrderDailyProgress, 'id' | 'order_id' | 'created_at'>
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    const newLogId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
    const newLog: OrderDailyProgress = {
      id: newLogId,
      order_id: orderId,
      gamer_id: entry.gamer_id,
      date: entry.date,
      shift: entry.shift || 'day',
      volume_millions: Number(entry.volume_millions || 0),
      notes: entry.notes || '',
      created_at: new Date().toISOString()
    };

    const currentLogs = order.daily_progress || [];
    const updatedLogs = [...currentLogs, newLog];
    const newTotalMade = updatedLogs.reduce((sum, l) => sum + Number(l.volume_millions || 0), 0);

    // Ensure the contributing gamer is registered in assigned_gamer_ids
    const currentAssigned = getOrderRunners(order);
    const updatedAssigned = currentAssigned.includes(entry.gamer_id) ? currentAssigned : [...currentAssigned, entry.gamer_id];

    // Auto-complete if total made reaches or exceeds order size
    const newStatus = (newTotalMade >= order.size_millions && order.status === 'Running') ? 'Completed' : order.status;

    return await updateOrder(
      order.id,
      order.order_number,
      updatedAssigned[0] || order.gamer_id,
      order.size_millions,
      order.asset_type,
      order.start_date,
      newStatus,
      order.payout,
      newTotalMade,
      updatedAssigned[1] || null,
      updatedAssigned,
      updatedLogs
    );
  };

  const deleteOrderDailyProgress = async (orderId: string, logId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    const currentLogs = order.daily_progress || [];
    const updatedLogs = currentLogs.filter((l) => l.id !== logId);
    const newTotalMade = updatedLogs.reduce((sum, l) => sum + Number(l.volume_millions || 0), 0);

    return await updateOrder(
      order.id,
      order.order_number,
      order.gamer_id,
      order.size_millions,
      order.asset_type,
      order.start_date,
      order.status,
      order.payout,
      newTotalMade,
      order.co_gamer_id || null,
      order.assigned_gamer_ids,
      updatedLogs
    );
  };

  const saveAttendance = async (
    gamerId: string, 
    date: string, 
    status: AttendanceStatus, 
    farmedMillions?: number,
    normalOvertimeHours?: number,
    holidayOvertimeHours?: number,
    shift?: ShiftType
  ) => {
    const existingRecord = attendance.find(a => a.gamer_id === gamerId && a.date === date);
    const targetGamer = gamers.find(g => g.id === gamerId);
    const currentTeamLeaderId = existingRecord?.team_leader_id !== undefined 
      ? existingRecord.team_leader_id 
      : (targetGamer?.team_leader_id || null);

    const finalStatus = status;
    const finalShift = shift || existingRecord?.shift || 'day';
    const finalFarmedMillions = farmedMillions !== undefined ? farmedMillions : (existingRecord?.farmed_millions || 0);
    const finalNormalOT = normalOvertimeHours !== undefined ? normalOvertimeHours : (existingRecord?.normal_overtime_hours || 0);
    const finalHolidayOT = holidayOvertimeHours !== undefined ? holidayOvertimeHours : (existingRecord?.holiday_overtime_hours || 0);

    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
      gamer_id: gamerId,
      date,
      status: finalStatus,
      shift: finalShift,
      farmed_millions: finalFarmedMillions,
      normal_overtime_hours: finalNormalOT,
      holiday_overtime_hours: finalHolidayOT,
      team_leader_id: currentTeamLeaderId,
      created_at: existingRecord?.created_at || new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        const payload: any = {
          gamer_id: gamerId,
          date,
          status: finalStatus,
          shift: finalShift,
          farmed_millions: finalFarmedMillions,
          normal_overtime_hours: finalNormalOT,
          holiday_overtime_hours: finalHolidayOT,
          created_at: new Date().toISOString()
        };
        if (currentTeamLeaderId) {
          payload.team_leader_id = currentTeamLeaderId;
        }

        let { data, error } = await supabase
          .from('attendance')
          .upsert(payload, { onConflict: 'gamer_id,date' })
          .select();

        if (error && (
          error.message?.includes('shift') || 
          error.message?.includes('overtime') || 
          error.message?.includes('team_leader_id') || 
          error.message?.includes('schema cache')
        )) {
          // Graceful fallback retry if shift/overtime/team_leader_id columns are not yet in Supabase table
          const fallbackPayload: any = {
            gamer_id: gamerId,
            date,
            status: finalStatus,
            farmed_millions: finalFarmedMillions,
            created_at: new Date().toISOString()
          };
          const retryRes = await supabase
            .from('attendance')
            .upsert(fallbackPayload, { onConflict: 'gamer_id,date' })
            .select();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) throw error;
        
        setAttendance((prev) => {
          const filtered = prev.filter((a) => !(a.gamer_id === gamerId && a.date === date));
          const upserted = data && data[0] ? { ...newRecord, ...data[0] } : newRecord;
          const updated = [upserted, ...filtered];
          safeLocalStorage.setItem('zampeak_attendance', JSON.stringify(updated));
          return updated;
        });

        return { success: true };
      } catch (err: any) {
        console.error('Supabase attendance save error:', err);
        return { success: false, error: err.message };
      }
    } else {
      setAttendance((prev) => {
        const filtered = prev.filter((a) => !(a.gamer_id === gamerId && a.date === date));
        const updated = [newRecord, ...filtered];
        safeLocalStorage.setItem('zampeak_attendance', JSON.stringify(updated));
        return updated;
      });
      return { success: true };
    }
  };

  const calculatePayroll = (gamerId: string, cycleLabel: string): PayrollSummary => {
    const gamer = gamers.find((g) => g.id === gamerId);
    
    // Default empty payroll
    const emptyPayroll: PayrollSummary = {
      gamerId,
      gamerName: gamer?.name || 'Unknown',
      employeeId: gamer?.employee_id || 'N/A',
      gamerRole: gamer?.gamer_role || 'gamer',
      level: gamer?.level || 'beginner',
      baseSalary: 0,
      dailyRate: 0,
      daysWorked: 0,
      daysAbsent: 0,
      onTimeDays: 0,
      basePayEarned: 0,
      deductions: 0,
      lateDeduction: 0,
      attendanceBonus: 0,
      orderBonus: 0,
      teamVolumeBonus: 0,
      totalPay: 0,
      isNewStructure: false,
      topRunnerBonus: 0,
    };

    if (!gamer) return emptyPayroll;

    const isNew = isNewSalaryStructureCycle(cycleLabel);

    // 2. Filter Attendance in Cycle
    const cycleAttendance = attendance.filter(
      (a) => a.gamer_id === gamerId && getAttendancePeriodLabel(a.date) === cycleLabel
    );

    const daysWorked = cycleAttendance.filter(
      (a) => a.status === 'present_on_time' || a.status === 'present_late'
    ).length;
    
    const daysAbsent = cycleAttendance.filter((a) => a.status === 'absent').length;
    const onTimeDays = cycleAttendance.filter((a) => a.status === 'present_on_time').length;
    const cappedDaysWorked = Math.min(26, daysWorked);

    // 3. Orders in cycle & completed orders count (10M = 1 completed order)
    let completedOrdersCount = 0;
    if (isNew) {
      const gamerOrdersInCycle = orders.filter((o) => {
        if (!isGamerOnOrder(o, gamerId)) return false;
        if (o.status === 'Completed') {
          const compDate = (o.completed_date || o.start_date || o.created_at || '').slice(0, 10);
          if (!compDate || compDate < '2026-09-14') {
            return false;
          }
          return getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel;
        }
        return false;
      });

      completedOrdersCount = Number((gamerOrdersInCycle.reduce((sum, o) => sum + calculateOrderUnits(o, gamerId), 0)).toFixed(2));
    } else {
      const legacyCompleted = orders.filter(
        (o) => isGamerOnOrder(o, gamerId) && o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel
      );
      completedOrdersCount = legacyCompleted.length;
    }

    // =========================================================================
    // NEW SALARY STRUCTURE (Effective from 16th August 2026 / Cycle Sep 15, 2026+)
    // =========================================================================
    if (isNew) {
      if (gamer.gamer_role === 'technical_manager') {
        const baseSalary = 4500;
        const dailyRate = baseSalary / 26;
        const basePayEarned = cappedDaysWorked * dailyRate;
        const deductions = Math.max(0, baseSalary - basePayEarned);
        const totalPay = Number(basePayEarned.toFixed(2));
        return {
          gamerId,
          gamerName: gamer.name,
          employeeId: gamer.employee_id,
          gamerRole: gamer.gamer_role,
          level: gamer.level,
          baseSalary,
          dailyRate,
          daysWorked,
          daysAbsent,
          onTimeDays,
          basePayEarned,
          deductions,
          lateDeduction: 0,
          attendanceBonus: 0,
          orderBonus: 0,
          teamVolumeBonus: 0,
          totalPay,
          isNewStructure: true,
          responsibilitySalary: baseSalary,
          attendanceSalary: 0,
          transportAllowance: 0,
          excessOrderIncentive: 0,
          topRunnerBonus: 0,
          completedOrdersCount,
          excessOrdersCount: 0,
          teamIncentive: 0,
          teamLeaderManagementAllowance: 0,
          additionalPerformanceAward: 0,
          teamCompletionRate: 1.0
        };
      }

      // Runners & Team Leaders use the unified production salary system
      const baseSalary = 900; // Responsibility Target Base (26 orders)
      const dailyRate = 900 / 26;

      // A. Responsibility Salary: K900 × MIN(validOrders / 26, 1.0)
      const responsibilitySalary = Number((900 * Math.min(1.0, completedOrdersCount / 26)).toFixed(2));

      // B. Attendance Salary: K200 × MIN(attendanceDays / 26, 1.0)
      const attendanceSalary = Number((200 * Math.min(1.0, cappedDaysWorked / 26)).toFixed(2));

      // C. Transport Allowance: K10 / actual attendance day
      const transportAllowance = Number((10 * daysWorked).toFixed(2));

      // D. Excess Order Incentive (Progressive Tiers from 27th order onwards)
      // Tier 1: 27–39 orders @ K40
      // Tier 2: 40–52 orders @ K45
      // Tier 3: 53–65 orders @ K50
      // Tier 4: 66+ orders @ K50
      let excessOrderIncentive = 0;
      let remainingExcess = Math.max(0, completedOrdersCount - 26);
      const excessOrdersCount = remainingExcess;

      // Tier 1: Orders 27–39 (up to 13 orders @ K40)
      const tier1 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier1 * 40;
      remainingExcess -= tier1;

      // Tier 2: Orders 40–52 (up to 13 orders @ K45)
      const tier2 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier2 * 45;
      remainingExcess -= tier2;

      // Tier 3: Orders 53–65 (up to 13 orders @ K50)
      const tier3 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier3 * 50;
      remainingExcess -= tier3;

      // Tier 4: Orders 66+ (remaining @ K50)
      if (remainingExcess > 0) {
        excessOrderIncentive += remainingExcess * 50;
      }
      excessOrderIncentive = Number(excessOrderIncentive.toFixed(2));

      // E. Team Leader Management Allowance: K200/month (prorated by attendance/26)
      let teamLeaderManagementAllowance = 0;
      if (gamer.gamer_role === 'team_leader') {
        teamLeaderManagementAllowance = Number((200 * Math.min(1.0, cappedDaysWorked / 26)).toFixed(2));
      }

      // F. Team Incentive: Activated only when every active team member reaches >= 26 orders
      let teamIncentive = 0;
      let teamCompletionRate = 0;
      const targetLeaderId = gamer.gamer_role === 'team_leader' ? gamerId : gamer.team_leader_id;

      if (targetLeaderId) {
        const teamMembers = gamers.filter(g => g.team_leader_id === targetLeaderId && g.status === 'active');
        const leaderGamer = gamers.find(g => g.id === targetLeaderId);
        const allTeamGamers = leaderGamer ? [leaderGamer, ...teamMembers] : teamMembers;

        if (allTeamGamers.length > 0) {
          const teamMemberStats = allTeamGamers.map(m => {
            const mOrders = orders.filter((o) => {
              if (!isGamerOnOrder(o, m.id)) return false;
              if (o.status === 'Completed') {
                const compDate = (o.completed_date || o.start_date || o.created_at || '').slice(0, 10);
                if (!compDate || compDate < '2026-09-14') {
                  return false;
                }
                return getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel;
              }
              return false;
            });
            const count = Number((mOrders.reduce((sum, o) => sum + calculateOrderUnits(o, m.id), 0)).toFixed(2));
            return { gamer: m, count };
          });

          // Condition: Every member must complete at least 26 orders
          const allMembersMetTarget = teamMemberStats.every(item => item.count >= 26);
          const totalTeamOrders = teamMemberStats.reduce((sum, item) => sum + item.count, 0);
          const teamTargetOrders = 26 * teamMemberStats.length;
          teamCompletionRate = teamTargetOrders > 0 ? Number((totalTeamOrders / teamTargetOrders).toFixed(4)) : 0;

          if (allMembersMetTarget) {
            const isLeader = gamer.gamer_role === 'team_leader';
            if (teamCompletionRate >= 1.20) {
              teamIncentive = isLeader ? 300 : 150;
            } else if (teamCompletionRate >= 1.10) {
              teamIncentive = isLeader ? 200 : 100;
            } else if (teamCompletionRate >= 1.00) {
              teamIncentive = isLeader ? 100 : 50;
            }
          }
        }
      }

      // G. Additional Performance Award (Manual bonus adjustment)
      const additionalPerformanceAward = gamer.bonus_adjustment || 0;

      // G2. Top Runner Bonus: The runner who completes the highest number of valid orders in a month receives an additional K300 bonus.
      let topRunnerBonus = 0;
      const orderRunners = gamers.filter(g => g.gamer_role !== 'technical_manager');
      let maxOrdersInCycle = 0;
      for (const runner of orderRunners) {
        const runnerOrders = orders.filter((o) => {
          if (!isGamerOnOrder(o, runner.id)) return false;
          if (o.status === 'Completed') {
            const compDate = (o.completed_date || o.start_date || o.created_at || '').slice(0, 10);
            if (!compDate || compDate < '2026-09-14') return false;
            return getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel;
          }
          return false;
        });
        const count = Number((runnerOrders.reduce((sum, o) => sum + calculateOrderUnits(o, runner.id), 0)).toFixed(2));
        if (count > maxOrdersInCycle) {
          maxOrdersInCycle = count;
        }
      }

      if (maxOrdersInCycle > 0 && completedOrdersCount >= maxOrdersInCycle) {
        topRunnerBonus = 300;
      }

      // H. Overtime Pay: Base K900 / 208 hrs ≈ K4.33 / hr
      const normalOvertimeHours = cycleAttendance.reduce((sum, a) => sum + Number(a.normal_overtime_hours || 0), 0);
      const holidayOvertimeHours = cycleAttendance.reduce((sum, a) => sum + Number(a.holiday_overtime_hours || 0), 0);
      const hourlyRate = 900 / 208; // ~4.327 K/hr
      const normalOvertimePay = normalOvertimeHours * hourlyRate * 1.5;
      const holidayOvertimePay = holidayOvertimeHours * hourlyRate * 2.0;
      const overtimePay = Number((normalOvertimePay + holidayOvertimePay).toFixed(2));

      // Base Pay Earned: Responsibility + Attendance + Transport
      const basePayEarned = Number((responsibilitySalary + attendanceSalary + transportAllowance).toFixed(2));
      const deductions = Math.max(0, 900 - responsibilitySalary) + Math.max(0, 200 - attendanceSalary);

      const totalPay = Number((
        responsibilitySalary + 
        attendanceSalary + 
        transportAllowance + 
        excessOrderIncentive + 
        topRunnerBonus +
        teamLeaderManagementAllowance + 
        teamIncentive + 
        additionalPerformanceAward +
        overtimePay
      ).toFixed(2));

      return {
        gamerId,
        gamerName: gamer.name,
        employeeId: gamer.employee_id,
        gamerRole: gamer.gamer_role,
        level: gamer.level,
        baseSalary,
        dailyRate,
        daysWorked,
        daysAbsent,
        onTimeDays,
        basePayEarned,
        deductions,
        lateDeduction: 0,
        attendanceBonus: attendanceSalary,
        orderBonus: excessOrderIncentive,
        teamVolumeBonus: teamIncentive + teamLeaderManagementAllowance,
        totalPay,
        isNewStructure: true,
        responsibilitySalary,
        attendanceSalary,
        transportAllowance,
        excessOrderIncentive,
        topRunnerBonus,
        completedOrdersCount,
        excessOrdersCount,
        teamIncentive,
        teamLeaderManagementAllowance,
        additionalPerformanceAward,
        teamCompletionRate,
        normalOvertimeHours,
        holidayOvertimeHours,
        overtimePay
      };
    }

    // =========================================================================
    // LEGACY SALARY STRUCTURE (Before August 16, 2026 / August 15, 2026 & prior)
    // =========================================================================
    let baseSalary = 1200;
    if (gamer.gamer_role === 'technical_manager') {
      baseSalary = 4500;
    } else {
      if (gamer.level === 'intermediate') baseSalary = 1800;
      else if (gamer.level === 'advanced') baseSalary = 2500;
    }

    const dailyRate = baseSalary / 26;
    const presentDaysForBase = Math.min(26, daysWorked);
    const basePayEarned = presentDaysForBase * dailyRate;
    const lateDeduction = 0;
    const missedDaysDeductions = Math.max(0, baseSalary - basePayEarned);
    const deductions = missedDaysDeductions;
    const attendanceBonus = onTimeDays >= 26 ? 200 : 0;
    const legacyCompleted = orders.filter(
      (o) => (o.gamer_id === gamerId || o.co_gamer_id === gamerId) && o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel
    );
    const orderBonus = legacyCompleted.reduce((sum, o) => sum + (o.co_gamer_id ? o.payout / 2 : o.payout), 0);

    let teamVolumeBonus = 0;
    if (gamer.gamer_role === 'team_leader') {
      const currentTeamMembers = gamers.filter((g) => g.team_leader_id === gamerId);
      const currentTeamGamerIds = currentTeamMembers.map((m) => m.id);

      const teamAttendance = attendance.filter((a) => {
        if (getAttendancePeriodLabel(a.date) !== cycleLabel) return false;
        if (a.gamer_id === gamerId) return true;
        if (a.team_leader_id !== undefined && a.team_leader_id !== null) {
          return a.team_leader_id === gamerId;
        }
        return currentTeamGamerIds.includes(a.gamer_id);
      });

      const dailyTotals: { [dateStr: string]: number } = {};
      teamAttendance.forEach((a) => {
        dailyTotals[a.date] = (dailyTotals[a.date] || 0) + Number(a.farmed_millions || 0);
      });

      Object.values(dailyTotals).forEach((total) => {
        if (total > 50) {
          const over = total - 50;
          const tens = Math.floor(over / 10);
          if (tens > 0) {
            teamVolumeBonus += tens * 10;
          }
        }
      });

      const nameLower = (gamer.name || '').toLowerCase();
      const isGilbert = nameLower.includes('gilbert') || nameLower.includes('phiri');
      const bonusAdjustment = gamer.bonus_adjustment !== undefined ? gamer.bonus_adjustment : (isGilbert ? 40 : 0);
      teamVolumeBonus += bonusAdjustment;
    }

    const totalPay = Number(Math.max(0, basePayEarned - lateDeduction + attendanceBonus + orderBonus + teamVolumeBonus).toFixed(2));

    return {
      gamerId,
      gamerName: gamer.name,
      employeeId: gamer.employee_id,
      gamerRole: gamer.gamer_role,
      level: gamer.level,
      baseSalary,
      dailyRate,
      daysWorked,
      daysAbsent,
      onTimeDays,
      basePayEarned,
      deductions,
      lateDeduction,
      attendanceBonus,
      orderBonus,
      teamVolumeBonus,
      totalPay,
      isNewStructure: false,
    };
  };

  const getDailyGamerEarnings = (cycleLabel: string, targetGamerId?: string): DailyGamerEarnings[] => {
    // 1. Get cycle attendance records
    const cycleAttendance = attendance.filter(
      (a) => getAttendancePeriodLabel(a.date) === cycleLabel
    );

    // Get all unique dates in the cycle attendance records or completed orders or order daily progress
    const datesSet = new Set<string>();
    cycleAttendance.forEach((a) => datesSet.add(a.date));
    
    orders.forEach((o) => {
      if (o.status === 'Completed') {
        const compDate = (o.completed_date || o.start_date || '').slice(0, 10);
        if (compDate && getOrderPeriodLabel(compDate) === cycleLabel) {
          datesSet.add(compDate);
        }
      }
      if (o.daily_progress && Array.isArray(o.daily_progress)) {
        o.daily_progress.forEach((log) => {
          if (log.date) {
            const logDate = log.date.slice(0, 10);
            if (getOrderPeriodLabel(logDate) === cycleLabel) {
              datesSet.add(logDate);
            }
          }
        });
      }
    });

    const uniqueDates = Array.from(datesSet).sort().reverse();
    const activeGamers = targetGamerId
      ? gamers.filter((g) => g.id === targetGamerId)
      : gamers.filter((g) => g.status === 'active');

    const result: DailyGamerEarnings[] = [];

    const isNewCycle = isNewSalaryStructureCycle(cycleLabel);

    uniqueDates.forEach((dateStr) => {
      const isNewDate = dateStr >= '2026-08-16';

      activeGamers.forEach((gamer) => {
        // Attendance record for gamer on this date
        const att = attendance.find((a) => a.gamer_id === gamer.id && a.date === dateStr);
        const attendanceStatus = att ? att.status : 'no_log';
        const isPresent = att && (att.status === 'present_on_time' || att.status === 'present_late');

        // Find completed orders for this gamer on this date (including shared / multi-runner orders)
        const gamerCompletedOrders = orders.filter(
          (o) => isGamerOnOrder(o, gamer.id) &&
                 o.status === 'Completed' &&
                 ((o.completed_date?.slice(0, 10) || o.start_date?.slice(0, 10)) === dateStr)
        );
        let orderBonus = gamerCompletedOrders.reduce((sum, o) => {
          const size = Number(o.size_millions || 0);
          const payout = Number(o.payout || 0);
          if (o.daily_progress && o.daily_progress.length > 0) {
            const gamerVol = o.daily_progress.filter(l => l.gamer_id === gamer.id).reduce((s, l) => s + Number(l.volume_millions || 0), 0);
            return sum + (size > 0 ? (gamerVol / size) * payout : 0);
          }
          const runners = getOrderRunners(o);
          return sum + (runners.length > 0 ? payout / runners.length : payout);
        }, 0);

        // Farmed volume calculation directly from orders:
        // 1. Direct daily progress entries logged by this gamer on this date across all orders
        let orderFarmedMillions = 0;
        let hasOrderProgressLogs = false;

        orders.forEach((o) => {
          if (o.daily_progress && Array.isArray(o.daily_progress)) {
            const dayLogs = o.daily_progress.filter((l) => l.gamer_id === gamer.id && l.date?.slice(0, 10) === dateStr);
            if (dayLogs.length > 0) {
              hasOrderProgressLogs = true;
              orderFarmedMillions += dayLogs.reduce((s, l) => s + Number(l.volume_millions || 0), 0);
            }
          }
        });

        // 2. Fallback: If no daily progress was logged on this date, check completed orders on this date without daily progress logs
        if (!hasOrderProgressLogs && gamerCompletedOrders.length > 0) {
          gamerCompletedOrders.forEach((o) => {
            if (!o.daily_progress || o.daily_progress.length === 0) {
              const runners = getOrderRunners(o);
              const size = Number(o.size_millions || 0);
              orderFarmedMillions += runners.length > 0 ? (size / runners.length) : size;
            }
          });
        }

        // 3. Fallback: If order volume is 0, check legacy attendance record farmed_millions
        const farmedMillions = Number((orderFarmedMillions > 0 ? orderFarmedMillions : Number(att?.farmed_millions || 0)).toFixed(2));

        let basePayEarned = 0;
        let teamVolumeBonus = 0;

        if (isNewDate) {
          // New Structure Daily Base: (K200/26 Attendance) + (K10 Transport) + (K200/26 TL Allowance if TL)
          if (isPresent) {
            const dailyAttendance = 200 / 26; // ~7.69
            const dailyTransport = 10;
            const dailyTL = gamer.gamer_role === 'team_leader' ? (200 / 26) : 0;
            basePayEarned = Number((dailyAttendance + dailyTransport + dailyTL).toFixed(2));
          }
        } else {
          // Legacy Daily Base
          let baseSalary = 1200;
          if (gamer.gamer_role === 'technical_manager') baseSalary = 4500;
          else if (gamer.gamer_role === 'team_leader') baseSalary = 2200;
          else if (gamer.level === 'intermediate') baseSalary = 1800;
          else if (gamer.level === 'advanced') baseSalary = 2500;

          const dailyRate = baseSalary / 26;
          if (isPresent) {
            basePayEarned = Number(dailyRate.toFixed(2));
          }

          if (gamer.gamer_role === 'team_leader') {
            const currentTeamMembers = gamers.filter((g) => g.team_leader_id === gamer.id);
            const currentTeamGamerIds = currentTeamMembers.map((m) => m.id);

            const dailyTeamAttendance = attendance.filter((a) => {
              if (a.date !== dateStr) return false;
              if (a.gamer_id === gamer.id) return true;
              if (a.team_leader_id !== undefined && a.team_leader_id !== null) {
                return a.team_leader_id === gamer.id;
              }
              return currentTeamGamerIds.includes(a.gamer_id);
            });
            const dailyVolume = dailyTeamAttendance.reduce((sum, a) => sum + Number(a.farmed_millions || 0), 0);
            if (dailyVolume > 50) {
              const over = dailyVolume - 50;
              const tens = Math.floor(over / 10);
              if (tens > 0) {
                teamVolumeBonus += tens * 10;
              }
            }

            const nameLower = (gamer.name || '').toLowerCase();
            const isGilbert = nameLower.includes('gilbert') || nameLower.includes('phiri');
            const bonusAdjustment = gamer.bonus_adjustment !== undefined ? gamer.bonus_adjustment : (isGilbert ? 40 : 0);
            teamVolumeBonus += bonusAdjustment;
          }
        }

        const normalOT = Number(att?.normal_overtime_hours || 0);
        const holidayOT = Number(att?.holiday_overtime_hours || 0);
        const dailyOTPay = Number(((normalOT * (900 / 208) * 1.5) + (holidayOT * (900 / 208) * 2.0)).toFixed(2));

        const totalDailyEarned = Number((basePayEarned + orderBonus + teamVolumeBonus + dailyOTPay).toFixed(2));

        // Include if gamer had attendance log, completed order, team volume bonus > 0, overtime, or farmed volume
        if (att || gamerCompletedOrders.length > 0 || teamVolumeBonus > 0 || dailyOTPay > 0 || farmedMillions > 0) {
          result.push({
            date: dateStr,
            gamerId: gamer.id,
            gamerName: gamer.name,
            employeeId: gamer.employee_id,
            gamerRole: gamer.gamer_role,
            level: gamer.level,
            farmedMillions,
            attendanceStatus,
            basePayEarned,
            orderBonus,
            teamVolumeBonus,
            totalDailyEarned,
            completedOrdersCount: gamerCompletedOrders.length,
            normalOvertimeHours: normalOT,
            holidayOvertimeHours: holidayOT,
            overtimePay: dailyOTPay
          });
        }
      });
    });

    return result;
  };

  const importBackupData = async (newGamers: Gamer[], newOrders: Order[], newAttendance?: AttendanceRecord[]) => {
    if (!isDemo && supabase) {
      try {
        for (const g of newGamers) {
          const { error } = await supabase.from('gamers').upsert(g);
          if (error) throw error;
        }
        for (const o of newOrders) {
          const { error } = await supabase.from('orders').upsert(o);
          if (error) throw error;
        }
        if (newAttendance) {
          for (const a of newAttendance) {
            const { error } = await supabase.from('attendance').upsert(a);
            if (error) throw error;
          }
        }
        await loadData();
        return { success: true };
      } catch (err: any) {
        console.error('Supabase backup import error:', err);
        return { success: false, error: err.message };
      }
    } else {
      setGamers(newGamers);
      setOrders(newOrders);
      setAttendance(newAttendance || []);
      safeLocalStorage.setItem('zampeak_gamers', JSON.stringify(newGamers));
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(newOrders));
      safeLocalStorage.setItem('zampeak_attendance', JSON.stringify(newAttendance || []));
      return { success: true };
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        role,
        gamerProfile,
        gamers,
        orders,
        attendance,
        loading,
        authLoading,
        isDemo,
        signIn,
        signUp,
        signOut,
        updatePassword,
        addGamer,
        updateGamer,
        toggleGamerStatus,
        deleteGamer,
        resetGamerPassword,
        addOrder,
        updateOrder,
        deleteOrder,
        updateOrderStatus,
        logOrderDailyProgress,
        deleteOrderDailyProgress,
        saveAttendance,
        calculatePayroll,
        getDailyGamerEarnings,
        importBackupData,
        refreshData,
        isMaintenanceMode,
        setMaintenanceMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
