export type OrderStatus = 'Running' | 'Paused' | 'Completed' | 'Cancelled' | 'Violation';
export type AssetType = 'Haval Coins' | 'Total Assets';

export interface Gamer {
  id: string;
  name: string;
  employee_id: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive';
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
