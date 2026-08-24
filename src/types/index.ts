export type OrderStatus = 'Running' | 'Paused' | 'Completed' | 'Cancelled' | 'Violation';
export type AssetType = 'Haval Coins' | 'Total Assets';
export type GamerLevel = 'beginner' | 'intermediate' | 'advanced';
export type GamerRole = 'gamer' | 'team_leader' | 'technical_manager';
export type AttendanceStatus = 'present_on_time' | 'present_late' | 'absent';

export interface Gamer {
  id: string;
  name: string;
  employee_id: string;
  email?: string;
  default_password?: string;
  phone?: string;
  status: 'active' | 'inactive';
  level: GamerLevel;
  gamer_role: GamerRole;
  team_leader_id: string | null;
  bonus_adjustment?: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  gamer_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  farmed_millions: number;
  team_leader_id?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  gamer_id: string;
  size_millions: number;
  asset_type: AssetType;
  start_date: string;
  status: OrderStatus;
  payout: number;
  completed_date?: string;
  created_at: string;
}

export interface GamerPerformance {
  gamer: Gamer;
  totalOrders: number;
  completedOrders: number;
  runningOrders: number;
  pausedOrders: number;
  cancelledOrders: number;
  violationOrders: number;
  totalAssetsFarmed: number; // in Millions
  totalPayoutExpected: number; // in Kwacha (K)
  completionRate: number; // percentage
  violationRate: number; // percentage
}

export interface DashboardStats {
  totalOrders: number;
  activeOrders: number; // Running + Paused
  completedOrders: number;
  cancelledOrders: number;
  violationOrders: number;
  totalExpectedPayout: number;
  totalPaidPayout: number;
  averageOrderSize: number;
  violationRate: number;
  recentOrders: Order[];
}

export interface PayrollSummary {
  gamerId: string;
  gamerName: string;
  employeeId: string;
  gamerRole: GamerRole;
  level: GamerLevel;
  baseSalary: number; // K1200, K1800, K2500, K4500 (Legacy) or K800 (New)
  dailyRate: number;
  daysWorked: number;
  daysAbsent: number;
  onTimeDays: number;
  basePayEarned: number;
  deductions: number;
  lateDeduction: number;
  attendanceBonus: number;
  orderBonus: number;
  teamVolumeBonus: number;
  totalPay: number;
  // New August 16, 2026+ Salary Structure Fields
  isNewStructure?: boolean;
  responsibilitySalary?: number;
  attendanceSalary?: number;
  transportAllowance?: number;
  excessOrderIncentive?: number;
  completedOrdersCount?: number;
  excessOrdersCount?: number;
  teamIncentive?: number;
  teamLeaderManagementAllowance?: number;
  additionalPerformanceAward?: number;
  teamCompletionRate?: number;
}

export interface TeamSummary {
  leaderId: string;
  leaderName: string;
  gamer_role: GamerRole;
  level: GamerLevel;
  memberCount: number;
  totalAssetsFarmed: number;
  totalPayout: number;
  gamerDetails: {
    gamerId: string;
    gamerName: string;
    employeeId: string;
    assetsFarmed: number;
    payout: number;
  }[];
}

export interface DailyGamerEarnings {
  date: string;
  gamerId: string;
  gamerName: string;
  employeeId: string;
  gamerRole: GamerRole;
  level: GamerLevel;
  farmedMillions: number;
  attendanceStatus: AttendanceStatus | 'no_log';
  basePayEarned: number;
  orderBonus: number;
  teamVolumeBonus: number;
  totalDailyEarned: number;
  completedOrdersCount: number;
}

