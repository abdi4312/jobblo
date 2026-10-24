import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Hourglass, Inbox, Layers, RotateCcw, Server, Skull, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ago, num } from '@/lib/devFormat';
import { useDevMe, useDevQueues } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { devApi, type BrokerInfo } from '../../api/developer';
import { Button } from '../../components/developer/ui/button';
import type { QueueInfo } from '../../api/developer';
import { CountBars, ErrorState, JsonView, KeyValue, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Skeleton } from '../../components/developer/ui/skeleton';

/** BullMQ queues on Redis: counts, failed jobs (dead letters) with retry / remove. */
function BrokerSection({ broker }: { broker: BrokerInfo }) {
  const { data: me } = useDevMe();
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      await qc.invalidateQueries({ queryKey: ['dev', 'queues'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const redisDown = broker.mode === 'redis' && broker.redis.ok === false;

  return (
    <Section
      title="Background jobs (BullMQ)"
      description={broker.mode === 'redis' ? `Redis ${broker.redis.ok ? `ok · ${broker.redis.ms} ms` : `unreachable: ${broker.redis.error}`}` : 'REDIS_URL is not set: jobs run in-process right after the request (no retries, lost on restart). Set REDIS_URL to get durable, retried jobs.'}
      action={<StatusBadge status={redisDown ? 'failing' : broker.mode === 'redis' ? 'healthy' : 'warning'} label={redisDown ? 'Redis down' : broker.mode === 'redis' ? 'Redis' : 'in-process'} />}
    >
      {broker.mode === 'inline' && (
        <p className="mb-3 text-xs text-muted-foreground">
          In-process since start: {num(broker.inline.ran)} jobs ran, {num(broker.inline.failed)} failed{broker.inline.lastError ? ` — last: ${broker.inline.lastError}` : ''}.
        </p>
      )}
      <div className="space-y-4">
        {broker.queues.map((q) => (
          <div key={q.name} className="rounded-md border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" />
                <span className="font-medium">{q.name}</span>
                <span className="text-xs text-muted-foreground">
                  concurrency {q.concurrency} · {q.attempts} attempt{q.attempts === 1 ? '' : 's'}
                  {broker.mode === 'redis' ? (q.workerHere ? ' · worker on this instance' : ' · no worker on this instance') : ''}
                  {q.isPaused ? ' · PAUSED' : ''}
                </span>
              </div>
              {canAct && (q.counts?.failed ?? 0) > 0 && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(`all-${q.name}`, () => devApi.retryFailedJobs(q.name), `Retrying failed ${q.name} jobs`)}>
                  <RotateCcw /> Retry all failed
                </Button>
              )}
            </div>
            {q.counts ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(['waiting', 'active', 'delayed', 'completed', 'failed', 'prioritized'] as const).map((k) => (
                  <div key={k} className="rounded-md border bg-muted/30 p-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">{k}</div>
                    <div className={cn('text-base font-semibold tabular-nums', k === 'failed' && q.counts![k] ? 'text-red-600' : '')}>{num(q.counts![k])}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No counts (in-process mode or Redis unreachable).</p>
            )}
            {q.schedulers && q.schedulers.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {q.schedulers.length} scheduled jobs · next: {q.schedulers.filter((s) => s.next).sort((a, b) => String(a.next).localeCompare(String(b.next)))[0]?.id} {ago(q.schedulers.filter((s) => s.next).sort((a, b) => String(a.next).localeCompare(String(b.next)))[0]?.next)}
              </p>
            )}
            {q.failed.length > 0 && (
              <div className="mt-3 space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Failed (dead letters)</h4>
                {(expanded[q.name] ? q.failed : q.failed.slice(0, 5)).map((j) => (
                  <div key={j.id} className="rounded-md border border-red-200 bg-red-50/50 p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono">
                        #{j.id} {j.name} · {j.attemptsMade}/{j.maxAttempts} attempts · {j.finishedAt ? ago(j.finishedAt) : ''}
                      </span>
                      {canAct && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7" disabled={busy !== null} onClick={() => act(`r-${j.id}`, () => devApi.retryQueueJob(q.name, j.id), `Job #${j.id} queued again`)}>
                            <RotateCcw /> Retry
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" disabled={busy !== null} onClick={() => act(`d-${j.id}`, () => devApi.removeQueueJob(q.name, j.id), `Job #${j.id} removed`)} aria-label="Remove job">
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-red-700">{j.failedReason}</div>
                    <JsonView value={j.data} className="mt-1 max-h-24" />
                  </div>
                ))}
                {q.failed.length > 5 && (
                  <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => ({ ...e, [q.name]: !e[q.name] }))}>
                    {expanded[q.name] ? 'Show fewer' : `Show all ${q.failed.length}${(q.counts?.failed ?? 0) > q.failed.length ? ` (of ${q.counts!.failed})` : ''}`}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function QueueCard({ q }: { q: QueueInfo }) {
  const health = q.stuck ? 'failing' : q.failed ? 'warning' : 'healthy';
  return (
    <Section
      title={q.name}
      description={q.worker}
      action={<StatusBadge status={health} label={q.stuck ? `${q.stuck} stuck` : q.failed ? `${q.failed} failed` : 'healthy'} />}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Backlog', q.backlog, q.backlog ? 'text-sky-700' : ''],
              ['Stuck', q.stuck, q.stuck ? 'text-red-600' : ''],
              ['Failed', q.failed, q.failed ? 'text-amber-600' : ''],
              ['Dead letter', q.deadLetter ?? '—', q.deadLetter ? 'text-red-600' : ''],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-md border bg-muted/30 p-2 text-center">
                <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
                <div className={cn('text-base font-semibold tabular-nums', tone as string)}>{typeof value === 'number' ? num(value) : value}</div>
              </div>
            ))}
          </div>
          <CountBars counts={q.counts} />
          <KeyValue
            items={[
              ['Oldest pending', q.oldestPendingAt ? ago(q.oldestPendingAt) : '—'],
              ['Retry policy', q.retryPolicy],
              ['Duplicate prevention', q.duplicatePrevention],
              ['Attempts', Object.entries(q.attempts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, n]) => `${k}×: ${n}`).join(' · ') || '—'],
            ]}
          />
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">Completed per hour, last 24h</h4>
            <TimeSeriesChart data={q.throughput} bucketMs={3_600_000} height={140} variant="bar" series={[{ key: 'done', label: 'Completed', color: 'var(--chart-2)' }]} />
          </div>
          {q.recentFailures.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">Recent failures</h4>
              <JsonView value={q.recentFailures} className="max-h-48" />
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export default function QueuesPage() {
  const { data, isLoading, isFetching, error, refetch } = useDevQueues();
  const qs = data?.queues || [];
  const sum = (k: 'backlog' | 'stuck' | 'failed') => qs.reduce((a, q) => a + q[k], 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Queues & Background Jobs"
        description="Background jobs (email, push, scheduled lifecycle jobs) on Redis/BullMQ — retried with backoff, failed jobs kept as dead letters you can retry — and the database-backed work queues (webhooks, payouts, recovery emails)." 
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Queues" icon={<Layers />} loading={isLoading} value={qs.length} hint={<Link className="text-primary hover:underline" to="/developer/scheduler">Scheduled jobs →</Link>} />
        <StatCard label="Backlog" icon={<Inbox />} tone={sum('backlog') ? 'info' : 'neutral'} loading={isLoading} value={num(sum('backlog'))} />
        <StatCard label="Stuck" icon={<Hourglass />} tone={sum('stuck') ? 'danger' : 'success'} loading={isLoading} value={num(sum('stuck'))} hint={`processing > ${data?.stuckAfterMinutes ?? 15} min`} />
        <StatCard label="Failed / dead letter" icon={sum('failed') ? <Skull /> : <AlertTriangle />} tone={sum('failed') ? 'warning' : 'success'} loading={isLoading} value={num(sum('failed'))} />
      </div>

      {data?.broker && <BrokerSection broker={data.broker} />}

      <h3 className="pt-2 text-sm font-semibold">Database-backed work queues</h3>
      <div className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
        No manual retry here on purpose: Stripe re-delivers webhooks itself, and payouts and recovery emails are retried by the scheduler with idempotency keys. Stuck items raise an incident automatically.
      </div>

      {isLoading ? <Skeleton className="h-80 w-full" /> : qs.map((q) => <QueueCard key={q.key} q={q} />)}
    </div>
  );
}
