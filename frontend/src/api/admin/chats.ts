import mainLink from '../mainURLs';
import type { ApiResponse, Pagination } from '../../types/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────
function toParams(q: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    });
    return p.toString();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminChatParticipant {
    _id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
    accountStatus: string;
    verified: boolean;
    averageRating?: number;
    completedJobs?: number;
    profileLink: string;
}

export interface AdminChatParticipants {
    customer: AdminChatParticipant | null;
    provider: AdminChatParticipant | null;
}

export interface AdminChatRelatedRecords {
    serviceId: string | null;
    serviceTitle: string | null;
    orderId: string | null;
    safePayOrderId: string | null;
    paymentStatus: string | null;
    orderStatus: string | null;
    disputeStatus: string | null;
    agreedPrice: number | null;
    safePayDetailLink: string | null;
    reportDetailLink: string | null;
    disputeId: string | null;
}

export interface AdminChatMessage {
    _id: string;
    type: string;
    text: string;
    sender: { _id: string; name: string; role: string } | null;
    attachments: string[];
    systemData: Record<string, unknown> | null;
    createdAt: string;
    isReported: boolean;
}

export interface AdminChatReport {
    _id: string;
    scope: 'chat' | 'message';
    reportType: string;
    title: string;
    status: string;
    priority: string;
    messageId?: string;
    reportedBy: { _id: string; name: string; email: string } | null;
    reportedUser: { _id: string; name: string; email: string } | null;
    createdAt: string;
}

export interface AdminChatDetail {
    _id: string;
    status: string;
    agreedPrice?: number;
    messageCount: number;
    attachmentCount: number;
    reportCount: number;
    lastMessage?: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string | null;
}

export interface AdminChatDetailResponse {
    chat: AdminChatDetail;
    participants: AdminChatParticipants;
    relatedRecords: AdminChatRelatedRecords;
    messages: AdminChatMessage[];
    reports: AdminChatReport[];
    accessLogged: boolean;
}

export interface AdminChatSummary {
    _id: string;
    status: string;
    agreedPrice?: number;
    reportCount: number;
    createdAt: string;
    updatedAt: string;
    clientId: AdminChatParticipant | null;
    providerId: AdminChatParticipant | null;
    serviceId: { _id: string; title: string; status: string } | null;
    orderId: string | null;
}

export interface AdminChatsQuery {
    page?: number;
    limit?: number;
    chatId?: string;
    orderId?: string;
    serviceId?: string;
    customerId?: string;
    providerId?: string;
    status?: string;
    reported?: 'true' | 'false';
    safePayLinked?: 'true' | 'false';
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AdminChatReportItem {
    _id: string;
    chatId: string | { _id: string; status: string };
    scope: 'chat' | 'message';
    reportType: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    messageId?: string;
    orderId?: string;
    safePayOrderId?: string;
    reportedBy: { _id: string; name: string; email: string; avatarUrl?: string } | null;
    reportedUser: { _id: string; name: string; email: string; avatarUrl?: string } | null;
    assignedAdminId: { _id: string; name: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminChatReportDetail extends AdminChatReportItem {
    evidence: Array<{ _id: string; fileUrl: string; fileType?: string; description?: string; uploadedAt: string }>;
    internalNotes: Array<{ _id: string; adminId: { _id: string; name: string; email: string }; note: string; createdAt: string }>;
    officialMessages: Array<{ _id: string; senderId: { _id: string; name: string }; recipientId: { _id: string; name: string }; message: string; createdAt: string }>;
    timeline: Array<{ _id: string; action: string; actorId: { _id: string; name: string } | null; description: string; createdAt: string }>;
    resolution?: { outcome: string; reason: string; resolvedBy: { _id: string; name: string } | null; resolvedAt: string };
}

export interface AdminChatReportsSummary {
    open: number;
    under_review: number;
    resolved: number;
    dismissed: number;
    urgent: number;
    high: number;
    resolvedThisMonth: number;
    unassigned: number;
}

export interface AdminChatReportsQuery {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    reportType?: string;
    chatId?: string;
    reportedBy?: string;
    reportedUser?: string;
    assignedAdminId?: string;
    safePayOrderId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ── Admin Chats ───────────────────────────────────────────────────────────────

export const fetchAdminChats = async (
    q: AdminChatsQuery = {}
): Promise<{ chats: AdminChatSummary[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ chats: AdminChatSummary[] }>>(
        `/api/admin/chats?${toParams(q as Record<string, unknown>)}`
    );
    return { chats: res.data.data.chats, pagination: res.data.pagination! };
};

export const fetchAdminChatById = async (
    chatId: string,
    accessReason: string
): Promise<AdminChatDetailResponse> => {
    const params = toParams({ accessReason });
    const res = await mainLink.get<ApiResponse<AdminChatDetailResponse>>(
        `/api/admin/chats/${chatId}?${params}`
    );
    return res.data.data;
};

export const postAdminChatAccessLog = async (
    chatId: string,
    accessReason: string
): Promise<{ accessLogged: boolean }> => {
    const res = await mainLink.post<ApiResponse<{ accessLogged: boolean }>>(
        `/api/admin/chats/${chatId}/access-log`,
        { accessReason }
    );
    return res.data.data;
};

// ── Admin Chat Reports ────────────────────────────────────────────────────────

export const fetchAdminChatReports = async (
    q: AdminChatReportsQuery = {}
): Promise<{ reports: AdminChatReportItem[]; summary: AdminChatReportsSummary; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ reports: AdminChatReportItem[]; summary: AdminChatReportsSummary }>>(
        `/api/admin/chat-reports?${toParams(q as Record<string, unknown>)}`
    );
    return {
        reports: res.data.data.reports,
        summary: res.data.data.summary,
        pagination: res.data.pagination!,
    };
};

export const fetchAdminChatReportById = async (
    reportId: string
): Promise<AdminChatReportDetail> => {
    const res = await mainLink.get<ApiResponse<{ report: AdminChatReportDetail }>>(
        `/api/admin/chat-reports/${reportId}`
    );
    return res.data.data.report;
};

export const assignChatReport = async (reportId: string): Promise<AdminChatReportItem> => {
    const res = await mainLink.patch<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/assign`,
        {}
    );
    return res.data.data.report;
};

export const updateChatReportPriority = async (
    reportId: string,
    priority: string
): Promise<AdminChatReportItem> => {
    const res = await mainLink.patch<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/priority`,
        { priority }
    );
    return res.data.data.report;
};

export const updateChatReportStatus = async (
    reportId: string,
    status: string,
    note?: string
): Promise<AdminChatReportItem> => {
    const res = await mainLink.patch<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/status`,
        { status, note }
    );
    return res.data.data.report;
};

export const addChatReportInternalNote = async (
    reportId: string,
    note: string
): Promise<void> => {
    await mainLink.post(`/api/admin/chat-reports/${reportId}/internal-notes`, { note });
};

export const sendChatReportOfficialMessage = async (
    reportId: string,
    recipientType: 'reporter' | 'reported_user',
    message: string
): Promise<void> => {
    await mainLink.post(`/api/admin/chat-reports/${reportId}/official-message`, {
        recipientType,
        message,
    });
};

export const resolveChatReport = async (
    reportId: string,
    outcomeOrPayload: string | { outcome: string; reason: string },
    reason?: string
): Promise<AdminChatReportItem> => {
    const payload = typeof outcomeOrPayload === 'string'
        ? { outcome: outcomeOrPayload, reason: reason ?? '' }
        : outcomeOrPayload;
    const res = await mainLink.post<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/resolve`,
        payload
    );
    return res.data.data.report;
};

// ── Additional chat functions ─────────────────────────────────────────────────
export const fetchAdminChatMessages = async (
    chatId: string,
    accessReason: string
): Promise<{ messages: AdminChatMessage[]; accessLogged: boolean; reason: string }> => {
    const params = toParams({ accessReason });
    const res = await mainLink.get<ApiResponse<{ messages: AdminChatMessage[]; accessLogged: boolean; reason: string }>>(
        `/api/admin/chats/${chatId}/messages?${params}`
    );
    return res.data.data;
};

export const fetchAdminChatReportsForChat = async (
    chatId: string
): Promise<AdminChatReport[]> => {
    const res = await mainLink.get<ApiResponse<{ reports: AdminChatReport[] }>>(
        `/api/admin/chats/${chatId}/reports`
    );
    return res.data.data.reports;
};

export const fetchChatReportsSummary = async (): Promise<AdminChatReportsSummary> => {
    const res = await mainLink.get<ApiResponse<AdminChatReportsSummary>>('/api/admin/chat-reports/summary');
    return res.data.data;
};

export const createDisputeFromReport = async (reportId: string): Promise<{ disputeId: string }> => {
    const res = await mainLink.post<ApiResponse<{ disputeId: string }>>(
        `/api/admin/chat-reports/${reportId}/create-dispute`,
        {}
    );
    return res.data.data;
};

export const dismissChatReport = async (
    reportId: string,
    reason: string
): Promise<AdminChatReportItem> => {
    const res = await mainLink.post<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/dismiss`,
        { reason }
    );
    return res.data.data.report;
};

export const reopenChatReport = async (reportId: string): Promise<AdminChatReportItem> => {
    const res = await mainLink.post<ApiResponse<{ report: AdminChatReportItem }>>(
        `/api/admin/chat-reports/${reportId}/reopen`,
        {}
    );
    return res.data.data.report;
};

// ── User-facing report submission ─────────────────────────────────────────────

export interface SubmitChatReportPayload {
    scope: 'chat' | 'message';
    messageId?: string;
    reportType: string;
    title: string;
    description: string;
}

export const submitUserChatReport = async (
    chatId: string,
    payload: SubmitChatReportPayload,
    evidenceFiles?: File[]
): Promise<{ reportId: string; status: string; createdAt: string }> => {
    const formData = new FormData();
    formData.append('scope', payload.scope);
    formData.append('reportType', payload.reportType);
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    if (payload.messageId) formData.append('messageId', payload.messageId);
    if (evidenceFiles) {
        evidenceFiles.forEach((f) => formData.append('evidence', f));
    }

    const res = await mainLink.post<ApiResponse<{ reportId: string; status: string; createdAt: string }>>(
        `/api/chats/${chatId}/reports`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
};

export const fetchMyChatsReports = async (
    chatId: string
): Promise<Array<{ _id: string; scope: string; reportType: string; title: string; status: string; createdAt: string }>> => {
    const res = await mainLink.get<ApiResponse<{ reports: Array<{ _id: string; scope: string; reportType: string; title: string; status: string; createdAt: string }> }>>(
        `/api/chats/${chatId}/reports/me`
    );
    return res.data.data.reports;
};
