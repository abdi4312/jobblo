import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as chatsApi from '../../api/admin/chats';
import type { AdminChatsQuery, ChatReportsQuery } from '../../types/admin/chats';

const keys = {
    chatsList: (q: AdminChatsQuery) => ['admin', 'chats', 'list', q] as const,
    chatDetail: (id: string) => ['admin', 'chats', 'detail', id] as const,
    chatMessages: (id: string, reason: string) => ['admin', 'chats', 'messages', id, reason] as const,
    chatReportsForChat: (id: string) => ['admin', 'chats', 'reports', id] as const,
    reportsList: (q: ChatReportsQuery) => ['admin', 'chat-reports', 'list', q] as const,
    reportsSummary: () => ['admin', 'chat-reports', 'summary'] as const,
    reportDetail: (id: string) => ['admin', 'chat-reports', 'detail', id] as const,
};

// ── Chats ─────────────────────────────────────────────────────────────────────
export const useAdminChats = (q: AdminChatsQuery) =>
    useQuery({ queryKey: keys.chatsList(q), queryFn: () => chatsApi.fetchAdminChats(q), staleTime: 20_000, placeholderData: (p) => p });

export const useAdminChatById = (chatId: string) =>
    useQuery({ queryKey: keys.chatDetail(chatId), queryFn: () => chatsApi.fetchAdminChatById(chatId), enabled: !!chatId, staleTime: 30_000 });

export const useAdminChatMessages = (chatId: string, accessReason: string, enabled: boolean) =>
    useQuery({
        queryKey: keys.chatMessages(chatId, accessReason),
        queryFn: () => chatsApi.fetchAdminChatMessages(chatId, accessReason),
        enabled: enabled && !!chatId && accessReason.trim().length >= 5,
        staleTime: 0,
        retry: false,
    });

export const useAdminChatReportsForChat = (chatId: string) =>
    useQuery({ queryKey: keys.chatReportsForChat(chatId), queryFn: () => chatsApi.fetchAdminChatReportsForChat(chatId), enabled: !!chatId });

// ── Chat Reports ──────────────────────────────────────────────────────────────
export const useAdminChatReports = (q: ChatReportsQuery) =>
    useQuery({ queryKey: keys.reportsList(q), queryFn: () => chatsApi.fetchAdminChatReports(q), staleTime: 20_000, placeholderData: (p) => p });

export const useChatReportsSummary = () =>
    useQuery({ queryKey: keys.reportsSummary(), queryFn: chatsApi.fetchChatReportsSummary, staleTime: 30_000 });

export const useAdminChatReportById = (reportId: string) =>
    useQuery({ queryKey: keys.reportDetail(reportId), queryFn: () => chatsApi.fetchAdminChatReportById(reportId), enabled: !!reportId, staleTime: 20_000 });

export const useAssignChatReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => chatsApi.assignChatReport(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'chat-reports'] }); toast.success('Rapport tildelt.'); },
        onError: () => toast.error('Kunne ikke tildele rapport.'),
    });
};

export const useUpdateChatReportStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => chatsApi.updateChatReportStatus(id, status, note),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'chat-reports'] }); toast.success('Status oppdatert.'); },
        onError: () => toast.error('Feil ved statusoppdatering.'),
    });
};

export const useUpdateChatReportPriority = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, priority }: { id: string; priority: string }) => chatsApi.updateChatReportPriority(id, priority),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'chat-reports'] }); toast.success('Prioritet oppdatert.'); },
        onError: () => toast.error('Feil ved oppdatering av prioritet.'),
    });
};

export const useAddChatReportNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, note }: { id: string; note: string }) => chatsApi.addChatReportInternalNote(id, note),
        onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: keys.reportDetail(id) }); toast.success('Notat lagret.'); },
        onError: () => toast.error('Kunne ikke lagre notat.'),
    });
};

export const useResolveChatReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, outcome, reason }: { id: string; outcome: string; reason: string }) =>
            chatsApi.resolveChatReport(id, outcome, reason),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'chat-reports'] }); toast.success('Rapport løst.'); },
        onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Feil ved løsning.'),
    });
};

export const useCreateDisputeFromReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => chatsApi.createDisputeFromReport(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'chat-reports'] }); qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }); toast.success('SafePay-tvist opprettet.'); },
        onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Feil.'),
    });
};
