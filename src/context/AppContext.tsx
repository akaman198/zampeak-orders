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
  PayrollSummary 
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  role: 'admin' | 'gamer';
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
  deleteGamer: (id: string) => Promise<{ success: boolean; error?: string }>;
  resetGamerPassword: (id: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  addOrder: (
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number
  ) => Promise<{ success: boolean; error?: string }>;
  updateOrder: (
    id: string,
    orderNumber: string,
    gamerId: string,
    sizeMillions: number,
    assetType: AssetType,
    startDate: string,
    status: OrderStatus,
    payoutOverride?: number
  ) => Promise<{ success: boolean; error?: string }>;
  deleteOrder: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<{ success: boolean; error?: string }>;
  saveAttendance: (gamerId: string, date: string, status: AttendanceStatus, farmedMillions?: number) => Promise<{ success: boolean; error?: string }>;
  calculatePayroll: (gamerId: string, cycleLabel: string) => PayrollSummary;
  importBackupData: (gamers: Gamer[], orders: Order[], attendance?: AttendanceRecord[]) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'gamer'>('admin');
  const [gamerProfile, setGamerProfile] = useState<Gamer | null>(null);
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured);

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
      if (matchedGamer) {
        setRole('gamer');
        setGamerProfile(matchedGamer);
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
      } else {
        const savedGamers = safeLocalStorage.getItem('zampeak_gamers');
        if (savedGamers) {
          const localGamers: Gamer[] = JSON.parse(savedGamers);
          const matched = localGamers.find(g => g.email?.toLowerCase() === loginEmail.toLowerCase());
          if (matched && password === (matched.default_password || 'gamer123')) {
            const mockUser = { id: matched.id, email: loginEmail } as User;
            setUser(mockUser);
            safeSessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
            return { success: true };
          }
        }
        return { success: false, error: 'Invalid credentials. Demo admin defaults: admin@zampeak.com / admin123. Or gamer employee ID with password.' };
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
    payoutOverride?: number
  ) => {
    const defaultPayout = sizeMillions;
    const finalPayout = payoutOverride !== undefined ? payoutOverride : defaultPayout;

    const newOrder: Order = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      order_number: orderNumber,
      gamer_id: gamerId,
      size_millions: sizeMillions,
      asset_type: assetType,
      start_date: startDate || new Date().toISOString(),
      status,
      payout: finalPayout,
      created_at: new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('orders').insert([newOrder]);
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
    payoutOverride?: number
  ) => {
    const defaultPayout = sizeMillions;
    const finalPayout = payoutOverride !== undefined ? payoutOverride : defaultPayout;

    if (!isDemo && supabase) {
      try {
        const updates = {
          order_number: orderNumber,
          gamer_id: gamerId,
          size_millions: sizeMillions,
          asset_type: assetType,
          start_date: startDate,
          status,
          payout: finalPayout,
        };

        const { error } = await supabase.from('orders').update(updates).eq('id', id);
        if (error) throw error;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
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
              asset_type: assetType,
              start_date: startDate,
              status,
              payout: finalPayout,
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
    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('orders').update({ status }).eq('id', id);
        if (error) throw error;

        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, status } : o))
        );
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, updating status:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = orders.map((o) => (o.id === id ? { ...o, status } : o));
      setOrders(updated);
      safeLocalStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const saveAttendance = async (gamerId: string, date: string, status: AttendanceStatus, farmedMillions?: number) => {
    const existingRecord = attendance.find(a => a.gamer_id === gamerId && a.date === date);
    const finalStatus = status;
    const finalFarmedMillions = farmedMillions !== undefined ? farmedMillions : (existingRecord?.farmed_millions || 0);

    const newRecord: AttendanceRecord = {
      id: existingRecord?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)),
      gamer_id: gamerId,
      date,
      status: finalStatus,
      farmed_millions: finalFarmedMillions,
      created_at: existingRecord?.created_at || new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        const { data, error } = await supabase
          .from('attendance')
          .upsert({
            gamer_id: gamerId,
            date,
            status: finalStatus,
            farmed_millions: finalFarmedMillions,
            created_at: new Date().toISOString()
          }, { onConflict: 'gamer_id,date' })
          .select();

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
    };

    if (!gamer) return emptyPayroll;

    // 1. Determine Base Salary
    let baseSalary = 1200;
    if (gamer.gamer_role === 'technical_manager') {
      baseSalary = 4500;
    } else {
      if (gamer.level === 'intermediate') baseSalary = 1800;
      else if (gamer.level === 'advanced') baseSalary = 2500;
    }

    const dailyRate = baseSalary / 26;

    // 2. Filter Attendance in Cycle
    const cycleAttendance = attendance.filter(
      (a) => a.gamer_id === gamerId && getAttendancePeriodLabel(a.date) === cycleLabel
    );

    const daysWorked = cycleAttendance.filter(
      (a) => a.status === 'present_on_time' || a.status === 'present_late'
    ).length;
    
    const daysAbsent = cycleAttendance.filter((a) => a.status === 'absent').length;
    const onTimeDays = cycleAttendance.filter((a) => a.status === 'present_on_time').length;

    // 3. Base Pay Earned & Deductions (capped at 26 working days)
    const presentDaysForBase = Math.min(26, daysWorked);
    const basePayEarned = presentDaysForBase * dailyRate;
    
    // Late deductions: Removed by request
    const lateDeduction = 0;
    
    const missedDaysDeductions = Math.max(0, baseSalary - basePayEarned);
    const deductions = missedDaysDeductions;

    // 4. Attendance Bonus: K200 if 26 days on time
    const attendanceBonus = onTimeDays >= 26 ? 200 : 0;

    // 5. Order payout bonuses
    const completedOrders = orders.filter(
      (o) => o.gamer_id === gamerId && o.status === 'Completed' && getOrderPeriodLabel(o.start_date) === cycleLabel
    );
    const orderBonus = completedOrders.reduce((sum, o) => sum + o.payout, 0);

    // 6. Team Leader Daily Volume Bonus
    let teamVolumeBonus = 0;
    if (gamer.gamer_role === 'team_leader') {
      const teamMembers = gamers.filter((g) => g.team_leader_id === gamerId);
      const teamGamerIds = [gamerId, ...teamMembers.map((m) => m.id)];

      // Find attendance records for these team members or leader in this cycle
      const teamAttendance = attendance.filter(
        (a) => teamGamerIds.includes(a.gamer_id) && getAttendancePeriodLabel(a.date) === cycleLabel
      );

      // Group by daily local date string and sum farmed_millions
      const dailyTotals: { [dateStr: string]: number } = {};
      teamAttendance.forEach((a) => {
        dailyTotals[a.date] = (dailyTotals[a.date] || 0) + Number(a.farmed_millions || 0);
      });

      // Calculate bonuses: K10 for every 10 Million above 50 Million
      Object.values(dailyTotals).forEach((total) => {
        if (total > 50) {
          const over = total - 50;
          const tens = Math.floor(over / 10);
          if (tens > 0) {
            teamVolumeBonus += tens * 10;
          }
        }
      });
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
    };
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
        deleteGamer,
        resetGamerPassword,
        addOrder,
        updateOrder,
        deleteOrder,
        updateOrderStatus,
        saveAttendance,
        calculatePayroll,
        importBackupData,
        refreshData,
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
