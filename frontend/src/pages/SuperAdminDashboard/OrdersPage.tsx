import React, { useState, useCallback } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useAdminOrders, useCancelAdminOrder } from '../../hooks/admin';
import type { AdminOrdersQuery, AdminOrder } from '../../api/admin';
import {
    AdminDataTable,
    AdminSearchInput,
    AdminFilterSelect,
    AdminStatusBadge,
    AdminConfirmDialog,
    AdminPageHeader,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Venter', value: 'pending' },
    { label: 'Akseptert', value: 'accepted' },
    { label: 'Pågår', value: 'in_progress' },
    { label: 'Fullført', value: 'completed' },
    { label: 'Avbrutt', value: 'cancelled' },
    { label: 'Venter betaling', value: 'awaiting_payment' },
    { label: 'Betalt', value: 'paid' },
];
const PAYMENT_OPTIONS = [
    { label: 'Ubetalt', value: 'unpaid' },
    { label: 'Venter', value: 'pending' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Refundert', value: 'refunded' },
];

export default function OrdersPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);

    const query: AdminOrdersQuery = {
        page,
        limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(paymentFilter && { paymentStatus: paymentFilter }),
        sortBy: 'createdAt',
        sortOrder: 'desc',
    };

    const { data, isLoading, isError, refetch } = useAdminOrders(query);
    const cancelMutation = useCancelAdminOrder();

    const columns: ColumnDef<AdminOrder>[] = [
        {
            key: 'id',
            header: 'Ordre-ID',
            render: (o) => (
                <span className="font-mono text-xs text-gray-500">
                    {o._id.slice(-8).toUpperCase()}
                </span>
            ),
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (o) => (
                <span className="text-sm font-medium text-gray-800 truncate max-w-[160px] block">
                    {o.serviceId?.title ?? '–'}
                </span>
            ),
        },
        {
            key: 'customer',
            header: 'Kunde',
            render: (o) => (
                <div>
                    <p className="text-sm font-medium text-gray-800">{o.customerId?.name ?? '–'}</p>
                    <p className="text-xs text-gray-400">{o.customerId?.email ?? ''}</p>
                </div>
            ),
        },
        {
            key: 'provider',
            header: 'Tilbyder',
            render: (o) => (
                <span className="text-sm text-gray-600">{o.providerId?.name ?? '–'}</span>
            ),
        },
        {
            key: 'amount',
            header: 'Beløp',
            render: (o) =>
                o.agreedPrice != null
                    ? <span className="font-semibold text-gray-800">{o.agreedPrice.toLocaleString('nb-NO')} NOK</span>
                    : <span className="text-gray-400">–</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (o) => <AdminStatusBadge status={o.status} />,
        },
        {
            key: 'payment',
            header: 'Betaling',
            render: (o) => <AdminStatusBadge status={o.paymentStatus} />,
        },
        {
            key: 'date',
            header: 'Dato',
            render: (o) =>
                new Date(o.createdAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            render: (o) =>
                !['cancelled', 'completed', 'paid'].includes(o.status) ? (
                    <button
                        onClick={() => setCancelTarget(o)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        aria-label={`Avbryt ordre ${o._id}`}
                    >
                        Avbryt
                    </button>
                ) : (
                    <span className="text-xs text-gray-300">–</span>
                ),
        },
    ];

    const handleFilterChange = useCallback((setter: (v: string) => void) => (v: string) => {
        setter(v);
        setPage(1);
    }, []);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Ordrer"
                description="Alle plattformordrer med status og betalingsinformasjon"
            />

            <AdminDataTable
                columns={columns}
                data={data?.orders ?? []}
                keyExtractor={(o) => o._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen ordrer"
                emptyDescription="Ingen ordrer matcher de valgte filtrene."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <ShoppingCart size={16} />
                            <span>{data?.pagination.total ?? 0} ordrer totalt</span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-auto">
                            <AdminFilterSelect
                                value={statusFilter}
                                onChange={handleFilterChange(setStatusFilter)}
                                options={STATUS_OPTIONS}
                                placeholder="Alle statuser"
                            />
                            <AdminFilterSelect
                                value={paymentFilter}
                                onChange={handleFilterChange(setPaymentFilter)}
                                options={PAYMENT_OPTIONS}
                                placeholder="Alle betalinger"
                            />
                        </div>
                    </div>
                }
            />

            <AdminConfirmDialog
                title="Avbryt ordre?"
                description={`Er du sikker på at du vil avbryte ordre for "${cancelTarget?.serviceId?.title ?? 'ukjent'}"?`}
                confirmText="Ja, avbryt ordre"
                cancelText="Tilbake"
                variant="destructive"
                isOpen={!!cancelTarget}
                onOpenChange={(open) => !open && setCancelTarget(null)}
                onConfirm={async () => {
                    if (!cancelTarget) return;
                    await cancelMutation.mutateAsync(cancelTarget._id);
                    setCancelTarget(null);
                }}
            />
        </div>
    );
}
