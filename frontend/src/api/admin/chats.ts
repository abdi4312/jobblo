import mainLink from '../mainURLs';
import type { ApiResponse } from '../../types/admin';
import type {
    AdminChatListItem, AdminChatMessage, ChatReport,
    ChatReportsSummary, AdminChatsQuery, ChatReportsQuery, Pagination,
} from '../../types/admin/chats';

function toParams(q: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
    return p.toString();
}

// ── Chats ─────────────────────────────────────────────────────────────────────
export const fetchAdminChats = async (q: AdminChatsQuery = {}): Promise<{ chats: AdminChatListItem[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ chats: AdminChatListItem[] }>>(`/api/admin/chats?${toParams(q as Record<string, unknown>)}`);
    return { chats: res.data.data.chats, pagination: res.data.pagination! };
};

export const fetchAdminChatById = async (chatId: string) => {
    const res = await mainLink.get<ApiResponse<unknown>>(`/api/admin/chats/${chatId}`);
    return res.data.data;
};

export const fetchAdminChatMessages = async (chatId: string, accessReason: string): Promise<{ messages: AdminChatMessage[]; accessLogged: boolean }> => {
    const res = await mainLink.get<ApiResponse<{ messages: AdminChatMessage[]; accessLogged: boolean }>>(
        `/api/admin/chats/${chatId}/messages?accessReason=${encodeURIComponent(accessReason)}`
    );
    return res.data.data;
};

export const fetchAdminChatReportsForChat = async (chatId: string): Promise<ChatReport[]> => {
    const res = await mainLink.get<ApiResponse<{ reports: ChatReport[] }>>(`/api/admin/chats/${chatId}/reports`);
    return res.data.data.reports;
};

export const logAdminChatAccess = async (chatId: string, accessReason: string, orderId?: string): Promise<void> => {
    await mainLink.post(`/api/admin/chats/${chatId}/access-log`, { accessReason, orderId });
};

// ── Chat Reports ──────────────────────────────────────────────────────────────
export const fetchAdminChatReports = async (q: ChatReportsQuery = {}): Promise<{ reports: ChatReport[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ reports: ChatReport[] }>>(`/api/admin/chat-reports?${toParams(q as Record<string, unknown>)}`);
    return { reports: res.data.data.reports, pagination: res.data.pagination! };
};

export const fetchChatReportsSummary = async (): Promise<ChatReportsSummary> => {
    const res = await mainLink.get<ApiResponse<ChatReportsSummary>>('/api/admin/chat-reports/summary');
    return res.data.data;
};

export const fetchAdminChatReportById = async (reportId: string): Promise<ChatReport> => {
    const res = await mainLink.get<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}`);
    return res.data.data.report;
};

export const assignChatReport = async (reportId: string): Promise<ChatReport> => {
    const res = await mainLink.patch<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}/assign`, {});
    return res.data.data.report;
};

export const updateChatReportPriority = async (reportId: string, priority: string): Promise<ChatReport> => {
    const res = await mainLink.patch<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}/priority`, { priority });
    return res.data.data.report;
};

export const updateChatReportStatus = async (reportId: string, status: string, note?: string): Promise<ChatReport> => {
    const res = await mainLink.patch<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}/status`, { status, note });
    return res.data.data.report;
};

export const addChatReportInternalNote = async (reportId: string, note: string): Promise<void> => {
    await mainLink.post(`/api/admin/chat-reports/${reportId}/internal-notes`, { note });
};

export const resolveChatReport = async (reportId: string, outcome: string, reason: string): Promise<ChatReport> => {
    const res = await mainLink.post<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}/resolve`, { outcome, reason });
    return res.data.data.report;
};

export const reopenChatReport = async (reportId: string, reason: string): Promise<ChatReport> => {
    const res = await mainLink.post<ApiResponse<{ report: ChatReport }>>(`/api/admin/chat-reports/${reportId}/reopen`, { reason });
    return res.data.data.report;
};

export const createDisputeFromReport = async (reportId: string) => {
    const res = await mainLink.post<ApiResponse<unknown>>(`/api/admin/chat-reports/${reportId}/create-dispute`, {});
    return res.data.data;
};
