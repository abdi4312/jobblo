/**
 * TanStack Query mutations for the Jobbsøker-profil screen.
 *
 * Endpoints (all authenticated, userId derived server-side from JWT):
 *   POST   /api/users/experience               → addExperience
 *   DELETE /api/users/experience/:expId        → deleteExperience
 *   POST   /api/users/portfolio                → addPortfolioItem   (multipart, field: image)
 *   DELETE /api/users/portfolio/:itemId        → deletePortfolioItem
 *   POST   /api/users/previous-projects        → addPreviousProject (multipart, field: image)
 *   DELETE /api/users/previous-projects/:projectId → deletePreviousProject
 *   POST   /api/users/certifications           → addCertification   (multipart, field: file)
 *   DELETE /api/users/certifications/:certId   → deleteCertification
 *
 * All create/delete mutations invalidate queryKeys.auth.profile so the
 * screen's useProfile() re-fetches the authoritative data.
 *
 * retry: false on all mutations — POST/DELETE are not idempotent and a
 * duplicate on network-retry would create a duplicate record or double-delete.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { queryKeys } from '../queryKeys';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExperienceInput = {
    title: string;
    company: string;
    startDate: string;   // YYYY-MM-DD
    endDate?: string;    // YYYY-MM-DD or empty
    description?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function invalidateProfile(queryClient: ReturnType<typeof useQueryClient>) {
    return queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
}

// ─── Experience ───────────────────────────────────────────────────────────────

export function useAddExperience() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (data: ExperienceInput) =>
            apiClient.post('/users/experience', data).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

export function useDeleteExperience() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (expId: string) =>
            apiClient.delete(`/users/experience/${expId}`).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export function useAddPortfolioItem() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (formData: FormData) =>
            apiClient.post('/users/portfolio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

export function useDeletePortfolioItem() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (itemId: string) =>
            apiClient.delete(`/users/portfolio/${itemId}`).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

// ─── Previous Projects ────────────────────────────────────────────────────────

export function useAddPreviousProject() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (formData: FormData) =>
            apiClient.post('/users/previous-projects', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

export function useDeletePreviousProject() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (projectId: string) =>
            apiClient.delete(`/users/previous-projects/${projectId}`).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

// ─── Certifications ───────────────────────────────────────────────────────────

export function useAddCertification() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (formData: FormData) =>
            apiClient.post('/users/certifications', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}

export function useDeleteCertification() {
    const qc = useQueryClient();
    return useMutation({
        retry: false,
        mutationFn: (certId: string) =>
            apiClient.delete(`/users/certifications/${certId}`).then((r) => r.data),
        onSuccess: () => invalidateProfile(qc),
    });
}
