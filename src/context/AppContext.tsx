'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Gamer, Order, OrderStatus, AssetType } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AppContextType {
  user: User | null;
  role: 'admin' | 'gamer';
  gamerProfile: Gamer | null;
  gamers: Gamer[];
  orders: Order[];
  loading: boolean;
  authLoading: boolean;
  isDemo: boolean;
  signIn: (emailOrEmpId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (emailOrEmpId: string, password: string, defaultPassword?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  addGamer: (name: string, employeeId: string, defaultPassword: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  updateGamer: (
    id: string,
    name: string,
    employeeId: string,
    defaultPassword?: string,
    phone?: string,
    status?: 'active' | 'inactive'
  ) => Promise<{ success: boolean; error?: string }>;
  deleteGamer: (id: string) => Promise<{ success: boolean; error?: string }>;
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
  importBackupData: (gamers: Gamer[], orders: Order[]) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getEmailFromInput = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed.toLowerCase()}@gamers.zampeak.com`;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'gamer'>('admin');
  const [gamerProfile, setGamerProfile] = useState<Gamer | null>(null);
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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
            setUser(session?.user ?? null);
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
    const sessionUser = sessionStorage.getItem('zampeak_user');
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

        if (gamersErr || ordersErr) {
          console.error('Database read error:', gamersErr?.message || ordersErr?.message);
          setIsDemo(true);
          loadLocalStorage();
        } else {
          setGamers(gamersData || []);
          setOrders(ordersData || []);
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
    const savedGamers = localStorage.getItem('zampeak_gamers');
    const savedOrders = localStorage.getItem('zampeak_orders');

    if (savedGamers && savedOrders) {
      setGamers(JSON.parse(savedGamers));
      setOrders(JSON.parse(savedOrders));
    } else {
      setGamers([]);
      setOrders([]);
      localStorage.setItem('zampeak_gamers', JSON.stringify([]));
      localStorage.setItem('zampeak_orders', JSON.stringify([]));
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
        sessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
        return { success: true };
      } else {
        const savedGamers = localStorage.getItem('zampeak_gamers');
        if (savedGamers) {
          const localGamers: Gamer[] = JSON.parse(savedGamers);
          const matched = localGamers.find(g => g.email?.toLowerCase() === loginEmail.toLowerCase());
          if (matched && password === (matched.default_password || 'gamer123')) {
            const mockUser = { id: matched.id, email: loginEmail } as User;
            setUser(mockUser);
            sessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));
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
        const savedGamers = localStorage.getItem('zampeak_gamers');
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
      sessionStorage.setItem('zampeak_user', JSON.stringify(mockUser));

      // Clear local default password
      const empId = emailOrEmpId.trim().toUpperCase();
      const updatedGamers = gamers.map(g => g.employee_id === empId ? { ...g, default_password: '' } : g);
      setGamers(updatedGamers);
      localStorage.setItem('zampeak_gamers', JSON.stringify(updatedGamers));

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
      sessionStorage.removeItem('zampeak_user');
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
        localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      }
      return { success: true };
    }
  };

  // Gamers operations
  const addGamer = async (name: string, employeeId: string, defaultPassword: string, phone?: string) => {
    if (!isDemo) {
      try {
        const response = await fetch('/api/create-gamer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, employeeId, defaultPassword, phone }),
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
        created_at: new Date().toISOString(),
      };
      const updated = [newGamer, ...gamers];
      setGamers(updated);
      localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

  const updateGamer = async (
    id: string,
    name: string,
    employeeId: string,
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
              status: status || g.status 
            }
          : g
      );
      setGamers(updated);
      localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
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
      localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
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
      localStorage.setItem('zampeak_orders', JSON.stringify(updated));
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
      localStorage.setItem('zampeak_orders', JSON.stringify(updated));
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
      localStorage.setItem('zampeak_orders', JSON.stringify(updated));
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
      localStorage.setItem('zampeak_orders', JSON.stringify(updated));
      return { success: true };
    }
  };

  const importBackupData = async (newGamers: Gamer[], newOrders: Order[]) => {
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
        await loadData();
        return { success: true };
      } catch (err: any) {
        console.error('Supabase backup import error:', err);
        return { success: false, error: err.message };
      }
    } else {
      setGamers(newGamers);
      setOrders(newOrders);
      localStorage.setItem('zampeak_gamers', JSON.stringify(newGamers));
      localStorage.setItem('zampeak_orders', JSON.stringify(newOrders));
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
        addOrder,
        updateOrder,
        deleteOrder,
        updateOrderStatus,
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
