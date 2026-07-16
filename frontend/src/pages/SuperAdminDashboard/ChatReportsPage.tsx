import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, MessageSquare, UserCheck, AlertTriangle, Shield, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
    fetchAdminChatReports,
    assignChatReport,
    updateChatReportPriority,
} from '../../api/admin/chats';
import type { AdminChatReportItem } from '../../api/admin/chats';
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
    { label: 'Venter reporter', value: 'waiting_for_reporter' },
    { label: 'Venter rapportert bruker', value: 'waiting_for_reported_user' },
    { label: 'Handling kreves', value: 'action_required' },
    { label: 'Løst', value: 'resolved' },
    { label: 'Avvist', value: 'dismissed' },
    { label: 'Lukket', value: 'closed' },
];

const PRIORITY_OPTIONS = [
    { label: 'Lav', value: 'low' },
    { label: 'Middels', value: 'medium' },
    { label: 'Høy', value: 'high' },
    { label: 'Haster', value: 'urgent' },
];

const PRIORITY_COLOR: Record<string, string> = {
    low: 'text-gray-500 bg-gray-50',
    medium: 'text-yellow-600 bg-yellow-50',
    high: 'text-orange-600 bg-orange-50',
    urgent: 'text-red-700 bg-red-100',
};

const REPORT_TYPE_OPTIONS = [
    { label: 'Trakassering', value: 'harassment' },
    { label: 'Krenkende språk', value: 'abusive_language' },
    { label: 'Trusler', value: 'threats' },
    { label: 'Spam', value: 'spam' },
    { label: 'Svindel', value: 'scam_or_fraud' },
    { label: 'Betalingsproblem', value: 'payment_issue' },
    { label: 'SafePay-problem', value: 'safepay_issue' },
    { label: 'Jobb ikke fullført', value: 'work_not_completed' },
    { label: 'Dårlig kvalitet', value: 'poor_quality' },
    { label: 'Avvik fra avtale', value: 'different_from_agreement' },
    { label: 'Upassende innhold', value: 'inappropriate_content' },
    { label: 'Falsk profil', value: 'fake_profile' },
    { label: 'Identitetsproblem', value: 'identity_issue' },
    { label: 'Mistenkelig lenke', value: 'suspicious_link' },
    { label: 'Personvernbrudd', value: 'privacy_violation' },
    { label: 'Betaling utenfor SafePay', value: 'off_platform_payment_request' },
    { label: 'Annet', value: 'other' },
];

export default function ChatReportsPage() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-chat-reports', page, statusFilter, priorityFilter, typeFilter],
        queryFn: () =>
            fetchAdminChatReports({
                page,
                limit: 20,
                ...(statusFilter && { status: statusFilter }),
                ...(priorityFilter && { priority: priorityFilter }),
                ...(typeFilter && { reportType: typeFilter }),
            }),
        staleTime: 30_000,
    });

    const assignMutation = useMutation({
        mutationFn: (id: string) => assignChatReport(id),
        onSuccess: () => {
            toast.success('Rapport tildelt til deg.');
            qc.invalidateQueries({ queryKey: ['admin-chat-reports'] });
        },
        onError: () => toast.error('Tildeling mislyktes.'),
    });

    const columns: ColumnDef<AdminChatReportItem>[] = [
        {
            key: 'reportId',
            header: 'Rapport-ID',
            render: (r) => (
                <Link
                    to={`/dashboard/chat-reports/${r._id}`}
                    className="font-mono text-xs text-[#2d4a3e] hover:underline"
                >
                    {r._id.slice(-8).toUpperCase()}
                </Link>
            ),
        },
        {
            key: 'chatId',
            header: 'Chat ID',
            render: (r) => {
                const cid = typeof r.chatId === 'object' ? r.chatId._id : r.chatId;
                return cid ? (
                    <span className="font-mono text-xs text-gray-500">
                        {cid.slice(0, 8)}…{cid.slice(-4)}
                    </span>
                ) : (
                    <span className="text-gray-400">–</span>
                );
            },
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
            key: 'scope',
            header: 'Omfang',
            render: (r) => (
                <span className="text-xs capitalize text-gray-500">{r.scope}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (r) => <AdminStatusBadge status={r.status} />,
        },
        {
            key: 'priority',
            header: 'Prioritet',
            render: (r) => (
                <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOR[r.priority] ?? ''
                        }`}
                >
                    {r.priority}
                </span>
            ),
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
                const chatId = typeof r.chatId === 'object' ? r.chatId._id : r.chatId;
                const isActive = !['resolved', 'dismissed', 'closed'].includes(r.status);
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                            to={`/dashboard/chat-reports/${r._id}`}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                            <Eye size={11} aria-hidden="true" /> Detaljer
                        </Link>
                        {chatId && (
                            <Link
                                to={`/dashboard/chat-review?chatId=${chatId}&reportId=${r._id}&source=report`}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-lg transition-colors"
                            >
                                <MessageSquare size={11} aria-hidden="true" /> Gjennomgå chat
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
                title="Chatrapporter"
                description="Administrer og behandle rapporter fra brukere om chatter og meldinger"
            />

            {/* Summary cards */}
            <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                    : summary && [
                        { title: 'Åpne', value: summary.open, icon: <AlertTriangle size={16} /> },
                        { title: 'Under behandling', value: summary.under_review, icon: <Shield size={16} /> },
                        { title: 'Ikke tildelt', value: summary.unassigned, icon: <Clock size={16} /> },
                        { title: 'Haster', value: summary.urgent, icon: <AlertTriangle size={16} /> },
                        { title: 'Høy prioritet', value: summary.high, icon: <AlertTriangle size={16} /> },
                        { title: 'Løst denne mnd', value: summary.resolvedThisMonth, icon: <CheckCircle2 size={16} /> },
                        { title: 'Totalt løst', value: summary.resolved, icon: <CheckCircle2 size={16} /> },
                        { title: 'Avvist', value: summary.dismissed, icon: <XCircle size={16} /> },
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
                emptyDescription="Det er ingen chatrapporter som samsvarer med valgte filtre."
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
                            value={priorityFilter}
                            onChange={(v) => { setPriorityFilter(v); setPage(1); }}
                            options={PRIORITY_OPTIONS}
                            placeholder="Alle prioriteter"
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
