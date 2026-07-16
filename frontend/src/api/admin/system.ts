import mainLink from '../mainURLs';
import type { ApiResponse, Pagination } from '../../types/admin';

export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'down';
    server: { uptime: number; nodeVersion: string; platform: string; memoryUsage: NodeJS.MemoryUsage };
    database: { state: string; responseTime: string };
    timestamp: string;
}

export interface SystemMetrics {
    server: { cpuUsage: number[]; totalRam: number; freeRam: number; ramUsagePercent: number; processMemory: NodeJS.MemoryUsage; uptime: number };
    database: { collections: Record<string, number>; responseTime: string };
    application: { totalUsers: number; activeSessions: number; openDisputes: number; openChatReports: number };
}

export interface SystemError {
    _id: string;
    action: string;
    description: string;
    createdAt: string;
    adminId?: { name: string; email: string };
}

export const fetchSystemHealth = async (): Promise<SystemHealth> => {
    const res = await mainLink.get<ApiResponse<SystemHealth>>('/api/admin/system/health');
    return res.data.data;
};

export const fetchSystemMetrics = async (): Promise<SystemMetrics> => {
    const res = await mainLink.get<ApiResponse<SystemMetrics>>('/api/admin/system/metrics');
    return res.data.data;
};

export const fetchSystemErrors = async (query?: { page?: number; limit?: number }): Promise<{ errors: SystemError[]; pagination: Pagination }> => {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const res = await mainLink.get<ApiResponse<{ errors: SystemError[] }>>(`/api/admin/system/errors?${params}`);
    return { errors: res.data.data.errors, pagination: res.data.pagination! };
};

export const fetchDiskInfo = async (): Promise<Record<string, unknown>> => {
    const res = await mainLink.get<ApiResponse<Record<string, unknown>>>('/api/admin/system/disk');
    return res.data.data;
};
