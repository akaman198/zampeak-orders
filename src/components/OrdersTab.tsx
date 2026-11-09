'use client';

import React, { useState, useEffect } from 'react';
import { useApp, getOrderRunners, getOrderProgressSummary, isGamerOnOrder } from '../context/AppContext';
import { OrderStatus, AssetType, Order, ShiftType, OrderDailyProgress } from '../types';
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
  AlertTriangle,
  XCircle,
  Sun,
  Moon,
  Home,
  BarChart3,
  Users,
  UserPlus,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';

const formatM = (val: number) => {
  if (val % 1 === 0) return String(val);
  return val.toFixed(1);
};

export default function OrdersTab() {
  const { 
    orders: allOrders, 
    gamers, 
    addOrder, 
    updateOrder, 
    deleteOrder, 
    updateOrderStatus, 
    logOrderDailyProgress,
    deleteOrderDailyProgress,
    role, 
    gamerProfile 
  } = useApp();

  // Control UI states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<Order | null>(null);

  // Form Fields
  const [orderNumber, setOrderNumber] = useState('');
  const [assignedGamerIds, setAssignedGamerIds] = useState<string[]>([]);
  const [selectedRunnerToAdd, setSelectedRunnerToAdd] = useState<string>('');
  const [sizeMillions, setSizeMillions] = useState<number>(50);
  const [assetType, setAssetType] = useState<AssetType>('Haval Coins');
  const [startDate, setStartDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Running');
  const [payout, setPayout] = useState<number>(50);
  const [progressMillions, setProgressMillions] = useState<number>(0);
  const [isPayoutOverridden, setIsPayoutOverridden] = useState(false);
  const [formError, setFormError] = useState('');
  const [gamerSearchQuery, setGamerSearchQuery] = useState('');

  // Daily Progress Logging Modal State
  const [activeLogOrder, setActiveLogOrder] = useState<Order | null>(null);
  const [logGamerId, setLogGamerId] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [logShift, setLogShift] = useState<ShiftType>('day');
  const [logVolume, setLogVolume] = useState<string>('');
  const [logNotes, setLogNotes] = useState<string>('');
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState('');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [gamerFilter, setGamerFilter] = useState<string>('All');
  const [missionTypeFilter, setMissionTypeFilter] = useState<'All' | 'solo' | 'multi'>('All');
  const [shiftFilter, setShiftFilter] = useState<'All' | 'day' | 'night' | 'home'>('All');
  const [sortBy, setSortBy] = useState<'date' | 'order_number' | 'size' | 'payout'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Keep activeLogOrder in sync when allOrders updates
  useEffect(() => {
    if (activeLogOrder) {
      const refreshed = allOrders.find(o => o.id === activeLogOrder.id);
      if (refreshed) {
        setActiveLogOrder(refreshed);
      }
    }
  }, [allOrders]);

  // Filter orders if user is a gamer (includes multi-runner and volume-logged missions)
  const orders = role === 'gamer' && gamerProfile && gamerProfile.gamer_role !== 'technical_manager'
    ? allOrders.filter(o => isGamerOnOrder(o, gamerProfile.id))
    : allOrders;

  const isManager = role === 'admin' || (role === 'gamer' && gamerProfile?.gamer_role === 'technical_manager');
  const isAdminOrViewer = role === 'admin' || role === 'viewer' || (role === 'gamer' && gamerProfile?.gamer_role === 'technical_manager');

  // Get active/standby gamers list (exclude technical manager)
  const getGamerRosterStatus = () => {
    const activeGamers = gamers.filter(g => g.status === 'active' && g.gamer_role !== 'technical_manager');
    
    return activeGamers.map(g => {
      // Find running orders assigned to this gamer
      const runningMissions = allOrders.filter(o => isGamerOnOrder(o, g.id) && o.status === 'Running');
      return {
        gamer: g,
        isDeployed: runningMissions.length > 0,
        currentMissions: runningMissions
      };
    });
  };

  const gamerRosterStatus = getGamerRosterStatus();
  const standbyGamers = gamerRosterStatus.filter(r => !r.isDeployed);
  const deployedGamers = gamerRosterStatus.filter(r => r.isDeployed);

  // Filter gamers list in Select dropdown (Only active gamers)
  const filteredGamersForSelect = gamers.filter(g => 
    g.status === 'active' && (
      g.name.toLowerCase().includes(gamerSearchQuery.toLowerCase()) ||
      g.employee_id.toLowerCase().includes(gamerSearchQuery.toLowerCase())
    )
  );

  // Auto-update payout when sizeMillions changes (unless overridden)
  useEffect(() => {
    if (!isPayoutOverridden) {
      setPayout(sizeMillions);
    }
  }, [sizeMillions, isPayoutOverridden]);

  // Set default deployment date on form open
  const openNewOrderForm = () => {
    if (!isManager) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    
    setOrderNumber('');
    const activeGamers = gamers.filter(g => g.status === 'active' && g.gamer_role !== 'technical_manager');
    const initialGamerId = activeGamers.length > 0 ? activeGamers[0].id : gamers[0]?.id || '';
    setAssignedGamerIds(initialGamerId ? [initialGamerId] : []);
    setSelectedRunnerToAdd('');
    setSizeMillions(50);
    setAssetType('Haval Coins');
    setStartDate(now.toISOString().slice(0, 16));
    setStatus('Running');
    setPayout(50);
    setProgressMillions(0);
    setIsPayoutOverridden(false);
    setFormError('');
    setGamerSearchQuery('');
    setIsEditing(null);
    setIsFormOpen(true);
  };

  const openEditOrderForm = (order: Order) => {
    if (!isManager) return;
    setIsEditing(order);
    setOrderNumber(order.order_number);
    const runners = getOrderRunners(order);
    setAssignedGamerIds(runners.length > 0 ? runners : [order.gamer_id]);
    setSelectedRunnerToAdd('');
    setSizeMillions(order.size_millions);
    setAssetType(order.asset_type || 'Haval Coins');
    setStartDate(new Date(order.start_date).toISOString().slice(0, 16));
    setStatus(order.status);
    setPayout(order.payout);
    setProgressMillions(order.progress_millions || (order.status === 'Completed' ? order.size_millions : 0));
    setIsPayoutOverridden(order.payout !== order.size_millions);
    setFormError('');
    setGamerSearchQuery('');
    setIsFormOpen(true);
  };

  // Add runner to form's assigned list
  const handleAddRunner = () => {
    if (!selectedRunnerToAdd) return;
    if (assignedGamerIds.includes(selectedRunnerToAdd)) return;
    setAssignedGamerIds([...assignedGamerIds, selectedRunnerToAdd]);
    setSelectedRunnerToAdd('');
  };

  // Remove runner from form's assigned list
  const handleRemoveRunner = (idToRemove: string) => {
    if (assignedGamerIds.length <= 1) {
      setFormError('At least one operational operator must remain assigned to the order.');
      return;
    }
    setAssignedGamerIds(assignedGamerIds.filter(id => id !== idToRemove));
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    if (!orderNumber.trim()) {
      setFormError('Order Number is required.');
      return;
    }
    if (assignedGamerIds.length === 0) {
      setFormError('At least one operational operator must be assigned.');
      return;
    }
    if (sizeMillions <= 0) {
      setFormError('Order Size must be positive.');
      return;
    }

    const formattedDate = new Date(startDate).toISOString();
    const primaryGamerId = assignedGamerIds[0];
    const secondaryGamerId = assignedGamerIds.length > 1 ? assignedGamerIds[1] : null;

    if (isEditing) {
      const numberExists = orders.some(
        o => o.id !== isEditing.id && o.order_number.trim().toLowerCase() === orderNumber.trim().toLowerCase()
      );
      if (numberExists) {
        setFormError(`Order Number ${orderNumber.trim()} is already assigned to another order.`);
        return;
      }

      const res = await updateOrder(
        isEditing.id,
        orderNumber.trim(),
        primaryGamerId,
        sizeMillions,
        assetType,
        formattedDate,
        status,
        payout,
        progressMillions,
        secondaryGamerId,
        assignedGamerIds,
        isEditing.daily_progress
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
        primaryGamerId,
        sizeMillions,
        assetType,
        formattedDate,
        status,
        payout,
        progressMillions,
        secondaryGamerId,
        assignedGamerIds,
        []
      );
      if (res.success) {
        setIsFormOpen(false);
      } else {
        setFormError(res.error || 'Failed to deploy order.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (role !== 'admin') return;
    if (confirm('Are you sure you want to terminate this order log?')) {
      const res = await deleteOrder(id);
      if (!res.success) {
        alert(res.error);
      }
    }
  };

  // Open Daily Progress Logging Modal
  const openDailyLogModal = (order: Order) => {
    setActiveLogOrder(order);
    const runners = getOrderRunners(order);
    if (role === 'gamer' && gamerProfile && runners.includes(gamerProfile.id)) {
      setLogGamerId(gamerProfile.id);
    } else {
      setLogGamerId(runners[0] || order.gamer_id);
    }
    setLogVolume('');
    setLogNotes('');
    setLogError('');
  };

  // Submit daily progress entry
  const handleAddDailyProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLogOrder) return;
    const vol = parseFloat(logVolume);
    if (isNaN(vol) || vol <= 0) {
      setLogError('Please specify a positive volume made in Millions.');
      return;
    }
    if (!logGamerId) {
      setLogError('Please choose which operator made this volume.');
      return;
    }

    setLogSubmitting(true);
    setLogError('');

    const res = await logOrderDailyProgress(activeLogOrder.id, {
      gamer_id: logGamerId,
      date: logDate,
      shift: logShift,
      volume_millions: vol,
      notes: logNotes.trim()
    });

    setLogSubmitting(false);
    if (res.success) {
      setLogVolume('');
      setLogNotes('');
    } else {
      setLogError(res.error || 'Failed to record daily progress.');
    }
  };

  // Delete daily progress log entry
  const handleDeleteLogEntry = async (logId: string) => {
    if (!activeLogOrder) return;
    if (!confirm('Are you sure you want to remove this volume log entry?')) return;
    await deleteOrderDailyProgress(activeLogOrder.id, logId);
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
      const runners = getOrderRunners(order);
      const runnerGamers = runners.map(id => gamers.find(g => g.id === id)).filter(Boolean);
      
      const matchesSearch = 
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        runnerGamers.some(g => 
          g?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g?.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesGamer = gamerFilter === 'All' || isGamerOnOrder(order, gamerFilter);
      const isMulti = runners.length > 1;
      const matchesMissionType = missionTypeFilter === 'All' || 
        (missionTypeFilter === 'multi' && isMulti) || 
        (missionTypeFilter === 'solo' && !isMulti);

      const matchesShift = shiftFilter === 'All' || 
        order.daily_progress?.some(l => l.shift === shiftFilter);

      return matchesSearch && matchesStatus && matchesGamer && matchesMissionType && matchesShift;
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

  const getShiftBadge = (shift: ShiftType) => {
    if (shift === 'day') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
          <Sun size={10} /> Day Shift
        </span>
      );
    }
    if (shift === 'night') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
          <Moon size={10} /> Night Shift
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
        <Home size={10} /> Home / Mobile
      </span>
    );
  };

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
            placeholder="Search by Order ID or Operator name/ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-dark/80 border border-cyber-border rounded pl-10 pr-3 py-2.5 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
          />
        </div>

        {/* Filters and Add Buttons */}
        <div className="flex flex-wrap gap-2.5 font-mono text-xs items-center">
          {/* Status Filter */}
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-cyber-dark/80 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
          >
            <option value="All">All Statuses</option>
            <option value="Running">Running</option>
            <option value="Paused">Paused</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Violation">Violation</option>
          </select>

          {/* Mission Type Filter */}
          <select 
            value={missionTypeFilter} 
            onChange={(e) => setMissionTypeFilter(e.target.value as 'All' | 'solo' | 'multi')}
            className="bg-cyber-dark/80 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
          >
            <option value="All">All Teams</option>
            <option value="solo">Solo Operators</option>
            <option value="multi">Multi-Operator Squads</option>
          </select>

          {/* Shift Filter */}
          <select 
            value={shiftFilter} 
            onChange={(e) => setShiftFilter(e.target.value as 'All' | 'day' | 'night' | 'home')}
            className="bg-cyber-dark/80 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
          >
            <option value="All">All Shifts</option>
            <option value="day">☀️ Day Shift</option>
            <option value="night">🌙 Night Shift</option>
            <option value="home">🏠 Home / Mobile</option>
          </select>

          {/* Gamer Filter */}
          {isAdminOrViewer && (
            <select 
              value={gamerFilter} 
              onChange={(e) => setGamerFilter(e.target.value)}
              className="bg-cyber-dark/80 border border-cyber-border rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-cyber-cyan cursor-pointer max-w-[170px] truncate text-xs"
            >
              <option value="All">All Operators</option>
              {gamers
                .filter(g => g.gamer_role !== 'technical_manager')
                .map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))
              }
            </select>
          )}

          {/* Deploy Order Button */}
          {isManager && (
            <button 
              onClick={openNewOrderForm}
              className="flex items-center gap-1.5 bg-cyber-cyan text-slate-950 font-bold px-3.5 py-2 rounded hover:bg-cyan-400 shadow-neon-cyan/20 hover:shadow-neon-cyan/30 transition-all cursor-pointer uppercase tracking-wider"
            >
              <PlusCircle size={14} />
              Deploy Order
            </button>
          )}
          {role === 'viewer' && (
            <span className="text-[10px] text-cyber-amber font-mono bg-cyber-amber/10 px-2.5 py-1.5 rounded border border-cyber-amber/30 font-bold uppercase">
              Audit Mode
            </span>
          )}
        </div>
      </div>

      {/* Deploy/Edit Order Dialog Overlay */}
      {isFormOpen && isManager && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/40 w-full max-w-xl relative my-8">
            <div className="hud-grid"></div>
            
            <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest border-b border-cyber-cyan/20 pb-3 mb-5 flex justify-between items-center">
              <span>{isEditing ? `Modify Deployment: ${isEditing.order_number}` : 'Deploy New Mission'}</span>
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

              {/* Order Number */}
              <div className="space-y-1">
                <label className="text-slate-400 uppercase tracking-wider">Order Number</label>
                <input 
                  type="text" 
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. ZP-2024 or 100M-NIGHT-01"
                  className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              {/* Multi-Operator Assignment Section */}
              <div className="p-4 bg-slate-900/60 rounded border border-cyber-cyan/30 space-y-3">
                <div className="flex items-center justify-between border-b border-cyber-border/30 pb-2">
                  <label className="text-cyber-cyan font-bold uppercase text-[11px] flex items-center gap-1.5">
                    <Users size={14} /> Assigned Operators ({assignedGamerIds.length})
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {assignedGamerIds.length > 1 ? '⚡ Multi-Operator Shared Mission' : 'Solo Assignment'}
                  </span>
                </div>

                {/* Assigned Runners Chip List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Current Crew on this Order:</span>
                  <div className="flex flex-wrap gap-2">
                    {assignedGamerIds.map((gId, index) => {
                      const gamer = gamers.find(g => g.id === gId);
                      const isLead = index === 0;
                      return (
                        <div 
                          key={gId} 
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs ${
                            isLead 
                              ? 'bg-cyber-cyan/15 border-cyber-cyan/40 text-cyber-cyan font-bold' 
                              : 'bg-slate-800/80 border-cyber-border text-slate-300'
                          }`}
                        >
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono bg-slate-950/60">
                            {isLead ? 'Lead' : `Runner #${index + 1}`}
                          </span>
                          <span>{gamer?.name || 'Unknown'} (ID: {gamer?.employee_id})</span>
                          {assignedGamerIds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRunner(gId)}
                              title="Remove operator from order"
                              className="text-slate-400 hover:text-cyber-red ml-1 transition-colors cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Operator to Order */}
                <div className="pt-2 border-t border-cyber-border/20 space-y-2">
                  <span className="text-[10px] text-slate-400 block uppercase">Add Another Operator (Day / Night / Home):</span>
                  <div className="flex gap-2">
                    <select 
                      value={selectedRunnerToAdd}
                      onChange={(e) => setSelectedRunnerToAdd(e.target.value)}
                      className="flex-1 bg-slate-950 border border-cyber-border rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                    >
                      <option value="">Select operator to add...</option>
                      {filteredGamersForSelect
                        .filter(g => g.gamer_role !== 'technical_manager' && !assignedGamerIds.includes(g.id))
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name} (ID: {g.employee_id})</option>
                        ))
                      }
                    </select>
                    <button
                      type="button"
                      onClick={handleAddRunner}
                      disabled={!selectedRunnerToAdd}
                      className="flex items-center gap-1 bg-cyber-green/20 hover:bg-cyber-green text-cyber-green hover:text-slate-950 border border-cyber-green/40 px-3 py-1.5 rounded font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
                    >
                      <UserPlus size={13} /> Add
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    💡 <em>Pro-tip:</em> When multiple operators are assigned, you can log the exact daily volumes made by each runner on day, night, or home shifts. Completed order units and payouts will accurately reflect each operator&apos;s real contributions.
                  </p>
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
                    onChange={(e) => {
                      const newStatus = e.target.value as OrderStatus;
                      setStatus(newStatus);
                      if (newStatus === 'Completed') {
                        setProgressMillions(sizeMillions);
                      }
                    }}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer"
                  >
                    <option value="Running">Running</option>
                    <option value="Paused">Paused</option>
                    <option value="Completed">Completed</option>
                    {role === 'admin' && <option value="Cancelled">Cancelled</option>}
                    <option value="Violation">Violation</option>
                  </select>
                </div>
              </div>

              {/* Progress Tracker Override */}
              <div className="p-3 bg-slate-900/60 rounded border border-cyber-border/40 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-slate-300 uppercase font-bold text-[10px]">
                    Volume Farmed Progress (Millions)
                  </label>
                  <span className="text-[10px] text-cyber-cyan font-bold">
                    {progressMillions}M / {sizeMillions}M ({Math.max(0, sizeMillions - progressMillions)}M Left)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0"
                    max={sizeMillions * 2}
                    step="5"
                    value={progressMillions}
                    onChange={(e) => setProgressMillions(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-cyber-border rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan"
                    placeholder="Total volume farmed so far"
                  />
                  <span className="text-xs text-slate-400 font-bold">M</span>
                </div>
              </div>

              {/* Payout & Actions */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total Order Payout</span>
                  <span className="text-base font-bold text-cyber-green">K{payout}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-cyber-border rounded hover:bg-slate-800 transition-colors uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-cyber-cyan text-slate-950 font-bold px-5 py-2 rounded hover:bg-cyan-400 shadow-neon-cyan/20 transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {isEditing ? 'Save Changes' : 'Confirm Deployment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Volume & Shift Progress Logging Modal */}
      {activeLogOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="tactical-panel p-6 rounded clip-corners border border-cyber-cyan/50 w-full max-w-2xl relative my-8 font-mono text-xs">
            <div className="hud-grid"></div>

            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-cyber-cyan/30 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-cyber-cyan font-black text-sm uppercase tracking-wider">
                    [Daily Volume &amp; Shift Log]
                  </span>
                  <span className="bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 px-2 py-0.5 rounded text-[10px] font-bold">
                    {activeLogOrder.order_number}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Record daily volumes made by employees on Day Shift, Night Shift, or Home/Mobile sessions.
                </p>
              </div>
              <button 
                onClick={() => setActiveLogOrder(null)} 
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Progress Status Bar */}
            {(() => {
              const summary = getOrderProgressSummary(activeLogOrder);
              const runners = getOrderRunners(activeLogOrder);
              return (
                <div className="space-y-4">
                  {/* Progress Header Card */}
                  <div className="p-3 bg-slate-900/80 rounded border border-cyber-border/60 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 uppercase text-[10px]">Total Farmed So Far: </span>
                        <span className="text-cyber-green font-bold text-sm">{formatM(summary.totalMade)}M</span>
                        <span className="text-slate-500 text-[10px]"> / {formatM(activeLogOrder.size_millions)}M Target</span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase text-[10px]">Remaining: </span>
                        <span className={`font-bold text-sm ${summary.remaining > 0 ? 'text-cyber-amber' : 'text-cyber-green'}`}>
                          {formatM(summary.remaining)}M
                        </span>
                        <span className="text-cyber-cyan text-[10px] ml-1.5 font-bold">({summary.percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-cyber-border/40">
                      <div 
                        className="bg-gradient-to-r from-cyber-cyan via-cyan-400 to-cyber-green h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, summary.percentage)}%` }}
                      ></div>
                    </div>

                    {/* Per-Employee Summary Cards */}
                    <div className="pt-2 border-t border-cyber-border/30">
                      <span className="text-[10px] text-slate-400 block uppercase mb-1.5 font-bold">
                        👥 Volume Contribution by Operator:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {runners.map(rId => {
                          const gamer = gamers.find(g => g.id === rId);
                          const stats = summary.gamerTotals[rId] || { volume: 0, dayVolume: 0, nightVolume: 0, homeVolume: 0, logsCount: 0 };
                          const unitsCredited = Math.floor(stats.volume / 10);
                          return (
                            <div key={rId} className="p-2 bg-slate-950/70 rounded border border-cyber-border/40 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-200">{gamer?.name || 'Unknown'}</span>
                                <span className="text-cyber-green font-bold">{formatM(stats.volume)}M made</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>ID: {gamer?.employee_id}</span>
                                <span className="text-cyber-cyan font-bold">({unitsCredited} Orders / units)</span>
                              </div>
                              <div className="flex flex-wrap gap-1 text-[9px] pt-1 border-t border-slate-900">
                                {stats.dayVolume > 0 && (
                                  <span className="text-amber-400 flex items-center gap-0.5">
                                    <Sun size={9} /> {formatM(stats.dayVolume)}M
                                  </span>
                                )}
                                {stats.nightVolume > 0 && (
                                  <span className="text-indigo-300 flex items-center gap-0.5">
                                    <Moon size={9} /> {formatM(stats.nightVolume)}M
                                  </span>
                                )}
                                {stats.homeVolume > 0 && (
                                  <span className="text-emerald-300 flex items-center gap-0.5">
                                    <Home size={9} /> {formatM(stats.homeVolume)}M
                                  </span>
                                )}
                                {stats.volume === 0 && (
                                  <span className="text-slate-600 italic">No volume logged yet</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Add New Daily Volume Log Form */}
                  <form onSubmit={handleAddDailyProgress} className="p-4 bg-slate-900/60 rounded border border-cyber-cyan/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-cyber-border/30 pb-1.5">
                      <span className="text-cyber-cyan font-bold uppercase text-[11px] flex items-center gap-1.5">
                        <Sparkles size={13} /> Record Volume Made on This Order
                      </span>
                    </div>

                    {logError && (
                      <div className="p-2 border border-cyber-red/30 bg-cyber-red/10 text-cyber-red rounded text-[11px]">
                        {logError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Operator Select */}
                      <div className="space-y-1">
                        <label className="text-slate-400 uppercase text-[10px] block">Operator</label>
                        <select
                          value={logGamerId}
                          onChange={(e) => setLogGamerId(e.target.value)}
                          className="w-full bg-slate-950 border border-cyber-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                        >
                          {runners.map(rId => {
                            const gamer = gamers.find(g => g.id === rId);
                            return (
                              <option key={rId} value={rId}>
                                {gamer?.name || 'Unknown'} (ID: {gamer?.employee_id})
                              </option>
                            );
                          })}
                          {/* Allow picking another gamer if not in runners list */}
                          {filteredGamersForSelect
                            .filter(g => !runners.includes(g.id) && g.gamer_role !== 'technical_manager')
                            .map(g => (
                              <option key={g.id} value={g.id}>
                                + {g.name} (Assisting - ID: {g.employee_id})
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      {/* Date */}
                      <div className="space-y-1">
                        <label className="text-slate-400 uppercase text-[10px] block">Date</label>
                        <input
                          type="date"
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="w-full bg-slate-950 border border-cyber-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
                        />
                      </div>

                      {/* Shift Type */}
                      <div className="space-y-1">
                        <label className="text-slate-400 uppercase text-[10px] block">Shift</label>
                        <select
                          value={logShift}
                          onChange={(e) => setLogShift(e.target.value as ShiftType)}
                          className="w-full bg-slate-950 border border-cyber-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan cursor-pointer text-xs"
                        >
                          <option value="day">☀️ Day Shift</option>
                          <option value="night">🌙 Night Shift</option>
                          <option value="home">🏠 Home / Mobile</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Volume in Millions */}
                      <div className="space-y-1">
                        <label className="text-slate-400 uppercase text-[10px] block">Volume Made (M)</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            value={logVolume}
                            onChange={(e) => setLogVolume(e.target.value)}
                            placeholder="e.g. 15 or 25.5"
                            className="w-full bg-slate-950 border border-cyber-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
                          />
                          <span className="text-xs text-slate-400 font-bold">M</span>
                        </div>
                      </div>

                      {/* Notes / Device / Shift details */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-slate-400 uppercase text-[10px] block">Notes (Optional)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={logNotes}
                            onChange={(e) => setLogNotes(e.target.value)}
                            placeholder="e.g. Phone #3 took home, completed chapter 8"
                            className="flex-1 bg-slate-950 border border-cyber-border rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyber-cyan text-xs"
                          />
                          <button
                            type="submit"
                            disabled={logSubmitting || !logVolume}
                            className="bg-cyber-cyan text-slate-950 font-bold px-3 py-1.5 rounded hover:bg-cyan-400 transition-all uppercase tracking-wider text-xs whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {logSubmitting ? 'Saving...' : '+ Save Log'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* Volume Logs History Table */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      📜 Logged Progress History ({activeLogOrder.daily_progress?.length || 0} entries):
                    </span>

                    {(!activeLogOrder.daily_progress || activeLogOrder.daily_progress.length === 0) ? (
                      <div className="p-4 bg-slate-950/40 rounded border border-cyber-border/30 text-center text-slate-500 italic">
                        No individual daily volume logs recorded yet for this order. Use the form above to record shift contributions.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto rounded border border-cyber-border/40">
                        <table className="w-full text-left">
                          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] border-b border-cyber-border/40 sticky top-0">
                            <tr>
                              <th className="p-2">Date</th>
                              <th className="p-2">Operator</th>
                              <th className="p-2">Shift</th>
                              <th className="p-2 text-right">Volume</th>
                              <th className="p-2">Notes</th>
                              <th className="p-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyber-border/20 text-xs">
                            {activeLogOrder.daily_progress.map(log => {
                              const gamer = gamers.find(g => g.id === log.gamer_id);
                              return (
                                <tr key={log.id} className="hover:bg-slate-900/50">
                                  <td className="p-2 font-mono text-slate-300">{log.date}</td>
                                  <td className="p-2">
                                    <div className="font-bold text-slate-200">{gamer?.name || 'Unknown'}</div>
                                    <div className="text-[9px] text-slate-500">ID: {gamer?.employee_id}</div>
                                  </td>
                                  <td className="p-2">{getShiftBadge(log.shift)}</td>
                                  <td className="p-2 text-right font-bold text-cyber-green">{formatM(log.volume_millions)}M</td>
                                  <td className="p-2 text-slate-400 text-[10px] max-w-[150px] truncate">{log.notes || '-'}</td>
                                  <td className="p-2 text-center">
                                    {isManager && (
                                      <button
                                        onClick={() => handleDeleteLogEntry(log.id)}
                                        title="Delete log entry"
                                        className="text-slate-500 hover:text-cyber-red p-1 transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
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
            })()}
          </div>
        </div>
      )}

      {/* Main Order View & Standby Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Orders Table Panel */}
        <div className="xl:col-span-3">
          <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 font-mono text-xs">
            {filteredOrders.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Gamepad2 size={36} className="mx-auto mb-2 opacity-30 text-cyber-cyan" />
                <p>No operational orders found matching the filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-cyber-border/50 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th 
                        className="p-3 cursor-pointer hover:text-cyber-cyan transition-colors"
                        onClick={() => toggleSort('order_number')}
                      >
                        Order ID {sortBy === 'order_number' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-3">Assigned Operators</th>
                      <th 
                        className="p-3 cursor-pointer hover:text-cyber-cyan transition-colors"
                        onClick={() => toggleSort('size')}
                      >
                        Progress &amp; Quota {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="p-3 text-right cursor-pointer hover:text-cyber-cyan transition-colors"
                        onClick={() => toggleSort('payout')}
                      >
                        {isManager ? 'Payout (K)' : 'My Payout Share'} {sortBy === 'payout' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th 
                        className="p-3 cursor-pointer hover:text-cyber-cyan transition-colors"
                        onClick={() => toggleSort('date')}
                      >
                        Deployed On {sortBy === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                      </th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Volume Logs &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30">
                    {filteredOrders.map((order) => {
                      const runners = getOrderRunners(order);
                      const runnerGamers = runners.map(id => gamers.find(g => g.id === id)).filter(Boolean);
                      const isMulti = runners.length > 1;
                      const summary = getOrderProgressSummary(order);

                      // Calculate gamer effective payout
                      let effectivePayout = order.payout;
                      if (!isManager && gamerProfile) {
                        if (summary.totalMade > 0 && summary.gamerTotals[gamerProfile.id]) {
                          const gamerVol = summary.gamerTotals[gamerProfile.id].volume;
                          effectivePayout = Math.round((gamerVol / order.size_millions) * order.payout);
                        } else if (isMulti) {
                          effectivePayout = Math.round(order.payout / runners.length);
                        }
                      }

                      return (
                        <tr key={order.id} className="hover:bg-slate-900/30 transition-colors">
                          {/* Order Number */}
                          <td className="p-3 text-cyber-cyan font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isManager ? (
                                <button
                                  onClick={() => openEditOrderForm(order)}
                                  title="Click to edit Order parameters and Order Number"
                                  className="text-left hover:text-white hover:underline transition-all inline-flex items-center gap-1 group cursor-pointer"
                                >
                                  <span>{order.order_number}</span>
                                  <Edit3 size={10} className="opacity-0 group-hover:opacity-100 text-cyber-cyan transition-opacity" />
                                </button>
                              ) : (
                                <span>{order.order_number}</span>
                              )}
                              {isMulti && (
                                <span className="text-[8px] text-cyber-green bg-cyber-green/10 border border-cyber-green/30 px-1 py-0.5 rounded uppercase font-mono">
                                  {runners.length} Runners
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-normal block mt-0.5">
                              {order.asset_type || 'Haval Coins'}
                            </span>
                          </td>

                          {/* Assigned Operators */}
                          <td className="p-3">
                            <div className="space-y-1">
                              {runnerGamers.map((gamer, i) => {
                                if (!gamer) return null;
                                const gamerVol = summary.gamerTotals[gamer.id]?.volume || 0;
                                const isLead = i === 0;
                                return (
                                  <div key={gamer.id} className="flex items-center gap-1.5 text-xs">
                                    <span className={`font-bold ${isLead ? 'text-slate-200' : 'text-slate-400'}`}>
                                      {gamer.name}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-mono">ID:{gamer.employee_id}</span>
                                    {gamerVol > 0 && (
                                      <span className="text-[9px] text-cyber-cyan font-bold bg-cyber-cyan/10 px-1 rounded border border-cyber-cyan/20">
                                        {formatM(gamerVol)}M
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {runnerGamers.length === 0 && (
                                <span className="text-slate-500 italic">No operators assigned</span>
                              )}
                            </div>
                          </td>

                          {/* Progress & Quota */}
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="font-bold text-slate-200">
                                  {formatM(summary.totalMade)}M <span className="text-[9px] text-slate-400 font-normal">/ {formatM(order.size_millions)}M</span>
                                </span>
                                <span className={`text-[10px] font-bold ${summary.remaining > 0 ? 'text-cyber-amber' : 'text-cyber-green'}`}>
                                  {summary.remaining > 0 ? `${formatM(summary.remaining)}M left` : 'Completed'}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-36 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-cyber-border/40">
                                <div 
                                  className="bg-gradient-to-r from-cyber-cyan to-cyber-green h-full"
                                  style={{ width: `${Math.min(100, summary.percentage)}%` }}
                                ></div>
                              </div>

                              <span className="text-[9px] text-slate-500 font-mono block">
                                {Math.floor(order.size_millions / 10)} Orders target (10M/unit)
                              </span>
                            </div>
                          </td>

                          {/* Payout */}
                          <td className="p-3 text-right font-bold text-cyber-green">
                            K{isManager ? order.payout : effectivePayout}
                            {isMulti && !isManager && (
                              <span className="text-[8px] text-slate-500 font-normal block">(Individual Share)</span>
                            )}
                            {order.payout !== order.size_millions && isManager && (
                              <span className="text-[8px] text-cyber-cyan font-bold block">(Override)</span>
                            )}
                          </td>

                          {/* Deployment Date */}
                          <td className="p-3 text-slate-400 text-[11px]">
                            {new Date(order.start_date).toLocaleDateString()} {new Date(order.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* Status Badge */}
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              order.status === 'Running' ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30' :
                              order.status === 'Completed' ? 'bg-cyber-green/15 text-cyber-green border border-cyber-green/30' :
                              order.status === 'Paused' ? 'bg-cyber-amber/15 text-cyber-amber border border-cyber-amber/30' :
                              order.status === 'Violation' ? 'bg-cyber-red/15 text-cyber-red border border-cyber-red/30' :
                              order.status === 'Cancelled' ? 'bg-slate-700/20 text-slate-400 border border-slate-600/30' :
                              'bg-slate-700/15 text-slate-400 border border-slate-600/30'
                            }`}>
                              {order.status}
                            </span>
                          </td>

                          {/* Volume Logs Button & Actions */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Log Volume Action Button */}
                              <button
                                onClick={() => openDailyLogModal(order)}
                                title="Open Daily Volume & Shift Progress Logger"
                                className="flex items-center gap-1 text-[10px] bg-cyber-cyan/15 hover:bg-cyber-cyan/30 text-cyber-cyan border border-cyber-cyan/35 px-2 py-1 rounded transition-all cursor-pointer font-bold"
                              >
                                <BarChart3 size={11} />
                                <span>Logs ({order.daily_progress?.length || 0})</span>
                              </button>

                              {isManager && (
                                <>
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
                                    {role === 'admin' && (
                                      <button 
                                        onClick={() => updateOrderStatus(order.id, 'Cancelled')}
                                        title="Set Cancelled"
                                        className={`p-1 rounded transition-colors ${order.status === 'Cancelled' ? 'bg-slate-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-500'}`}
                                      >
                                        <XCircle size={10} />
                                      </button>
                                    )}
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
                                    {role === 'admin' && (
                                      <button 
                                        onClick={() => handleDelete(order.id)}
                                        title="Terminate Log"
                                        className="p-1.5 hover:bg-cyber-red/15 rounded text-slate-400 hover:text-cyber-red transition-colors"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
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

        {/* Standby panel (1/4 width) */}
        <div className="xl:col-span-1">
          {isAdminOrViewer && (
            <div className="tactical-panel p-4 rounded clip-corners border border-cyber-border/40 bg-slate-950/20 font-mono text-xs">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-2 mb-3 flex items-center justify-between">
                <span>Operational Roster</span>
                <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1 py-0.5 rounded">standby status</span>
              </h3>

              <div className="space-y-4">
                {/* Standby list */}
                <div>
                  <div className="text-[10px] text-cyber-cyan uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan animate-pulse"></span>
                    Standby (Ready to Deploy) - {standbyGamers.length}
                  </div>
                  {standbyGamers.length === 0 ? (
                    <div className="text-[10px] text-slate-600 uppercase italic pl-2.5">All operators deployed.</div>
                  ) : (
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {standbyGamers.map(r => (
                        <div 
                          key={r.gamer.id} 
                          onClick={() => {
                            setAssignedGamerIds([r.gamer.id]);
                            const now = new Date();
                            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                            setOrderNumber('');
                            setSizeMillions(50);
                            setAssetType('Haval Coins');
                            setStartDate(now.toISOString().slice(0, 16));
                            setStatus('Running');
                            setPayout(50);
                            setIsPayoutOverridden(false);
                            setFormError('');
                            setGamerSearchQuery('');
                            setIsEditing(null);
                            setIsFormOpen(true);
                          }}
                          className="flex justify-between items-center p-1.5 rounded border border-cyber-border/20 bg-slate-900/30 hover:bg-cyber-cyan/10 hover:border-cyber-cyan/30 transition-all cursor-pointer"
                          title="Click to Deploy Order to this gamer"
                        >
                          <span className="font-bold text-slate-300">{r.gamer.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">ID: {r.gamer.employee_id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deployed list */}
                <div>
                  <div className="text-[10px] text-cyber-amber uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyber-amber animate-pulse"></span>
                    Deployed (Active) - {deployedGamers.length}
                  </div>
                  {deployedGamers.length === 0 ? (
                    <div className="text-[10px] text-slate-600 uppercase italic pl-2.5">No active deployments.</div>
                  ) : (
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {deployedGamers.map(r => (
                        <div key={r.gamer.id} className="p-1.5 rounded border border-cyber-border/10 bg-slate-900/10">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-400">{r.gamer.name}</span>
                            <span className="text-[9px] text-slate-500">ID: {r.gamer.employee_id}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.currentMissions.map(m => (
                              <span key={m.id} className="text-[8px] px-1 bg-cyber-amber/10 border border-cyber-amber/25 text-cyber-amber rounded font-mono font-bold">
                                {m.order_number} ({m.size_millions}M)
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}