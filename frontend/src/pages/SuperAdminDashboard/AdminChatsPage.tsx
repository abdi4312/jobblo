import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, CheckCircle2, Eye, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAdminChats } from '../../api/admin/chats';
import type { AdminChatSummary } from '../../api/admin/chats';
import {
    AdminDataTable,
    AdminFilterSelect,
    AdminStatusBadge,
    AdminPageHeader,
    AdminSearchInput,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Forespurt', value: 'requested' },
    { label: 'Avtalt', value: 'agreed' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Kontraktert', value: 'contracted' },
    { label: 'Pågår', value: 'in_progress' },
    { label: 'Fullført', value: 'completed' },
    { label: 'Tvist', value: 'disputed' },
    { label: 'Avbrutt', value: 'cancelled' },
];

const REPORTED_OPTIONS = [
    { label: 'Rapportert', value: 'true' },
    { label: 'Ikke rapportert', value: 'false' },
];

const SAFEPAY_OPTIONS = [
    { label: 'SafePay tilknyttet', value: 'true' },
    { label: 'Ikke tilknyttet', value: 'false' },
];

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value).then(() => {
                    setCopied(true);
                    toast.success('Chat ID kopiert');
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Kopier Chat ID"
            title="Kopier Chat ID"
        >
            {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
    );
}

export default function AdminChatsPage() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [reportedFilter, setReportedFilter] = useState('');
    const [safePayFilter, setSafePayFilter] = useState('');

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-chats', page, search, statusFilter, reportedFilter, safePayFilter],
        queryFn: () =>
            fetchAdminChats({
                page,
                limit: 20,
                ...(search && { chatId: search }),
                ...(statusFilter && { status: statusFilter }),
                ...(reportedFilter && { reported: reportedFilter as 'true' | 'false' }),
                ...(safePayFilter && { safePayLinked: safePayFilter as 'true' | 'false' }),
            }),
        staleTime: 30_000,
    });

    const columns: ColumnDef<AdminChatSummary>[] = [
        {
            key: 'chatId',
            header: 'Chat ID',
            render: (c) => (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-gray-600">
                        {c._id.slice(0, 8)}…{c._id.slice(-4)}
                    </span>
                    <CopyButton value={c._id} />
                </div>
            ),
        },
        {
            key: 'customer',
            header: 'Kunde',
            render: (c) => {
                const u = c.clientId;
                return u ? (
                    <div>
                        <p className="text-sm text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                ) : (
                    <span className="text-gray-400">–</span>
                );
            },
        },
        {
            key: 'provider',
            header: 'Tilbyder',
            render: (c) => {
                const u = c.providerId;
                return u ? (
                    <div>
                        <p className="text-sm text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                ) : (
                    <span className="text-gray-400">–</span>
                );
            },
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (c) =>
                c.serviceId ? (
                    <span className="text-sm truncate max-w-[120px] block">{c.serviceId.title}</span>
                ) : (
                    <span className="text-gray-400">–</span>
                ),
        },
        {
            key: 'orderId',
            header: 'Ordre-ID',
            render: (c) =>
                c.orderId ? (
                    <Link
                        to={`/dashboard/safepay/${c.orderId}`}
                        className="font-mono text-xs text-[#2d4a3e] hover:underline"
                    >
                        {String(c.orderId).slice(-8).toUpperCase()}
                    </Link>
                ) : (
                    <span className="text-gray-400">–</span>
                ),
        },
        {
            key: 'status',
            header: 'Chat-status',
            render: (c) => <AdminStatusBadge status={c.status} />,
        },
        {
            key: 'reportCount',
            header: 'Rapporter',
            render: (c) =>
                c.reportCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        {c.reportCount}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400">0</span>
                ),
        },
        {
            key: 'createdAt',
            header: 'Opprettet',
            render: (c) =>
                new Date(c.createdAt).toLocaleDateString('nb-NO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            className: 'whitespace-nowrap',
            render: (c) => (
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => navigate(`/dashboard/chats/${c._id}`)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        aria-label="Se chat"
                    >
                        <Eye size={12} aria-hidden="true" /> Se chat
                    </button>
                    <Link
                        to={`/dashboard/chat-review?chatId=${c._id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-lg transition-colors"
                    >
                        <MessageSquare size={12} aria-hidden="true" /> Gjennomgå
                    </Link>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Chatter"
                description="Søk og administrer samtaler mellom kunder og tilbydere"
            />

            <AdminDataTable
                columns={columns}
                data={data?.chats ?? []}
                keyExtractor={(c) => c._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen chatter"
                emptyDescription="Ingen chatter samsvarer med valgte filtre."
                pagination={data?.pagination}
                onPageChange={(p) => setPage(p)}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <AdminSearchInput
                            value={search}
                            onChange={(v) => { setSearch(v); setPage(1); }}
                            placeholder="Søk på Chat ID…"
                            className="flex-1 min-w-[200px]"
                        />
                        <AdminFilterSelect
                            value={statusFilter}
                            onChange={(v) => { setStatusFilter(v); setPage(1); }}
                            options={STATUS_OPTIONS}
                            placeholder="Alle statuser"
                        />
                        <AdminFilterSelect
                            value={reportedFilter}
                            onChange={(v) => { setReportedFilter(v); setPage(1); }}
                            options={REPORTED_OPTIONS}
                            placeholder="Rapporteringsstatus"
                        />
                        <AdminFilterSelect
                            value={safePayFilter}
                            onChange={(v) => { setSafePayFilter(v); setPage(1); }}
                            options={SAFEPAY_OPTIONS}
                            placeholder="SafePay-tilknytning"
                        />
                    </div>
                }
            />
        </div>
    );
}
