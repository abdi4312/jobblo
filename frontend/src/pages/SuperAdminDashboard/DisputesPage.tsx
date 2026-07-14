import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, Clock, Users, CheckCircle2, Loader2 } from 'lucide-react';
import { useAdminDisputes, useDisputesSummary, useAssignDispute, useUpdateDisputeStatus, useResolveDispute, useReopenDispute, useAddInternalNote } from '../../hooks/admin/safepay';
import type { Dispute, DisputeStatus, DisputeOutcome } from '../../types/admin/safepay';
import {
    AdminDataTable,
    AdminFilterSelect,
    AdminStatusBadge,
    AdminPageHeader,
    AdminStatCard,
    AdminStatCardSkeleton,
    AdminConfirmDialog,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS: { label: string; value: DisputeStatus }[] = [
    { label: 'Åpen', value: 'open' },
    { label: 'Under behandling', value: 'under_review' },
    { label: 'Venter kunde', value: 'waiting_for_customer' },
    { label: 'Venter tilbyder', value: 'waiting_for_provider' },
    { label: 'Bevis innlevert', value: 'evidence_submitted' },
    { label: 'Løst', value: 'resolved' },
    { label: 'Lukket', value: 'closed' },
];

const PRIORITY_OPTIONS = [
    { label: 'Lav', value: 'low' },
    { label: 'Middels', value: 'medium' },
    { label: 'Høy', value: 'high' },
    { label: 'Kritisk', value: 'critical' },
];

const PRIORITY_COLOR: Record<string, string> = {
    low: 'text-gray-500 bg-gray-50',
    medium: 'text-yellow-600 bg-yellow-50',
    high: 'text-orange-600 bg-orange-50',
    critical: 'text-red-700 bg-red-100',
};

const OUTCOME_OPTIONS: { label: string; value: DisputeOutcome }[] = [
    { label: 'Frigi til tilbyder', value: 'release_to_provider' },
    { label: 'Full refusjon til kunde', value: 'full_refund_to_customer' },
    { label: 'Delvis refusjon', value: 'partial_refund' },
    { label: 'Del betaling', value: 'split_payment' },
    { label: 'Avbryt uten betaling', value: 'cancel_without_payment' },
    { label: 'Ingen handling', value: 'no_action' },
];

interface ResolveForm {
    outcome: DisputeOutcome | '';
    reason: string;
    customerAmount: string;
    providerAmount: string;
}

export default function DisputesPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    // Action state
    const [resolveTarget, setResolveTarget] = useState<Dispute | null>(null);
    const [resolveForm, setResolveForm] = useState<ResolveForm>({ outcome: '', reason: '', customerAmount: '', providerAmount: '' });
    const [noteTarget, setNoteTarget] = useState<Dispute | null>(null);
    const [noteText, setNoteText] = useState('');
    const [reopenTarget, setReopenTarget] = useState<Dispute | null>(null);
    const [reopenReason, setReopenReason] = useState('');

    const { data, isLoading, isError, refetch } = useAdminDisputes({
        page, limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
    });
    const { data: summary, isLoading: summaryLoading } = useDisputesSummary();

    const assignMutation = useAssignDispute();
    const statusMutation = useUpdateDisputeStatus();
    const resolveMutation = useResolveDispute();
    const reopenMutation = useReopenDispute();
    const noteMutation = useAddInternalNote();

    const handleResolve = async () => {
        if (!resolveTarget || !resolveForm.outcome || !resolveForm.reason.trim()) return;
        await resolveMutation.mutateAsync({
            id: resolveTarget._id,
            payload: {
                outcome: resolveForm.outcome,
                reason: resolveForm.reason.trim(),
                customerAmount: resolveForm.customerAmount ? parseFloat(resolveForm.customerAmount) : 0,
                providerAmount: resolveForm.providerAmount ? parseFloat(resolveForm.providerAmount) : 0,
            },
        });
        setResolveTarget(null);
        setResolveForm({ outcome: '', reason: '', customerAmount: '', providerAmount: '' });
    };

    const columns: ColumnDef<Dispute>[] = [
        {
            key: 'id',
            header: 'Tvist-ID',
            render: (d) => (
                <Link to={`/dashboard/disputes/${d._id}`} className="font-mono text-xs text-[#2d4a3e] hover:underline">
                    {d._id.slice(-8).toUpperCase()}
                </Link>
            ),
        },
        {
            key: 'order',
            header: 'Ordre',
            render: (d) => {
                const orderId = typeof d.orderId === 'object' ? d.orderId._id : d.orderId;
                return (
                    <Link to={`/dashboard/safepay/${orderId}`} className="text-xs font-mono text-gray-600 hover:underline">
                        {orderId?.slice(-8).toUpperCase() ?? '–'}
                    </Link>
                );
            },
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (d) => <span className="text-sm truncate max-w-[120px] block">{d.serviceId?.title ?? '–'}</span>,
        },
        {
            key: 'openedBy',
            header: 'Åpnet av',
            render: (d) => (
                <div>
                    <p className="text-sm text-gray-800">{d.openedBy?.name ?? '–'}</p>
                    <p className="text-xs text-gray-400 capitalize">{d.openedByRole ?? d.openedBy?.role ?? ''}</p>
                </div>
            ),
        },
        {
            key: 'reason',
            header: 'Årsak',
            render: (d) => <span className="text-xs text-gray-600">{d.reasonCategory.replace(/_/g, ' ')}</span>,
        },
        {
            key: 'amount',
            header: 'Beløp',
            render: (d) => {
                const order = typeof d.orderId === 'object' ? d.orderId : null;
                return order?.agreedPrice != null
                    ? <span className="text-sm font-medium">{order.agreedPrice.toLocaleString('nb-NO')} NOK</span>
                    : <span className="text-gray-400">–</span>;
            },
        },
        {
            key: 'status',
            header: 'Status',
            render: (d) => <AdminStatusBadge status={d.status} />,
        },
        {
            key: 'priority',
            header: 'Prioritet',
            render: (d) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOR[d.priority] ?? ''}`}>
                    {d.priority}
                </span>
            ),
        },
        {
            key: 'assigned',
            header: 'Tildelt',
            render: (d) => d.assignedAdminId
                ? <span className="text-xs text-gray-700">{d.assignedAdminId.name}</span>
                : <span className="text-xs text-orange-500">Ikke tildelt</span>,
        },
        {
            key: 'date',
            header: 'Åpnet',
            render: (d) => new Date(d.openedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (d) => {
                const isActive = ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'].includes(d.status);
                const isResolved = ['resolved', 'closed'].includes(d.status);
                return (
                    <div className="flex items-center gap-1.5">
                        <Link to={`/dashboard/disputes/${d._id}`} className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            Se detaljer
                        </Link>
                        {isActive && !d.assignedAdminId && (
                            <button
                                onClick={() => assignMutation.mutate(d._id)}
                                disabled={assignMutation.isPending}
                                className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Ta sak
                            </button>
                        )}
                        {isActive && (
                            <button
                                onClick={() => { setResolveTarget(d); }}
                                className="px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                            >
                                Løs
                            </button>
                        )}
                        {isResolved && (
                            <button
                                onClick={() => { setReopenTarget(d); }}
                                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Gjenåpne
                            </button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader title="Tvister" description="Administrer alle SafePay-tvister og løsninger" />

            {/* Summary */}
            <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4">
                {summaryLoading
                    ? Array.from({ length: 6 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                    : summary && [
                        { title: 'Åpne', value: summary.open, icon: <AlertTriangle size={16} /> },
                        { title: 'Under behandling', value: summary.under_review, icon: <Shield size={16} /> },
                        { title: 'Venter kunde', value: summary.waiting_for_customer, icon: <Clock size={16} /> },
                        { title: 'Venter tilbyder', value: summary.waiting_for_provider, icon: <Clock size={16} /> },
                        { title: 'Ikke tildelt', value: summary.unassigned, icon: <Users size={16} /> },
                        { title: 'Løst denne måneden', value: summary.resolvedThisMonth, icon: <CheckCircle2 size={16} /> },
                        { title: 'Høy/Kritisk prioritet', value: summary.high_priority, icon: <AlertTriangle size={16} /> },
                    ].map((c) => <AdminStatCard key={c.title} title={c.title} value={c.value} icon={c.icon} />)
                }
            </section>

            <AdminDataTable
                columns={columns}
                data={data?.disputes ?? []}
                keyExtractor={(d) => d._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen tvister"
                emptyDescription="Det er ingen aktive tvister."
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
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Løs tvist: {resolveTarget.title}</h2>
                        <p className="text-sm text-gray-500">Alle handlinger logges og varsler berørte parter. Stripe-refusjoner behandles i sanntid.</p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Utfall *</label>
                            <select
                                value={resolveForm.outcome}
                                onChange={(e) => setResolveForm((f) => ({ ...f, outcome: e.target.value as DisputeOutcome }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                            >
                                <option value="">Velg utfall</option>
                                {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={resolveForm.reason} onChange={(e) => setResolveForm((f) => ({ ...f, reason: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                                placeholder="Forklar hvorfor du valgte dette utfallet..."
                            />
                        </div>

                        {['partial_refund', 'split_payment'].includes(resolveForm.outcome) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kundebeløp (NOK)</label>
                                    <input type="number" min="0" value={resolveForm.customerAmount} onChange={(e) => setResolveForm((f) => ({ ...f, customerAmount: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tilbyderbeløp (NOK)</label>
                                    <input type="number" min="0" value={resolveForm.providerAmount} onChange={(e) => setResolveForm((f) => ({ ...f, providerAmount: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                    />
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                            ⚠️ For refusjoner: Stripe API kalles umiddelbart. Dette kan ikke angres.
                        </p>

                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setResolveTarget(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Avbryt</button>
                            <button
                                onClick={handleResolve}
                                disabled={resolveMutation.isPending || !resolveForm.outcome || !resolveForm.reason.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-50"
                            >
                                {resolveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                Bekreft løsning
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reopen dialog */}
            <AdminConfirmDialog
                title="Gjenåpne tvist?"
                description="Skriv årsaken til gjenåpning."
                confirmText="Gjenåpne"
                cancelText="Avbryt"
                isOpen={!!reopenTarget}
                onOpenChange={(open) => !open && setReopenTarget(null)}
                onConfirm={async () => {
                    if (!reopenTarget || !reopenReason.trim()) return;
                    await reopenMutation.mutateAsync({ id: reopenTarget._id, reason: reopenReason.trim() });
                    setReopenTarget(null); setReopenReason('');
                }}
                trigger={undefined}
            />
        </div>
    );
}
