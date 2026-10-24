import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Gauge, MapPinOff, SearchX, Search, MapPinned } from 'lucide-react';
import { num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { SearchHealthInfo } from '../../api/developer';
import { useDevSearchHealth, useUrlFilters } from '../../features/developer/hooks';
import { CountBars, ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v} ms`);

export default function SearchHealthPage() {
  const [f, setF] = useUrlFilters({ days: '7' });
  const { data, isLoading, error, refetch } = useDevSearchHealth(Number(f.days));
  const [open, setOpen] = useState<string | null>(null);
  const s = data?.search;
  const broken = data ? data.listings.public - data.listings.findable : 0;

  const issueCols: Column<SearchHealthInfo['issues'][number]>[] = [
    { key: 's', header: '', cell: (i) => (i.count ? <MapPinOff className="size-4 text-red-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />) },
    { key: 't', header: 'Problem', className: 'max-w-[460px] whitespace-normal', cell: (i) => <div><div className="font-medium">{i.title}</div><div className="text-xs text-muted-foreground">{i.why}</div></div> },
    { key: 'n', header: 'Open listings', align: 'right', cell: (i) => <span className={cn('tabular-nums', i.count && 'font-medium text-red-600')}>{i.count}</span> },
  ];
  const endpointCols: Column<SearchHealthInfo['endpoints'][number]>[] = [
    { key: 'r', header: 'Endpoint', cell: (e) => <span className="font-mono text-xs">{e.route}</span> },
    { key: 'n', header: 'Requests', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.requests)}</span> },
    { key: 'p', header: 'p95', align: 'right', cell: (e) => <span className={cn('tabular-nums', (e.p95 ?? 0) > 1000 && 'font-medium text-amber-600')}>{ms(e.p95)}</span> },
    { key: 's', header: 'Slow', align: 'right', cell: (e) => <span className="tabular-nums">{e.slowShare === null ? '—' : `${e.slowShare}%`}</span> },
    { key: 'e', header: '5xx', align: 'right', cell: (e) => <span className={cn('tabular-nums', e.c5xx && 'font-medium text-red-600')}>{e.c5xx || '—'}</span> },
  ];
  const selected = data?.issues.find((i) => i.key === open);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search & Location"
        description="Can people find jobs? Listings with no or wrong coordinates are invisible to radius and map search; missing region codes hide them from county filters. Every job search (first page) is logged anonymously for 30 days to measure zero-result searches and latency."
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Searches" icon={<Search />} loading={isLoading} value={num(s?.total)} hint={s ? `${s.withText} with words · ${s.withRadius} by distance · ${s.withRegion} by region` : undefined} />
        <StatCard label="Zero results" icon={<SearchX />} loading={isLoading} tone={!s?.total ? 'neutral' : (s.zeroRate ?? 0) >= 30 ? 'danger' : (s.zeroRate ?? 0) >= 15 ? 'warning' : 'success'} value={s?.zeroRate === null || s?.zeroRate === undefined ? '—' : `${s.zeroRate}%`} hint={s ? `${num(s.zeroResults)} searches found nothing` : undefined} />
        <StatCard label="Search latency" icon={<Gauge />} loading={isLoading} tone={(s?.p95 ?? 0) > 1000 ? 'warning' : 'success'} value={ms(s?.p95)} hint={s ? `p95 · p50 ${ms(s.p50)}` : undefined} />
        <StatCard label="Findable on the map" icon={<MapPinned />} loading={isLoading} tone={broken ? 'danger' : 'success'} value={data ? `${data.listings.findable} / ${data.listings.public}` : '—'} hint="open listings with valid coordinates in Norway" />
        <StatCard label="Geo index" icon={<CheckCircle2 />} loading={isLoading} tone={data && !data.geoIndex ? 'danger' : 'success'} value={data ? (data.geoIndex ? 'present' : 'MISSING') : '—'} hint={data?.geoIndex ? `2dsphere on ${data.geoIndex.key}` : 'radius search falls back to a full scan or fails'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Searches and zero results">
          <TimeSeriesChart
            data={s?.series}
            bucketMs={data?.bucketMs}
            height={200}
            variant="bar"
            series={[
              { key: 'searches', label: 'Searches', color: 'var(--chart-1)' },
              { key: 'zero', label: 'Zero results', color: 'var(--chart-5)' },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Job list: {num(s?.byKind.list.searches)} searches, {s?.byKind.list.zeroRate ?? '—'}% empty · Nearby jobs: {num(s?.byKind.nearby.searches)} searches, {s?.byKind.nearby.zeroRate ?? '—'}% empty
          </p>
        </Section>
        <Section title="Distance filters used">
          <CountBars counts={Object.fromEntries((s?.radius || []).map((r) => [r.k, r.n]))} />
        </Section>
      </div>

      <Section title="Searches that found nothing" description="Words, categories, radius and regions combined. Recurring ones are demand Jobblo cannot serve — or listings that exist but cannot be found.">
        {s?.topZero.length ? (
          <ul className="divide-y text-sm">
            {s.topZero.map((z) => (
              <li key={z.query} className="flex justify-between py-1.5">
                <span className="font-mono text-xs">{z.query}</span>
                <span className="tabular-nums text-muted-foreground">{z.n}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No zero-result searches in this period.</p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Listing data problems" description="Open listings only. Click a row for the listings.">
          <DataTable columns={issueCols} rows={data?.issues} loading={isLoading} rowKey={(i) => i.key} onRowClick={(i) => setOpen(i.key === open ? null : i.key)} />
          {selected && (
            <ul className="mt-3 space-y-1 text-sm">
              {selected.samples.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2">
                  <Link to={`/developer/transactions?id=${x.id}`} className="text-primary hover:underline">{x.title}</Link>
                  {x.city && <span className="text-xs text-muted-foreground">{x.city}</span>}
                  {x.coordinates && <span className="font-mono text-[11px] text-muted-foreground">[{x.coordinates.map((c) => c.toFixed(4)).join(', ')}]</span>}
                  {x.detail && <span className="text-xs text-muted-foreground">{x.detail}</span>}
                </li>
              ))}
              {!selected.samples.length && <li className="text-muted-foreground">None.</li>}
            </ul>
          )}
        </Section>
        <Section title="Search endpoints" description="From API monitoring: request volume, p95 latency, share slower than the SLO, server errors.">
          <DataTable columns={endpointCols} rows={data?.endpoints} loading={isLoading} rowKey={(e) => e.route} emptyTitle="No search traffic in this period" />
          <Link to="/developer/dependencies?view=external" className="mt-3 inline-block text-xs text-primary hover:underline">
            Geocoding provider health →
          </Link>
        </Section>
      </div>
    </div>
  );
}
