import { Link } from 'react-router-dom';
import { Activity, AlertOctagon, Briefcase, Clock, Gauge, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ago, bytes, compact, duration, ms, num, pct, rate } from '@/lib/devFormat';
import { useDevOverview, useUrlFilters } from '../../features/developer/hooks';
import { ErrorState, KeyValue, Meter, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Button } from '../../components/developer/ui/button';

function HealthScore({ score, deductions }: { score: number; deductions: { reason: string; points: number }[] }) {
  const tone = score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-red-600';
  const ring = score >= 90 ? 'stroke-emerald-500' : score >= 70 ? 'stroke-amber-500' : 'stroke-red-500';
  const c = 2 * Math.PI * 34;
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r="34" className="fill-none stroke-muted" strokeWidth="7" />
          <circle cx="40" cy="40" r="34" className={cn('fill-none transition-all', ring)} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-semibold tabular-nums', tone)}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {deductions.length ? (
          deductions.map((d) => (
            <div key={d.reason} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{d.reason}</span>
              <span className="shrink-0 tabular-nums text-red-600">−{d.points}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">All checks passing. No deductions.</p>
        )}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [f, setF] = useUrlFilters({ range: '24h' });
  const { data, isLoading, isFetching, error, refetch } = useDevOverview({ range: f.range as '24h' });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Health, traffic and integrations across the whole platform."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="System health score" description="100 minus explained deductions">
          {data ? <HealthScore score={data.healthScore} deductions={data.deductions} /> : <Skeleton className="h-24 w-full" />}
        </Section>
        <Section
          title="Traffic"
          description="Requests and failed responses"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/developer/api">Details</Link>
            </Button>
          }
        >
          <TimeSeriesChart
            data={data?.trafficSeries}
            bucketMs={data?.range.bucketMs}
            height={150}
            series={[
              { key: 'requests', label: 'Requests', color: 'var(--chart-1)' },
              { key: 'errors', label: 'Errors', color: 'var(--chart-5)' },
            ]}
          />
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Requests" icon={<Activity />} loading={isLoading} value={compact(data?.api.count)} hint={`${rate(data?.api.rps)} avg · ${rate(data?.api.live.rps)} now`} />
        <StatCard label="Success rate" icon={<Zap />} tone={data?.api.successRate != null && data.api.successRate < 99 ? 'warning' : 'success'} loading={isLoading} value={pct(data?.api.successRate, 2)} hint={`Error rate ${pct(data?.api.errorRate, 2)}`} />
        <StatCard label="Latency" icon={<Gauge />} loading={isLoading} value={ms(data?.api.avgMs)} hint={`P95 ${ms(data?.api.p95)} · P99 ${ms(data?.api.p99)}`} />
        <StatCard label="Critical errors" icon={<AlertOctagon />} tone={data?.errors.openCritical ? 'danger' : 'success'} loading={isLoading} value={num(data?.errors.openCritical)} hint={`${num(data?.errors.inRange)} errors in range`} />
        <StatCard label="Users" icon={<Users />} loading={isLoading} value={compact(data?.users.total)} hint={`+${num(data?.users.new)} new · ${num(data?.users.activeSessions)} online`} />
        <StatCard label="Jobs" icon={<Briefcase />} loading={isLoading} value={compact(data?.jobs.listings)} hint={`${num(data?.jobs.active)} active orders`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Integrations" description="Live dependency status">
          {data ? (
            <div className="divide-y text-sm">
              {[
                ['MongoDB', <StatusBadge key="m" status={data.integrations.mongo.ok ? 'connected' : 'disconnected'} />, data.integrations.mongo.ms != null ? `${data.integrations.mongo.ms} ms` : ''],
                ['Stripe webhook', <StatusBadge key="s" status={data.integrations.stripeWebhook.status} />, data.integrations.stripeWebhook.mode || ''],
                ['Webhook backlog', <StatusBadge key="w" status={data.integrations.webhookEvents.failed ? 'failing' : 'healthy'} label={`${data.integrations.webhookEvents.failed} failed`} />, `${data.integrations.webhookEvents.pending} pending`],
                ['Scheduler', <StatusBadge key="c" status={!data.scheduler.enabled ? 'disabled' : data.scheduler.failing ? 'failing' : 'healthy'} />, `${data.scheduler.jobs} jobs`],
                ['SafePay records', <StatusBadge key="p" status="healthy" tone="info" label={num(data.integrations.safePay.total)} />, ''],
              ].map(([k, badge, hint]) => (
                <div key={k as string} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="text-foreground">{k}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {hint}
                    {badge}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Section>

        <Section title="Server" description="This API instance" action={<Button variant="ghost" size="sm" asChild><Link to="/developer/server">Details</Link></Button>}>
          {data ? (
            <div className="space-y-4">
              <Meter label="CPU" value={data.server.cpuPercent} detail={data.server.cpuPercent === null ? 'Load average unavailable on this OS' : undefined} />
              <Meter label="Memory" value={data.server.ramPercent} />
              <Meter label="Disk" value={data.server.disk?.percent ?? null} detail={data.server.disk ? `${bytes(data.server.disk.free)} free of ${bytes(data.server.disk.total)}` : undefined} />
              <KeyValue items={[['Process uptime', duration(data.server.processUptime)], ['Host uptime', duration(data.server.uptime)]]} />
            </div>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Section>

        <Section title="Jobs & orders" description="Order lifecycle totals">
          {data ? (
            <KeyValue
              items={[
                ['Job listings', num(data.jobs.listings)],
                ['Orders total', num(data.jobs.orders)],
                ['Active', num(data.jobs.active)],
                ['Completed', num(data.jobs.completed)],
                ['Cancelled / declined', num(data.jobs.cancelled)],
                ['Disputed', <span key="d" className={data.jobs.disputed ? 'text-amber-600' : undefined}>{num(data.jobs.disputed)}</span>],
                ['Active users (range)', num(data.users.active)],
              ]}
            />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Recent activity" description="Latest audited admin & developer actions" action={<Button variant="ghost" size="sm" asChild><Link to="/developer/audit">All</Link></Button>}>
          {data?.recentActivity.length ? (
            <ul className="divide-y text-sm">
              {data.recentActivity.map((a) => (
                <li key={a._id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{a.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.adminId?.name || 'System'} · {a.action.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {ago(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'No recent activity.'}</p>
          )}
        </Section>
        <Section title="Deployments" description="Latest releases">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <StatusBadge status="n/a" label="Not connected" />
            Deployment history needs the CI/CD integration (planned).
          </div>
        </Section>
      </div>
    </div>
  );
}
