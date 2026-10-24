import { Cpu, Database, MemoryStick, Recycle, Timer, Zap } from 'lucide-react';
import { ago, bytes, duration, ms, rate } from '@/lib/devFormat';
import { useDevPerformance } from '../../features/developer/hooks';
import type { OpStat } from '../../api/developer';
import { EmptyState, ErrorState, JsonView, Meter, MethodBadge, NotConfigured, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';

const opColumns: Column<OpStat>[] = [
  { key: 'key', header: 'Operation', className: 'max-w-[340px]', cell: (o) => <span className="block truncate font-mono text-xs">{o.key}</span> },
  { key: 'count', header: 'Calls', align: 'right', cell: (o) => <span className="tabular-nums">{o.count.toLocaleString()}</span> },
  { key: 'avg', header: 'Avg', align: 'right', cell: (o) => <span className="tabular-nums">{ms(o.avgMs)}</span> },
  { key: 'p95', header: 'P95', align: 'right', cell: (o) => <span className={`tabular-nums ${o.p95 > 500 ? 'text-red-600' : o.p95 > 100 ? 'text-amber-600' : ''}`}>{ms(o.p95)}</span> },
  { key: 'max', header: 'Max', align: 'right', cell: (o) => <span className="tabular-nums text-muted-foreground">{ms(o.maxMs)}</span> },
];

export default function PerformancePage() {
  const { data, isLoading, isFetching, error, refetch } = useDevPerformance();
  const hist = (data?.history || []).map((h) => ({ ...h, heapMb: Math.round(h.heapUsed / 1048576), rssMb: Math.round(h.rss / 1048576) }));
  const heapPct = data ? Math.round((data.heap.used / data.heap.limit) * 100) : null;
  const loopTone = data?.eventLoop && data.eventLoop.p99 > 100 ? 'danger' : data?.eventLoop && data.eventLoop.p99 > 50 ? 'warning' : 'success';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance"
        description="In-process APM for this API instance: event loop, heap, GC, database and Stripe latency, slow queries. History covers the last 60 minutes."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && !data.enabled && (
        <div className="rounded-md border border-sky-200/70 bg-sky-50 px-3 py-2 text-sm text-sky-800">APM is not running on this instance (it starts with the server, not in tests).</div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Event loop P99" icon={<Timer />} tone={loopTone} loading={isLoading} value={ms(data?.eventLoop?.p99)} hint={`P50 ${ms(data?.eventLoop?.p50)} · max ${ms(data?.eventLoop?.max)}`} />
        <StatCard label="Heap" icon={<MemoryStick />} tone={heapPct && heapPct > 85 ? 'danger' : 'neutral'} loading={isLoading} value={bytes(data?.heap.used)} hint={`${heapPct ?? '—'}% of ${bytes(data?.heap.limit)} limit`} />
        <StatCard label="GC (last min)" icon={<Recycle />} loading={isLoading} value={data?.gc.lastMinuteCount ?? '—'} hint={`${ms(data?.gc.lastMinuteMs)} paused`} />
        <StatCard label="Throughput" icon={<Zap />} loading={isLoading} value={rate(data?.live.rps)} hint={`P95 ${ms(data?.live.p95LastMin)} last min`} />
        <StatCard label="Slow queries" icon={<Database />} tone={data?.slowQueries.length ? 'warning' : 'success'} loading={isLoading} value={data?.slowQueries.length ?? '—'} hint={`≥ ${data?.slowQueryMs ?? 100} ms or failed`} />
        <StatCard label="Uptime" icon={<Cpu />} loading={isLoading} value={duration(data?.process.uptime)} hint={data?.process.node} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Event-loop delay" description="Per minute (ms). Sustained P99 above 50 ms means the process is CPU-bound.">
          <TimeSeriesChart data={hist} bucketMs={60_000} valueFormatter={(v) => `${v}`} series={[{ key: 'loopP50', label: 'P50', color: 'var(--chart-2)' }, { key: 'loopP99', label: 'P99', color: 'var(--chart-5)' }]} />
        </Section>
        <Section title="Memory & CPU" description="Heap / RSS (MB) and process CPU %">
          <TimeSeriesChart data={hist} bucketMs={60_000} series={[{ key: 'heapMb', label: 'Heap MB', color: 'var(--chart-1)' }, { key: 'rssMb', label: 'RSS MB', color: 'var(--chart-3)' }, { key: 'cpu', label: 'CPU %', color: 'var(--chart-4)' }]} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Slowest endpoints" description="Last 60 minutes, by P95">
          {data?.slowestEndpoints.length ? (
            <ul className="divide-y rounded-md border text-sm">
              {data.slowestEndpoints.map((e) => (
                <li key={`${e.method} ${e.route}`} className="flex items-center gap-2 px-3 py-2">
                  <MethodBadge method={e.method} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.route}</span>
                  <span className="text-xs text-muted-foreground">{e.count} calls</span>
                  <span className={`w-16 text-right tabular-nums ${e.p95 > 1000 ? 'text-red-600' : ''}`}>{ms(e.p95)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No traffic in the last hour" />
          )}
        </Section>
        <Section title="Heap & GC" description="Since process start">
          <div className="space-y-4">
            <Meter label="Heap used of V8 limit" value={heapPct} detail={`${bytes(data?.heap.used)} used · ${bytes(data?.heap.total)} allocated · ${bytes(data?.heap.external)} external`} />
            <div className="flex flex-wrap gap-2">
              {Object.entries(data?.gc.byKindSinceStart || {}).map(([k, n]) => (
                <StatusBadge key={k} status={k} tone="neutral" label={`${k} GC · ${n.toLocaleString()}`} />
              ))}
            </div>
          </div>
        </Section>
      </div>

      <Section title="Database operations" description="MongoDB command latency since start, slowest first (driver command monitoring)">
        <DataTable columns={opColumns} rows={data?.db} loading={isLoading} rowKey={(o) => o.key} emptyTitle="No database commands recorded yet" />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Slow & failed queries" description="Filter keys only — values are never captured">
          {data?.slowQueries.length ? (
            <ul className="space-y-2">
              {data.slowQueries.map((q, i) => (
                <li key={i} className="rounded-md border p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">
                      {q.command} {q.collection}
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      {q.failed && <StatusBadge status="failed" />}
                      <span className="tabular-nums">{ms(q.ms)}</span>
                      <span className="text-muted-foreground">{ago(q.at)}</span>
                    </span>
                  </div>
                  {q.shape !== '?' && <JsonView value={q.shape} className="mt-2 max-h-32" />}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No slow queries" description={`Nothing slower than ${data?.slowQueryMs ?? 100} ms since start.`} />
          )}
        </Section>
        <Section title="Stripe API latency" description={`Since start · ${data?.stripeErrors ?? 0} 5xx responses`}>
          <DataTable columns={opColumns} rows={data?.stripe} loading={isLoading} rowKey={(o) => o.key} emptyTitle="No Stripe calls yet" />
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(data?.unavailable || {}).map(([k, v]) => (
          <Section key={k} title={k.charAt(0).toUpperCase() + k.slice(1)}>
            <NotConfigured title="Not available" description={v} />
          </Section>
        ))}
      </div>
    </div>
  );
}
