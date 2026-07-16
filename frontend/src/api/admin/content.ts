import mainLink from '../mainURLs';
import type { ApiResponse } from '../../types/admin';

// ── Feature Flags ────────────────────────────────────────────────────────────────
export interface FeatureFlag {
    key: string;
    value: boolean;
    description?: string;
}

export const fetchFeatureFlags = async (): Promise<FeatureFlag[]> => {
    const res = await mainLink.get<ApiResponse<{ flags: FeatureFlag[] }>>('/api/admin/feature-flags');
    return res.data.data.flags;
};

export const toggleFeatureFlag = async (key: string, enabled: boolean): Promise<FeatureFlag> => {
    const res = await mainLink.put<ApiResponse<FeatureFlag>>('/api/admin/feature-flags/toggle', { key, enabled });
    return res.data.data;
};

// ── Global Config ────────────────────────────────────────────────────────────────
export interface GlobalConfigEntry {
    key: string;
    value: unknown;
    description?: string;
}

export const fetchAllConfigs = async (): Promise<Record<string, unknown>> => {
    const res = await mainLink.get<ApiResponse<{ configs: Record<string, unknown> }>>('/api/admin/config');
    return res.data.data.configs;
};

export const updateConfig = async (key: string, value: unknown, description?: string): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/config', { key, value, description });
    return res.data.data;
};

// ── Homepage Content ─────────────────────────────────────────────────────────────
export const fetchHomepageContent = async (): Promise<Record<string, unknown>> => {
    const res = await mainLink.get<ApiResponse<{ content: Record<string, unknown> }>>('/api/admin/content/homepage');
    return res.data.data.content;
};

export const updateHomepageContent = async (payload: Record<string, unknown>): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/content/homepage', payload);
    return res.data.data;
};

// ── Navigation ───────────────────────────────────────────────────────────────────
export const fetchNavigation = async (): Promise<Record<string, unknown>> => {
    const res = await mainLink.get<ApiResponse<{ navigation: Record<string, unknown> }>>('/api/admin/content/navigation');
    return res.data.data.navigation;
};

export const updateNavigation = async (payload: Record<string, unknown>): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/content/navigation', payload);
    return res.data.data;
};

// ── Footer ───────────────────────────────────────────────────────────────────────
export const fetchFooter = async (): Promise<Record<string, unknown>> => {
    const res = await mainLink.get<ApiResponse<{ footer: Record<string, unknown> }>>('/api/admin/content/footer');
    return res.data.data.footer;
};

export const updateFooter = async (payload: Record<string, unknown>): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/content/footer', payload);
    return res.data.data;
};

// ── Announcements ────────────────────────────────────────────────────────────────
export const fetchAnnouncements = async (): Promise<Record<string, unknown>[]> => {
    const res = await mainLink.get<ApiResponse<{ announcements: Record<string, unknown>[] }>>('/api/admin/content/announcements');
    return res.data.data.announcements;
};

export const updateAnnouncement = async (payload: Record<string, unknown>): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/content/announcements', payload);
    return res.data.data;
};

// ── Maintenance Mode ─────────────────────────────────────────────────────────────
export const fetchMaintenanceMode = async (): Promise<{ enabled: boolean; message?: string }> => {
    const res = await mainLink.get<ApiResponse<{ maintenanceMode: { enabled: boolean; message?: string } }>>('/api/admin/maintenance');
    return res.data.data.maintenanceMode;
};

export const toggleMaintenanceMode = async (payload: { enabled: boolean; message?: string }): Promise<unknown> => {
    const res = await mainLink.put<ApiResponse<unknown>>('/api/admin/maintenance', payload);
    return res.data.data;
};
