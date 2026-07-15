import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, DollarSign, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useSafePayList, useSafePaySummary } from '../../hooks/admin/safepay';
import type { SafePayContract } from '../../types/admin/safepay';
import {
    AdminDataTable,
    AdminSearchInput,
    AdminFilterSelect,
    AdminStatusBadge,
    AdminPageHeader,
    AdminStatCard,
    AdminStatCardSkeleton,
    AdminErrorState,
} from '../../components/admin';
import { ChatIdCell } from '../../components/admin/chat/ChatIdCell';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Venter betaling', value: 'awaiting_payment' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Pågår', value: 'in_progress' },
    { label: 'Fullført', value: 'completed' },
    { label: 'Avbrutt', value: 'cancelled' },
    { label: 'Tvist', value: 'disputed' },
];

export default function SafePayPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const handleSearchChange = useCallback((val: string) => {
        setSearch(val);
        clearTimeout((handleSearchChange as any)._t);
        (handleSearchChange as any)._t = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
    }, []);

    const { data, isLoading, isError, refetch } = useSafePayList({
        page, limit: 15,
        ...(statusFilter && { status: statusFilter }),
        ...(debouncedSearch && { orderId: debouncedSearch }),
    });

    const { data: summary, isLoading: summaryLoading } = useSafePaySummary();

    const columns: ColumnDef<SafePayContract>[] = [
        {
            key: 'id',
            header: 'Kontrakt-ID',
            render: (c) => (
                <Link to={`/dashboard/safepay/${c._id}`} className="font-mono text-xs text-[#2d4a3e] hover:underline">
                    {c._id.slice(-8).toUpperCase()}
                </Link>
            ),
        },
        {
            key: 'chatId',
            header: 'Chat ID',
            render: (c) => <ChatIdCell chatId={c.chatId} reviewSource="safepay" />,
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (c) => <span className="text-sm font-medium text-gray-800 truncate max-w-[140px] block">{c.serviceId?.title ?? '–'}</span>,
        },
        {
            key: 'customer',
            header: 'Kunde',
            render: (c) => (
                <div>
                    <p className="text-sm text-gray-800">{c.customerId?.name ?? '–'}</p>
                    <p className="text-xs text-gray-400">{c.customerId?.email ?? ''}</p>
                </div>
            ),
        },
        {
            key: 'provider',
            header: 'Tilbyder',
            render: (c) => (
                <div>
                    <p className="text-sm text-gray-800">{c.providerId?.name ?? '–'}</p>
                    <p className="text-xs text-gray-400">{c.providerId?.email ?? ''}</p>
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Avtalt pris',
            render: (c) => c.agreedPrice != null ? <span className="font-semibold text-gray-800">{c.agreedPrice.toLocaleString('nb-NO')} NOK</span> : <span className="text-gray-400">–</span>,
        },
        {
            key: 'fee',
            header: 'Gebyr',
            render: (c) => c.fee != null ? <span className="text-sm text-gray-500">{c.fee.toLocaleString('nb-NO')} NOK</span> : <span className="text-gray-400">–</span>,
        },
        {
            key: 'status',
            header: 'Ordrestatus',
            render: (c) => <AdminStatusBadge status={c.status} />,
        },
        {
            key: 'payment',
            header: 'Betaling',
            render: (c) => <AdminStatusBadge status={c.paymentStatus} />,
        },
        {
            key: 'chat',
            header: 'Chat',
            render: (c) => c.chatStatus ? <AdminStatusBadge status={c.chatStatus} /> : <span className="text-gray-300 text-xs">–</span>,
        },
        {
            key: 'dispute',
            header: 'Tvist',
            render: (c) => c.dispute
                ? <Link to={`/dashboard/disputes/${c.dispute._id}`} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><AlertTriangle size={12} /><AdminStatusBadge status={c.dispute.status} /></Link>
                : <span className="text-xs text-gray-300">–</span>,
        },
        {
            key: 'date',
            header: 'Opprettet',
            render: (c) => new Date(c.createdAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }),
        },
        {
            key: 'actions',
            header: '',
            render: (c) => (
                <Link to={`/dashboard/safepay/${c._id}`} className="px-3 py-1.5 text-xs font-medium text-[#2d4a3e] bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                    Se detaljer
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader title="SafePay" description="Oversikt over alle SafePay-kontrakter og betalingsstatus" />

            {/* Summary cards */}
            <section aria-label="SafePay sammendrag" className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-4">
                {summaryLoading
                    ? Array.from({ length: 6 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                    : summary && [
                        { title: 'Totalt', value: summary.orders.total, icon: <Shield size={16} />, to: '/dashboard/safepay' },
                        { title: 'Venter betaling', value: summary.orders.awaiting_payment, icon: <Clock size={16} /> },
                        { title: 'Betalt / Pågår', value: summary.orders.paid + summary.orders.in_progress, icon: <CheckCircle2 size={16} /> },
                        { title: 'Fullført', value: summary.orders.completed, icon: <CheckCircle2 size={16} /> },
                        { title: 'Tvister', value: summary.disputes.open, icon: <AlertTriangle size={16} />, to: '/dashboard/disputes' },
                        { title: 'Plattformgebyr NOK', value: Math.round(summary.revenue.fees).toLocaleString('nb-NO'), icon: <DollarSign size={16} /> },
                    ].map((c) => (
                        <AdminStatCard key={c.title} title={c.title} value={c.value} icon={c.icon} to={c.to} />
                    ))}
            </section>

            <AdminDataTable
                columns={columns}
                data={data?.contracts ?? []}
                keyExtractor={(c) => c._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen SafePay-kontrakter"
                emptyDescription="Det finnes ingen SafePay-kontrakter ennå."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminSearchInput value={search} onChange={handleSearchChange} placeholder="Søk på ordre-ID..." className="flex-1 min-w-[180px]" />
                        <AdminFilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={STATUS_OPTIONS} placeholder="Alle statuser" />
                    </div>
                }
            />
        </div>
    );
}
