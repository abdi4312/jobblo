import React, { useState } from 'react';
import { useActivityLog } from '../../hooks/admin';
import {
    AdminDataTable,
    AdminFilterSelect,
    AdminPageHeader,
    AdminActivityItem,
} from '../../components/admin';
import type { AdminActivity } from '../../types/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const ACTION_OPTIONS = [
    { label: 'Innlogging', value: 'login' },
    { label: 'Utlogging', value: 'logout' },
    { label: 'Rolleendring', value: 'role_change' },
    { label: 'Bruker verifisert', value: 'user_verified' },
    { label: 'Bruker slettet', value: 'user_deleted' },
    { label: 'Tjeneste slettet', value: 'service_deleted' },
    { label: 'Ordre oppdatert', value: 'order_updated' },
    { label: 'Kupong opprettet', value: 'coupon_created' },
    { label: 'Varsling sendt', value: 'notification_broadcast' },
    { label: 'Sesjon tilbakekalt', value: 'session_revoked' },
];

export default function ActivityLogPage() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');

    const { data, isLoading, isError, refetch } = useActivityLog({
        page,
        limit: 20,
        ...(actionFilter && { action: actionFilter }),
    });

    const columns: ColumnDef<AdminActivity>[] = [
        {
            key: 'action',
            header: 'Handling',
            render: (a) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {a.action.replace(/_/g, ' ')}
                </span>
            ),
        },
        {
            key: 'description',
            header: 'Beskrivelse',
            render: (a) => (
                <span className="text-sm text-gray-700 truncate max-w-[280px] block">{a.description}</span>
            ),
        },
        {
            key: 'admin',
            header: 'Admin',
            render: (a) => {
                const actor = typeof a.adminId === 'object' && a.adminId ? a.adminId.name : '–';
                return <span className="text-sm text-gray-600">{actor}</span>;
            },
        },
        {
            key: 'targetModel',
            header: 'Modell',
            render: (a) => (
                <span className="text-xs text-gray-400 font-mono">{a.targetModel}</span>
            ),
        },
        {
            key: 'ip',
            header: 'IP',
            render: (a) => <span className="text-xs text-gray-400 font-mono">{a.ip}</span>,
        },
        {
            key: 'date',
            header: 'Tidspunkt',
            render: (a) =>
                new Date(a.createdAt).toLocaleString('nb-NO', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                }),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Aktivitetslogg"
                description="Alle admin-handlinger logget for revisjon"
            />

            <AdminDataTable
                columns={columns}
                data={data?.logs ?? []}
                keyExtractor={(a) => a._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen aktivitet"
                emptyDescription="Ingen adminhandlinger er logget ennå."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full justify-between">
                        <p className="text-sm text-gray-500 self-center">
                            {data?.pagination.total ?? 0} loggoppføringer totalt
                        </p>
                        <AdminFilterSelect
                            value={actionFilter}
                            onChange={(v) => { setActionFilter(v); setPage(1); }}
                            options={ACTION_OPTIONS}
                            placeholder="Alle handlinger"
                        />
                    </div>
                }
            />

            {/* Latest 5 at bottom as feed view */}
            {!isLoading && data && data.logs.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Siste aktivitet (feed)</h3>
                    <div className="divide-y divide-gray-50">
                        {data.logs.slice(0, 5).map((item) => (
                            <AdminActivityItem key={item._id} item={item} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
