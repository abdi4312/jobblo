import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, UserCheck, AlertTriangle, Shield, Clock, CheckCircle2, XCircle, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    fetchAdminJobReports,
    assignJobReport,
} from '../../api/admin/jobReports';
import type { AdminJobReportItem } from '../../api/admin/jobReports';
import {
    AdminDataTable,
    AdminFilterSelect,
    AdminStatusBadge,
    AdminPageHeader,
    AdminStatCard,
    AdminStatCardSkeleton,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Åpen', value: 'open' },
    { label: 'Under behandling', value: 'under_review' },
    { label: 'Løst', value: 'resolved' },
    { label: 'Avvist', value: 'dismissed' },
];

const REPORT_TYPE_OPTIONS = [
    { label: 'Falsk annonse', value: 'fake_job' },
    { label: 'Svindel', value: 'scam_or_fraud' },
    { label: 'Spam', value: 'spam' },
    { label: 'Duplikat', value: 'duplicate' },
    { label: 'Upassende innhold', value: 'inappropriate_content' },
    { label: 'Feil kategori', value: 'wrong_category' },
    { label: 'Villedende informasjon', value: 'misleading_info' },
    { label: 'Utløpt annonse', value: 'expired_job' },
    { label: 'Betalingsproblem', value: 'payment_issue' },
    { label: 'Annet', value: 'other' },
];

export default function JobReportsPage() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-job-reports', page, statusFilter, typeFilter],
        queryFn: () =>
            fetchAdminJobReports({
                page,
                limit: 20,
                ...(statusFilter && { status: statusFilter }),
                ...(typeFilter && { reportType: typeFilter }),
            }),
        staleTime: 30_000,
    });

    const assignMutation = useMutation({
        mutationFn: (id: string) => assignJobReport(id),
        onSuccess: () => {
            toast.success('Rapport tildelt til deg.');
            qc.invalidateQueries({ queryKey: ['admin-job-reports'] });
        },
        onError: () => toast.error('Tildeling mislyktes.'),
    });

    const columns: ColumnDef<AdminJobReportItem>[] = [
        {
            key: 'serviceId',
            header: 'Annonse',
            render: (r) =>
                r.serviceId ? (
                    <div>
                        <p className="text-sm text-gray-800 line-clamp-1">{r.serviceId.title}</p>
                        <p className="font-mono text-xs text-gray-400">{r.serviceId._id.slice(-8).toUpperCase()}</p>
                    </div>
                ) : (
                    <span className="text-gray-400">Slettet</span>
                ),
        },
        {
            key: 'reportedBy',
            header: 'Rapportert av',
            render: (r) =>
                r.reportedBy ? (
                    <div>
                        <p className="text-sm text-gray-800">{r.reportedBy.name}</p>
                        <p className="text-xs text-gray-400">{r.reportedBy.email}</p>
                    </div>
                ) : (
                    <span className="text-gray-400">–</span>
                ),
        },
        {
            key: 'reportedUser',
            header: 'Rapportert bruker',
            render: (r) =>
                r.reportedUser ? (
                    <div>
                        <p className="text-sm text-gray-800">{r.reportedUser.name}</p>
                        <p className="text-xs text-gray-400">{r.reportedUser.email}</p>
                    </div>
                ) : (
                    <span className="text-gray-400">–</span>
                ),
        },
        {
            key: 'reportType',
            header: 'Type',
            render: (r) => (
                <span className="text-xs text-gray-600">{r.reportType.replace(/_/g, ' ')}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (r) => <AdminStatusBadge status={r.status} />,
        },
        {
            key: 'assigned',
            header: 'Tildelt',
            render: (r) =>
                r.assignedAdminId ? (
                    <span className="text-xs text-gray-700">{r.assignedAdminId.name}</span>
                ) : (
                    <span className="text-xs text-orange-500">Ikke tildelt</span>
                ),
        },
        {
            key: 'createdAt',
            header: 'Opprettet',
            render: (r) =>
                new Date(r.createdAt).toLocaleDateString('nb-NO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (r) => {
                const isActive = !['resolved', 'dismissed'].includes(r.status);
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                            to={`/dashboard/job-reports/${r._id}`}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                            <Eye size={11} aria-hidden="true" /> Detaljer
                        </Link>
                        {r.serviceId && (
                            <Link
                                to={`/job-listing/${r.serviceId._id}`}
                                target="_blank"
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-lg transition-colors"
                            >
                                <Briefcase size={11} aria-hidden="true" /> Se annonse
                            </Link>
                        )}
                        {isActive && !r.assignedAdminId && (
                            <button
                                onClick={() => assignMutation.mutate(r._id)}
                                disabled={assignMutation.isPending}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <UserCheck size={11} aria-hidden="true" /> Ta sak
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    const summary = data?.summary;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Jobbrapporter"
                description="Rapporter fra brukere om annonser på markedsplassen"
            />

            <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
                {isLoading
                    ? Array.from({ length: 7 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                    : summary && [
                        { title: 'Åpne', value: summary.open, icon: <AlertTriangle size={16} /> },
                        { title: 'Under behandling', value: summary.under_review, icon: <Shield size={16} /> },
                        { title: 'Ikke tildelt', value: summary.unassigned, icon: <Clock size={16} /> },
                        { title: 'Løst denne mnd', value: summary.resolvedThisMonth, icon: <CheckCircle2 size={16} /> },
                        { title: 'Totalt løst', value: summary.resolved, icon: <CheckCircle2 size={16} /> },
                        { title: 'Avvist', value: summary.dismissed, icon: <XCircle size={16} /> },
                        { title: 'Totalt', value: summary.total, icon: <Briefcase size={16} /> },
                    ].map((c) => (
                        <AdminStatCard key={c.title} title={c.title} value={c.value} icon={c.icon} />
                    ))}
            </section>

            <AdminDataTable
                columns={columns}
                data={data?.reports ?? []}
                keyExtractor={(r) => r._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen rapporter"
                emptyDescription="Det er ingen jobbrapporter som samsvarer med valgte filtre."
                pagination={data?.pagination}
                onPageChange={(p) => setPage(p)}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminFilterSelect
                            value={statusFilter}
                            onChange={(v) => { setStatusFilter(v); setPage(1); }}
                            options={STATUS_OPTIONS}
                            placeholder="Alle statuser"
                        />
                        <AdminFilterSelect
                            value={typeFilter}
                            onChange={(v) => { setTypeFilter(v); setPage(1); }}
                            options={REPORT_TYPE_OPTIONS}
                            placeholder="Alle rapporttyper"
                        />
                    </div>
                }
            />
        </div>
    );
}
