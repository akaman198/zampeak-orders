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
  DailyGamerEarnings
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
    progressMillions?: number
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
    progressMillions?: number
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<{ success: boolean; error?: string }>;
  saveAttendance: (gamerId: string, date: string, status: AttendanceStatus, farmedMillions?: number) => Promise<{ success: boolean; error?: string }>;
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
  const normalizedStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
  const date = new Date(normalizedStr);
  let year = date.getFullYear();
  let month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  if (day >= 16) {
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

export const getOrderPeriodLabel = (dateStr: string) => {
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

export const getPayPeriodLabel = getAttendancePeriodLabel;

export const isNewSalaryStructureCycle = (cycleLabel: string): boolean => {
  if (!cycleLabel) return true;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const parts = cycleLabel.replace(',', '').split(' '); // e.g. ["September", "15", "2026"]
  if (parts.length < 3) return false;
  const monthIndex = monthNames.indexOf(parts[0]);
  const day = parseInt(parts[1]) || 15;
  const year = parseInt(parts[2]) || 2026;
  const cycleEndDate = new Date(year, monthIndex, day);
  // Cutoff is August 15, 2026. Cycles ending AFTER August 15, 2026 (starting from 16th August 2026) use the new salary structure.
  const cutoffDate = new Date(2026, 7, 15);
  return cycleEndDate.getTime() > cutoffDate.getTime();
};

/**
 * Calculates the valid completed order count (in 10M units):
 * - For orders <= 100M: Only added when the whole order is 'Completed' (size_millions / 10).
 * - For orders > 100M: Added each time the runner hits 100M milestones (Math.floor(progress_millions / 100) * 10).
 *   When the whole order is marked 'Completed', the entire volume (size_millions / 10) is added.
 */
export const calculateOrderUnits = (order: Order): number => {
  const size = Number(order.size_millions || 0);
  if (size <= 0) return 0;

  if (size <= 100) {
    if (order.status === 'Completed') {
      return Math.floor(size / 10);
    }
    return 0;
  } else {
    // Orders larger than 100M
    if (order.status === 'Completed') {
      return Math.floor(size / 10);
    }
    const progress = Number(order.progress_millions || 0);
    const completedHundredMillions = Math.floor(progress / 100);
    return completedHundredMillions * 10;
  }
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
          setGamers(gamersData || []);
          setOrders(ordersData || []);
          setAttendance(attendanceData || []);
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
      setGamers(JSON.parse(savedGamers));
      setOrders(JSON.parse(savedOrders));
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
    progressMillions?: number
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

    const newOrder: Order = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      order_number: orderNumber,
      gamer_id: gamerId,
      size_millions: sizeMillions,
      progress_millions: progressMillions !== undefined ? progressMillions : (status === 'Completed' ? sizeMillions : 0),
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
        if (error && (error.message?.includes('progress_millions') || error.message?.includes('schema cache'))) {
          // Graceful fallback retry if progress_millions column has not been added to Supabase table yet
          const fallbackOrder: any = { ...newOrder };
          delete fallbackOrder.progress_millions;
          const retryRes = await supabase.from('orders').insert([fallbackOrder]);
          error = retryRes.error;
        }
        if (error) throw error;
        setOrders((prev) => [newOrder, ...prev]);
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
    progressMillions?: number
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

    const finalProgress = progressMillions !== undefined 
      ? progressMillions 
      : (status === 'Completed' ? sizeMillions : (existing?.progress_millions || 0));

    if (!isDemo && supabase) {
      try {
        const updates: any = {
          order_number: orderNumber,
          gamer_id: gamerId,
          size_millions: sizeMillions,
          progress_millions: finalProgress,
          asset_type: assetType,
          start_date: startDate,
          status,
          payout: finalPayout,
          completed_date: completedDate || null
        };

        let { error } = await supabase.from('orders').update(updates).eq('id', id);
        if (error && (error.message?.includes('progress_millions') || error.message?.includes('schema cache'))) {
          // Graceful fallback retry if progress_millions column has not been added to Supabase table yet
          delete updates.progress_millions;
          const retryRes = await supabase.from('orders').update(updates).eq('id', id);
          error = retryRes.error;
        }
        if (error) throw error;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, ...updates, progress_millions: finalProgress, completed_date: completedDate || undefined } : o))
        );
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
              gamer_id: gamerId,
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

  const saveAttendance = async (gamerId: string, date: string, status: AttendanceStatus, farmedMillions?: number) => {
    const existingRecord = attendance.find(a => a.gamer_id === gamerId && a.date === date);
    const targetGamer = gamers.find(g => g.id === gamerId);
    const currentTeamLeaderId = existingRecord?.team_leader_id !== undefined 
      ? existingRecord.team_leader_id 
      : (targetGamer?.team_leader_id || null);

    const finalStatus = status;
    const finalFarmedMillions = farmedMillions !== undefined ? farmedMillions : (existingRecord?.farmed_millions || 0);

    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
      gamer_id: gamerId,
      date,
      status: finalStatus,
      farmed_millions: finalFarmedMillions,
      team_leader_id: currentTeamLeaderId,
      created_at: existingRecord?.created_at || new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        const payload: any = {
          gamer_id: gamerId,
          date,
          status: finalStatus,
          farmed_millions: finalFarmedMillions,
          created_at: new Date().toISOString()
        };
        if (currentTeamLeaderId) {
          payload.team_leader_id = currentTeamLeaderId;
        }

        let { data, error } = await supabase
          .from('attendance')
          .upsert(payload, { onConflict: 'gamer_id,date' })
          .select();

        if (error && (error.message?.includes('team_leader_id') || error.message?.includes('schema cache'))) {
          // Graceful fallback retry if team_leader_id column has not been added to Supabase table yet
          delete payload.team_leader_id;
          const retryRes = await supabase
            .from('attendance')
            .upsert(payload, { onConflict: 'gamer_id,date' })
            .select();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) throw error;
        
        setAttendance((prev) => {
          const filtered = prev.filter((a) => !(a.gamer_id === gamerId && a.date === date));
          const upserted = data && data[0] ? data[0] as AttendanceRecord : newRecord;
          const updated = [upserted, ...filtered];
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
        if (o.gamer_id !== gamerId) return false;
        if (o.status === 'Completed') {
          return getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel;
        }
        // Orders > 100M with milestone progress (>= 100M)
        if (o.size_millions > 100 && (o.progress_millions || 0) >= 100) {
          return getOrderPeriodLabel(o.start_date) === cycleLabel;
        }
        return false;
      });

      completedOrdersCount = gamerOrdersInCycle.reduce((sum, o) => sum + calculateOrderUnits(o), 0);
    } else {
      const legacyCompleted = orders.filter(
        (o) => o.gamer_id === gamerId && o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel
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
          completedOrdersCount,
          excessOrdersCount: 0,
          teamIncentive: 0,
          teamLeaderManagementAllowance: 0,
          additionalPerformanceAward: 0,
          teamCompletionRate: 1.0
        };
      }

      // Runners & Team Leaders use the unified production salary system
      const baseSalary = 800; // Responsibility Target Base (26 orders)
      const dailyRate = 800 / 26;

      // A. Responsibility Salary: K800 × MIN(validOrders / 26, 1.0)
      const responsibilitySalary = Number((800 * Math.min(1.0, completedOrdersCount / 26)).toFixed(2));

      // B. Attendance Salary: K200 × MIN(attendanceDays / 26, 1.0)
      const attendanceSalary = Number((200 * Math.min(1.0, cappedDaysWorked / 26)).toFixed(2));

      // C. Transport Allowance: K10 / actual attendance day
      const transportAllowance = Number((10 * daysWorked).toFixed(2));

      // D. Excess Order Incentive (Progressive Tiers from 27th order onwards)
      let excessOrderIncentive = 0;
      let remainingExcess = Math.max(0, completedOrdersCount - 26);
      const excessOrdersCount = remainingExcess;

      // Tier 1: Orders 27–39 (up to 13 orders @ K35)
      const tier1 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier1 * 35;
      remainingExcess -= tier1;

      // Tier 2: Orders 40–52 (up to 13 orders @ K40)
      const tier2 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier2 * 40;
      remainingExcess -= tier2;

      // Tier 3: Orders 53–65 (up to 13 orders @ K45)
      const tier3 = Math.min(13, remainingExcess);
      excessOrderIncentive += tier3 * 45;
      remainingExcess -= tier3;

      // Tier 4: Orders 66+ (remaining @ K45)
      if (remainingExcess > 0) {
        excessOrderIncentive += remainingExcess * 45;
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
              if (o.gamer_id !== m.id) return false;
              if (o.status === 'Completed') {
                return getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel;
              }
              if (o.size_millions > 100 && (o.progress_millions || 0) >= 100) {
                return getOrderPeriodLabel(o.start_date) === cycleLabel;
              }
              return false;
            });
            const count = mOrders.reduce((sum, o) => sum + calculateOrderUnits(o), 0);
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

      // Base Pay Earned: Responsibility + Attendance + Transport
      const basePayEarned = Number((responsibilitySalary + attendanceSalary + transportAllowance).toFixed(2));
      const deductions = Math.max(0, 800 - responsibilitySalary) + Math.max(0, 200 - attendanceSalary);

      const totalPay = Number((
        responsibilitySalary + 
        attendanceSalary + 
        transportAllowance + 
        excessOrderIncentive + 
        teamLeaderManagementAllowance + 
        teamIncentive + 
        additionalPerformanceAward
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
        completedOrdersCount,
        excessOrdersCount,
        teamIncentive,
        teamLeaderManagementAllowance,
        additionalPerformanceAward,
        teamCompletionRate
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
      (o) => o.gamer_id === gamerId && o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === cycleLabel
    );
    const orderBonus = legacyCompleted.reduce((sum, o) => sum + o.payout, 0);

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

    // Get all unique dates in the cycle attendance records or completed orders
    const datesSet = new Set<string>();
    cycleAttendance.forEach((a) => datesSet.add(a.date));
    
    orders.forEach((o) => {
      if (o.status === 'Completed') {
        const compDate = (o.completed_date || o.start_date).slice(0, 10);
        if (getOrderPeriodLabel(compDate) === cycleLabel) {
          datesSet.add(compDate);
        }
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
        const farmedMillions = Number(att?.farmed_millions || 0);
        const attendanceStatus = att ? att.status : 'no_log';
        const isPresent = att && (att.status === 'present_on_time' || att.status === 'present_late');

        // Completed orders on this date for gamer
        const gamerCompletedOrders = orders.filter((o) => {
          if (o.gamer_id !== gamer.id || o.status !== 'Completed') return false;
          const orderDate = (o.completed_date || o.start_date).slice(0, 10);
          return orderDate === dateStr;
        });

        let basePayEarned = 0;
        let orderBonus = 0;
        let teamVolumeBonus = 0;

        if (isNewDate) {
          // New Structure Daily Base: (K200/26 Attendance) + (K10 Transport) + (K200/26 TL Allowance if TL)
          if (isPresent) {
            const dailyAttendance = 200 / 26; // ~7.69
            const dailyTransport = 10;
            const dailyTL = gamer.gamer_role === 'team_leader' ? (200 / 26) : 0;
            basePayEarned = Number((dailyAttendance + dailyTransport + dailyTL).toFixed(2));
          }
          orderBonus = gamerCompletedOrders.reduce((sum, o) => sum + Number(o.payout || 0), 0);
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
          orderBonus = gamerCompletedOrders.reduce((sum, o) => sum + Number(o.payout || 0), 0);

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

        const totalDailyEarned = Number((basePayEarned + orderBonus + teamVolumeBonus).toFixed(2));

        // Include if gamer had attendance log or completed order or team volume bonus > 0
        if (att || gamerCompletedOrders.length > 0 || teamVolumeBonus > 0) {
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
            completedOrdersCount: gamerCompletedOrders.length
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
