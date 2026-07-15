import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, AlertTriangle, CheckCircle2, Clock, Users, Loader2 } from 'lucide-react';
import { useAdminChatReports, useChatReportsSummary, useAssignChatReport, useUpdateChatReportStatus, useResolveChatReport } from '../../hooks/admin/chats';
import type { ChatReport } from '../../types/admin/chats';
import { REPORT_TYPE_LABELS } from '../../types/admin/chats';
import {
    AdminDataTable, AdminFilterSelect, AdminStatusBadge,
    AdminPageHeader, AdminStatCard, AdminStatCardSkeleton, AdminConfirmDialog,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';
import { ChatIdCell } from '../../components/admin/chat/ChatIdCell';

const STATUS_OPTIONS = [
    { label: 'Åpen', value: 'open' },
    { label: 'Under behandling', value: 'under_review' },
    { label: 'Handling kreves', value: 'action_required' },
    { label: 'Venter reporter', value: 'waiting_for_reporter' },
    { label: 'Venter bruker', value: 'waiting_for_reported_user' },
    { label: 'Løst', value: 'resolved' },
    { label: 'Avvist', value: 'dismissed' },
];

const PRIORITY_OPTIONS = [
    { label: 'Lav', value: 'low' },
    { label: 'Middels', value: 'medium' },
    { label: 'Høy', value: 'high' },
    { label: 'Kritisk', value: 'urgent' },
];

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-gray-50 text-gray-500',
    medium: 'bg-yellow-50 text-yellow-600',
    high: 'bg-orange-50 text-orange-600',
    urgent: 'bg-red-100 text-red-700',
};

const RESOLVE_OUTCOMES = [
    { label: 'Ingen brudd', value: 'no_violation' },
    { label: 'Advarsel utstedt', value: 'warning_issued' },
    { label: 'Innholdsbrudd', value: 'content_violation' },
    { label: 'Bruker begrenset', value: 'user_restricted' },
    { label: 'SafePay-tvist åpnet', value: 'safepay_dispute_opened' },
    { label: 'Løst mellom brukere', value: 'resolved_between_users' },
    { label: 'Annet', value: 'other' },
];

export default function ChatReportsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [resolveTarget, setResolveTarget] = useState<ChatReport | null>(null);
    const [resolveForm, setResolveForm] = useState({ outcome: '', reason: '' });

    const { data, isLoading, isError, refetch } = useAdminChatReports({
        page, limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
    });
    const { data: summary, isLoading: summaryLoading } = useChatReportsSummary();
    const assignMutation = useAssignChatReport();
    const statusMutation = useUpdateChatReportStatus();
    const resolveMutation = useResolveChatReport();

    const columns: ColumnDef<ChatReport>[] = [
        {
            key: 'id',
            header: 'Rapport-ID',
            render: (r) => <Link to={`/dashboard/chat-reports/${r._id}`} className="font-mono text-xs text-[#2d4a3e] hover:underline">{r._id.slice(-8).toUpperCase()}</Link>,
        },
        {
            key: 'chat',
            header: 'Chat ID',
            render: (r) => {
                const chatId = typeof r.chatId === 'object' ? r.chatId._id : r.chatId;
                return <ChatIdCell chatId={chatId} reviewSource="report" reportId={r._id} />;
            },
        },
        {
            key: 'reportedBy',
            header: 'Rapportert av',
            render: (r) => <div><p className="text-sm text-gray-800">{r.reportedBy?.name ?? '–'}</p><p className="text-xs text-gray-400">{r.reportedBy?.email}</p></div>,
        },
        {
            key: 'reportedUser',
            header: 'Om bruker',
            render: (r) => <div><p className="text-sm text-gray-800">{r.reportedUser?.name ?? '–'}</p><p className="text-xs text-gray-400">{r.reportedUser?.email}</p></div>,
        },
        {
            key: 'type',
            header: 'Type',
            render: (r) => <span className="text-xs text-gray-600">{REPORT_TYPE_LABELS[r.reportType] ?? r.reportType}</span>,
        },
        {
            key: 'scope',
            header: 'Omfang',
            render: (r) => <span className="text-xs capitalize text-gray-500">{r.scope === 'message' ? 'Melding' : 'Chat'}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (r) => <AdminStatusBadge status={r.status} />,
        },
        {
            key: 'priority',
            header: 'Prioritet',
            render: (r) => <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[r.priority] ?? ''}`}>{r.priority}</span>,
        },
        {
            key: 'assigned',
            header: 'Tildelt',
            render: (r) => r.assignedAdminId
                ? <span className="text-xs text-gray-700">{r.assignedAdminId.name}</span>
                : <span className="text-xs text-orange-500">Ikke tildelt</span>,
        },
        {
            key: 'date',
            header: 'Dato',
            render: (r) => new Date(r.createdAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'actions',
            header: '',
            className: 'whitespace-nowrap',
            render: (r) => {
                const isActive = !['resolved', 'dismissed', 'closed'].includes(r.status);
                return (
                    <div className="flex items-center gap-1.5">
                        <Link to={`/dashboard/chat-reports/${r._id}`}
                            className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            Se
                        </Link>
                        {isActive && !r.assignedAdminId && (
                            <button onClick={() => assignMutation.mutate(r._id)} disabled={assignMutation.isPending}
                                className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
                                Ta sak
                            </button>
                        )}
                        {isActive && (
                            <button onClick={() => { setResolveTarget(r); setResolveForm({ outcome: '', reason: '' }); }}
                                className="px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
                                Løs
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader title="Chatrapporter" description="Administrer alle innsendte chatrapporter" />

            {/* Summary */}
            <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
                {summaryLoading
                    ? Array.from({ length: 6 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                    : summary && [
                        { title: 'Åpne', value: summary.open, icon: <Flag size={15} /> },
                        { title: 'Under behandling', value: summary.under_review, icon: <Clock size={15} /> },
                        { title: 'Kritisk/Urgent', value: summary.urgent, icon: <AlertTriangle size={15} /> },
                        { title: 'Ikke tildelt', value: summary.unassigned, icon: <Users size={15} /> },
                        { title: 'Venter reporter', value: summary.waiting_for_reporter, icon: <Clock size={15} /> },
                        { title: 'Løst denne mnd', value: summary.resolvedThisMonth, icon: <CheckCircle2 size={15} /> },
                        { title: 'SafePay-lenket', value: summary.safePayLinked, icon: <Flag size={15} /> },
                    ].map((c) => <AdminStatCard key={c.title} title={c.title} value={c.value} icon={c.icon} />)
                }
            </section>

            <AdminDataTable
                columns={columns}
                data={data?.reports ?? []}
                keyExtractor={(r) => r._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen rapporter"
                emptyDescription="Ingen chatrapporter er innsendt ennå."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminFilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="Alle statuser" />
                        <AdminFilterSelect value={priorityFilter} onChange={(v) => { setPriorityFilter(v); setPage(1); }} options={PRIORITY_OPTIONS} placeholder="Alle prioriteter" />
                    </div>
                }
            />

            {/* Resolve dialog */}
            {resolveTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Løs rapport: {resolveTarget.title}</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Utfall *</label>
                            <select value={resolveForm.outcome} onChange={(e) => setResolveForm((f) => ({ ...f, outcome: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                <option value="">Velg utfall</option>
                                {RESOLVE_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={resolveForm.reason} onChange={(e) => setResolveForm((f) => ({ ...f, reason: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                placeholder="Forklar avgjørelsen..." />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setResolveTarget(null)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    if (!resolveForm.outcome || !resolveForm.reason.trim()) return;
                                    await resolveMutation.mutateAsync({ id: resolveTarget._id, outcome: resolveForm.outcome, reason: resolveForm.reason.trim() });
                                    setResolveTarget(null);
                                }}
                                disabled={resolveMutation.isPending || !resolveForm.outcome || !resolveForm.reason.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-50 transition-colors">
                                {resolveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                Bekreft
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
