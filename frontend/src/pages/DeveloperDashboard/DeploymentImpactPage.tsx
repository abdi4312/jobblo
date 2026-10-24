import { ArrowLeft, ArrowRight, Rocket, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { ApiRelease, ImpactVerdict, ImpactWindow, MobileRelease } from '../../api/developer';
import { useDevImpact, useDevImpactDetail, useUrlFilters } from '../../features/developer/hooks';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const VERDICT: Record<ImpactVerdict, { label: string; tone: 'danger' | 'warning' | 'success' | 'info' | 'neutral' }> = {
  regression: { label: 'Regression', tone: 'danger' },
  warning: { label: 'Check', tone: 'warning' },
  healthy: { label: 'No change', tone: 'success' },
  improved: { label: 'Improved', tone: 'info' },
  insufficient: { label: 'Not enough traffic', tone: 'neutral' },
};
const errRate = (w: ImpactWindow) => (w.requests ? (w.c5xx / w.requests) * 100 : null);
const p = (v: number | null, d = 2) => (v === null ? '—' : `${v.toFixed(d)}%`);
const short = (sha: string | null) => (sha ? sha.slice(0, 7) : '—');

function Delta({ before, after, unit, lowerIsBetter = true, digits = 0 }: { before: number | null; after: number | null; unit: string; lowerIsBetter?: boolean; digits?: number }) {
  if (before === null || after === null) return <span className="text-muted-foreground">{after === null ? '—' : `${after.toFixed(digits)}${unit}`}</span>;
  const worse = lowerIsBetter ? after > before : after < before;
  const same = Math.abs(after - before) < (unit === '%' ? 0.01 : 1);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <span className="text-muted-foreground">{before.toFixed(digits)}{unit}</span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className={cn('font-medium', !same && (worse ? 'text-red-600' : 'text-emerald-600'))}>{after.toFixed(digits)}{unit}</span>
    </span>
  );
}

function ReleaseDetail({ id, hours, onBack }: { id: string; hours: number; onBack: () => void }) {
  const { data, isLoading, error } = useDevImpactDetail(id, hours);
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const d = data.deployment;
  const v = VERDICT[data.verdict];
  return (
    <div className="space-y-4">
      <Section
        title={`Release ${d.version} · ${short(d.commit)}`}
        description={`Deployed ${dateTime(d.deployedAt)} on ${d.host || 'unknown host'} · ${d.boots} boot${d.boots === 1 ? '' : 's'} · compared over ${data.windowHours} h before vs after${data.next ? ` (next release ${data.next.version} cuts the window)` : ''}`}
        action={
          <Button size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft /> All releases
          </Button>
        }
      >
        <div className={cn('rounded-md border p-3 text-sm', v.tone === 'danger' ? 'border-red-200 bg-red-50' : v.tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'bg-muted/40')}>
          <div className="flex items-center gap-2">
            <StatusBadge status={v.label} tone={v.tone} />
            {d.previous && <span className="text-xs text-muted-foreground">previous: {d.previous.version} · {short(d.previous.commit)} · {dateTime(d.previous.deployedAt)}</span>}
          </div>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {data.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <div><div className="text-xs text-muted-foreground">Requests</div><Delta before={data.before.requests} after={data.after.requests} unit="" lowerIsBetter={false} /></div>
          <div><div className="text-xs text-muted-foreground">5xx rate</div><Delta before={errRate(data.before)} after={errRate(data.after)} unit="%" digits={2} /></div>
          <div><div className="text-xs text-muted-foreground">p95 latency</div><Delta before={data.before.p95} after={data.after.p95} unit=" ms" /></div>
          <div><div className="text-xs text-muted-foreground">Slow requests</div><Delta before={data.before.slowShare === null ? null : data.before.slowShare * 100} after={data.after.slowShare === null ? null : data.after.slowShare * 100} unit="%" digits={1} /></div>
          <div><div className="text-xs text-muted-foreground">Synthetic failures</div><Delta before={data.synthetic.before.failed} after={data.synthetic.after.failed} unit="" /></div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Traffic and 5xx around the release" description={`The release is at ${dateTime(d.deployedAt)}; everything before it is the baseline.`}>
          <TimeSeriesChart
            data={data.series}
            bucketMs={data.bucketMs}
            height={200}
            series={[
              { key: 'requests', label: 'Requests', color: 'var(--chart-1)' },
              { key: 'errors', label: '5xx', color: 'var(--chart-5)' },
            ]}
          />
        </Section>
        <Section title="p95 latency around the release">
          <TimeSeriesChart data={data.series} bucketMs={data.bucketMs} height={200} series={[{ key: 'p95', label: 'p95 ms', color: 'var(--chart-3)' }]} valueFormatter={(x) => `${x}`} />
        </Section>
      </div>

      <Section title="Routes that changed most" description="Ordered by change in 5xx rate, then p95. New = no traffic on this route before the release.">
        <DataTable
          columns={[
            { key: 'route', header: 'Route', cell: (r) => <span className="font-mono text-xs">{r.route}{r.isNew && <Badge variant="secondary" className="ml-2">new</Badge>}</span> },
            { key: 'req', header: 'Requests', align: 'right', cell: (r) => <span className="tabular-nums text-xs">{num(r.before?.requests ?? 0)} → {num(r.after.requests)}</span> },
            { key: 'err', header: '5xx rate', align: 'right', cell: (r) => <Delta before={r.before?.requests ? (r.before.c5xx / r.before.requests) * 100 : 0} after={(r.after.c5xx / r.after.requests) * 100} unit="%" digits={1} /> },
            { key: 'p95', header: 'p95', align: 'right', cell: (r) => <Delta before={r.before?.p95 ?? null} after={r.after.p95} unit=" ms" /> },
          ]}
          rows={data.routes}
          rowKey={(r) => r.route}
          emptyTitle="No route traffic after the release"
        />
      </Section>

      <Section title="Error types first seen after the release">
        {data.newErrors.length ? (
          <ul className="divide-y">
            {data.newErrors.map((e) => (
              <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link to={`/developer/errors?q=${encodeURIComponent(e.errorCode)}`} className="truncate font-medium text-primary hover:underline">{e.errorCode}</Link>
                  <div className="truncate text-xs text-muted-foreground">{e.route || '—'} · {e.message}</div>
                </div>
                <span className="text-xs text-muted-foreground">{num(e.count)}× · first {ago(e.firstSeen)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No new error types.</p>
        )}
      </Section>
    </div>
  );
}

export default function DeploymentImpactPage() {
  const [f, setF] = useUrlFilters({ hours: '6', id: '' });
  const hours = Number(f.hours);
  const { data, isLoading, error, refetch } = useDevImpact(hours);
  const api = data?.api || [];
  const latest = api[0];
  const regressions = api.filter((a) => a.verdict === 'regression').length;

  const apiCols: Column<ApiRelease>[] = [
    { key: 'v', header: 'Release', cell: (a) => <div><div className="font-medium">{a.version} <span className="font-mono text-xs text-muted-foreground">{short(a.commit)}</span>{a.current && <Badge variant="secondary" className="ml-2">running</Badge>}</div><div className="text-xs text-muted-foreground">{a.branch || a.environment || '—'} · {a.host || '—'}</div></div> },
    { key: 'at', header: 'Deployed', cell: (a) => <span className="text-xs" title={dateTime(a.deployedAt)}>{ago(a.deployedAt)}</span> },
    { key: 'verdict', header: 'Impact', cell: (a) => <StatusBadge status={VERDICT[a.verdict].label} tone={VERDICT[a.verdict].tone} /> },
    { key: 'err', header: '5xx rate', cell: (a) => <Delta before={errRate(a.before)} after={errRate(a.after)} unit="%" digits={2} /> },
    { key: 'p95', header: 'p95', cell: (a) => <Delta before={a.before.p95} after={a.after.p95} unit=" ms" /> },
    { key: 'new', header: 'New errors', align: 'right', cell: (a) => <span className={cn('tabular-nums', a.newErrors > 0 && 'font-medium text-amber-600')}>{a.newErrors}</span> },
    { key: 'why', header: '', className: 'max-w-[300px]', cell: (a) => <span className="block truncate text-xs text-muted-foreground" title={a.reasons.join('; ')}>{a.reasons[0]}</span> },
  ];
  const mobileCols: Column<MobileRelease>[] = [
    { key: 'v', header: 'App version', cell: (m) => <span className="font-medium">{m.version} <Badge variant="outline" className="ml-1">{m.platform === 'ios' ? 'iOS' : m.platform === 'android' ? 'Android' : m.platform}</Badge></span> },
    { key: 'at', header: 'First seen', cell: (m) => <span className="text-xs" title={dateTime(m.deployedAt)}>{ago(m.deployedAt)}</span> },
    { key: 'verdict', header: 'Impact', cell: (m) => <StatusBadge status={VERDICT[m.verdict].label} tone={VERDICT[m.verdict].tone} /> },
    { key: 'cf', header: 'Crash-free', align: 'right', cell: (m) => <span className="tabular-nums">{p(m.crashFree)}</span> },
    { key: 'dev', header: 'Devices', align: 'right', cell: (m) => <span className="tabular-nums">{num(m.installs)}</span> },
    { key: 's', header: 'Sessions', align: 'right', cell: (m) => <span className="tabular-nums">{num(m.sessions)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deployment Impact"
        description="What changed after each release. API releases are recorded automatically on the first boot of a new version/commit; mobile releases are the first session of each app version. Each API release is compared on equal windows before and after it."
        actions={
          <Tabs value={f.hours} onValueChange={(h) => setF({ hours: h })}>
            <TabsList>
              {['1', '3', '6', '12', '24'].map((h) => (
                <TabsTrigger key={h} value={h}>
                  {h} h
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {f.id ? (
        <ReleaseDetail id={f.id} hours={hours} onBack={() => setF({ id: '' })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Running release" icon={<Rocket />} loading={isLoading} value={data?.current.version ?? '—'} hint={data ? `${short(data.current.commit)}${data.current.branch ? ` · ${data.current.branch}` : ''}` : ''} />
            <StatCard label="Latest release impact" icon={<Rocket />} tone={latest ? VERDICT[latest.verdict].tone === 'info' ? 'success' : (VERDICT[latest.verdict].tone as 'danger' | 'warning' | 'success' | 'neutral') : 'neutral'} loading={isLoading} value={latest ? VERDICT[latest.verdict].label : '—'} hint={latest ? `deployed ${ago(latest.deployedAt)}` : 'no releases recorded yet'} />
            <StatCard label="Regressions" icon={<Rocket />} tone={regressions ? 'danger' : 'success'} loading={isLoading} value={regressions} hint={`of ${api.length} recent API releases`} />
            <StatCard label="Mobile versions" icon={<Smartphone />} loading={isLoading} value={data?.mobile.length ?? 0} hint="seen in app telemetry" />
          </div>
          <Section title="API releases" description={`${hours} h before vs ${hours} h after (shorter when the next release came sooner). Click a release for routes, charts and new errors.`}>
            <DataTable columns={apiCols} rows={api} loading={isLoading} rowKey={(a) => a.id} onRowClick={(a) => setF({ id: a.id })} emptyTitle="No releases recorded yet — the first one is recorded on the next server start" />
          </Section>
          <Section title="Mobile app releases" description="Crash-free sessions on each version since it first appeared.">
            <DataTable columns={mobileCols} rows={data?.mobile} loading={isLoading} rowKey={(m) => m.id} emptyTitle="No app versions reported yet" />
          </Section>
        </>
      )}
    </div>
  );
}
