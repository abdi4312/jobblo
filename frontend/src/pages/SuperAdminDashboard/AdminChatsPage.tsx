import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ExternalLink, Flag, Filter } from 'lucide-react';
import { useAdminChats } from '../../hooks/admin/chats';
import type { AdminChatListItem } from '../../types/admin/chats';
import { ChatIdCell } from '../../components/admin/chat/ChatIdCell';
import {
    AdminDataTable, AdminSearchInput, AdminFilterSelect,
    AdminStatusBadge, AdminPageHeader, AdminDateRangePicker,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Forespurt', value: 'requested' },
    { label: 'Avtalt', value: 'agreed' },
    { label: 'Kontraktert', value: 'contracted' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Pågår', value: 'in_progress' },
    { label: 'Fullført', value: 'completed' },
    { label: 'Tvist', value: 'disputed' },
    { label: 'Avbrutt', value: 'cancelled' },
    { label: 'Begrenset', value: 'restricted' },
];

const REPORTED_OPTIONS = [
    { label: 'Med rapporter', value: 'true' },
    { label: 'Uten rapporter', value: 'false' },
];

const SAFEPAY_OPTIONS = [
    { label: 'Med SafePay', value: 'true' },
    { label: 'Uten SafePay', value: 'false' },
];

export default function AdminChatsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [reportedFilter, setReportedFilter] = useState('');
    const [safePayFilter, setSafePayFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleSearchChange = useCallback((val: string) => {
        setSearch(val);
        clearTimeout((handleSearchChange as unknown as { _t: ReturnType<typeof setTimeout> })._t);
        (handleSearchChange as unknown as { _t: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    }, []);

    const { data, isLoading, isError, refetch } = useAdminChats({
        page, limit: 15,
        search: debouncedSearch,
        ...(statusFilter && { status: statusFilter }),
        ...(reportedFilter && { reported: reportedFilter === 'true' }),
        ...(safePayFilter && { safePayLinked: safePayFilter === 'true' }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        sortOrder: 'desc',
    });

    const columns: ColumnDef<AdminChatListItem>[] = [
        {
            key: 'chatId',
            header: 'Chat ID',
            render: (c) => <ChatIdCell chatId={c._id} />,
        },
        {
            key: 'customer',
            header: 'Kunde',
            render: (c) => c.clientId ? (
                <div>
                    <p className="text-sm font-medium text-gray-800">{c.clientId.name}</p>
                    <p className="text-xs text-gray-400">{c.clientId.email}</p>
                </div>
            ) : <span className="text-gray-400">–</span>,
        },
        {
            key: 'provider',
            header: 'Tilbyder',
            render: (c) => c.providerId ? (
                <div>
                    <p className="text-sm font-medium text-gray-800">{c.providerId.name}</p>
                    <p className="text-xs text-gray-400">{c.providerId.email}</p>
                </div>
            ) : <span className="text-gray-400">–</span>,
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (c) => <span className="text-sm truncate max-w-[120px] block">{c.serviceId?.title ?? '–'}</span>,
        },
        {
            key: 'orderId',
            header: 'Ordre',
            render: (c) => c.orderId ? (
                <div>
                    <Link to={`/dashboard/safepay/${(c.orderId as { _id: string })._id}`}
                        className="font-mono text-xs text-[#2d4a3e] hover:underline">
                        {(c.orderId as { _id: string })._id.slice(-8).toUpperCase()}
                    </Link>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {(c.orderId as { paymentStatus?: string })?.paymentStatus ?? '–'}
                    </p>
                </div>
            ) : <span className="text-gray-300">–</span>,
        },
        {
            key: 'status',
            header: 'Chat-status',
            render: (c) => <AdminStatusBadge status={c.status} />,
        },
        {
            key: 'messages',
            header: 'Meldinger',
            render: (c) => (
                <div className="text-center">
                    <p className="text-sm font-medium text-gray-800">{c.messageCount ?? 0}</p>
                    {c.attachmentCount > 0 && (
                        <p className="text-[10px] text-gray-400">{c.attachmentCount} vedlegg</p>
                    )}
                </div>
            ),
        },
        {
            key: 'lastMessage',
            header: 'Siste melding',
            render: (c) => c.lastMessageAt ? (
                <span className="text-xs text-gray-600">
                    {new Date(c.lastMessageAt).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
            ) : <span className="text-gray-300">–</span>,
        },
        {
            key: 'reports',
            header: 'Rapporter',
            render: (c) => c.reportCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-red-600 bg-red-50">
                    <Flag size={10} /> {c.reportCount}
                </span>
            ) : <span className="text-xs text-gray-300">0</span>,
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
                <Link to={`/dashboard/chats/${c._id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2d4a3e] bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                    <ExternalLink size={12} /> Åpne
                </Link>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader title="Chatter" description="Administrer alle plattformchatter" />
            <AdminDataTable
                columns={columns}
                data={data?.chats ?? []}
                keyExtractor={(c) => c._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen chatter"
                emptyDescription="Ingen chatter matcher søket."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminSearchInput value={search} onChange={handleSearchChange}
                            placeholder="Søk på navn, e-post, tjeneste..." className="flex-1 min-w-[200px]" />
                        <AdminFilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
                            options={STATUS_OPTIONS} placeholder="Alle statuser" />
                        <AdminFilterSelect value={reportedFilter} onChange={(v) => { setReportedFilter(v); setPage(1); }}
                            options={REPORTED_OPTIONS} placeholder="Rapportering" />
                        <AdminFilterSelect value={safePayFilter} onChange={(v) => { setSafePayFilter(v); setPage(1); }}
                            options={SAFEPAY_OPTIONS} placeholder="SafePay" />
                        <AdminDateRangePicker
                            startDate={startDate} endDate={endDate}
                            onStartDateChange={(v) => { setStartDate(v); setPage(1); }}
                            onEndDateChange={(v) => { setEndDate(v); setPage(1); }}
                        />
                    </div>
                }
            />
        </div>
    );
}
