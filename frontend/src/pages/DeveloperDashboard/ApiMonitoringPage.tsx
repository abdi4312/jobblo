import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Download, Gauge, Search, Timer, Zap } from 'lucide-react';
import { ago, compact, dateTime, downloadCsv, ms, num, pct, rate } from '@/lib/devFormat';
import { useDevApiMetrics, useDevApiTraces, useDevEndpointClients, useUrlFilters } from '../../features/developer/hooks';
import { IpSheet } from '../../components/developer/IpSheet';
import type { ApiClient, EndpointStat, RangeKey } from '../../api/developer';
import { EmptyState, ErrorState, KeyValue, MethodBadge, Mono, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const METHODS = ['all', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SORTS: { value: keyof EndpointStat; label: string }[] = [
  { value: 'count', label: 'Most called' },
  { value: 'p95', label: 'Slowest (P95)' },
  { value: 'failed', label: 'Most failures' },
  { value: 'avgMs', label: 'Avg latency' },
];

function ClientList({ clients, onPick }: { clients: ApiClient[] | undefined; onPick: (ip: string) => void }) {
  if (!clients?.length) return <EmptyState title="No client IPs recorded" description="IPs are recorded for traffic from this release onward." />;
  const max = Math.max(...clients.map((c) => c.requests));
  return (
    <ul className="divide-y rounded-md border text-sm">
      {clients.map((c) => (
        <li key={c.ip}>
          <button type="button" onClick={() => onPick(c.ip)} className="grid w-full grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 px-3 py-2 text-left hover:bg-muted/50">
            <span className="truncate font-mono text-xs">{c.ip}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(c.requests / max) * 100}%` }} />
            </span>
            <span className="text-xs tabular-nums">
              {num(c.requests)}
              {c.failed > 0 && <span className="ml-1 text-amber-600">({num(c.failed)} failed)</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EndpointSheet({ endpoint, range, onClose, onPickIp }: { endpoint: EndpointStat | null; range: RangeKey; onClose: () => void; onPickIp: (ip: string) => void }) {
  const { data, isLoading } = useDevApiTraces(endpoint?.route, endpoint?.method);
  const { data: callers } = useDevEndpointClients({ route: endpoint?.route, method: endpoint?.method, range }, Boolean(endpoint));
  return (
    <Sheet open={Boolean(endpoint)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {endpoint && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <MethodBadge method={endpoint.method} />
                <span className="truncate font-mono text-sm">{endpoint.route}</span>
              </SheetTitle>
              <SheetDescription>Last seen {ago(endpoint.lastSeen)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-2">
                {(['p50', 'p95', 'p99', 'maxMs'] as const).map((k) => (
                  <div key={k} className="rounded-md border bg-muted/30 p-2.5">
                    <div className="text-[10px] uppercase text-muted-foreground">{k === 'maxMs' ? 'max' : k}</div>
                    <div className="text-sm font-semibold tabular-nums">{ms(endpoint[k])}</div>
                  </div>
                ))}
              </div>
              <KeyValue
                items={[
                  ['Requests', num(endpoint.count)],
                  ['Failed (4xx/5xx)', num(endpoint.failed)],
                  ['Success rate (non-5xx)', pct(endpoint.successRate, 2)],
                  ['Average', ms(endpoint.avgMs)],
                  ['Throughput', rate(endpoint.rps)],
                ]}
              />
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Status codes</h4>
                <div className="grid grid-cols-6 gap-1.5">
                  {Object.entries(endpoint.codes).map(([code, n]) => (
                    <div key={code} className="rounded-md border p-2 text-center">
                      <div className={`font-mono text-xs ${Number(code) >= 500 ? 'text-red-600' : 'text-amber-600'}`}>{code}</div>
                      <div className="text-sm font-semibold tabular-nums">{num(n)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Top client IPs</h4>
                <ClientList clients={callers?.clients} onPick={onPickIp} />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Recent error traces</h4>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : data?.traces.length ? (
                  <ul className="divide-y rounded-md border text-sm">
                    {data.traces.map((t) => (
                      <li key={t._id} className="space-y-1 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Mono>{t.requestId || t.referenceId}</Mono>
                          <span className="text-xs text-muted-foreground">{dateTime(t.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-foreground">
                          <span className="mr-1 font-mono text-red-600">{t.statusCode}</span>
                          {t.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="No error traces" description="No logged errors for this endpoint." />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ApiMonitoringPage() {
  const [f, setF] = useUrlFilters({ range: '24h', method: 'all', q: '', sort: 'count' });
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<EndpointStat | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevApiMetrics({
    range: f.range as '24h',
    method: f.method === 'all' ? undefined : f.method,
    q: f.q || undefined,
  });

  const rows = useMemo(() => {
    const key = f.sort as keyof EndpointStat;
    return [...(data?.endpoints || [])].sort((a, b) => Number(b[key]) - Number(a[key]));
  }, [data, f.sort]);
  const bucketMs = data?.range.bucketMs;

  const columns: Column<EndpointStat>[] = [
    {
      key: 'endpoint',
      header: 'Endpoint',
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-2">
          <MethodBadge method={e.method} />
          <span className="truncate font-mono text-xs">{e.route}</span>
        </div>
      ),
      className: 'max-w-[420px]',
    },
    { key: 'count', header: 'Requests', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.count)}</span> },
    { key: 'rps', header: 'Req/s', align: 'right', cell: (e) => <span className="tabular-nums text-muted-foreground">{rate(e.rps)}</span> },
    {
      key: 'failed',
      header: 'Failed',
      align: 'right',
      cell: (e) => <span className={`tabular-nums ${e.failed ? 'text-amber-600' : 'text-muted-foreground'}`}>{num(e.failed)}</span>,
    },
    {
      key: 'success',
      header: 'Success',
      align: 'right',
      cell: (e) => <StatusBadge status={e.successRate >= 99.5 ? 'healthy' : e.successRate >= 95 ? 'warning' : 'failing'} label={pct(e.successRate, 1)} />,
    },
    { key: 'avg', header: 'Avg', align: 'right', cell: (e) => <span className="tabular-nums">{ms(e.avgMs)}</span> },
    { key: 'p95', header: 'P95', align: 'right', cell: (e) => <span className={`tabular-nums ${e.p95 > 1000 ? 'text-red-600' : ''}`}>{ms(e.p95)}</span> },
    { key: 'p99', header: 'P99', align: 'right', cell: (e) => <span className="tabular-nums text-muted-foreground">{ms(e.p99)}</span> },
    { key: 'last', header: 'Last seen', align: 'right', cell: (e) => <span className="text-xs text-muted-foreground">{ago(e.lastSeen)}</span> },
  ];

  const t = data?.totals;
  const clientColumns: Column<ApiClient>[] = [
    { key: 'ip', header: 'IP address', cell: (c) => <span className="font-mono text-xs">{c.ip}</span> },
    { key: 'requests', header: 'Requests', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.requests)}</span> },
    { key: 'share', header: 'Share', align: 'right', cell: (c) => <span className="tabular-nums text-muted-foreground">{t?.count ? pct((c.requests / t.count) * 100) : '—'}</span> },
    { key: 'failed', header: 'Failed', align: 'right', cell: (c) => <span className={`tabular-nums ${c.failed ? 'text-amber-600' : 'text-muted-foreground'}`}>{num(c.failed)}</span> },
    { key: 'endpoints', header: 'Endpoints', align: 'right', cell: (c) => <span className="tabular-nums">{c.endpoints ?? '—'}</span> },
    { key: 'last', header: 'Last seen', align: 'right', cell: (c) => <span className="text-xs text-muted-foreground">{ago(c.lastSeen)}</span> },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="API Monitoring"
        description="Every backend endpoint by route template, with latency percentiles and status codes."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button variant="outline" size="sm" className="bg-card" disabled={!rows.length} onClick={() => downloadCsv(`api-endpoints-${f.range}.csv`, rows.map(({ codes, ...r }) => ({ ...r, ...codes })))}>
              <Download /> Export
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Requests" icon={<Activity />} loading={isLoading} value={compact(t?.count)} hint={`${rate(t?.rps)} avg`} />
        <StatCard label="Live" icon={<Zap />} tone="info" loading={isLoading} value={rate(t?.live.rps)} hint={`${t?.live.activeRequests ?? 0} in flight`} />
        <StatCard label="Success rate" icon={<Zap />} tone={t?.successRate != null && t.successRate < 99 ? 'warning' : 'success'} loading={isLoading} value={pct(t?.successRate, 2)} hint="Non-5xx responses" />
        <StatCard label="Failed" icon={<AlertTriangle />} tone={t?.failed ? 'warning' : 'neutral'} loading={isLoading} value={compact(t?.failed)} hint={`Error rate ${pct(t?.errorRate, 2)}`} />
        <StatCard label="Avg latency" icon={<Timer />} loading={isLoading} value={ms(t?.avgMs)} />
        <StatCard label="P95 / P99" icon={<Gauge />} loading={isLoading} value={ms(t?.p95)} hint={`P99 ${ms(t?.p99)}`} />
      </div>

      <Section title="Trends" description="Request volume, failures and latency over time">
        <Tabs defaultValue="traffic">
          <TabsList className="mb-3">
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
          </TabsList>
          <TabsContent value="traffic">
            <TimeSeriesChart data={data?.series} bucketMs={bucketMs} variant="bar" series={[{ key: 'requests', label: 'Requests', color: 'var(--chart-1)' }, { key: 'errors', label: 'Failed', color: 'var(--chart-5)' }]} />
          </TabsContent>
          <TabsContent value="latency">
            <TimeSeriesChart data={data?.series} bucketMs={bucketMs} valueFormatter={(v) => `${v}ms`} series={[{ key: 'avgMs', label: 'Average', color: 'var(--chart-2)' }, { key: 'p95', label: 'P95', color: 'var(--chart-3)' }]} />
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        title="Endpoints"
        description={`${rows.length} route templates seen in range`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                setF({ q: search.trim() });
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter path…" className="h-7 w-44 pl-7 text-xs" aria-label="Filter by path" />
            </form>
            <Select value={f.method} onValueChange={(method) => setF({ method })}>
              <SelectTrigger size="sm" className="w-28" aria-label="HTTP method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === 'all' ? 'All methods' : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={f.sort} onValueChange={(sort) => setF({ sort })}>
              <SelectTrigger size="sm" className="w-36" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          rowKey={(e) => `${e.method} ${e.route}`}
          onRowClick={setSelected}
          emptyTitle="No API traffic recorded"
          emptyDescription="Metrics are flushed every minute. Make a few requests and check back."
        />
      </Section>
      <Section title="Top clients (IP)" description="Who sends the most requests in this range. Click an IP to see every endpoint it called.">
        <DataTable
          columns={clientColumns}
          rows={data?.clients}
          loading={isLoading}
          rowKey={(c) => c.ip}
          onRowClick={(c) => setIp(c.ip)}
          emptyTitle="No client IPs recorded yet"
          emptyDescription="IPs are recorded for traffic from this release onward (flushed every minute)."
        />
      </Section>
      <EndpointSheet endpoint={selected} range={f.range as RangeKey} onClose={() => setSelected(null)} onPickIp={(v) => { setSelected(null); setIp(v); }} />
      <IpSheet ip={ip} range={f.range as RangeKey} onClose={() => setIp(null)} />
    </div>
  );
}
