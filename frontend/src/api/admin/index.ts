import mainLink from '../mainURLs';
import type {
    AdminUsersQuery,
    ApiResponse,
    DashboardOverview,
    AdminUser,
    Pagination,
} from '../../types/admin';

// ── helpers ──────────────────────────────────────────────────────────────────
function toParams(query: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== '') p.set(k, String(v));
    });
    return p.toString();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const fetchDashboardOverview = async (): Promise<DashboardOverview> => {
    const res = await mainLink.get<ApiResponse<DashboardOverview>>('/api/admin/overview');
    return res.data.data;
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const fetchAdminUsers = async (
    query: AdminUsersQuery = {}
): Promise<{ users: AdminUser[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ users: AdminUser[] }>>(
        `/api/admin/users?${toParams(query as Record<string, unknown>)}`
    );
    return { users: res.data.data.users, pagination: res.data.pagination! };
};

export const createAdminUser = async (payload: {
    name: string; email: string; phone?: string; password: string; role: string;
}): Promise<AdminUser> => {
    const res = await mainLink.post<ApiResponse<{ user: AdminUser }>>('/api/admin/users', payload);
    return res.data.data.user;
};

export const changeUserRole = async (id: string, role: string): Promise<AdminUser> => {
    const res = await mainLink.put<ApiResponse<{ user: AdminUser }>>(`/api/admin/users/${id}/role`, { role });
    return res.data.data.user;
};

export const updateUserStatus = async (id: string, accountStatus: string): Promise<AdminUser> => {
    const res = await mainLink.put<ApiResponse<{ user: AdminUser }>>(`/api/admin/users/${id}/status`, { accountStatus });
    return res.data.data.user;
};

export const verifyUser = async (id: string): Promise<AdminUser> => {
    const res = await mainLink.put<ApiResponse<{ user: AdminUser }>>(`/api/admin/users/${id}/verify`, {});
    return res.data.data.user;
};

// ── Orders ────────────────────────────────────────────────────────────────────
export interface AdminOrdersQuery {
    page?: number; limit?: number; status?: string; paymentStatus?: string;
    customerId?: string; providerId?: string; serviceId?: string;
    dateFrom?: string; dateTo?: string; sortBy?: string; sortOrder?: string;
}

export interface AdminOrder {
    _id: string;
    status: string;
    paymentStatus: string;
    agreedPrice?: number;
    initialPrice?: number;
    scheduledDate?: string;
    createdAt: string;
    updatedAt: string;
    customerId?: { _id: string; name: string; email: string; avatarUrl?: string };
    providerId?: { _id: string; name: string; email: string; avatarUrl?: string };
    serviceId?: { _id: string; title: string; price: number; status: string };
}

export const fetchAdminOrders = async (
    query: AdminOrdersQuery = {}
): Promise<{ orders: AdminOrder[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ orders: AdminOrder[] }>>(
        `/api/admin/orders?${toParams(query as Record<string, unknown>)}`
    );
    return { orders: res.data.data.orders, pagination: res.data.pagination! };
};

export const cancelAdminOrder = async (id: string): Promise<AdminOrder> => {
    const res = await mainLink.put<ApiResponse<{ order: AdminOrder }>>(`/api/admin/orders/${id}/status`, { status: 'cancelled' });
    return res.data.data.order;
};

// ── Services ──────────────────────────────────────────────────────────────────
export interface AdminServicesQuery {
    page?: number; limit?: number; search?: string; status?: string;
    category?: string; dateFrom?: string; dateTo?: string;
    sortBy?: string; sortOrder?: string;
}

export interface AdminService {
    _id: string;
    title: string;
    description?: string;
    price: number;
    hourlyRate?: number;
    paymentType?: string;
    status: string;
    categories: string[];
    tags?: string[];
    images?: string[];
    views: number;
    urgent?: boolean;
    promoted?: boolean;
    maxApplicants?: number;
    equipment?: string;
    fromDate?: string;
    toDate?: string;
    location?: { address?: string; city?: string; coordinates?: number[] };
    createdAt: string;
    updatedAt: string;
    userId?: { _id: string; name: string; email: string; avatarUrl?: string; role: string };
}

export const fetchAdminServices = async (
    query: AdminServicesQuery = {}
): Promise<{ services: AdminService[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ services: AdminService[] }>>(
        `/api/admin/services?${toParams(query as Record<string, unknown>)}`
    );
    return { services: res.data.data.services, pagination: res.data.pagination! };
};

export const updateServiceStatus = async (id: string, status: string): Promise<AdminService> => {
    const res = await mainLink.put<ApiResponse<{ service: AdminService }>>(`/api/admin/services/${id}/status`, { status });
    return res.data.data.service;
};

export const deleteAdminService = async (id: string): Promise<void> => {
    await mainLink.delete(`/api/admin/services/${id}`);
};

// ── Reviews ───────────────────────────────────────────────────────────────────
export interface AdminReview {
    _id: string;
    rating: number;
    comment?: string;
    revieweeRole: string;
    createdAt: string;
    reviewerId?: { _id: string; name: string; email: string; avatarUrl?: string };
    revieweeId?: { _id: string; name: string; email: string; avatarUrl?: string };
    serviceId?: { _id: string; title: string };
}

export interface AdminReviewsQuery {
    page?: number; limit?: number; rating?: number;
    reviewerId?: string; dateFrom?: string; dateTo?: string; sortOrder?: string;
}

export const fetchAdminReviews = async (
    query: AdminReviewsQuery = {}
): Promise<{ reviews: AdminReview[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ reviews: AdminReview[] }>>(
        `/api/admin/reviews?${toParams(query as Record<string, unknown>)}`
    );
    return { reviews: res.data.data.reviews, pagination: res.data.pagination! };
};

export const deleteAdminReview = async (id: string): Promise<void> => {
    await mainLink.delete(`/api/admin/reviews/${id}`);
};

// ── Categories ────────────────────────────────────────────────────────────────
export interface AdminCategory {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
}

export interface AdminCategoriesQuery {
    page?: number; limit?: number; search?: string; isActive?: string;
}

export const fetchAdminCategories = async (
    query: AdminCategoriesQuery = {}
): Promise<{ categories: AdminCategory[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ categories: AdminCategory[] }>>(
        `/api/admin/categories?${toParams(query as Record<string, unknown>)}`
    );
    return { categories: res.data.data.categories, pagination: res.data.pagination! };
};

export const createAdminCategory = async (payload: {
    name: string; icon?: string; sortOrder?: number;
}): Promise<AdminCategory> => {
    const res = await mainLink.post<ApiResponse<{ category: AdminCategory }>>('/api/admin/categories', payload);
    return res.data.data.category;
};

export const updateAdminCategory = async (id: string, payload: Partial<AdminCategory>): Promise<AdminCategory> => {
    const res = await mainLink.put<ApiResponse<{ category: AdminCategory }>>(`/api/admin/categories/${id}`, payload);
    return res.data.data.category;
};

export const toggleAdminCategory = async (id: string): Promise<AdminCategory> => {
    const res = await mainLink.put<ApiResponse<{ category: AdminCategory }>>(`/api/admin/categories/${id}/toggle`, {});
    return res.data.data.category;
};

export const deleteAdminCategory = async (id: string): Promise<void> => {
    await mainLink.delete(`/api/admin/categories/${id}`);
};

// ── Transactions ──────────────────────────────────────────────────────────────
export interface AdminTransaction {
    _id: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    planName: string;
    planType: string;
    discountAmount: number;
    discountCoupon?: string;
    refunded: boolean;
    createdAt: string;
    userId?: { _id: string; name: string; email: string };
}

export interface AdminTransactionsQuery {
    page?: number; limit?: number; search?: string; status?: string;
    type?: string; dateFrom?: string; dateTo?: string; sortOrder?: string;
}

export const fetchAdminTransactions = async (
    query: AdminTransactionsQuery = {}
): Promise<{ transactions: AdminTransaction[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ transactions: AdminTransaction[] }>>(
        `/api/admin/transactions?${toParams(query as Record<string, unknown>)}`
    );
    return { transactions: res.data.data.transactions, pagination: res.data.pagination! };
};

// ── Activity Log ──────────────────────────────────────────────────────────────

// ── Page-level admin endpoints (edit job, notifications, shop, vouchers, billing) ──
export const fetchAdminServiceById = async (id: string) => {
    const res = await mainLink.get(`/api/admin/services/${id}`);
    return res.data.data.service;
};

export const updateAdminServiceForm = (id: string, formData: FormData) =>
    mainLink.put(`/api/admin/services/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const fetchSystemHistory = async (page: number, limit = 5) =>
    (await mainLink.get(`/api/admin/system-history?page=${page}&limit=${limit}`)).data;

export const sendSystemNotification = async (payload: Record<string, unknown>) =>
    (await mainLink.post('/api/notifications/system', payload)).data;

// ── Shop (moved from ShopAdminPage) ──────────────────────────────────────────
export interface ShopItem {
    _id: string;
    title: string;
    description: string;
    coins: number;
    category: 'coins' | 'premium' | 'feature';
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ShopForm {
    title: string;
    description: string;
    coins: string;
    category: 'coins' | 'premium' | 'feature';
}


export const fetchShopItems = async (page: number) => {
    const resp = await mainLink.get(`/api/admin/shop?page=${page}&limit=15`);
    return { items: resp.data.data.items as ShopItem[], pagination: resp.data.pagination };
};

export const createShopItem = async (payload: ShopForm) => {
    const resp = await mainLink.post('/api/admin/shop', {
        ...payload,
        coins: parseInt(payload.coins, 10) || 0,
    });
    return resp.data;
};

export const updateShopItem = async (id: string, payload: ShopForm) => {
    const resp = await mainLink.put(`/api/admin/shop/${id}`, {
        ...payload,
        coins: parseInt(payload.coins, 10) || 0,
    });
    return resp.data;
};

export const toggleShopItem = async (id: string) => {
    const resp = await mainLink.put(`/api/admin/shop/${id}/toggle`);
    return resp.data;
};

export const deleteShopItem = async (id: string) => {
    await mainLink.delete(`/api/admin/shop/${id}`);
};

// ── Subscription billing + promotion codes ───────────────────────────────────
export const fetchSubscriptionBillingSummary = async (mode: string) =>
    (await mainLink.get(`/api/admin/billing/subscriptions/summary?mode=${mode}`)).data;

export const reconcileSubscriptionBilling = async (payload: { mode: string; limit: number; cursorUserId?: string }) =>
    (await mainLink.post('/api/admin/billing/subscriptions/reconcile', payload)).data;

export const fetchPromotionCodes = async <T = unknown>(): Promise<{ vouchers: T[]; mode: string }> => {
    const resp = await mainLink.get('/api/admin/promotion-codes');
    return { vouchers: resp.data.promotions, mode: resp.data.mode };
};

export const deactivatePromotionCode = (id: string) => mainLink.post(`/api/admin/promotion-codes/${id}/deactivate`);

export const createPromotionCode = (payload: Record<string, unknown>) => mainLink.post('/api/admin/promotion-codes', payload);
