import { Bug, Eye, Gauge, MonitorSmartphone, Users } from 'lucide-react';
import { ago, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { RumInfo, VitalRating } from '../../api/developer';
import { useDevRum, useUrlFilters } from '../../features/developer/hooks';
import { CountBars, EmptyState, ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const INFO: Record<string, { name: string; what: string }> = {
  LCP: { name: 'Largest Contentful Paint', what: 'main content visible' },
  INP: { name: 'Interaction to Next Paint', what: 'responds to taps/clicks' },
  CLS: { name: 'Cumulative Layout Shift', what: 'layout stays still' },
  FCP: { name: 'First Contentful Paint', what: 'first pixels' },
  TTFB: { name: 'Time to First Byte', what: 'server responds' },
};
const TONE: Record<VitalRating, string> = { good: 'text-emerald-600', 'needs-improvement': 'text-amber-600', poor: 'text-red-600' };
const BG: Record<VitalRating, string> = { good: 'bg-emerald-500', 'needs-improvement': 'bg-amber-500', poor: 'bg-red-500' };
const fmt = (metric: string, v: number | null | undefined) => (v === null || v === undefined ? '—' : metric === 'CLS' ? v.toFixed(3) : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);

function VitalCard({ m }: { m: RumInfo['metrics'][number] }) {
  const good = m.goodShare ?? 0;
  const poor = m.poorShare ?? 0;
  return (
    <Card size="sm" className="gap-2">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">{m.metric}</span>
          {m.rating && <Badge variant="outline" className={cn('capitalize', TONE[m.rating])}>{m.rating.replace('-', ' ')}</Badge>}
        </div>
        <div className={cn('text-2xl font-semibold tabular-nums', m.rating && TONE[m.rating])}>{fmt(m.metric, m.p75)}</div>
        <p className="text-xs text-muted-foreground">
          p75 · {INFO[m.metric].what} · {num(m.samples)} samples
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" title={m.samples ? `${good}% good · ${poor}% poor` : 'no samples yet'}>
          {m.samples > 0 && (
            <>
              <div className="bg-emerald-500" style={{ width: `${good}%` }} />
              <div className="bg-amber-500" style={{ width: `${Math.max(0, 100 - good - poor)}%` }} />
              <div className="bg-red-500" style={{ width: `${poor}%` }} />
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">good ≤ {fmt(m.metric, m.thresholds[0])} · poor &gt; {fmt(m.metric, m.thresholds[1])}</p>
      </CardContent>
    </Card>
  );
}

export default function RumPage() {
  const [f, setF] = useUrlFilters({ days: '7' });
  const { data, isLoading, error, refetch } = useDevRum(Number(f.days));
  const pageCols: Column<RumInfo['pages'][number]>[] = [
    { key: 'p', header: 'Page', cell: (p) => <span className="font-mono text-xs">{p.page}</span> },
    { key: 'v', header: 'Views', align: 'right', cell: (p) => <span className="tabular-nums">{num(p.views)}</span> },
    ...(['LCP', 'INP', 'CLS', 'TTFB'] as const).map((metric) => ({
      key: metric,
      header: `${metric} p75`,
      align: 'right' as const,
      cell: (p: RumInfo['pages'][number]) => {
        const v = p.vitals[metric]?.p75;
        const r = data?.metrics.find((x) => x.metric === metric);
        const rating: VitalRating | null = v === undefined || !r ? null : v <= r.thresholds[0] ? 'good' : v <= r.thresholds[1] ? 'needs-improvement' : 'poor';
        return <span className={cn('tabular-nums text-xs', rating && TONE[rating])}>{fmt(metric, v)}</span>;
      },
    })),
    { key: 'e', header: 'JS errors', align: 'right', cell: (p) => <span className={cn('tabular-nums', p.errors && 'font-medium text-red-600')}>{p.errors || '—'}</span> },
    { key: 'w', header: '', cell: (p) => (p.worst ? <span className={cn('inline-block size-2 rounded-full', BG[p.worst])} title={p.worst} /> : null) },
  ];
  const errCols: Column<RumInfo['errors'][number]>[] = [
    { key: 'm', header: 'Error', className: 'max-w-[480px]', cell: (e) => <div className="min-w-0"><div className="truncate font-medium">{e.message}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{e.source || 'unknown source'}</div></div> },
    { key: 's', header: 'Visitors hit', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.sessions)}</span> },
    { key: 'n', header: 'Events', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.n)}</span> },
    { key: 'p', header: 'Pages', cell: (e) => <span className="text-xs">{e.pages.join(', ')}</span> },
    { key: 'b', header: 'Browsers', cell: (e) => <span className="text-xs text-muted-foreground">{e.browsers.filter(Boolean).join(', ')}</span> },
    { key: 'l', header: 'Last', align: 'right', cell: (e) => <span className="text-xs text-muted-foreground">{ago(e.last)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Real Users"
        description="How fast jobblo.no is for real visitors — Core Web Vitals at the 75th percentile (Google's pass/fail line), slow pages and browser crashes. Anonymous: a random per-tab id in memory, no cookies, no user, no query strings; admin and developer pages are excluded."
        actions={
          <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
            <TabsList>
              <TabsTrigger value="1">24 h</TabsTrigger>
              <TabsTrigger value="7">7 d</TabsTrigger>
              <TabsTrigger value="30">30 d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Visits" icon={<Users />} loading={isLoading} value={num(data?.sessions)} hint="browser tabs" />
        <StatCard label="Page views" icon={<Eye />} loading={isLoading} value={num(data?.views)} />
        <StatCard label="Crash-free visits" icon={<Bug />} tone={data?.crashFreeSessions === null || data?.crashFreeSessions === undefined ? 'neutral' : data.crashFreeSessions >= 99 ? 'success' : data.crashFreeSessions >= 95 ? 'warning' : 'danger'} loading={isLoading} value={data?.crashFreeSessions === null || data?.crashFreeSessions === undefined ? '—' : `${data.crashFreeSessions}%`} hint={`${num(data?.errorCount)} JS errors`} />
        <StatCard label="Passing vitals" icon={<Gauge />} tone={data && data.metrics.filter((m) => m.rating && m.rating !== 'good').length ? 'warning' : 'success'} loading={isLoading} value={data ? `${data.metrics.filter((m) => m.rating === 'good').length} / ${data.metrics.filter((m) => m.rating).length}` : '—'} hint="p75 within Google's good range" />
      </div>

      {data && !data.views ? (
        <EmptyState title="No visitor data yet" description="The web app starts reporting once this build is deployed. Visits to admin and developer pages are not counted." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{data?.metrics.map((m) => <VitalCard key={m.metric} m={m} />)}</div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Section title="Traffic and JS errors">
              <TimeSeriesChart
                data={data?.series}
                bucketMs={data?.bucketMs}
                height={200}
                variant="bar"
                series={[
                  { key: 'views', label: 'Page views', color: 'var(--chart-1)' },
                  { key: 'errors', label: 'JS errors', color: 'var(--chart-5)' },
                ]}
              />
            </Section>
            <div className="space-y-4">
              <Section title="Devices" action={<MonitorSmartphone className="size-4 text-muted-foreground" />}>
                <CountBars counts={data?.devices || {}} />
              </Section>
              <Section title="Browsers">
                <CountBars counts={data?.browsers || {}} />
              </Section>
            </div>
          </div>
          <Section title="Pages" description="Vitals are attributed to the page a visit landed on; colour = Google rating of that page's p75.">
            <DataTable columns={pageCols} rows={data?.pages} loading={isLoading} rowKey={(p) => p.page} emptyTitle="No pages" />
          </Section>
          <Section title="Browser errors" description="Uncaught errors and unhandled promise rejections, grouped. Render crashes caught by the error boundary also appear under Errors.">
            <DataTable columns={errCols} rows={data?.errors} loading={isLoading} rowKey={(e) => e.fingerprint} emptyTitle="No browser errors" />
          </Section>
        </>
      )}
    </div>
  );
}
