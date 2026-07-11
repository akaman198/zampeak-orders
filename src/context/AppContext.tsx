'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Gamer, Order, OrderStatus, AssetType, GamerPerformance, DashboardStats } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AppContextType {
  gamers: Gamer[];
  orders: Order[];
  loading: boolean;
  isDemo: boolean;
  addGamer: (name: string, employeeId: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  updateGamer: (
    id: string,
    name: string,
    employeeId: string,
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured);

  const loadData = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
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
          throw new Error(gamersErr?.message || ordersErr?.message);
        }

        setGamers(gamersData || []);
        setOrders(ordersData || []);
        setIsDemo(false);
      } catch (err) {
        console.error('Failed to load from Supabase, falling back to local storage:', err);
        setIsDemo(true);
        loadLocalStorage();
      }
    } else {
      setIsDemo(true);
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
      // Production ready: Start completely empty
      setGamers([]);
      setOrders([]);
      localStorage.setItem('zampeak_gamers', JSON.stringify([]));
      localStorage.setItem('zampeak_orders', JSON.stringify([]));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async () => {
    await loadData();
  };

  const addGamer = async (name: string, employeeId: string, phone?: string) => {
    const newGamer: Gamer = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      name,
      employee_id: employeeId,
      phone: phone || '',
      status: 'active',
      created_at: new Date().toISOString(),
    };

    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('gamers').insert([newGamer]);
        if (error) throw error;
        setGamers((prev) => [newGamer, ...prev]);
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, adding gamer:', err);
        return { success: false, error: err.message };
      }
    } else {
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
    phone?: string,
    status?: 'active' | 'inactive'
  ) => {
    if (!isDemo && supabase) {
      try {
        const updates: Partial<Gamer> = { name, employee_id: employeeId, phone: phone || '' };
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
          ? { ...g, name, employee_id: employeeId, phone: phone || '', status: status || g.status }
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

    if (!isDemo && supabase) {
      try {
        const { error } = await supabase.from('gamers').delete().eq('id', id);
        if (error) throw error;
        setGamers((prev) => prev.filter((g) => g.id !== id));
        return { success: true };
      } catch (err: any) {
        console.error('Supabase error, deleting gamer:', err);
        return { success: false, error: err.message };
      }
    } else {
      const updated = gamers.filter((g) => g.id !== id);
      setGamers(updated);
      localStorage.setItem('zampeak_gamers', JSON.stringify(updated));
      return { success: true };
    }
  };

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
        gamers,
        orders,
        loading,
        isDemo,
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
