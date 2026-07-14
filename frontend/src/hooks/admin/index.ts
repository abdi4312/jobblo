import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as adminApi from '../../api/admin';
import type {
    AdminUsersQuery,
    AdminOrdersQuery,
    AdminServicesQuery,
    AdminReviewsQuery,
    AdminCategoriesQuery,
    AdminTransactionsQuery,
} from '../../api/admin';

// Re-export query types for convenience
export type {
    AdminOrdersQuery,
    AdminServicesQuery,
    AdminReviewsQuery,
    AdminCategoriesQuery,
    AdminTransactionsQuery,
};

// ── Query keys ────────────────────────────────────────────────────────────────
export const adminKeys = {
    all: ['admin'] as const,
    overview: () => [...adminKeys.all, 'overview'] as const,
    users: (q: AdminUsersQuery) => [...adminKeys.all, 'users', q] as const,
    user: (id: string) => [...adminKeys.all, 'user', id] as const,
    orders: (q: object) => [...adminKeys.all, 'orders', q] as const,
    order: (id: string) => [...adminKeys.all, 'order', id] as const,
    services: (q: object) => [...adminKeys.all, 'services', q] as const,
    reviews: (q: object) => [...adminKeys.all, 'reviews', q] as const,
    categories: (q: object) => [...adminKeys.all, 'categories', q] as const,
    transactions: (q: object) => [...adminKeys.all, 'transactions', q] as const,
    activity: (q: object) => [...adminKeys.all, 'activity', q] as const,
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const useDashboardOverview = () =>
    useQuery({
        queryKey: adminKeys.overview(),
        queryFn: adminApi.fetchDashboardOverview,
        staleTime: 30_000,
        retry: 2,
    });

// ── Users ─────────────────────────────────────────────────────────────────────
export const useAdminUsers = (query: AdminUsersQuery) =>
    useQuery({
        queryKey: adminKeys.users(query),
        queryFn: () => adminApi.fetchAdminUsers(query),
        staleTime: 20_000,
        placeholderData: (prev) => prev,
    });

export const useAdminUser = (id: string) =>
    useQuery({
        queryKey: adminKeys.user(id),
        queryFn: () => adminApi.fetchAdminUserById(id),
        enabled: !!id,
        staleTime: 30_000,
    });

export const useCreateAdminUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: adminApi.createAdminUser,
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Bruker opprettet.'); },
        onError: (e: { response?: { data?: { message?: string } } }) =>
            toast.error(e?.response?.data?.message || 'Kunne ikke opprette bruker.'),
    });
};

export const useChangeUserRole = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.changeUserRole(id, role),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Rolle oppdatert.'); },
        onError: (e: { response?: { data?: { error?: string } } }) =>
            toast.error(e?.response?.data?.error || 'Kunne ikke endre rolle.'),
    });
};

export const useUpdateUserStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, accountStatus }: { id: string; accountStatus: string }) =>
            adminApi.updateUserStatus(id, accountStatus),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Status oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere status.'),
    });
};

export const useVerifyUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.verifyUser(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Bruker verifisert.'); },
        onError: () => toast.error('Kunne ikke verifisere bruker.'),
    });
};

export const useSoftDeleteUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.softDeleteUser(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Bruker arkivert.'); },
        onError: (e: { response?: { data?: { error?: string } } }) =>
            toast.error(e?.response?.data?.error || 'Kunne ikke arkivere bruker.'),
    });
};

export const useRestoreUser = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.restoreUser(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Bruker gjenopprettet.'); },
        onError: () => toast.error('Kunne ikke gjenopprette bruker.'),
    });
};

export const useRevokeUserSessions = () =>
    useMutation({
        mutationFn: (id: string) => adminApi.revokeUserSessions(id),
        onSuccess: (d) => toast.success(`${d.revokedCount} sesjon(er) tilbakekalt.`),
        onError: () => toast.error('Kunne ikke tilbakekalle sesjoner.'),
    });

// ── Orders ────────────────────────────────────────────────────────────────────
export const useAdminOrders = (query: AdminOrdersQuery) =>
    useQuery({
        queryKey: adminKeys.orders(query),
        queryFn: () => adminApi.fetchAdminOrders(query),
        staleTime: 20_000,
        placeholderData: (prev) => prev,
    });

export const useAdminOrder = (id: string) =>
    useQuery({
        queryKey: adminKeys.order(id),
        queryFn: () => adminApi.fetchAdminOrderById(id),
        enabled: !!id,
        staleTime: 30_000,
    });

export const useCancelAdminOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.cancelAdminOrder(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Ordre avbrutt.'); },
        onError: (e: { response?: { data?: { message?: string } } }) =>
            toast.error(e?.response?.data?.message || 'Kunne ikke avbryte ordre.'),
    });
};

// ── Services ──────────────────────────────────────────────────────────────────
export const useAdminServices = (query: AdminServicesQuery) =>
    useQuery({
        queryKey: adminKeys.services(query),
        queryFn: () => adminApi.fetchAdminServices(query),
        staleTime: 20_000,
        placeholderData: (prev) => prev,
    });

export const useUpdateServiceStatus = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            adminApi.updateServiceStatus(id, status),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Tjenestestatus oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere tjeneste.'),
    });
};

export const useDeleteAdminService = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.deleteAdminService(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Tjeneste slettet.'); },
        onError: (e: { response?: { data?: { error?: string } } }) =>
            toast.error(e?.response?.data?.error || 'Kunne ikke slette tjeneste.'),
    });
};

// ── Reviews ───────────────────────────────────────────────────────────────────
export const useAdminReviews = (query: AdminReviewsQuery) =>
    useQuery({
        queryKey: adminKeys.reviews(query),
        queryFn: () => adminApi.fetchAdminReviews(query),
        staleTime: 20_000,
        placeholderData: (prev) => prev,
    });

export const useDeleteAdminReview = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.deleteAdminReview(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Vurdering slettet.'); },
        onError: () => toast.error('Kunne ikke slette vurdering.'),
    });
};

// ── Categories ────────────────────────────────────────────────────────────────
export const useAdminCategories = (query: AdminCategoriesQuery) =>
    useQuery({
        queryKey: adminKeys.categories(query),
        queryFn: () => adminApi.fetchAdminCategories(query),
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

export const useCreateAdminCategory = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: adminApi.createAdminCategory,
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Kategori opprettet.'); },
        onError: (e: { response?: { data?: { message?: string } } }) =>
            toast.error(e?.response?.data?.message || 'Kunne ikke opprette kategori.'),
    });
};

export const useUpdateAdminCategory = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<adminApi.AdminCategory> }) =>
            adminApi.updateAdminCategory(id, payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Kategori oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere kategori.'),
    });
};

export const useToggleAdminCategory = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.toggleAdminCategory(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); },
        onError: () => toast.error('Kunne ikke endre kategori.'),
    });
};

export const useDeleteAdminCategory = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adminApi.deleteAdminCategory(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.all }); toast.success('Kategori slettet.'); },
        onError: (e: { response?: { data?: { message?: string } } }) =>
            toast.error(e?.response?.data?.message || 'Kunne ikke slette kategori.'),
    });
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const useAdminTransactions = (query: AdminTransactionsQuery) =>
    useQuery({
        queryKey: adminKeys.transactions(query),
        queryFn: () => adminApi.fetchAdminTransactions(query),
        staleTime: 20_000,
        placeholderData: (prev) => prev,
    });

// ── Activity ──────────────────────────────────────────────────────────────────
export const useActivityLog = (query: Parameters<typeof adminApi.fetchActivityLog>[0]) =>
    useQuery({
        queryKey: adminKeys.activity(query),
        queryFn: () => adminApi.fetchActivityLog(query),
        staleTime: 15_000,
        placeholderData: (prev) => prev,
    });
