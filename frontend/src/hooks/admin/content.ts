import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchFeatureFlags, toggleFeatureFlag,
    fetchAllConfigs, updateConfig,
    fetchHomepageContent, updateHomepageContent,
    fetchNavigation, updateNavigation,
    fetchFooter, updateFooter,
    fetchAnnouncements, updateAnnouncement,
    fetchMaintenanceMode, toggleMaintenanceMode,
} from '../../api/admin/content';
import { toast } from 'sonner';

export const useFeatureFlags = () =>
    useQuery({ queryKey: ['admin', 'feature-flags'], queryFn: fetchFeatureFlags });

export const useToggleFeatureFlag = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => toggleFeatureFlag(key, enabled),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'feature-flags'] }); toast.success('Funksjonsflagg oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere funksjonsflagg.'),
    });
};

export const useAllConfigs = () =>
    useQuery({ queryKey: ['admin', 'config'], queryFn: fetchAllConfigs });

export const useUpdateConfig = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ key, value }: { key: string; value: unknown }) => updateConfig(key, value),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'config'] }); toast.success('Konfigurasjon oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere konfigurasjon.'),
    });
};

export const useHomepageContent = () =>
    useQuery({ queryKey: ['admin', 'content', 'homepage'], queryFn: fetchHomepageContent });

export const useUpdateHomepageContent = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: unknown) => updateHomepageContent(payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'content', 'homepage'] }); toast.success('Hjemmeside oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere hjemmeside.'),
    });
};

export const useNavigation = () =>
    useQuery({ queryKey: ['admin', 'content', 'navigation'], queryFn: fetchNavigation });

export const useUpdateNavigation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: unknown) => updateNavigation(payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'content', 'navigation'] }); toast.success('Navigasjon oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere navigasjon.'),
    });
};

export const useFooter = () =>
    useQuery({ queryKey: ['admin', 'content', 'footer'], queryFn: fetchFooter });

export const useUpdateFooter = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: unknown) => updateFooter(payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'content', 'footer'] }); toast.success('Footer oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere footer.'),
    });
};

export const useAnnouncements = () =>
    useQuery({ queryKey: ['admin', 'content', 'announcements'], queryFn: fetchAnnouncements });

export const useUpdateAnnouncement = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: unknown) => updateAnnouncement(payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'content', 'announcements'] }); toast.success('Kunngjøring oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere kunngjøring.'),
    });
};

export const useMaintenanceMode = () =>
    useQuery({ queryKey: ['admin', 'maintenance'], queryFn: fetchMaintenanceMode });

export const useToggleMaintenanceMode = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: { enabled: boolean; message?: string }) => toggleMaintenanceMode(payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] }); toast.success('Vedlikeholdsmodus oppdatert.'); },
        onError: () => toast.error('Kunne ikke oppdatere vedlikeholdsmodus.'),
    });
};
