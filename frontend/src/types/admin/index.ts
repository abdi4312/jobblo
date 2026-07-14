// ─── Canonical roles ────────────────────────────────────────────────────────
export type UserRole = 'user' | 'provider' | 'company' | 'superAdmin';
export const ASSIGNABLE_ROLES: UserRole[] = ['user', 'provider', 'company'];

// ─── Pagination ──────────────────────────────────────────────────────────────
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

// ─── Standard API envelope ───────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T;
    pagination: Pagination | null;
}

// ─── Admin user (list / detail) ──────────────────────────────────────────────
export interface AdminUser {
    _id: string;
    name: string;
    lastName?: string;
    email: string;
    phone?: string;
    role: UserRole;
    accountStatus: 'active' | 'inactive' | 'verified';
    verified: boolean;
    isTrusted?: boolean;
    avatarUrl?: string;
    subscription?: string;
    planType?: 'business' | 'private';
    companyName?: string;
    orgNumber?: string;
    earnings?: number;
    spending?: number;
    completedJobs?: number;
    averageRating?: number;
    reviewCount?: number;
    lastLogin?: string;
    isDeleted?: boolean;
    deletedAt?: string;
    createdAt: string;
    updatedAt: string;
}

// ─── Admin activity log ───────────────────────────────────────────────────────
export interface AdminActivity {
    _id: string;
    adminId: { _id: string; name: string; email: string } | null;
    action: string;
    targetModel: string;
    targetId: string | null;
    description: string;
    metadata: Record<string, unknown>;
    ip: string;
    userAgent: string;
    createdAt: string;
}

// ─── Dashboard overview ───────────────────────────────────────────────────────
export interface StatValue {
    value: number;
    thisMonth?: number;
    change?: number | null; // percentage vs previous period, null when no prior data
    prevMonth?: number;
    currency?: string;
}

export interface DashboardStats {
    totalUsers: StatValue;
    totalServices: StatValue;
    totalOrders: StatValue;
    revenueThisMonth: StatValue;
    activeSubscriptions: StatValue;
    totalReviews: StatValue;
}

export interface RoleDistribution {
    user: number;
    provider: number;
    company: number;
    superAdmin: number;
}

export interface OrderStatusDistribution {
    pending?: number;
    accepted?: number;
    declined?: number;
    in_progress?: number;
    completed?: number;
    cancelled?: number;
    awaiting_payment?: number;
    paid?: number;
}

export interface TrendPoint {
    _id: string; // YYYY-MM-DD
    count: number;
}

// Recent items (lightweight)
export interface RecentUser {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    accountStatus: string;
    createdAt: string;
    avatarUrl?: string;
}

export interface RecentService {
    _id: string;
    title: string;
    price: number;
    status: string;
    categories: string[];
    createdAt: string;
    userId?: { _id: string; name: string };
}

export interface RecentOrder {
    _id: string;
    status: string;
    paymentStatus: string;
    agreedPrice?: number;
    createdAt: string;
    customerId?: { _id: string; name: string };
    serviceId?: { _id: string; title: string };
}

export interface DashboardOverview {
    stats: DashboardStats;
    roleDistribution: RoleDistribution;
    orderStatusDistribution: OrderStatusDistribution;
    userRegistrationTrend: TrendPoint[];
    recentActivity: AdminActivity[];
    recentUsers: RecentUser[];
    recentServices: RecentService[];
    recentOrders: RecentOrder[];
}

// ─── Query params helpers ─────────────────────────────────────────────────────
export interface AdminUsersQuery {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    accountStatus?: string;
    verified?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    showDeleted?: 'true' | 'false';
}
