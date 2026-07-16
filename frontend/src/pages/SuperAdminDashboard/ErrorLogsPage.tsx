import { useState } from 'react';
import { AlertTriangle, RefreshCw, AlertCircle, XCircle } from 'lucide-react';
import { useSystemErrors } from '../../hooks/admin/system';
import { AdminPageHeader, AdminDataTable, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';
import type { SystemError } from '../../api/admin/system';

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; className: string }> = {
    critical: { icon: XCircle, className: 'bg-red-100 text-red-700' },
    error: { icon: AlertCircle, className: 'bg-red-50 text-red-600' },
    warning: { icon: AlertTriangle, className: 'bg-yellow-50 text-yellow-700' },
};

function getSeverityConfig(action: string) {
    const lower = action.toLowerCase();
    if (lower.includes('critical') || lower.includes('kritisk')) return SEVERITY_CONFIG.critical;
    if (lower.includes('warning') || lower.includes('advarsel')) return SEVERITY_CONFIG.warning;
    return SEVERITY_CONFIG.error;
}

export default function ErrorLogsPage() {
    const [page, setPage] = useState(1);

    const { data, isLoading, isError, refetch } = useSystemErrors({ page, limit: 20 });

    const columns: ColumnDef<SystemError>[] = [
        {
            key: 'action',
            header: 'Type',
            render: (e) => {
                const cfg = getSeverityConfig(e.action);
                const Icon = cfg.icon;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                        <Icon size={12} />
                        {e.action.replace(/_/g, ' ')}
                    </span>
                );
            },
        },
        {
            key: 'description',
            header: 'Beskrivelse',
            render: (e) => (
                <span className="text-sm text-gray-700 truncate max-w-[320px] block">{e.description}</span>
            ),
        },
        {
            key: 'admin',
            header: 'Admin',
            render: (e) => {
                const name = e.adminId?.name;
                return <span className="text-sm text-gray-600">{name ?? '–'}</span>;
            },
        },
        {
            key: 'createdAt',
            header: 'Tidspunkt',
            render: (e) =>
                new Date(e.createdAt).toLocaleString('nb-NO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
        },
    ];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <AdminPageHeader title="Systemfeil" description="Overvåk systemfeil og advarsler" />
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <AdminLoadingSkeleton rows={6} />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="space-y-6">
                <AdminPageHeader title="Systemfeil" description="Overvåk systemfeil og advarsler" />
                <AdminErrorState onRetry={refetch} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Systemfeil"
                description="Overvåk systemfeil og advarsler"
                actions={
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                        <RefreshCw size={15} /> Oppdater
                    </button>
                }
            />

            <AdminDataTable
                columns={columns}
                data={data?.errors ?? []}
                keyExtractor={(e) => e._id}
                loading={false}
                error={false}
                onRetry={refetch}
                emptyTitle="Ingen systemfeil"
                emptyDescription="Det er ingen systemfeil eller advarsler å vise."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full justify-between">
                        <p className="text-sm text-gray-500 self-center">
                            {data?.pagination.total ?? 0} feil totalt
                        </p>
                    </div>
                }
            />
        </div>
    );
}
