import mainLink from '../mainURLs';
import type { ApiResponse } from '../../types/admin';
import type {
    SafePayContract, SafePaySummary, TimelineEvent,
    Dispute, DisputesSummary, SafePayQuery, DisputesQuery,
    Pagination,
} from '../../types/admin/safepay';

function toParams(q: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== '') p.set(k, String(v));
    });
    return p.toString();
}

// ── SafePay ────────────────────────────────────────────────────────────────────
export const fetchSafePayList = async (q: SafePayQuery = {}): Promise<{ contracts: SafePayContract[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ contracts: SafePayContract[] }>>(
        `/api/admin/safepay?${toParams(q as Record<string, unknown>)}`
    );
    return { contracts: res.data.data.contracts, pagination: res.data.pagination! };
};

export const fetchSafePaySummary = async (): Promise<SafePaySummary> => {
    const res = await mainLink.get<ApiResponse<SafePaySummary>>('/api/admin/safepay/summary');
    return res.data.data;
};

export const fetchSafePayDetail = async (orderId: string) => {
    const res = await mainLink.get<ApiResponse<unknown>>(`/api/admin/safepay/${orderId}`);
    return res.data.data;
};

export const fetchSafePayTimeline = async (orderId: string): Promise<TimelineEvent[]> => {
    const res = await mainLink.get<ApiResponse<{ timeline: TimelineEvent[] }>>(`/api/admin/safepay/${orderId}/timeline`);
    return res.data.data.timeline;
};

export interface AdminChatMessage {
    _id: string;
    type: string;
    text?: string;
    sender?: { _id: string; name: string; role: string } | null;
    attachments?: string[];
    systemData?: Record<string, unknown>;
    createdAt: string;
}

export interface AdminChatData {
    chat: {
        _id: string;
        status: string;
        agreedPrice?: number;
        messages: AdminChatMessage[];
    };
    accessLogged: boolean;
    reason: string;
}

export const fetchSafePayChat = async (orderId: string, accessReason: string, auditMode = false): Promise<AdminChatData> => {
    const params = new URLSearchParams({ accessReason });
    if (auditMode) params.set('auditMode', 'true');
    const res = await mainLink.get<ApiResponse<AdminChatData>>(
        `/api/admin/safepay/${orderId}/chat?${params.toString()}`
    );
    return res.data.data;
};

// ── Disputes ───────────────────────────────────────────────────────────────────
export const fetchAdminDisputes = async (q: DisputesQuery = {}): Promise<{ disputes: Dispute[]; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ disputes: Dispute[] }>>(
        `/api/admin/disputes?${toParams(q as Record<string, unknown>)}`
    );
    return { disputes: res.data.data.disputes, pagination: res.data.pagination! };
};

export const fetchDisputesSummary = async (): Promise<DisputesSummary> => {
    const res = await mainLink.get<ApiResponse<DisputesSummary>>('/api/admin/disputes/summary');
    return res.data.data;
};

export const fetchDisputeById = async (id: string): Promise<Dispute> => {
    const res = await mainLink.get<ApiResponse<{ dispute: Dispute }>>(`/api/admin/disputes/${id}`);
    return res.data.data.dispute;
};

export const assignDispute = async (id: string): Promise<Dispute> => {
    const res = await mainLink.patch<ApiResponse<{ dispute: Dispute }>>(`/api/admin/disputes/${id}/assign`, {});
    return res.data.data.dispute;
};

export const updateDisputeStatus = async (id: string, status: string, note?: string): Promise<Dispute> => {
    const res = await mainLink.patch<ApiResponse<{ dispute: Dispute }>>(`/api/admin/disputes/${id}/status`, { status, note });
    return res.data.data.dispute;
};

export const requestDisputeInformation = async (id: string, from: 'customer' | 'provider', message: string): Promise<Dispute> => {
    const res = await mainLink.post<ApiResponse<{ dispute: Dispute }>>(`/api/admin/disputes/${id}/request-information`, { from, message });
    return res.data.data.dispute;
};

export const addDisputeMessage = async (id: string, message: string): Promise<void> => {
    await mainLink.post(`/api/admin/disputes/${id}/message`, { message });
};

export const addInternalNote = async (id: string, note: string): Promise<void> => {
    await mainLink.post(`/api/admin/disputes/${id}/internal-note`, { note });
};

export const resolveDispute = async (id: string, payload: {
    outcome: string; reason: string; customerAmount?: number; providerAmount?: number;
}): Promise<{ dispute: Dispute; stripeRefundId?: string }> => {
    const res = await mainLink.post<ApiResponse<{ dispute: Dispute; stripeRefundId?: string }>>(`/api/admin/disputes/${id}/resolve`, payload);
    return res.data.data;
};

export const reopenDispute = async (id: string, reason: string): Promise<Dispute> => {
    const res = await mainLink.post<ApiResponse<{ dispute: Dispute }>>(`/api/admin/disputes/${id}/reopen`, { reason });
    return res.data.data.dispute;
};
