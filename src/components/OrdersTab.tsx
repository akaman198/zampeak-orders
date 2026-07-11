'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { OrderStatus, AssetType, Order } from '../types';
import { 
  Gamepad2, 
  Search, 
  Trash2, 
  Edit3, 
  X,
  PlusCircle,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function OrdersTab() {
  const { orders, gamers, addOrder, updateOrder, deleteOrder, updateOrderStatus } = useApp();

  // Control UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<Order | null>(null);

  // Form Fields
  const [orderNumber, setOrderNumber] = useState('');
  const [gamerId, setGamerId] = useState('');
  const [sizeMillions, setSizeMillions] = useState<number>(50);
  const [assetType, setAssetType] = useState<AssetType>('Haval Coins');
  const [startDate, setStartDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Running');
  const [payout, setPayout] = useState<number>(50);
  const [isPayoutOverridden, setIsPayoutOverridden] = useState(false);
  const [formError, setFormError] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [gamerFilter, setGamerFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'date' | 'order_number' | 'size' | 'payout'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Trigger payout auto-update when sizeMillions changes (unless overridden)
  useEffect(() => {
    if (!isPayoutOverridden) {
      setPayout(sizeMillions);
    }
  }, [sizeMillions, isPayoutOverridden]);

  // Set default deployment date on form open
  const openNewOrderForm = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    
    setOrderNumber('');
    const activeGamers = gamers.filter(g => g.status === 'active');
    setGamerId(activeGamers.length > 0 ? activeGamers[0].id : gamers[0]?.id || '');
    setSizeMillions(50);
    setAssetType('Haval Coins');
    setStartDate(now.toISOString().slice(0, 16));
    setStatus('Running');
    setPayout(50);
    setIsPayoutOverridden(false);
    setFormError('');
    setIsEditing(null);
    setIsFormOpen(true);
  };

  const openEditOrderForm = (order: Order) => {
    setIsEditing(order);
    setOrderNumber(order.order_number);
    setGamerId(order.gamer_id);
    setSizeMillions(order.size_millions);
    setAssetType(order.asset_type || 'Haval Coins');
    setStartDate(new Date(order.start_date).toISOString().slice(0, 16));
    setStatus(order.status);
    setPayout(order.payout);
    setIsPayoutOverridden(order.payout !== order.size_millions);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setFormError('Order Number is required.');
      return;
    }
    if (!gamerId) {
      setFormError('An operational Gamer must be assigned.');
      return;
    }
    if (sizeMillions <= 0) {
      setFormError('Order Size must be positive.');
      return;
    }

    const formattedDate = new Date(startDate).toISOString();

    if (isEditing) {
      const res = await updateOrder(
        isEditing.id,
        orderNumber.trim(),
        gamerId,
        sizeMillions,
        assetType,
        formattedDate,
        status,
        payout
      );
      if (res.success) {
        setIsFormOpen(false);
        setIsEditing(null);
      } else {
        setFormError(res.error || 'Failed to update order.');
      }
    } else {
      const numberExists = orders.some(o => o.order_number.toLowerCase() === orderNumber.trim().toLowerCase());
      if (numberExists) {
        setFormError(`Order Number ${orderNumber} is already logged.`);
        return;
      }

      const res = await addOrder(
        orderNumber.trim(),
        gamerId,
        sizeMillions,
        assetType,
        formattedDate,
        status,
        payout
      );
      if (res.success) {
        setIsFormOpen(false);
      } else {
        setFormError(res.error || 'Failed to deploy order.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to terminate this order log?')) {
      const res = await deleteOrder(id);
      if (!res.success) {
        alert(res.error);
      }
    }
  };

  const toggleSort = (field: 'date' | 'order_number' | 'size' | 'payout') => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const filteredOrders = orders
    .filter(order => {
      const assignedGamer = gamers.find(g => g.id === order.gamer_id);
      const gamerName = assignedGamer ? assignedGamer.name : '';
      const employeeId = assignedGamer ? assignedGamer.employee_id : '';
      
      const matchesSearch = 
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gamerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employeeId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesGamer = gamerFilter === 'All' || order.gamer_id === gamerFilter;

      return matchesSearch && matchesStatus && matchesGamer;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortBy === 'order_number') {
        comparison = a.order_number.localeCompare(b.order_number);
      } else if (sortBy === 'size') {
        comparison = a.size_millions - b.size_millions;
      } else if (sortBy === 'payout') {
        comparison = a.payout - b.payout;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border-b border-cyber-border/40 pb-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md font-mono text-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
            <Search size={14} />
          </span>
          <input 
            type="text" 
            placeholder="Search by Order ID or Gamer Employee ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-dark/80 border border-cyber-border rounded pl-10 pr-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
          />
        </div>

        {/* Filters and Add Buttons */}
        <div className="flex flex-wrap gap-3 font-mono text-xs">
          {/* Status Filter */}
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-cyber-dark border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Running">Running</option>
            <option value="Paused">Paused</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Violation">Violation</option>
          </select>

          {/* Gamer Filter */}
          <select 
            value={gamerFilter} 
            onChange={(e) => setGamerFilter(e.target.value)}
            className="bg-cyber-dark border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer max-w-[150px]"
          >
            <option value="All">All Gamers</option>
            {gamers.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {gamers.length === 0 ? (
            <button 
              disabled 
              className="flex items-center gap-1 opacity-50 bg-slate-800 text-slate-500 border border-slate-700 px-3 py-2 rounded font-bold cursor-not-allowed"
            >
              Recruit Gamers First
            </button>
          ) : (
            <button 
              onClick={openNewOrderForm}
              className="flex items-center gap-1 bg-cyber-cyan text-slate-950 font-bold px-3 py-2 rounded hover:bg-cyan-400 shadow-neon-cyan/15 hover:shadow-neon-cyan/25 transition-all cursor-pointer uppercase tracking-wider"
            >
              <PlusCircle size={14} />
              Deploy Order
            </button>
          )}
        </div>
      </div>

      {/* Deploy/Edit Order Dialog Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/40 w-full max-w-lg relative">
            <div className="hud-grid"></div>
            
            <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest border-b border-cyber-cyan/20 pb-3 mb-5 flex justify-between items-center">
              <span>{isEditing ? `Modify Deployment: ${orderNumber}` : 'Deploy New Mission'}</span>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-200 cursor-pointer">
                <X size={16} />
              </button>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
              {formError && (
                <div className="p-3 border border-cyber-red/30 bg-cyber-red/10 text-cyber-red rounded font-bold">
                  [WARNING]: {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order Code */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Order Number</label>
                  <input 
                    type="text" 
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. ZP-2024"
                    disabled={!!isEditing}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan disabled:opacity-50"
                  />
                </div>

                {/* Gamer Select */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Assign Gamer Dossier</label>
                  <select 
                    value={gamerId} 
                    onChange={(e) => setGamerId(e.target.value)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    <option value="" disabled>Select active gamer...</option>
                    {gamers.map(g => (
                      <option key={g.id} value={g.id}>{g.name} (ID: {g.employee_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Size (in millions) */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Order Size (Millions)</label>
                  <input 
                    type="number" 
                    value={sizeMillions || ''}
                    onChange={(e) => setSizeMillions(Number(e.target.value))}
                    min="1"
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                {/* Asset Type */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Asset Metric Type</label>
                  <select 
                    value={assetType} 
                    onChange={(e) => setAssetType(e.target.value as AssetType)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    <option value="Haval Coins">Haval Coins</option>
                    <option value="Total Assets">Total Assets</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Date & Time */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Deployment Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider">Current Status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    <option value="Running">Running</option>
                    <option value="Paused">Paused</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Violation">Violation</option>
                  </select>
                </div>
              </div>

              {/* Payout */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-slate-400 uppercase tracking-wider">Payout Amount (K)</label>
                  <div className="flex items-center gap-1">
                    <input 
                      type="checkbox" 
                      id="override" 
                      checked={isPayoutOverridden} 
                      onChange={(e) => {
                        setIsPayoutOverridden(e.target.checked);
                        if (!e.target.checked) setPayout(sizeMillions);
                      }}
                      className="cursor-pointer"
                    />
                    <label htmlFor="override" className="text-[10px] text-slate-500 cursor-pointer select-none">Override</label>
                  </div>
                </div>
                <input 
                  type="number" 
                  value={payout || ''}
                  onChange={(e) => setPayout(Number(e.target.value))}
                  disabled={!isPayoutOverridden}
                  className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan disabled:opacity-50"
                />
                <div className="text-[10px] text-slate-500 mt-0.5">Calculated: K{sizeMillions} (K1 per 1M)</div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-400 rounded hover:bg-slate-900 cursor-pointer"
                >
                  ABORT MISSION
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-cyber-cyan text-slate-950 font-bold rounded hover:bg-cyan-400 transition-colors shadow-neon-cyan/20 cursor-pointer"
                >
                  {isEditing ? 'COMMIT UPDATE' : 'DEPLOY NOW'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orders Table Container */}
      <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center font-mono text-slate-500 text-xs">
            NO ORDERS FOUND MATCHING CURRENT FILTERS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-cyber-border text-slate-400 bg-cyber-dark/40 select-none">
                  <th 
                    className="p-3 cursor-pointer hover:text-cyber-cyan transition-colors"
                    onClick={() => toggleSort('order_number')}
                  >
                    Order Code {sortBy === 'order_number' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-3">Gamer Details</th>
                  <th 
                    className="p-3 text-right cursor-pointer hover:text-cyber-cyan transition-colors"
                    onClick={() => toggleSort('size')}
                  >
                    Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    className="p-3 text-right cursor-pointer hover:text-cyber-cyan transition-colors"
                    onClick={() => toggleSort('payout')}
                  >
                    Payout (K) {sortBy === 'payout' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    className="p-3 cursor-pointer hover:text-cyber-cyan transition-colors"
                    onClick={() => toggleSort('date')}
                  >
                    Deployed On {sortBy === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Operational Shifts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/30">
                {filteredOrders.map((order) => {
                  const assignedGamer = gamers.find(g => g.id === order.gamer_id);

                  return (
                    <tr key={order.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 text-cyber-cyan font-bold">{order.order_number}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-300">{assignedGamer ? assignedGamer.name : 'Unknown Gamer'}</div>
                        <div className="text-[10px] text-slate-500">{assignedGamer ? `ID: ${assignedGamer.employee_id}` : ''}</div>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-300">
                        {order.size_millions}M
                        <span className="text-[9px] text-slate-500 font-normal block">{order.asset_type || 'Haval Coins'}</span>
                      </td>
                      <td className="p-3 text-right font-bold text-cyber-green">
                        K{order.payout}
                        {order.payout !== order.size_millions && (
                          <span className="text-[8px] text-cyber-cyan font-bold block">(Override)</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(order.start_date).toLocaleDateString()} {new Date(order.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'Running' ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30' :
                          order.status === 'Completed' ? 'bg-cyber-green/15 text-cyber-green border border-cyber-green/30' :
                          order.status === 'Paused' ? 'bg-cyber-amber/15 text-cyber-amber border border-cyber-amber/30' :
                          order.status === 'Violation' ? 'bg-cyber-red/15 text-cyber-red border border-cyber-red/30' :
                          'bg-slate-700/15 text-slate-400 border border-slate-600/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Transitions */}
                          <div className="flex gap-0.5 border border-cyber-border/40 rounded p-0.5 bg-slate-950/80">
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'Running')}
                              title="Set Running"
                              className={`p-1 rounded transition-colors ${order.status === 'Running' ? 'bg-cyber-cyan text-slate-950' : 'text-slate-400 hover:text-cyber-cyan'}`}
                            >
                              <Play size={10} />
                            </button>
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'Paused')}
                              title="Set Paused"
                              className={`p-1 rounded transition-colors ${order.status === 'Paused' ? 'bg-cyber-amber text-slate-950' : 'text-slate-400 hover:text-cyber-amber'}`}
                            >
                              <Pause size={10} />
                            </button>
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'Completed')}
                              title="Set Completed"
                              className={`p-1 rounded transition-colors ${order.status === 'Completed' ? 'bg-cyber-green text-slate-950' : 'text-slate-400 hover:text-cyber-green'}`}
                            >
                              <CheckCircle size={10} />
                            </button>
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'Violation')}
                              title="Set Violation"
                              className={`p-1 rounded transition-colors ${order.status === 'Violation' ? 'bg-cyber-red text-slate-950 font-bold' : 'text-slate-400 hover:text-cyber-red'}`}
                            >
                              <AlertTriangle size={10} />
                            </button>
                          </div>

                          {/* Full Edit / Delete */}
                          <div className="flex gap-1 pl-1 border-l border-cyber-border/30">
                            <button 
                              onClick={() => openEditOrderForm(order)}
                              title="Edit Order parameters"
                              className="p-1.5 hover:bg-cyber-cyan/15 rounded text-slate-400 hover:text-cyber-cyan transition-colors"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button 
                              onClick={() => handleDelete(order.id)}
                              title="Terminate Log"
                              className="p-1.5 hover:bg-cyber-red/15 rounded text-slate-400 hover:text-cyber-red transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
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
