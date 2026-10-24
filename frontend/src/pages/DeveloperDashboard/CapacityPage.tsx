import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, Cpu, Database, HardDrive, Image, MemoryStick, RefreshCw } from 'lucide-react';
import { bytes, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type CapacityInfo, type CapacityResource, type ForecastConfidence } from '../../api/developer';
import { useDevCapacity } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Skeleton } from '../../components/developer/ui/skeleton';

const ICON: Record<string, typeof HardDrive> = { disk: HardDrive, memory: MemoryStick, mongo: Database, blob: Image };
const CONF: Record<ForecastConfidence, string> = { high: 'high confidence', medium: 'medium confidence', low: 'low confidence', estimated: 'estimated from collection growth', insufficient: 'needs 3+ days of data' };
const eta = (days: number | null) => (days === null ? null : days === 0 ? 'now' : days < 1 ? 'today' : days < 60 ? `${Math.round(days)} days` : days < 730 ? `${Math.round(days / 30)} months` : `${(days / 365).toFixed(1)} years`);
const etaTone = (days: number | null) => (days === null ? 'text-muted-foreground' : days < 30 ? 'text-red-600' : days < 90 ? 'text-amber-600' : 'text-emerald-600');

function ResourceCard({ r }: { r: CapacityResource }) {
  const Icon = ICON[r.key] || HardDrive;
  const pct = r.limit && r.current !== null ? Math.min(100, (r.current / r.limit) * 100) : null;
  const when = eta(r.daysToLimit);
  return (
    <Card size="sm" className="gap-3">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <Icon className="size-4 text-muted-foreground" /> {r.name}
          </span>
          <Badge variant="outline" className="text-[10px]">{CONF[r.confidence]}</Badge>
        </div>
        <div className="text-2xl font-semibold tabular-nums">{bytes(r.current)}</div>
        {pct !== null && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
            </div>
            <div className={cn('text-xs', r.current! >= r.limit! ? 'font-medium text-red-600' : 'text-muted-foreground')}>
              {r.current! >= r.limit! ? `Over the limit (${r.limitLabel})` : `${pct.toFixed(0)}% of limit · ${r.limitLabel}`}
            </div>
          </div>
        )}
        {pct === null && <div className="text-xs text-muted-foreground">{r.limitLabel}</div>}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Growth / day</div>
            <div className="tabular-nums">{r.perDay === null ? '—' : `${r.perDay >= 0 ? '+' : '−'}${bytes(Math.abs(r.perDay))}`}</div>
          </div>
          <div>
            <div className="text-muted-foreground">In 90 days</div>
            <div className="tabular-nums">{r.in90 === null ? '—' : bytes(Math.max(0, r.in90))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Limit reached</div>
            <div className={cn('font-medium tabular-nums', etaTone(r.daysToLimit))}>{when ?? (r.perDay !== null && r.limit ? 'not growing' : '—')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CapacityPage() {
  const { data, isLoading, error, refetch } = useDevCapacity();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const t = data?.traffic;
  const soonest = data?.resources.filter((r) => r.daysToLimit !== null).sort((a, b) => a.daysToLimit! - b.daysToLimit!)[0];

  const recompute = async () => {
    setBusy(true);
    try {
      qc.setQueryData(['dev', 'capacity'], await devApi.capacity(true));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<CapacityInfo['collections'][number]>[] = [
    { key: 'name', header: 'Collection', cell: (c) => <span className="font-mono text-xs">{c.name}</span> },
    { key: 'docs', header: 'Documents', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.documents)}</span> },
    { key: 'size', header: 'Data', align: 'right', cell: (c) => <span className="tabular-nums">{bytes(c.bytes)}</span> },
    { key: 'added', header: 'Added (90 d)', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.addedLast90d)}</span> },
    { key: 'rate', header: 'Docs / day', align: 'right', cell: (c) => <span className="tabular-nums">{c.docsPerDay === null ? '—' : c.docsPerDay.toFixed(c.docsPerDay < 10 ? 2 : 0)}</span> },
    { key: 'bytes', header: 'Size / day', align: 'right', cell: (c) => <span className="tabular-nums">{c.bytesPerDay === null ? '—' : bytes(Math.max(0, c.bytesPerDay))}</span> },
    { key: 'in90', header: 'Docs in 90 d', align: 'right', cell: (c) => <span className="tabular-nums">{c.docsIn90 === null ? '—' : num(Math.round(c.docsIn90))}</span> },
    { key: 'conf', header: '', cell: (c) => <span className="text-xs text-muted-foreground">{c.confidence === 'insufficient' ? 'too new' : c.confidence}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Capacity Planning"
        description="How fast each resource grows and when it runs out — a straight-line forecast over daily points. Disk, memory and blob storage use hourly snapshots (history starts when this was deployed); MongoDB and collection growth use the creation time inside every document id, so they have 90 days of history already."
        actions={
          <Button size="sm" variant="outline" className="bg-card" disabled={busy} onClick={recompute}>
            <RefreshCw className={cn(busy && 'animate-spin')} /> Recompute
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="First limit reached" icon={<HardDrive />} tone={soonest ? (soonest.daysToLimit! < 30 ? 'danger' : soonest.daysToLimit! < 90 ? 'warning' : 'success') : 'neutral'} loading={isLoading} value={soonest ? eta(soonest.daysToLimit) : 'none in sight'} hint={soonest ? (soonest.daysToLimit === 0 ? `${soonest.name} is already over its limit` : soonest.name) : 'no growing resource has a limit yet'} />
        <StatCard
          label="Traffic headroom"
          icon={<Activity />}
          tone={t?.headroom === null || t?.headroom === undefined ? 'neutral' : t.headroom < 20 ? 'danger' : t.headroom < 50 ? 'warning' : 'success'}
          loading={isLoading}
          value={t?.headroom === null || t?.headroom === undefined ? '—' : `${t.headroom}%`}
          hint={t?.maxRps ? `peak ${t.current?.toFixed(2)} of ${t.maxRps} req/s` : 'set CAPACITY_MAX_RPS (load-test result)'}
        />
        <StatCard label="CPU load" icon={<Cpu />} tone={(data?.host.loadPerCpu ?? 0) > 0.8 ? 'warning' : 'neutral'} loading={isLoading} value={data?.host.loadPerCpu === null || !data ? '—' : `${Math.round(data.host.loadPerCpu * 100)}%`} hint={data ? (data.host.loadPerCpu === null ? `not available on Windows · ${data.host.cpus} cores` : `1-min load per core · ${data.host.cpus} cores`) : ''} />
        <StatCard label="History" icon={<Database />} loading={isLoading} value={data ? `${data.snapshots.days} d` : '—'} hint="of hourly snapshots (forecasts need ≥ 3)" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data?.resources.map((r) => <ResourceCard key={r.key} r={r} />)}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Peak load per day" description={t?.perDay !== null && t?.perDay !== undefined ? `Busiest minute each day, in requests/second · trend ${t.perDay >= 0 ? '+' : ''}${(t.perDay * 30).toFixed(2)} req/s per month` : 'Busiest minute each day, in requests/second'}>
          <TimeSeriesChart data={t?.series} bucketMs={86_400_000} height={200} series={[{ key: 'peakRps', label: 'Peak req/s', color: 'var(--chart-1)' }]} />
        </Section>
        <Section title="Requests per day" description={t?.requestsPerDay.in30 ? `Projected ${num(Math.round(t.requestsPerDay.in30))} requests/day in 30 days` : undefined}>
          <TimeSeriesChart data={t?.series} bucketMs={86_400_000} height={200} variant="bar" series={[{ key: 'requests', label: 'Requests', color: 'var(--chart-2)' }]} />
        </Section>
      </div>

      <Section title="Collection growth" description="Largest collections; growth from document creation times over the last 90 days. Fast-growing log collections are TTL-capped and level off.">
        <DataTable columns={columns} rows={data?.collections} loading={isLoading} rowKey={(c) => c.name} />
      </Section>
    </div>
  );
}
