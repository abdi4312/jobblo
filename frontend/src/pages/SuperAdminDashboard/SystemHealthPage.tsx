import { useCallback } from 'react';
import { Activity, Server, Database, AlertTriangle, RefreshCw, MemoryStick as Memory } from 'lucide-react';
import { useSystemHealth, useSystemMetrics, useSystemErrors, useDiskInfo } from '../../hooks/admin/system';
import { AdminPageHeader, AdminErrorState, AdminLoadingSkeleton, AdminStatCard } from '../../components/admin';

function formatUptime(s: number): string {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}t ${m}m`;
    if (h > 0) return `${h}t ${m}m`;
    if (m > 0) return `${m}m ${Math.floor(s % 60)}s`;
    return `${Math.floor(s)}s`;
}

function toGB(bytes: number): string {
    return (bytes / 1073741824).toFixed(1) + ' GB';
}

function getRamColor(pct: number): string {
    if (pct < 60) return 'bg-green-500';
    if (pct < 80) return 'bg-yellow-500';
    return 'bg-red-500';
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-40">{label}</span>
            <span className="text-sm text-gray-800 text-right min-w-0">
                {value ?? <span className="text-gray-300">–</span>}
            </span>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

export default function SystemHealthPage() {
    const { data: health, isLoading: healthLoading, isError: healthError, refetch: refetchHealth } = useSystemHealth();
    const { data: metrics, isLoading: metricsLoading, isError: metricsError, refetch: refetchMetrics } = useSystemMetrics();
    const { data: diskInfo, isLoading: diskLoading, isError: diskError, refetch: refetchDisk } = useDiskInfo();
    const { data: errors, isLoading: errorsLoading, isError: errorsError, refetch: refetchErrors } = useSystemErrors();

    const handleRefresh = useCallback(() => {
        refetchHealth();
        refetchMetrics();
        refetchDisk();
        refetchErrors();
    }, [refetchHealth, refetchMetrics, refetchDisk, refetchErrors]);

    const loading = healthLoading || metricsLoading || diskLoading || errorsLoading;
    const error = healthError || metricsError || diskError || errorsError;

    if (loading) return <div className="space-y-4"><AdminLoadingSkeleton rows={3} /><AdminLoadingSkeleton rows={6} /></div>;
    if (error || !health || !metrics) return <AdminErrorState onRetry={handleRefresh} title="Systemstatus utilgjengelig" description="Kunne ikke hente systeminformasjon." />;

    const statusColor = health.status === 'healthy' ? 'text-green-500' : health.status === 'degraded' ? 'text-yellow-500' : 'text-red-500';
    const statusLabel = health.status === 'healthy' ? 'Sunn' : health.status === 'degraded' ? 'Svekket' : 'Nede';
    const dbConnected = health.database.state === 'connected';
    const ramPct = metrics.server.ramUsagePercent;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Systemhelse"
                description="Overvåk systemstatus, ytelse og tilkoblinger"
                actions={
                    <button onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors">
                        <RefreshCw size={15} /> Oppdater
                    </button>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AdminStatCard
                    title="API-status"
                    value={statusLabel}
                    icon={<Activity />}
                    iconClassName={statusColor}
                />
                <AdminStatCard
                    title="Oppetid"
                    value={formatUptime(health.server.uptime)}
                    icon={<Server />}
                />
                <AdminStatCard
                    title="RAM-bruk"
                    value={`${ramPct}%`}
                    icon={<Memory />}
                />
                <AdminStatCard
                    title="Database"
                    value={dbConnected ? 'Tilkoblet' : 'Frakoblet'}
                    icon={<Database />}
                    iconClassName={dbConnected ? 'text-green-500' : 'text-red-500'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Server">
                    <Row label="Node.js" value={health.server.nodeVersion} />
                    <Row label="Plattform" value={health.server.platform} />
                    <Row label="Prosess-oppetid" value={formatUptime(metrics.server.uptime)} />
                    <Row label="CPU (1/5/15 min)" value={metrics.server.cpuUsage.map(v => v.toFixed(1)).join(' / ')} />
                    <Row label="Total RAM" value={toGB(metrics.server.totalRam)} />
                    <Row label="Ledig RAM" value={toGB(metrics.server.freeRam)} />
                    <Row label="RAM-bruk" value={
                        <div className="flex items-center gap-2">
                            <span>{ramPct.toFixed(1)}%</span>
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${getRamColor(ramPct)}`} style={{ width: `${Math.min(ramPct, 100)}%` }} />
                            </div>
                        </div>
                    } />
                    <Row label="Heap brukt / total" value={`${toGB(metrics.server.processMemory.heapUsed)} / ${toGB(metrics.server.processMemory.heapTotal)}`} />
                </Section>

                <Section title="Database">
                    <Row label="Tilkobling" value={
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${dbConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            {dbConnected ? 'Tilkoblet' : 'Frakoblet'}
                        </span>
                    } />
                    <Row label="Samlinger" value={
                        <div className="space-y-0.5">
                            {Object.entries(metrics.database.collections).map(([name, count]) => (
                                <div key={name} className="flex justify-between text-xs">
                                    <span className="text-gray-500">{name}</span>
                                    <span className="text-gray-800 font-medium">{count}</span>
                                </div>
                            ))}
                        </div>
                    } />
                    <Row label="Responstid" value={metrics.database.responseTime} />
                </Section>

                <Section title="Applikasjon">
                    <Row label="Totalt brukere" value={metrics.application.totalUsers.toLocaleString('nb-NO')} />
                    <Row label="Aktive sesjoner" value={metrics.application.activeSessions.toLocaleString('nb-NO')} />
                    <Row label="Åpne tvister" value={metrics.application.openDisputes.toLocaleString('nb-NO')} />
                    <Row label="Åpne chat-rapporter" value={metrics.application.openChatReports.toLocaleString('nb-NO')} />
                </Section>

                <Section title="Lagring">
                    {diskInfo ? (
                        <div className="text-xs text-gray-600 space-y-1">
                            {typeof diskInfo === 'object' ? (
                                Object.entries(diskInfo).map(([key, val]) => (
                                    <div key={key} className="flex justify-between">
                                        <span className="text-gray-500">{key}</span>
                                        <span className="text-gray-800 font-medium">{String(val)}</span>
                                    </div>
                                ))
                            ) : (
                                <p>{String(diskInfo)}</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">Ingen diskinformasjon tilgjengelig</p>
                    )}
                </Section>
            </div>

            {errors && errors.errors?.length > 0 && (
                <Section title={`Systemfeil (${errors.errors.length})`}>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {errors.errors.map((e) => (
                            <div key={e._id} className="flex items-start gap-3 p-2.5 bg-red-50 rounded-xl border border-red-100">
                                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-red-700">{e.action}</p>
                                    <p className="text-xs text-red-500">{e.description}</p>
                                    <time className="text-[10px] text-red-300">{new Date(e.createdAt).toLocaleString('nb-NO')}</time>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}
