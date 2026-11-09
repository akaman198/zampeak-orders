'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  useApp, 
  getPayPeriodLabel, 
  getOrderPeriodLabel,
  getOrderRunners,
  isGamerOnOrder
} from '../context/AppContext';
import { OrderStatus, ShiftType } from '../types';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Upload, 
  Database,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Home,
  Search,
  Gamepad2,
  Clock,
  Layers,
  Sparkles,
  Users
} from 'lucide-react';

const formatM = (val: number) => {
  if (val % 1 === 0) return String(val);
  return val.toFixed(1);
};

export default function ReportsTab() {
  const { gamers, orders, attendance, importBackupData, calculatePayroll, getDailyGamerEarnings, role } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayStr);
  const [selectedGamerFilter, setSelectedGamerFilter] = useState<string>('all');

  // Orders Report States & Filters
  const [orderCycleFilter, setOrderCycleFilter] = useState<string>('current');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderGamerFilter, setOrderGamerFilter] = useState<string>('all');
  const [orderShiftFilter, setOrderShiftFilter] = useState<'all' | 'day' | 'night' | 'home'>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>('');
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all');
  const [ordersViewMode, setOrdersViewMode] = useState<'orders' | 'sessions'>('orders');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // Generate list of cycles
  const getAvailablePayCycles = () => {
    const cyclesSet = new Set<string>();
    
    // Always include previous, current and next month's cycles
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    cyclesSet.add(getPayPeriodLabel(prevMonthDate.toISOString()));
    cyclesSet.add(getPayPeriodLabel(now.toISOString()));
    cyclesSet.add(getPayPeriodLabel(nextMonthDate.toISOString()));

    // Add cycles from completed orders
    orders.forEach(o => {
      if (o.status === 'Completed') {
        cyclesSet.add(getOrderPeriodLabel(o.completed_date || o.start_date));
      }
    });

    // Add cycles from attendance records
    attendance.forEach(a => {
      cyclesSet.add(getPayPeriodLabel(a.date));
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return Array.from(cyclesSet).sort((a, b) => {
      const parseDate = (label: string) => {
        const parts = label.replace(',', '').split(' '); // e.g. ["November", "1", "2026"]
        const m = monthNames.indexOf(parts[0]);
        const d = parseInt(parts[1]) || 1;
        const y = parseInt(parts[2]) || 2026;
        return new Date(y, m, d).getTime();
      };
      return parseDate(b) - parseDate(a); // descending order
    });
  };

  const getCycleRangeLabel = (cycleLabel: string) => {
    if (!cycleLabel) return '';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const parts = cycleLabel.replace(',', '').split(' ');
    const monthIndex = monthNames.indexOf(parts[0]);
    const day = parseInt(parts[1]) || 1;
    const year = parseInt(parts[2]) || 2026;

    let prevMonthIndex = monthIndex - 1;
    let prevYear = year;
    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevYear -= 1;
    }

    if (day === 15) {
      return `Cycle period: ${monthNames[prevMonthIndex]} 16, ${prevYear} to ${parts[0]} 15, ${year}`;
    }

    if (cycleLabel === 'October 1, 2026') {
      return `Cycle period: Orders (Sep 14) / Attendance (Sep 15) to Sep 30, 2026`;
    }

    if (cycleLabel === 'October 5, 2026') {
      return `Cycle period: Orders (Sep 14) / Attendance (Sep 15) to Oct 5, 2026`;
    }

    if (day === 1) {
      return `Cycle period: ${monthNames[prevMonthIndex]} 1, ${prevYear} to ${parts[0]} 1, ${year}`;
    }

    return `Cycle period: ${monthNames[prevMonthIndex]} ${day}, ${prevYear} to ${parts[0]} ${day}, ${year}`;
  };

  const availableCycles = getAvailablePayCycles();
  const currentMonthCycle = getPayPeriodLabel(new Date().toISOString());
  const [selectedCycle, setSelectedCycle] = useState(
    availableCycles.includes(currentMonthCycle) ? currentMonthCycle : (availableCycles[0] || '')
  );

  // Active Gamers Payroll Calculations
  const activeOperators = gamers.filter(g => g.status === 'active');
  const payrollSummaries = activeOperators.map(g => calculatePayroll(g.id, selectedCycle));

  // Totals & Aggregates
  const totalDaysWorkedAll = payrollSummaries.reduce((sum, p) => sum + p.daysWorked, 0);
  const totalValidOrderUnitsAll = payrollSummaries.reduce((sum, p) => sum + (p.completedOrdersCount || 0), 0);
  const totalResponsibilitySalary = payrollSummaries.reduce((sum, p) => sum + (p.responsibilitySalary || 0), 0);
  const totalAttendanceSalary = payrollSummaries.reduce((sum, p) => sum + (p.attendanceSalary || 0), 0);
  const totalTransportAllowance = payrollSummaries.reduce((sum, p) => sum + (p.transportAllowance || 0), 0);
  const totalExcessOrderIncentive = payrollSummaries.reduce((sum, p) => sum + (p.excessOrderIncentive || 0), 0);
  const totalTopRunnerBonus = payrollSummaries.reduce((sum, p) => sum + (p.topRunnerBonus || 0), 0);
  const totalNormalOTHoursAll = payrollSummaries.reduce((sum, p) => sum + (p.normalOvertimeHours || 0), 0);
  const totalHolidayOTHoursAll = payrollSummaries.reduce((sum, p) => sum + (p.holidayOvertimeHours || 0), 0);
  const totalOvertimePayAll = payrollSummaries.reduce((sum, p) => sum + (p.overtimePay || 0), 0);
  const totalTLManagementAllowance = payrollSummaries.reduce((sum, p) => sum + (p.teamLeaderManagementAllowance || 0), 0);
  const totalTeamIncentive = payrollSummaries.reduce((sum, p) => sum + (p.teamIncentive || 0), 0);
  const totalPayAll = payrollSummaries.reduce((sum, p) => sum + p.totalPay, 0);

  // Operational metrics
  const cycleOrders = orders.filter(
    o => o.status === 'Completed' && getOrderPeriodLabel(o.completed_date || o.start_date) === selectedCycle
  );
  const totalCompletedMissions = cycleOrders.length;
  // Daily Gamer Earnings (synced directly from order volumes & logs)
  const dailyGamerEarnings = getDailyGamerEarnings(selectedCycle);
  const totalAssetsFarmedAll = dailyGamerEarnings.reduce((sum, r) => sum + Number(r.farmedMillions || 0), 0);
  const availableDailyDates = Array.from(new Set(dailyGamerEarnings.map(r => r.date))).sort().reverse();
  const filteredDailyEarnings = dailyGamerEarnings.filter(r => {
    const matchesDate = selectedDailyDate === 'all' || r.date === selectedDailyDate;
    const matchesGamer = selectedGamerFilter === 'all' || r.gamerId === selectedGamerFilter || r.gamerName === selectedGamerFilter;
    return matchesDate && matchesGamer;
  });

  // Export functions
  const exportToCSV = () => {
    const headers = [
      'Operator Name',
      'Days Worked',
      'Orders (26 Target)',
      'Responsibility Salary (K900 Base)',
      'Attendance Salary (K200 Base)',
      'Transport Allowance (K10/day)',
      'Excess Order Incentive',
      'Top Runner Bonus (K300)',
      'Normal OT Hours (1.5x)',
      'Holiday OT Hours (2.0x)',
      'Total Overtime Pay',
      'TL Management Allowance',
      'Team Incentive',
      'Additional Performance Award',
      'Total Net Pay (Kwacha K)'
    ];

    const rows = payrollSummaries.map(p => [
      `"${p.gamerName}"`,
      `"${p.daysWorked}/26"`,
      p.completedOrdersCount || 0,
      (p.responsibilitySalary || 0).toFixed(2),
      (p.attendanceSalary || 0).toFixed(2),
      (p.transportAllowance || 0).toFixed(2),
      (p.excessOrderIncentive || 0).toFixed(2),
      (p.topRunnerBonus || 0).toFixed(2),
      p.normalOvertimeHours || 0,
      p.holidayOvertimeHours || 0,
      (p.overtimePay || 0).toFixed(2),
      (p.teamLeaderManagementAllowance || 0).toFixed(2),
      (p.teamIncentive || 0).toFixed(2),
      (p.additionalPerformanceAward || 0).toFixed(2),
      p.totalPay.toFixed(2)
    ]);

    // System Totals row
    rows.push([
      '"SYSTEM TOTALS"',
      `"${totalDaysWorkedAll}"`,
      totalValidOrderUnitsAll,
      totalResponsibilitySalary.toFixed(2),
      totalAttendanceSalary.toFixed(2),
      totalTransportAllowance.toFixed(2),
      totalExcessOrderIncentive.toFixed(2),
      totalTopRunnerBonus.toFixed(2),
      totalNormalOTHoursAll,
      totalHolidayOTHoursAll,
      totalOvertimePayAll.toFixed(2),
      totalTLManagementAllowance.toFixed(2),
      totalTeamIncentive.toFixed(2),
      '0.00',
      totalPayAll.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_payroll_${selectedCycle.replace(' ', '_').replace(',', '')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDailyEarningsToCSV = () => {
    const headers = [
      'Date',
      'Gamer Name',
      'Employee ID',
      'Farmed Millions (M)',
      'Base Earned (K)',
      'Attendance Status',
      'Orders Bonus (K)',
      'Normal OT Hours (1.5x)',
      'Holiday OT Hours (2.0x)',
      'Overtime Pay (K)',
      'Team Volume Bonus (K)',
      'Daily Total Net (K)'
    ];

    const rows = filteredDailyEarnings.map(r => [
      `"${r.date}"`,
      `"${r.gamerName}"`,
      `"${r.employeeId}"`,
      formatM(r.farmedMillions),
      r.basePayEarned.toFixed(2),
      `"${r.attendanceStatus}"`,
      r.orderBonus.toFixed(2),
      r.normalOvertimeHours || 0,
      r.holidayOvertimeHours || 0,
      (r.overtimePay || 0).toFixed(2),
      r.teamVolumeBonus.toFixed(2),
      r.totalDailyEarned.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_daily_earnings_${selectedCycle.replace(' ', '_').replace(',', '')}_${selectedDailyDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // Orders Operational Audit Data & Handlers
  // =========================================================================

  // Unique dates from orders start_date, completed_date, and daily_progress
  const availableOrderDates = Array.from(new Set(
    orders.flatMap(o => {
      const dates: string[] = [];
      if (o.start_date) dates.push(o.start_date.slice(0, 10));
      if (o.completed_date) dates.push(o.completed_date.slice(0, 10));
      if (o.daily_progress) {
        o.daily_progress.forEach(l => {
          if (l.date) dates.push(l.date.slice(0, 10));
        });
      }
      return dates;
    })
  )).filter(Boolean).sort().reverse();

  const effectiveOrderCycle = orderCycleFilter === 'current' ? selectedCycle : orderCycleFilter;

  // Filtered orders for production audit report
  const filteredOrdersReport = orders.filter(order => {
    // 1. Cycle filter
    if (orderCycleFilter !== 'all') {
      const mainCycle = getOrderPeriodLabel(order.completed_date || order.start_date);
      const hasLogInCycle = (order.daily_progress || []).some(
        l => l.date && getOrderPeriodLabel(l.date) === effectiveOrderCycle
      );
      if (mainCycle !== effectiveOrderCycle && !hasLogInCycle) {
        return false;
      }
    }

    // 2. Status filter
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
      return false;
    }

    // 3. Runner filter
    if (orderGamerFilter !== 'all' && !isGamerOnOrder(order, orderGamerFilter)) {
      return false;
    }

    // 4. Shift filter
    if (orderShiftFilter !== 'all') {
      const hasShiftLog = (order.daily_progress || []).some(l => l.shift === orderShiftFilter);
      if (!hasShiftLog) return false;
    }

    // 5. Date filter
    if (orderDateFilter !== 'all') {
      const isStartDate = order.start_date?.slice(0, 10) === orderDateFilter;
      const isCompDate = order.completed_date?.slice(0, 10) === orderDateFilter;
      const hasDateLog = (order.daily_progress || []).some(l => l.date?.slice(0, 10) === orderDateFilter);
      if (!isStartDate && !isCompDate && !hasDateLog) return false;
    }

    // 6. Search query
    if (orderSearchTerm.trim()) {
      const term = orderSearchTerm.toLowerCase();
      const numMatch = order.order_number?.toLowerCase().includes(term);
      const runnerIds = getOrderRunners(order);
      const runnerMatch = runnerIds.some(id => {
        const g = gamers.find(gam => gam.id === id);
        return g?.name?.toLowerCase().includes(term) || g?.employee_id?.toLowerCase().includes(term);
      });
      const notesMatch = (order.daily_progress || []).some(l => l.notes?.toLowerCase().includes(term));
      if (!numMatch && !runnerMatch && !notesMatch) return false;
    }

    return true;
  });

  // Flat list of individual daily session logs matching filters
  const allFilteredSessionLogs = filteredOrdersReport.flatMap(order => {
    const size = Number(order.size_millions || 0);
    const logs = [...(order.daily_progress || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
    let runningTotal = 0;

    return logs.map(log => {
      const vol = Number(log.volume_millions || 0);
      runningTotal += vol;
      const runner = gamers.find(g => g.id === log.gamer_id);
      return {
        logId: log.id,
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.status,
        orderSize: size,
        date: log.date,
        gamerId: log.gamer_id,
        gamerName: runner?.name || 'Unknown',
        employeeId: runner?.employee_id || 'N/A',
        shift: log.shift,
        volumeMillions: vol,
        runningTotal,
        remainingLeft: Math.max(0, size - runningTotal),
        notes: log.notes
      };
    }).filter(s => {
      if (orderShiftFilter !== 'all' && s.shift !== orderShiftFilter) return false;
      if (orderDateFilter !== 'all' && s.date?.slice(0, 10) !== orderDateFilter) return false;
      if (orderGamerFilter !== 'all' && s.gamerId !== orderGamerFilter) return false;
      return true;
    });
  }).sort((a, b) => (a.date > b.date ? -1 : 1));

  // High-level aggregates for filtered orders
  const ordersAggregates = {
    totalCount: filteredOrdersReport.length,
    totalSize: filteredOrdersReport.reduce((s, o) => s + Number(o.size_millions || 0), 0),
    dayFarmed: filteredOrdersReport.reduce((s, o) => {
      return s + (o.daily_progress || []).filter(l => l.shift === 'day').reduce((sub, l) => sub + Number(l.volume_millions || 0), 0);
    }, 0),
    nightFarmed: filteredOrdersReport.reduce((s, o) => {
      return s + (o.daily_progress || []).filter(l => l.shift === 'night').reduce((sub, l) => sub + Number(l.volume_millions || 0), 0);
    }, 0),
    homeFarmed: filteredOrdersReport.reduce((s, o) => {
      return s + (o.daily_progress || []).filter(l => l.shift === 'home').reduce((sub, l) => sub + Number(l.volume_millions || 0), 0);
    }, 0),
    totalFarmed: filteredOrdersReport.reduce((s, o) => {
      const logs = o.daily_progress || [];
      if (logs.length > 0) return s + logs.reduce((sub, l) => sub + Number(l.volume_millions || 0), 0);
      return s + (o.status === 'Completed' ? Number(o.size_millions || 0) : Number(o.progress_millions || 0));
    }, 0),
    totalRemaining: 0,
    totalPayout: filteredOrdersReport.reduce((s, o) => s + Number(o.payout || 0), 0)
  };
  ordersAggregates.totalRemaining = Math.max(0, ordersAggregates.totalSize - ordersAggregates.totalFarmed);

  // XLSX Export function (Sheet 1: Orders Summary, Sheet 2: Daily Sessions Breakdown)
  const exportOrdersToXLSX = () => {
    // 1. Orders Summary Data
    const summaryData = filteredOrdersReport.map(o => {
      const size = Number(o.size_millions || 0);
      const logs = o.daily_progress || [];
      const dayVol = logs.filter(l => l.shift === 'day').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const nightVol = logs.filter(l => l.shift === 'night').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const homeVol = logs.filter(l => l.shift === 'home').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const totalMade = logs.length > 0 ? (dayVol + nightVol + homeVol) : (o.status === 'Completed' ? size : Number(o.progress_millions || 0));
      const remaining = Math.max(0, size - totalMade);
      const pct = size > 0 ? Math.min(100, Math.round((totalMade / size) * 100)) : 0;
      
      const lead = gamers.find(g => g.id === o.gamer_id);
      const allRunners = getOrderRunners(o).map(id => {
        const g = gamers.find(gam => gam.id === id);
        return g ? `${g.name} (${g.employee_id})` : id;
      }).join(', ');

      return {
        'Order Number': o.order_number,
        'Asset Type': o.asset_type || 'Total Assets',
        'Status': o.status,
        'Target Size (M)': size,
        'Order Units (10M/unit)': Number((size / 10).toFixed(1)),
        'Lead Operator': lead ? `${lead.name} (${lead.employee_id})` : 'N/A',
        'Assigned Operators': allRunners,
        'Day Shift Volume (M)': dayVol,
        'Night Shift Volume (M)': nightVol,
        'Home Shift Volume (M)': homeVol,
        'Total Farmed (M)': totalMade,
        'Remaining Volume (M)': remaining,
        'Progress (%)': `${pct}%`,
        'Payout (K)': Number(o.payout || 0),
        'Start Date': o.start_date ? o.start_date.slice(0, 10) : 'N/A',
        'Completed Date': o.completed_date ? o.completed_date.slice(0, 10) : 'N/A',
        'Pay Cycle': getOrderPeriodLabel(o.completed_date || o.start_date)
      };
    });

    // 2. Daily Sessions Breakdown Data
    const sessionData: any[] = [];
    filteredOrdersReport.forEach(o => {
      const size = Number(o.size_millions || 0);
      const logs = [...(o.daily_progress || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
      let runningTotal = 0;

      logs.forEach(log => {
        const vol = Number(log.volume_millions || 0);
        runningTotal += vol;
        const g = gamers.find(gam => gam.id === log.gamer_id);
        sessionData.push({
          'Date': log.date,
          'Order Number': o.order_number,
          'Asset Type': o.asset_type || 'Total Assets',
          'Operator Name': g?.name || 'Unknown',
          'Clearance ID': g?.employee_id || 'N/A',
          'Shift': log.shift === 'day' ? 'Day Shift' : log.shift === 'night' ? 'Night Shift' : 'Home / Mobile',
          'Session Volume (M)': vol,
          'Order Target (M)': size,
          'Running Order Total (M)': runningTotal,
          'Remaining Left (M)': Math.max(0, size - runningTotal),
          'Order Status': o.status,
          'Session Notes': log.notes || '',
          'Pay Cycle': getOrderPeriodLabel(log.date)
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsSessions = XLSX.utils.json_to_sheet(sessionData.length > 0 ? sessionData : [{ 'Note': 'No daily session logs found for selected filters' }]);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Orders Summary');
    XLSX.utils.book_append_sheet(wb, wsSessions, 'Daily Sessions Breakdown');

    const cyclePart = (orderCycleFilter === 'current' ? selectedCycle : orderCycleFilter).replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `zampeak_orders_report_${cyclePart}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // CSV Export for Orders Summary
  const exportOrdersToCSV = () => {
    const headers = [
      'Order Number',
      'Asset Type',
      'Status',
      'Target Size (M)',
      'Order Units',
      'Lead Operator',
      'Assigned Operators',
      'Day Volume (M)',
      'Night Volume (M)',
      'Home Volume (M)',
      'Total Farmed (M)',
      'Remaining Volume (M)',
      'Progress %',
      'Payout (K)',
      'Start Date',
      'Completed Date',
      'Pay Cycle'
    ];

    const rows = filteredOrdersReport.map(o => {
      const size = Number(o.size_millions || 0);
      const logs = o.daily_progress || [];
      const dayVol = logs.filter(l => l.shift === 'day').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const nightVol = logs.filter(l => l.shift === 'night').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const homeVol = logs.filter(l => l.shift === 'home').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
      const totalMade = logs.length > 0 ? (dayVol + nightVol + homeVol) : (o.status === 'Completed' ? size : Number(o.progress_millions || 0));
      const remaining = Math.max(0, size - totalMade);
      const pct = size > 0 ? Math.min(100, Math.round((totalMade / size) * 100)) : 0;
      
      const lead = gamers.find(g => g.id === o.gamer_id);
      const allRunners = getOrderRunners(o).map(id => {
        const g = gamers.find(gam => gam.id === id);
        return g ? `${g.name} (${g.employee_id})` : id;
      }).join('; ');

      return [
        `"${o.order_number}"`,
        `"${o.asset_type || 'Total Assets'}"`,
        `"${o.status}"`,
        size,
        Number((size / 10).toFixed(1)),
        `"${lead ? lead.name : 'N/A'}"`,
        `"${allRunners}"`,
        dayVol,
        nightVol,
        homeVol,
        totalMade,
        remaining,
        `"${pct}%"`,
        Number(o.payout || 0),
        `"${o.start_date ? o.start_date.slice(0, 10) : ''}"`,
        `"${o.completed_date ? o.completed_date.slice(0, 10) : ''}"`,
        `"${getOrderPeriodLabel(o.completed_date || o.start_date)}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `zampeak_orders_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportBackupJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ gamers, orders, attendance }, null, 2)
    );
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `zampeak_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && Array.isArray(parsed.gamers) && Array.isArray(parsed.orders)) {
            const res = await importBackupData(parsed.gamers, parsed.orders, parsed.attendance || []);
            if (res.success) {
              setImportStatus({ success: true, message: 'Dossier, Order and Attendance logs successfully restored!' });
            } else {
              setImportStatus({ success: false, message: res.error || 'Import failed.' });
            }
          } else {
            setImportStatus({ success: false, message: 'Invalid file format. Backup must contain gamers and orders.' });
          }
        } catch (err) {
          setImportStatus({ success: false, message: 'Failed to read backup file.' });
        }
      };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // SQL Schema Script to create / update tables in Supabase
  const supabaseSQL = `-- =========================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO UPDATE YOUR EXISTING TABLES
-- =========================================================================
-- 1. Update ORDERS table for multi-operator assignment, daily progress & night shift tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_gamer_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS daily_progress JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress_millions NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS co_gamer_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_date DATE;

-- 2. Update ATTENDANCE table for shift (day vs night) & overtime hours tracking
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'day';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS normal_overtime_hours NUMERIC DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS holiday_overtime_hours NUMERIC DEFAULT 0;

-- 3. Update GAMERS table for status & custom adjustments
ALTER TABLE public.gamers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.gamers ADD COLUMN IF NOT EXISTS bonus_adjustment NUMERIC DEFAULT 0;

-- =========================================================================
-- FULL FRESH TABLE DEFINITIONS (If setting up a new project)
-- =========================================================================
-- 1. Create GAMERS Table
CREATE TABLE IF NOT EXISTS public.gamers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    default_password TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    level TEXT NOT NULL DEFAULT 'beginner',
    gamer_role TEXT NOT NULL DEFAULT 'gamer',
    team_leader_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    bonus_adjustment NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create ORDERS Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE RESTRICT NOT NULL,
    co_gamer_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    assigned_gamer_ids TEXT[] DEFAULT '{}',
    daily_progress JSONB DEFAULT '[]'::jsonb,
    size_millions NUMERIC NOT NULL,
    progress_millions NUMERIC DEFAULT 0,
    asset_type TEXT NOT NULL DEFAULT 'Haval Coins',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Running',
    payout NUMERIC NOT NULL,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create ATTENDANCE Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamer_id UUID REFERENCES public.gamers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    shift TEXT DEFAULT 'day',
    farmed_millions NUMERIC NOT NULL DEFAULT 0,
    normal_overtime_hours NUMERIC DEFAULT 0,
    holiday_overtime_hours NUMERIC DEFAULT 0,
    team_leader_id UUID REFERENCES public.gamers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(gamer_id, date)
);

-- Enable Row Level Security (RLS) or add your security policies as needed
ALTER TABLE public.gamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Authenticated users access policy
CREATE POLICY "Allow authenticated read access" ON public.gamers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.gamers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write access" ON public.attendance FOR ALL TO authenticated USING (true);

-- RPC Secure Registration Validator
CREATE OR REPLACE FUNCTION verify_gamer_registration(p_employee_id TEXT, p_default_password TEXT)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_gamer RECORD;
BEGIN
    SELECT * FROM public.gamers WHERE UPPER(employee_id) = UPPER(p_employee_id) INTO v_gamer;
    
    IF v_gamer.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is not registered in the system. Contact Admin.');
    END IF;
    
    IF v_gamer.default_password IS NULL OR v_gamer.default_password = '' THEN
        RETURN json_build_object('success', false, 'error', 'Employee ID is already registered. Please Sign In.');
    END IF;
    
    IF v_gamer.default_password <> p_default_password THEN
        RETURN json_build_object('success', false, 'error', 'Invalid default registration password.');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;`;

  const envTemplate = `NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key`;

  const copyToClipboard = (text: string, type: 'sql' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'sql') {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:bg-white print:text-black">
        {/* Action controls (Hidden during print) */}
        <div className="flex flex-wrap gap-3 items-center justify-between border-b border-cyber-border/40 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400 uppercase">Target Pay Cycle:</span>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-slate-950 border border-cyber-border rounded px-3 py-1.5 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
            >
              {availableCycles.map(cycle => (
                <option key={cycle} value={cycle}>
                  {cycle} — {getCycleRangeLabel(cycle).replace('Cycle period: ', '')}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={exportOrdersToXLSX}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-3 py-2 rounded transition-all cursor-pointer shadow-neon-green/10"
              title="Download Orders & Daily Sessions Breakdown in Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} />
              Export Orders (XLSX)
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-border bg-slate-900 px-3 py-2 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              Export Payroll CSV
            </button>
            <button 
              onClick={exportDailyEarningsToCSV}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-cyan/40 bg-cyber-cyan/10 px-3 py-2 rounded text-cyber-cyan hover:bg-cyber-cyan/20 transition-all cursor-pointer"
            >
              <Download size={14} />
              Export Daily Earnings CSV
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 font-mono text-xs uppercase font-bold border border-cyber-border bg-slate-900 px-3 py-2 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <Printer size={14} />
              Print Report
            </button>
          </div>
        </div>

        {/* Report Document Box */}
        <div className="tactical-panel p-6 rounded clip-corners border border-cyber-border/40 bg-cyber-dark/30 relative">
          <div className="text-center font-mono border-b border-cyber-border/40 pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-widest text-cyber-cyan uppercase print:text-black">
              ZAMPEAK CORP PAYROLL LEDGER
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 print:text-slate-600">
              CYCLE: {selectedCycle} ({getCycleRangeLabel(selectedCycle)}) — GENERATED ON {new Date().toLocaleString()}
            </p>
          </div>

          {/* Table */}
          {payrollSummaries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono text-xs">
              NO OPERATIONS LOADED IN THE SYSTEM.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-cyber-border text-slate-400 print:text-slate-700 font-bold uppercase text-[9px]">
                      <th className="py-2.5 px-2">Operator Name</th>
                      <th className="py-2.5 px-2 text-center">Days Worked</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan">Orders (26 Target)</th>
                      <th className="py-2.5 px-2 text-right">Responsibility (K900)</th>
                      <th className="py-2.5 px-2 text-right">Attendance (K200)</th>
                      <th className="py-2.5 px-2 text-right">Transport (K10/d)</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Excess Orders</th>
                      <th className="py-2.5 px-2 text-right text-cyber-yellow print:text-yellow-700 font-bold">Top Runner Bonus</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan print:text-cyan-700 font-bold">OT 1.5x (hrs)</th>
                      <th className="py-2.5 px-2 text-center text-cyber-cyan print:text-cyan-700 font-bold">OT 2.0x (hrs)</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-bold">Overtime Pay</th>
                      <th className="py-2.5 px-2 text-right text-cyber-amber print:text-amber-700 font-bold">TL Allowance</th>
                      <th className="py-2.5 px-2 text-right text-cyber-green print:text-green-700 font-bold">Team Incentive</th>
                      <th className="py-2.5 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-border/30 text-slate-300 print:text-black">
                    {payrollSummaries.map((p) => (
                      <tr key={p.gamerId} className="hover:bg-slate-900/20">
                        <td className="py-3 px-2 font-bold">{p.gamerName}</td>
                        <td className="py-3 px-2 text-center font-bold">{p.daysWorked} / 26</td>
                        <td className="py-3 px-2 text-center font-bold text-cyber-cyan">{p.completedOrdersCount || 0}</td>
                        <td className="py-3 px-2 text-right">K{(p.responsibilitySalary || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">K{(p.attendanceSalary || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">K{(p.transportAllowance || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-bold">
                          K{(p.excessOrderIncentive || 0).toFixed(2)}
                          {(p.excessOrdersCount || 0) > 0 && (
                            <span className="text-[9px] text-slate-500 block font-normal">+{p.excessOrdersCount} excess</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-cyber-yellow print:text-yellow-700">
                          {(p.topRunnerBonus || 0) > 0 ? (
                            <span className="bg-cyber-yellow/15 text-cyber-yellow border border-cyber-yellow/30 px-1 py-0.5 rounded text-[9px] inline-block font-mono">
                              👑 K{p.topRunnerBonus}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-normal">K0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-200">
                          {p.normalOvertimeHours || 0} hrs
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-200">
                          {p.holidayOvertimeHours || 0} hrs
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-cyber-cyan">
                          K{(p.overtimePay || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-amber print:text-amber-700">
                          K{(p.teamLeaderManagementAllowance || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-green print:text-green-700">
                          K{(p.teamIncentive || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">
                          K{p.totalPay.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Aggregates Summary Row */}
                    <tr className="border-t-2 border-cyber-cyan bg-cyber-dark/40 font-bold text-slate-200 print:text-black text-[10px]">
                      <td className="py-3 px-2 uppercase font-black">SYSTEM TOTALS</td>
                      <td className="py-3 px-2 text-center font-black">{totalDaysWorkedAll}</td>
                      <td className="py-3 px-2 text-center font-black text-cyber-cyan">{totalValidOrderUnitsAll}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalResponsibilitySalary.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalAttendanceSalary.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-black">K{totalTransportAllowance.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalExcessOrderIncentive.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-yellow print:text-yellow-700 font-black">K{totalTopRunnerBonus.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center text-cyber-cyan print:text-cyan-700 font-black">{totalNormalOTHoursAll} hrs</td>
                      <td className="py-3 px-2 text-center text-cyber-cyan print:text-cyan-700 font-black">{totalHolidayOTHoursAll} hrs</td>
                      <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black">K{totalOvertimePayAll.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-amber print:text-amber-700 font-black">K{totalTLManagementAllowance.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-green print:text-green-700 font-black">K{totalTeamIncentive.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right text-cyber-cyan print:text-cyan-700 font-black text-xs">
                        K{totalPayAll.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tactical summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-cyber-border/40 pt-4 print:hidden">
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Completion Success Ratio</span>
                  <div className="text-lg font-bold text-cyber-green font-mono mt-0.5">
                    {totalCompletedMissions} Completed Missions
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Total Farmed Value</span>
                  <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                    {formatM(totalAssetsFarmedAll)}M assets
                  </div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded border border-cyber-border/30">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">Expected Net Payroll</span>
                  <div className="text-lg font-bold text-cyber-cyan font-mono mt-0.5">
                    K{totalPayAll.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Daily Gamer Earnings Ledger Section */}
              <div className="mt-8 pt-6 border-t border-cyber-border/40">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest flex items-center gap-2">
                    <span>Daily Gamer Earnings Ledger</span>
                    <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">per-day gamer earnings breakdown</span>
                  </h3>

                  {/* Filter Controls (Gamer Name + Date) */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs print:hidden">
                    {/* Gamer Name Filter */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Gamer:</span>
                      <select
                        value={selectedGamerFilter}
                        onChange={(e) => setSelectedGamerFilter(e.target.value)}
                        className="bg-slate-950 border border-cyber-border rounded px-2.5 py-1 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer max-w-[160px] truncate"
                      >
                        <option value="all">All Gamers</option>
                        {gamers.filter(g => g.status === 'active').map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({g.employee_id})</option>
                        ))}
                      </select>
                    </div>

                    {/* Date Filter Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Date:</span>
                      <select
                        value={selectedDailyDate}
                        onChange={(e) => setSelectedDailyDate(e.target.value)}
                        className="bg-slate-950 border border-cyber-border rounded px-2.5 py-1 text-cyber-cyan text-xs font-mono focus:outline-none focus:border-cyber-cyan cursor-pointer"
                      >
                        <option value={todayStr}>Today ({todayStr})</option>
                        <option value="all">All Dates in Cycle</option>
                        {availableDailyDates.filter(d => d !== todayStr).map(date => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                {filteredDailyEarnings.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border/30 rounded">
                    NO DAILY GAMER EARNINGS RECORDED FOR {selectedGamerFilter === 'all' ? '' : 'SELECTED GAMER ON '}{selectedDailyDate === 'all' ? 'THIS CYCLE' : selectedDailyDate}.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-cyber-border/30 rounded">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-cyber-border text-slate-400 font-bold uppercase text-[9px] bg-slate-950/60 select-none">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Gamer Name</th>
                          <th className="py-2.5 px-3">Employee ID</th>
                          <th className="py-2.5 px-3 text-right">Farmed (M)</th>
                          <th className="py-2.5 px-3 text-right">Base Earned</th>
                          <th className="py-2.5 px-3 text-center">Attendance Status</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green">Orders Bonus</th>
                          <th className="py-2.5 px-3 text-center text-cyber-cyan">OT 1.5x</th>
                          <th className="py-2.5 px-3 text-center text-cyber-cyan">OT 2.0x</th>
                          <th className="py-2.5 px-3 text-right text-cyber-cyan">Overtime Pay</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green">Team Bonus</th>
                          <th className="py-2.5 px-3 text-right text-cyber-cyan font-black">Daily Total Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                        {filteredDailyEarnings.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40 font-mono">
                            <td className="py-2.5 px-3 font-bold">{rec.date}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-100">{rec.gamerName}</td>
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{rec.employeeId}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-200">{formatM(rec.farmedMillions)}M</td>
                            <td className="py-2.5 px-3 text-right">K{rec.basePayEarned.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                rec.attendanceStatus === 'present_on_time' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                                rec.attendanceStatus === 'present_late' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20' :
                                rec.attendanceStatus === 'absent' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20' :
                                'bg-slate-800 text-slate-500'
                              }`}>
                                {rec.attendanceStatus === 'present_on_time' ? 'On Time' :
                                 rec.attendanceStatus === 'present_late' ? 'Late' :
                                 rec.attendanceStatus === 'absent' ? 'Absent' : 'No Log'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-green font-bold">K{rec.orderBonus}</td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                              {rec.normalOvertimeHours ? `${rec.normalOvertimeHours}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                              {rec.holidayOvertimeHours ? `${rec.holidayOvertimeHours}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-cyan font-bold">
                              K{(rec.overtimePay || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyber-green font-bold">K{rec.teamVolumeBonus}</td>
                            <td className="py-2.5 px-3 text-right text-cyber-cyan font-black">K{rec.totalDailyEarned.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* Missions & Orders Production Audit Section                                */}
              {/* ========================================================================= */}
              <div className="mt-8 pt-6 border-t border-cyber-border/40 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                    <h3 className="font-mono font-bold text-sm text-cyber-cyan uppercase tracking-widest flex items-center gap-2">
                      <Gamepad2 size={16} />
                      <span>Missions & Orders Production Audit</span>
                      <span className="text-[9px] text-slate-500 font-normal lowercase bg-cyber-cyan/10 px-1.5 py-0.5 rounded border border-cyber-cyan/20">
                        day/night breakdown & session volume audit
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 print:hidden">
                      Full transparency into assigned crew, day/night shift progression, session volume, and remaining targets.
                    </p>
                  </div>

                  {/* Export buttons */}
                  <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <button
                      onClick={exportOrdersToXLSX}
                      className="flex items-center gap-1.5 font-mono text-[11px] uppercase font-bold border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded transition-all cursor-pointer shadow-neon-green/10"
                      title="Download complete report with Orders Summary and Daily Session Breakdown sheets in Excel (.xlsx)"
                    >
                      <FileSpreadsheet size={13} />
                      Download Excel (.xlsx)
                    </button>
                    <button
                      onClick={exportOrdersToCSV}
                      className="flex items-center gap-1.5 font-mono text-[11px] uppercase font-bold border border-cyber-border bg-slate-900 hover:border-cyber-cyan text-slate-300 hover:text-cyber-cyan px-2.5 py-1.5 rounded transition-all cursor-pointer"
                      title="Export Orders Summary as CSV"
                    >
                      <Download size={13} />
                      CSV
                    </button>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="p-3.5 bg-slate-950/70 border border-cyber-border/40 rounded clip-corners space-y-3 font-mono text-xs print:hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                    {/* 1. Cycle Filter */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Pay Cycle</label>
                      <select
                        value={orderCycleFilter}
                        onChange={(e) => setOrderCycleFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-cyber-border/60 rounded px-2 py-1 text-cyber-cyan text-[11px] focus:outline-none focus:border-cyber-cyan cursor-pointer truncate"
                      >
                        <option value="current">Current ({selectedCycle})</option>
                        <option value="all">All Pay Cycles</option>
                        {availableCycles.filter(c => c !== selectedCycle).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Order Status Filter */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Status</label>
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                        className="w-full bg-slate-900 border border-cyber-border/60 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyber-cyan cursor-pointer"
                      >
                        <option value="all">All Statuses</option>
                        <option value="Running">Running</option>
                        <option value="Completed">Completed</option>
                        <option value="Paused">Paused</option>
                        <option value="Violation">Violation</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* 3. Operator / Runner Filter */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Operator</label>
                      <select
                        value={orderGamerFilter}
                        onChange={(e) => setOrderGamerFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-cyber-border/60 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyber-cyan cursor-pointer truncate"
                      >
                        <option value="all">All Operators</option>
                        {gamers.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.employee_id})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Shift Filter */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Shift</label>
                      <select
                        value={orderShiftFilter}
                        onChange={(e) => setOrderShiftFilter(e.target.value as any)}
                        className="w-full bg-slate-900 border border-cyber-border/60 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyber-cyan cursor-pointer"
                      >
                        <option value="all">All Shifts</option>
                        <option value="day">☀️ Day Shift</option>
                        <option value="night">🌙 Night Shift</option>
                        <option value="home">🏠 Home / Mobile</option>
                      </select>
                    </div>

                    {/* 5. Date Filter */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Session Date</label>
                      <select
                        value={orderDateFilter}
                        onChange={(e) => setOrderDateFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-cyber-border/60 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyber-cyan cursor-pointer"
                      >
                        <option value="all">All Dates</option>
                        {availableOrderDates.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* 6. Search Query */}
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Search</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Order # / Runner / Notes..."
                          value={orderSearchTerm}
                          onChange={(e) => setOrderSearchTerm(e.target.value)}
                          className="w-full bg-slate-900 border border-cyber-border/60 rounded pl-7 pr-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyber-cyan"
                        />
                        <Search size={11} className="absolute left-2 top-2 text-slate-500" />
                      </div>
                    </div>
                  </div>

                  {/* View Mode Switcher & Quick Totals */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-cyber-border/20 text-[10px]">
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-cyber-border/40">
                      <button
                        onClick={() => setOrdersViewMode('orders')}
                        className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                          ordersViewMode === 'orders' ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/20' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Orders Overview ({filteredOrdersReport.length})
                      </button>
                      <button
                        onClick={() => setOrdersViewMode('sessions')}
                        className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                          ordersViewMode === 'sessions' ? 'bg-cyber-cyan text-slate-950 shadow-neon-cyan/20' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Day-by-Day Session Manifest ({allFilteredSessionLogs.length})
                      </button>
                    </div>

                    {/* Aggregate KPI Mini Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-400">Target: <b className="text-slate-200">{formatM(ordersAggregates.totalSize)}M</b></span>
                      <span className="text-slate-600">|</span>
                      <span className="text-cyber-green flex items-center gap-1">Farmed: <b>{formatM(ordersAggregates.totalFarmed)}M</b></span>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-400 flex items-center gap-1">Left: <b>{formatM(ordersAggregates.totalRemaining)}M</b></span>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-300" title="Day Shift Total">☀️ {formatM(ordersAggregates.dayFarmed)}M</span>
                      <span className="text-indigo-300" title="Night Shift Total">🌙 {formatM(ordersAggregates.nightFarmed)}M</span>
                      {ordersAggregates.homeFarmed > 0 && (
                        <span className="text-emerald-300" title="Home Session Total">🏠 {formatM(ordersAggregates.homeFarmed)}M</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Table: Either Orders Overview or Day-by-Day Session Manifest */}
                {filteredOrdersReport.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-mono text-xs border border-dashed border-cyber-border/30 rounded">
                    NO ORDERS MATCHING CRITERIA DETECTED.
                  </div>
                ) : ordersViewMode === 'orders' ? (
                  /* View 1: Orders Overview Table with Expandable Day Logs */
                  <div className="overflow-x-auto border border-cyber-border/30 rounded">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-cyber-border text-slate-400 font-bold uppercase text-[9px] bg-slate-950/60 select-none">
                          <th className="py-2.5 px-2 text-center w-8"></th>
                          <th className="py-2.5 px-3">Order #</th>
                          <th className="py-2.5 px-2 text-center">Status</th>
                          <th className="py-2.5 px-3 text-right">Target (M)</th>
                          <th className="py-2.5 px-3">Runners Handling Order</th>
                          <th className="py-2.5 px-2 text-center text-amber-300">☀️ Day (M)</th>
                          <th className="py-2.5 px-2 text-center text-indigo-300">🌙 Night (M)</th>
                          <th className="py-2.5 px-2 text-center text-emerald-300">🏠 Home (M)</th>
                          <th className="py-2.5 px-3 text-right text-cyber-green font-bold">Farmed (M)</th>
                          <th className="py-2.5 px-3 text-right text-amber-400 font-bold">Left (M)</th>
                          <th className="py-2.5 px-3 text-center">Progress</th>
                          <th className="py-2.5 px-3 text-right">Payout</th>
                          <th className="py-2.5 px-3 text-center">Timeline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                        {filteredOrdersReport.map((order) => {
                          const size = Number(order.size_millions || 0);
                          const logs = order.daily_progress || [];
                          const dayVol = logs.filter(l => l.shift === 'day').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
                          const nightVol = logs.filter(l => l.shift === 'night').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
                          const homeVol = logs.filter(l => l.shift === 'home').reduce((s, l) => s + Number(l.volume_millions || 0), 0);
                          const totalMade = logs.length > 0 ? (dayVol + nightVol + homeVol) : (order.status === 'Completed' ? size : Number(order.progress_millions || 0));
                          const remaining = Math.max(0, size - totalMade);
                          const percentage = size > 0 ? Math.min(100, Math.round((totalMade / size) * 100)) : 0;
                          const units = Number((size / 10).toFixed(1));
                          
                          const leadRunner = gamers.find(g => g.id === order.gamer_id);
                          const runnerIds = getOrderRunners(order);
                          const otherRunners = runnerIds
                            .filter(id => id !== order.gamer_id)
                            .map(id => gamers.find(g => g.id === id))
                            .filter(Boolean);

                          const isExpanded = expandedOrderIds.has(order.id);

                          return (
                            <React.Fragment key={order.id}>
                              <tr 
                                onClick={() => toggleOrderExpand(order.id)}
                                className="hover:bg-slate-900/40 cursor-pointer transition-colors"
                              >
                                {/* Expand chevron */}
                                <td className="py-2.5 px-2 text-center text-slate-400">
                                  {isExpanded ? <ChevronDown size={14} className="text-cyber-cyan" /> : <ChevronRight size={14} />}
                                </td>

                                {/* Order Number & Asset Type */}
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                    <span>{order.order_number}</span>
                                    {logs.length > 0 && (
                                      <span className="text-[8px] bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30 px-1 rounded font-bold">
                                        {logs.length} {logs.length === 1 ? 'log' : 'logs'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-500">{order.asset_type || 'Total Assets'}</div>
                                </td>

                                {/* Status */}
                                <td className="py-2.5 px-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    order.status === 'Completed' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                                    order.status === 'Running' ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20' :
                                    order.status === 'Paused' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20' :
                                    order.status === 'Violation' ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/20' :
                                    'bg-slate-800 text-slate-500'
                                  }`}>
                                    {order.status}
                                  </span>
                                </td>

                                {/* Target Size & Units */}
                                <td className="py-2.5 px-3 text-right">
                                  <div className="font-bold text-slate-200">{formatM(size)}M</div>
                                  <div className="text-[9px] text-slate-500">{units} {units === 1 ? 'unit' : 'units'}</div>
                                </td>

                                {/* Runners Handling Order */}
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                                    {leadRunner && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-[9px] font-bold">
                                        <span className="text-[7px] bg-cyber-cyan text-slate-950 px-0.5 rounded uppercase font-black">LEAD</span>
                                        {leadRunner.name}
                                        <span className="text-slate-400 font-mono text-[8px]">({leadRunner.employee_id})</span>
                                      </span>
                                    )}
                                    {otherRunners.map(r => (
                                      <span key={r!.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[9px]">
                                        {r!.name}
                                        <span className="text-slate-500 font-mono text-[8px]">({r!.employee_id})</span>
                                      </span>
                                    ))}
                                    {runnerIds.length === 0 && (
                                      <span className="text-slate-600 text-[10px] italic">Unassigned</span>
                                    )}
                                  </div>
                                </td>

                                {/* Day Shift Volume */}
                                <td className="py-2.5 px-2 text-center font-mono">
                                  {dayVol > 0 ? (
                                    <span className="text-amber-300 font-bold">{formatM(dayVol)}M</span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>

                                {/* Night Shift Volume */}
                                <td className="py-2.5 px-2 text-center font-mono">
                                  {nightVol > 0 ? (
                                    <span className="text-indigo-300 font-bold">{formatM(nightVol)}M</span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>

                                {/* Home Shift Volume */}
                                <td className="py-2.5 px-2 text-center font-mono">
                                  {homeVol > 0 ? (
                                    <span className="text-emerald-300 font-bold">{formatM(homeVol)}M</span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>

                                {/* Total Farmed */}
                                <td className="py-2.5 px-3 text-right font-bold text-cyber-green font-mono">
                                  {formatM(totalMade)}M
                                </td>

                                {/* Remaining Left */}
                                <td className="py-2.5 px-3 text-right font-mono">
                                  {remaining === 0 ? (
                                    <span className="text-cyber-green text-[10px] font-bold">0M (Fulfilled)</span>
                                  ) : (
                                    <span className="text-amber-400 font-bold">{formatM(remaining)}M left</span>
                                  )}
                                </td>

                                {/* Progress bar */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${percentage >= 100 ? 'bg-cyber-green' : 'bg-gradient-to-r from-cyber-cyan to-cyber-green'}`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-mono w-7 text-right">{percentage}%</span>
                                  </div>
                                </td>

                                {/* Payout */}
                                <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                                  K{Number(order.payout || 0)}
                                </td>

                                {/* Timeline */}
                                <td className="py-2.5 px-3 text-center text-[9px] text-slate-400">
                                  <div>{order.start_date ? order.start_date.slice(0, 10) : '-'}</div>
                                  <div className="text-slate-600 text-[8px]">
                                    {order.completed_date ? `to ${order.completed_date.slice(0, 10)}` : '(in progress)'}
                                  </div>
                                </td>
                              </tr>

                              {/* Accordion: Day-by-Day Session Logs for this Order */}
                              {isExpanded && (
                                <tr className="bg-slate-950/80">
                                  <td colSpan={13} className="py-3 px-4 pl-10 border-b border-cyber-border/40">
                                    <div className="p-3 bg-slate-900/90 border border-cyber-cyan/30 rounded space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-bold uppercase text-cyber-cyan flex items-center gap-1.5 font-mono">
                                          <Clock size={12} />
                                          <span>Day-by-Day Session Progression for Order #{order.order_number}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-mono">
                                          Total Order Target: {formatM(size)}M ({units} units)
                                        </span>
                                      </div>

                                      {logs.length === 0 ? (
                                        <div className="text-slate-500 text-[10px] italic py-2 font-mono">
                                          Standard production order. No individual daily session logs recorded.
                                        </div>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left font-mono text-[10px] border-collapse">
                                            <thead>
                                              <tr className="border-b border-cyber-border/60 text-slate-400 uppercase text-[8px]">
                                                <th className="py-1 px-2">Date</th>
                                                <th className="py-1 px-2">Operator Handling</th>
                                                <th className="py-1 px-2 text-center">Shift</th>
                                                <th className="py-1 px-2 text-right">Volume Farmed (M)</th>
                                                <th className="py-1 px-2 text-right">Progress Total (M)</th>
                                                <th className="py-1 px-2 text-right">Remaining Left (M)</th>
                                                <th className="py-1 px-2">Session Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                                              {logs.map((log, lIdx) => {
                                                const runner = gamers.find(g => g.id === log.gamer_id);
                                                const runningTotal = logs.slice(0, lIdx + 1).reduce((s, l) => s + Number(l.volume_millions || 0), 0);
                                                const leftAfter = Math.max(0, size - runningTotal);
                                                return (
                                                  <tr key={log.id || lIdx} className="hover:bg-slate-800/40">
                                                    <td className="py-1.5 px-2 font-bold text-slate-200">{log.date}</td>
                                                    <td className="py-1.5 px-2 text-slate-200">
                                                      {runner?.name || 'Unknown'}
                                                      <span className="text-slate-500 text-[9px] ml-1">({runner?.employee_id || 'N/A'})</span>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-bold ${
                                                        log.shift === 'day' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                                                        log.shift === 'night' ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' :
                                                        'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                      }`}>
                                                        {log.shift === 'day' ? '☀️ Day' : log.shift === 'night' ? '🌙 Night' : '🏠 Home'}
                                                      </span>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-bold text-cyber-cyan">
                                                      {formatM(Number(log.volume_millions || 0))}M
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-slate-300">
                                                      {formatM(runningTotal)}M / {formatM(size)}M
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-amber-400 font-bold">
                                                      {leftAfter === 0 ? (
                                                        <span className="text-cyber-green">0M (Target Met)</span>
                                                      ) : (
                                                        `${formatM(leftAfter)}M left`
                                                      )}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-slate-400 text-[9px] italic">
                                                      {log.notes || '-'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* View 2: Day-by-Day Session Manifest Across All Filtered Orders */
                  <div className="overflow-x-auto border border-cyber-border/30 rounded">
                    {allFilteredSessionLogs.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 font-mono text-xs">
                        NO DAILY SESSIONS RECORDED MATCHING THE CURRENT FILTERS.
                      </div>
                    ) : (
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-cyber-border text-slate-400 font-bold uppercase text-[9px] bg-slate-950/60 select-none">
                            <th className="py-2.5 px-3">Session Date</th>
                            <th className="py-2.5 px-3">Order #</th>
                            <th className="py-2.5 px-3">Operator</th>
                            <th className="py-2.5 px-2 text-center">Shift</th>
                            <th className="py-2.5 px-3 text-right text-cyber-cyan font-bold">Session Farmed (M)</th>
                            <th className="py-2.5 px-3 text-right">Order Target (M)</th>
                            <th className="py-2.5 px-3 text-right text-amber-400 font-bold">Remaining Left (M)</th>
                            <th className="py-2.5 px-2 text-center">Status</th>
                            <th className="py-2.5 px-3">Session Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cyber-border/20 text-slate-300">
                          {allFilteredSessionLogs.map((session, sIdx) => (
                            <tr key={session.logId || sIdx} className="hover:bg-slate-900/40">
                              <td className="py-2.5 px-3 font-bold text-slate-100">{session.date}</td>
                              <td className="py-2.5 px-3 font-bold text-cyber-cyan">{session.orderNumber}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-200">{session.gamerName}</span>
                                <span className="text-slate-500 text-[9px] ml-1.5 font-mono">({session.employeeId})</span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  session.shift === 'day' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                                  session.shift === 'night' ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' :
                                  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {session.shift === 'day' ? '☀️ Day' : session.shift === 'night' ? '🌙 Night' : '🏠 Home'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-cyber-cyan font-mono">
                                {formatM(session.volumeMillions)}M
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                {formatM(session.orderSize)}M
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-400 font-mono">
                                {session.remainingLeft === 0 ? (
                                  <span className="text-cyber-green">0M (Fulfilled)</span>
                                ) : (
                                  `${formatM(session.remainingLeft)}M left`
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  session.orderStatus === 'Completed' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' :
                                  session.orderStatus === 'Running' ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20' :
                                  session.orderStatus === 'Paused' ? 'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/20' :
                                  'bg-slate-800 text-slate-500'
                                }`}>
                                  {session.orderStatus}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[10px] italic">
                                {session.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cloud DB & Local Storage Settings panel (Hidden during print) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Backup / Restore Box */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 font-mono text-xs">
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-3 mb-4 flex items-center gap-2">
            <Database size={16} className="text-cyber-cyan" />
            Data Archiving & Backups
          </h3>
          
          <p className="text-slate-400 mb-4 leading-relaxed">
            Archive your current order tracker logs and gamer rosters locally on your computer, or restore a previous session backup file.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={exportBackupJSON}
              className="flex-1 flex items-center justify-center gap-1.5 border border-cyber-border bg-slate-950 px-3 py-2.5 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
            >
              <Download size={14} />
              Export Backup (.json)
            </button>

            {role === 'admin' && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImportJSON}
                  accept=".json"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-cyber-border bg-slate-950 px-3 py-2.5 rounded text-slate-300 hover:border-cyber-cyan hover:text-cyber-cyan transition-all cursor-pointer"
                >
                  <Upload size={14} />
                  Restore Backup (.json)
                </button>
              </>
            )}
          </div>

          {importStatus && (
            <div className={`mt-4 p-3 border rounded flex items-center gap-2 ${
              importStatus.success 
                ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green' 
                : 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red'
            }`}>
              {importStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span>{importStatus.message}</span>
            </div>
          )}
        </div>

        {/* Supabase coupling instructions */}
        <div className="tactical-panel p-5 rounded clip-corners border border-cyber-border/40 font-mono text-xs">
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-widest border-b border-cyber-border/40 pb-3 mb-4 flex items-center gap-2">
            <Database size={16} className="text-cyber-cyan" />
            Supabase Cloud Coupling
          </h3>

          <div className="space-y-4">
            <p className="text-slate-400 leading-relaxed">
              To connect your tracking dashboard to a cloud database, follow these steps to configure your Supabase backend.
            </p>

            {/* Step 1: SQL Schema */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300 font-bold uppercase text-[10px]">
                <span>1. Run SQL Schema in Supabase Editor</span>
                <button 
                  onClick={() => copyToClipboard(supabaseSQL, 'sql')}
                  className="flex items-center gap-1 text-cyber-cyan hover:underline cursor-pointer"
                >
                  {copiedSql ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSql ? 'Copied!' : 'Copy SQL'}
                </button>
              </div>
              <pre className="p-2.5 bg-slate-950 border border-cyber-border/60 rounded text-[10px] text-slate-400 overflow-x-auto max-h-[120px] font-mono select-all">
                {supabaseSQL}
              </pre>
            </div>

            {/* Step 2: Env config */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-300 font-bold uppercase text-[10px]">
                <span>2. Add Environment Variables to .env.local</span>
                <button 
                  onClick={() => copyToClipboard(envTemplate, 'env')}
                  className="flex items-center gap-1 text-cyber-cyan hover:underline cursor-pointer"
                >
                  {copiedEnv ? <Check size={12} /> : <Copy size={12} />}
                  {copiedEnv ? 'Copied!' : 'Copy Env'}
                </button>
              </div>
              <pre className="p-2.5 bg-slate-950 border border-cyber-border/60 rounded text-[10px] text-slate-400 overflow-x-auto font-mono select-all">
                {envTemplate}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
