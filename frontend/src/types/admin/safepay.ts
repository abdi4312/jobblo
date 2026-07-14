import type { Pagination } from './index';

// ── SafePay contract (enriched order) ────────────────────────────────────────
export interface SafePayContract {
    _id: string;
    status: string;
    paymentStatus: string;
    agreedPrice?: number;
    initialPrice?: number;
    fee?: number;
    customerTotal?: number;
    providerNet?: number;
    scheduledDate?: string;
    createdAt: string;
    updatedAt: string;
    chatId?: string;
    chatStatus?: string;
    customerId?: { _id: string; name: string; email: string; avatarUrl?: string; accountStatus: string; verified: boolean };
    providerId?: { _id: string; name: string; email: string; avatarUrl?: string; accountStatus: string; verified: boolean };
    serviceId?: { _id: string; title: string; price: number; status: string };
    dispute?: { _id: string; status: string; priority: string } | null;
}

// ── SafePay summary ───────────────────────────────────────────────────────────
export interface SafePaySummary {
    orders: {
        total: number;
        awaiting_payment: number;
        paid: number;
        in_progress: number;
        completed: number;
        cancelled: number;
        disputed: number;
    };
    disputes: { open: number; under_review: number; resolved: number };
    revenue: { secured: number; released: number; refunded: number; fees: number };
}

// ── Timeline event ────────────────────────────────────────────────────────────
export interface TimelineEvent {
    source: 'order' | 'chat' | 'dispute' | 'admin';
    action: string;
    actorId?: string;
    timestamp: string;
    description: string;
}

// ── Dispute ───────────────────────────────────────────────────────────────────
export type DisputeStatus =
    | 'open' | 'under_review' | 'waiting_for_customer' | 'waiting_for_provider'
    | 'evidence_submitted' | 'resolved' | 'closed' | 'cancelled';

export type DisputePriority = 'low' | 'medium' | 'high' | 'critical';

export type DisputeOutcome =
    | 'release_to_provider' | 'full_refund_to_customer' | 'partial_refund'
    | 'split_payment' | 'cancel_without_payment' | 'no_action';

export interface DisputeMessage {
    _id: string;
    senderId?: { _id: string; name: string; email: string; role: string };
    senderRole: 'customer' | 'provider' | 'admin' | 'system';
    message: string;
    attachments?: string[];
    isInternal: boolean;
    createdAt: string;
}

export interface Dispute {
    _id: string;
    orderId: { _id: string; status: string; agreedPrice?: number } | string;
    serviceId?: { _id: string; title: string };
    openedBy?: { _id: string; name: string; email: string; role: string };
    openedAgainst?: { _id: string; name: string; email: string; role: string };
    reasonCategory: string;
    title: string;
    description: string;
    status: DisputeStatus;
    priority: DisputePriority;
    assignedAdminId?: { _id: string; name: string; email: string } | null;
    messages: DisputeMessage[];
    timeline: Array<{ action: string; actorId?: { _id: string; name: string }; note?: string; createdAt: string }>;
    evidence: Array<{ _id: string; fileUrl: string; fileType?: string; description?: string; createdAt: string }>;
    resolution?: {
        outcome: DisputeOutcome;
        reason: string;
        customerAmount: number;
        providerAmount: number;
        platformFee: number;
        resolvedBy?: { _id: string; name: string };
        resolvedAt: string;
        stripeRefundId?: string;
        stripeRefundStatus?: string;
    };
    payoutFrozen: boolean;
    openedAt: string;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DisputesSummary {
    open: number;
    under_review: number;
    waiting_for_customer: number;
    waiting_for_provider: number;
    resolved: number;
    closed: number;
    resolvedThisMonth: number;
    unassigned: number;
    high_priority: number;
}

// ── Query params ──────────────────────────────────────────────────────────────
export interface SafePayQuery {
    page?: number; limit?: number; status?: string; paymentStatus?: string;
    orderId?: string; dateFrom?: string; dateTo?: string; sortOrder?: string;
}
export interface DisputesQuery {
    page?: number; limit?: number; status?: string; priority?: string;
    assignedToMe?: string; unassigned?: string; dateFrom?: string; dateTo?: string;
}
export type { Pagination };
