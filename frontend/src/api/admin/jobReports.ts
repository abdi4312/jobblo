import mainLink from '../mainURLs';
import type { ApiResponse, Pagination } from '../../types/admin';

function toParams(q: Record<string, unknown>): string {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    });
    return p.toString();
}

export interface AdminJobReportItem {
    _id: string;
    serviceId: { _id: string; title: string; price?: number; status?: string; images?: string[] } | null;
    reportedBy: { _id: string; name: string; email: string; avatarUrl?: string; role?: string } | null;
    reportedUser: { _id: string; name: string; email: string; avatarUrl?: string; role?: string } | null;
    reportType: string;
    description: string;
    status: string;
    assignedAdminId: { _id: string; name: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminJobReportDetail extends AdminJobReportItem {
    serviceId: { _id: string; title: string; description?: string; price?: number; status?: string; images?: string[]; location?: unknown; createdAt?: string } | null;
    resolvedBy: { _id: string; name: string; email: string } | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
}

export interface AdminJobReportsSummary {
    open: number;
    under_review: number;
    resolved: number;
    dismissed: number;
    resolvedThisMonth: number;
    unassigned: number;
    total: number;
}

export interface AdminJobReportsQuery {
    page?: number;
    limit?: number;
    status?: string;
    reportType?: string;
    serviceId?: string;
    assignedToMe?: 'true' | 'false';
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export const fetchAdminJobReports = async (
    q: AdminJobReportsQuery = {}
): Promise<{ reports: AdminJobReportItem[]; summary: AdminJobReportsSummary; pagination: Pagination }> => {
    const res = await mainLink.get<ApiResponse<{ reports: AdminJobReportItem[]; summary: AdminJobReportsSummary }>>(
        `/api/admin/job-reports?${toParams(q as Record<string, unknown>)}`
    );
    return {
        reports: res.data.data.reports,
        summary: res.data.data.summary,
        pagination: res.data.pagination!,
    };
};

export const fetchAdminJobReportById = async (reportId: string): Promise<AdminJobReportDetail> => {
    const res = await mainLink.get<ApiResponse<{ report: AdminJobReportDetail }>>(
        `/api/admin/job-reports/${reportId}`
    );
    return res.data.data.report;
};

export const assignJobReport = async (reportId: string): Promise<AdminJobReportItem> => {
    const res = await mainLink.patch<ApiResponse<{ report: AdminJobReportItem }>>(
        `/api/admin/job-reports/${reportId}/assign`,
        {}
    );
    return res.data.data.report;
};

export const updateJobReportStatus = async (
    reportId: string,
    status: string,
    note?: string
): Promise<AdminJobReportItem> => {
    const res = await mainLink.patch<ApiResponse<{ report: AdminJobReportItem }>>(
        `/api/admin/job-reports/${reportId}/status`,
        { status, note }
    );
    return res.data.data.report;
};

export interface SubmitJobReportPayload {
    reportType: string;
    description: string;
}

export const submitUserJobReport = async (
    serviceId: string,
    payload: SubmitJobReportPayload
): Promise<{ reportId: string; status: string; createdAt: string }> => {
    const res = await mainLink.post<ApiResponse<{ reportId: string; status: string; createdAt: string }>>(
        `/api/services/${serviceId}/reports`,
        payload
    );
    return res.data.data;
};
