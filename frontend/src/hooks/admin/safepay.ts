import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as safePayApi from '../../api/admin/safepay';
import type { SafePayQuery, DisputesQuery } from '../../types/admin/safepay';

const keys = {
    safePayList: (q: SafePayQuery) => ['admin', 'safepay', 'list', q] as const,
    safePaySummary: () => ['admin', 'safepay', 'summary'] as const,
    safePayDetail: (id: string) => ['admin', 'safepay', 'detail', id] as const,
    safePayTimeline: (id: string) => ['admin', 'safepay', 'timeline', id] as const,
    disputesList: (q: DisputesQuery) => ['admin', 'disputes', 'list', q] as const,
    disputesSummary: () => ['admin', 'disputes', 'summary'] as const,
    disputeDetail: (id: string) => ['admin', 'disputes', 'detail', id] as const,
};

export const useSafePayList = (q: SafePayQuery) =>
    useQuery({ queryKey: keys.safePayList(q), queryFn: () => safePayApi.fetchSafePayList(q), staleTime: 20_000, placeholderData: (p) => p });

export const useSafePaySummary = () =>
    useQuery({ queryKey: keys.safePaySummary(), queryFn: safePayApi.fetchSafePaySummary, staleTime: 30_000 });

export const useSafePayDetail = (orderId: string) =>
    useQuery({ queryKey: keys.safePayDetail(orderId), queryFn: () => safePayApi.fetchSafePayDetail(orderId), enabled: !!orderId, staleTime: 30_000 });

export const useSafePayTimeline = (orderId: string) =>
    useQuery({ queryKey: keys.safePayTimeline(orderId), queryFn: () => safePayApi.fetchSafePayTimeline(orderId), enabled: !!orderId, staleTime: 30_000 });

export const useSafePayChat = (orderId: string, accessReason: string, enabled: boolean, auditMode = false) =>
    useQuery({
        queryKey: ['admin', 'safepay', 'chat', orderId, accessReason],
        queryFn: () => safePayApi.fetchSafePayChat(orderId, accessReason, auditMode),
        enabled: enabled && !!orderId && accessReason.trim().length >= 5,
        staleTime: 0, // Always re-fetch so each access is freshly logged
        retry: false,
    });

export const useAdminDisputes = (q: DisputesQuery) =>
    useQuery({ queryKey: keys.disputesList(q), queryFn: () => safePayApi.fetchAdminDisputes(q), staleTime: 20_000, placeholderData: (p) => p });

export const useDisputesSummary = () =>
    useQuery({ queryKey: keys.disputesSummary(), queryFn: safePayApi.fetchDisputesSummary, staleTime: 30_000 });

export const useDisputeById = (id: string) =>
    useQuery({ queryKey: keys.disputeDetail(id), queryFn: () => safePayApi.fetchDisputeById(id), enabled: !!id, staleTime: 20_000 });

export const useAssignDispute = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => safePayApi.assignDispute(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }); toast.success('Tvist tildelt.'); },
        onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Feil.'),
    });
};

export const useUpdateDisputeStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => safePayApi.updateDisputeStatus(id, status, note),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }); toast.success('Status oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere status.'),
    });
};

export const useResolveDispute = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof safePayApi.resolveDispute>[1] }) =>
            safePayApi.resolveDispute(id, payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }); qc.invalidateQueries({ queryKey: ['admin', 'safepay'] }); toast.success('Tvist løst.'); },
        onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Kunne ikke løse tvist.'),
    });
};

export const useReopenDispute = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => safePayApi.reopenDispute(id, reason),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'disputes'] }); toast.success('Tvist gjenåpnet.'); },
        onError: () => toast.error('Kunne ikke gjenåpne tvist.'),
    });
};

export const useAddInternalNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, note }: { id: string; note: string }) => safePayApi.addInternalNote(id, note),
        onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: keys.disputeDetail(id) }); toast.success('Notat lagret.'); },
        onError: () => toast.error('Kunne ikke lagre notat.'),
    });
};
