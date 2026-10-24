import { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Plug, Server as ServerIcon } from 'lucide-react';
import { bytes, duration, ms } from '@/lib/devFormat';
import { useDevServer } from '../../features/developer/hooks';
import { ErrorState, KeyValue, Meter, NotConfigured, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Skeleton } from '../../components/developer/ui/skeleton';

type Sample = { t: number; cpu: number | null; ram: number; heap: number; rps: number };
const WARN = { cpu: 80, ram: 85, disk: 85 };

export default function ServerPage() {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useDevServer();
  const ramPct = data ? Math.round((data.memory.used / data.memory.total) * 100) : 0;
  // Rolling in-browser history of the 5s polls (session only, not persisted).
  const [hist, setHist] = useState<Sample[]>([]);
  useEffect(() => {
    if (!data) return;
    const point = { t: dataUpdatedAt, cpu: data.cpu.percent, ram: ramPct, heap: Math.round(data.process.heapUsed / 1048576), rps: data.live.rps };
    setHist((h) => [...h.slice(-119), point]);
  }, [dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = data
    ? [
        data.cpu.percent !== null && data.cpu.percent >= WARN.cpu && `CPU at ${data.cpu.percent}%`,
        ramPct >= WARN.ram && `Memory at ${ramPct}%`,
        data.disk?.percent != null && data.disk.percent >= WARN.disk && `Disk at ${data.disk.percent}%`,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Server"
        description="Host and Node.js process health for the API instance serving this request."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2 text-sm text-amber-800">Threshold warning: {warnings.join(' · ')}</div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="CPU" icon={<Cpu />} tone={data?.cpu.percent != null && data.cpu.percent >= WARN.cpu ? 'danger' : 'neutral'} loading={isLoading} value={data?.cpu.percent == null ? 'n/a' : `${data.cpu.percent}%`} hint={data ? `load ${data.cpu.loadavg.map((l) => l.toFixed(2)).join(' / ')}` : ''} />
        <StatCard label="Memory" icon={<MemoryStick />} tone={ramPct >= WARN.ram ? 'danger' : 'neutral'} loading={isLoading} value={`${ramPct}%`} hint={data ? `${bytes(data.memory.used)} / ${bytes(data.memory.total)}` : ''} />
        <StatCard label="Disk" icon={<HardDrive />} loading={isLoading} value={data?.disk?.percent == null ? 'n/a' : `${data.disk.percent}%`} hint={data?.disk ? `${bytes(data.disk.free)} free` : 'Unavailable'} />
        <StatCard label="Heap used" icon={<Activity />} loading={isLoading} value={bytes(data?.process.heapUsed)} hint={`of ${bytes(data?.process.heapTotal)}`} />
        <StatCard label="Process uptime" icon={<ServerIcon />} loading={isLoading} value={duration(data?.process.uptime)} hint={`host ${duration(data?.host.uptime)}`} />
        <StatCard label="Sockets" icon={<Plug />} loading={isLoading} value={data?.sockets ?? 'n/a'} hint={`${data?.live.activeRequests ?? 0} active requests`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Resource history" description="Live, since this page was opened (5s samples)">
          <TimeSeriesChart
            data={hist}
            bucketMs={60_000}
            valueFormatter={(v) => `${v}%`}
            series={[
              { key: 'cpu', label: 'CPU %', color: 'var(--chart-1)' },
              { key: 'ram', label: 'Memory %', color: 'var(--chart-3)' },
            ]}
          />
        </Section>
        <Section title="Process" description="Heap (MB) and throughput (req/s)">
          <TimeSeriesChart
            data={hist}
            bucketMs={60_000}
            series={[
              { key: 'heap', label: 'Heap MB', color: 'var(--chart-2)' },
              { key: 'rps', label: 'Req/s', color: 'var(--chart-4)' },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Host">
          {data ? (
            <KeyValue
              items={[
                ['Hostname', data.host.hostname],
                ['Environment', <StatusBadge key="e" status={data.host.environment} tone={data.host.environment === 'production' ? 'danger' : 'info'} />],
                ['OS', `${data.host.type} ${data.host.release} (${data.host.arch})`],
                ['CPU', `${data.host.cpus} × ${data.host.cpuModel || 'unknown'}`],
                ['Network', data.network.map((n) => `${n.name} (${n.family})`).join(', ') || '—'],
              ]}
            />
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </Section>
        <Section title="Node.js process">
          {data ? (
            <KeyValue
              items={[
                ['Node', data.process.nodeVersion],
                ['PID', data.process.pid],
                ['RSS', bytes(data.process.rss)],
                ['External', bytes(data.process.external)],
                ['P95 (last min)', ms(data.live.p95LastMin)],
                ['Errors (last min)', data.live.errorsLastMin],
              ]}
            />
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </Section>
        <Section title="Process manager">
          {data?.process.pm2 ? (
            <KeyValue items={[['PM2 id', data.process.pm2.id], ['Name', data.process.pm2.name || '—'], ['Restarts', data.process.pm2.restarts]]} />
          ) : (
            <NotConfigured title="Not running under PM2" description="PM2 status, restart counts and Nginx/SSL checks appear when the API runs under PM2 (see Developer Tools for SSL)." />
          )}
        </Section>
      </div>

      {data && (
        <Section title="Thresholds" description={`Warnings at CPU ${WARN.cpu}%, memory ${WARN.ram}%, disk ${WARN.disk}%`}>
          <div className="grid gap-5 md:grid-cols-3">
            <Meter label="CPU" value={data.cpu.percent} />
            <Meter label="Memory" value={ramPct} />
            <Meter label="Disk" value={data.disk?.percent ?? null} />
          </div>
        </Section>
      )}
    </div>
  );
}
