import type { Pagination } from './index';

export interface AdminChatParticipant {
    _id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
    accountStatus: string;
    verified: boolean;
}

export interface AdminChatListItem {
    _id: string;
    status: string;
    agreedPrice?: number;
    lastMessage?: string;
    reportCount: number;
    messageCount: number;
    attachmentCount: number;
    lastMessageAt: string | null;
    createdAt: string;
    updatedAt: string;
    clientId?: AdminChatParticipant;
    providerId?: AdminChatParticipant;
    serviceId?: { _id: string; title: string; status: string; price: number };
    orderId?: { _id: string; status: string; paymentStatus: string; agreedPrice?: number };
}

export interface AdminChatMessage {
    _id: string;
    type: string;
    text?: string;
    attachments?: string[];
    systemData?: Record<string, unknown>;
    sender?: { _id: string; name: string; role: string } | null;
    isReported?: boolean;
    createdAt: string;
}

export const REPORT_TYPE_LABELS: Record<string, string> = {
    harassment: 'Trakassering',
    abusive_language: 'Fornærmende språk',
    threats: 'Trusler',
    spam: 'Spam',
    scam_or_fraud: 'Svindel eller bedrageri',
    payment_issue: 'Betalingsproblem',
    safepay_issue: 'SafePay-problem',
    work_not_completed: 'Arbeid ikke fullført',
    poor_quality: 'Dårlig kvalitet',
    different_from_agreement: 'Avviker fra avtale',
    inappropriate_content: 'Upassende innhold',
    fake_profile: 'Falsk profil',
    identity_issue: 'Identitetsproblem',
    suspicious_link: 'Mistenkelig lenke',
    privacy_violation: 'Personvernbrudd',
    off_platform_payment_request: 'Betalingsforespørsel utenfor plattformen',
    other: 'Annet',
};

export interface ChatReport {
    _id: string;
    chatId: { _id: string; status: string } | string;
    scope: 'chat' | 'message';
    messageId?: string;
    reportType: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    reportedBy?: AdminChatParticipant;
    reportedUser?: AdminChatParticipant;
    serviceId?: { _id: string; title: string };
    orderId?: { _id: string; status: string; agreedPrice?: number };
    safePayOrderId?: { _id: string; status: string };
    disputeId?: { _id: string; status: string };
    assignedAdminId?: { _id: string; name: string; email: string } | null;
    internalNotes?: Array<{ _id: string; adminId: string; note: string; createdAt: string }>;
    officialMessages?: Array<{ _id: string; senderId: string; recipientId: string; message: string; createdAt: string }>;
    timeline?: Array<{ _id: string; action: string; actorId?: { _id: string; name: string }; description?: string; createdAt: string }>;
    resolution?: { outcome: string; reason: string; resolvedBy?: { _id: string; name: string }; resolvedAt: string };
    createdAt: string;
    updatedAt: string;
}

export interface ChatReportsSummary {
    open: number;
    under_review: number;
    action_required: number;
    waiting_for_reporter: number;
    waiting_for_reported_user: number;
    resolved: number;
    resolvedThisMonth: number;
    unassigned: number;
    safePayLinked: number;
    urgent: number;
}

export interface AdminChatsQuery {
    page?: number; limit?: number; search?: string; chatId?: string;
    orderId?: string; serviceId?: string; customerId?: string; providerId?: string;
    reportId?: string;
    status?: string; reported?: boolean; safePayLinked?: boolean;
    startDate?: string; endDate?: string; sortBy?: string; sortOrder?: string;
}

export interface ChatReportsQuery {
    page?: number; limit?: number; status?: string; priority?: string;
    reportType?: string; chatId?: string; safePayOrderId?: string;
    assignedToMe?: string; unassigned?: string; startDate?: string; endDate?: string;
}

export type { Pagination };
