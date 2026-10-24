import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Briefcase, CreditCard, Plug, ShieldAlert, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ago, ms, rate } from '@/lib/devFormat';
import { useDevLive, useDevPrefs } from '../../features/developer/hooks';
import type { LiveInfo } from '../../api/developer';
import { EmptyState, ErrorState, LiveDot, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Button } from '../../components/developer/ui/button';

const TYPE_ICON = { job: Briefcase, payment: CreditCard, error: AlertTriangle, security: ShieldAlert } as const;
const TYPE_TONE = { job: 'text-sky-600 bg-sky-50', payment: 'text-emerald-600 bg-emerald-50', error: 'text-red-600 bg-red-50', security: 'text-amber-600 bg-amber-50' } as const;
const TYPES = ['all', 'job', 'payment', 'error', 'security'] as const;

export default function LiveActivityPage() {
  const { data, error, refetch, dataUpdatedAt } = useDevLive();
  const autoRefresh = useDevPrefs((s) => s.autoRefresh);
  const [type, setType] = useState<(typeof TYPES)[number]>('all');
  // Rolling 5s samples while the page is open.
  const [series, setSeries] = useState<{ t: number; rps: number; active: number; p95: number }[]>([]);
  useEffect(() => {
    if (data) setSeries((s) => [...s.slice(-119), { t: dataUpdatedAt, rps: data.traffic.rps, active: data.traffic.activeRequests, p95: data.traffic.p95LastMin }]);
  }, [dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = (data?.events || []).filter((e) => type === 'all' || e.type === type);
  const l: LiveInfo['lastTwoMinutes'] | undefined = data?.lastTwoMinutes;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Activity"
        description="What is happening right now, refreshed every 5 seconds. No names, emails or personal data are shown."
        actions={
          <span className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <LiveDot on={autoRefresh} /> {autoRefresh ? `Live · updated ${ago(data?.at)}` : 'Paused (auto-refresh off)'}
          </span>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Online sessions" icon={<Users />} tone="info" loading={!data} value={data?.sessions.online ?? '—'} hint="active in 5 min" />
        <StatCard label="Logged-in users" icon={<Users />} loading={!data} value={data?.sessions.loggedInUsers ?? '—'} />
        <StatCard label="Sockets" icon={<Plug />} loading={!data} value={data?.sockets ?? 'n/a'} hint="this instance" />
        <StatCard label="Traffic" icon={<Activity />} loading={!data} value={rate(data?.traffic.rps)} hint={`${data?.traffic.activeRequests ?? 0} in flight · P95 ${ms(data?.traffic.p95LastMin)}`} />
        <StatCard label="New jobs" icon={<Briefcase />} loading={!data} value={l?.orders ?? '—'} hint="last 2 min" />
        <StatCard label="Payments" icon={<CreditCard />} tone="success" loading={!data} value={l?.payments ?? '—'} hint="updated, last 2 min" />
        <StatCard label="Signups" icon={<UserPlus />} loading={!data} value={l?.signups ?? '—'} hint="last 2 min" />
        <StatCard label="Errors" icon={<AlertTriangle />} tone={l?.errors ? 'danger' : 'success'} loading={!data} value={l?.errors ?? '—'} hint={`${l?.security ?? 0} security events`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Live traffic" description="Requests/s and in-flight requests (5s samples, since page opened)">
          <TimeSeriesChart data={series} bucketMs={60_000} height={200} series={[{ key: 'rps', label: 'Req/s', color: 'var(--chart-1)' }, { key: 'active', label: 'In flight', color: 'var(--chart-4)' }]} />
        </Section>
        <Section title="Online users trend" description="Sessions active in the previous 5 min, sampled each minute (this instance's history)">
          <TimeSeriesChart data={data?.onlineHistory} bucketMs={60_000} height={200} series={[{ key: 'sessions', label: 'Online sessions', color: 'var(--chart-2)' }]} />
        </Section>
      </div>

      <Section
        title="Event feed"
        description="Last 2 minutes"
        action={
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <Button key={t} size="xs" variant={type === t ? 'secondary' : 'ghost'} className="capitalize" onClick={() => setType(t)}>
                {t}
              </Button>
            ))}
          </div>
        }
      >
        {events.length ? (
          <ul className="divide-y rounded-md border">
            {events.map((e, i) => {
              const Icon = TYPE_ICON[e.type];
              return (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', TYPE_TONE[e.type])}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  {e.ref && <span className="hidden max-w-60 truncate font-mono text-xs text-muted-foreground sm:block">{e.ref}</span>}
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(e.at)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Quiet" description="No jobs, payments, errors or security events in the last 2 minutes." />
        )}
      </Section>
    </div>
  );
}
