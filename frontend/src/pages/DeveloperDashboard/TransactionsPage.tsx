import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowUpRight, CircleCheck, CircleDashed, CircleX, Clock, Route, Search, Workflow } from 'lucide-react';
import { dateTime, duration, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { TxJourneys } from '../../api/developer';
import { useDevJourneys, useDevTxTrace, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const dur = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : ms < 60_000 ? '< 1 min' : duration(Math.round(ms / 1000)));
const STAGE_LABEL: Record<string, string> = { posted: 'posted', first_bid: 'waiting for bids', accepted: 'waiting for payment', paid: 'waiting for work to start', started: 'waiting for delivery', delivered: 'waiting for approval', completed: 'waiting for payout' };

function Trace({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading, error } = useDevTxTrace(id);
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const reachedIdx = data.steps.findIndex((s) => s.key === data.current);
  return (
    <div className="space-y-4">
      <Section
        title={data.title || 'Job'}
        description={`Job ${data.serviceId}${data.orderId ? ` · order ${data.orderId}` : ''} · ${data.totalMs ? `${dur(data.totalMs)} end to end` : 'not started'}`}
        action={
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onBack}>
              <ArrowLeft /> Journeys
            </Button>
            {data.orderId && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/developer/jobs?id=${data.orderId}`}>
                  Job Diagnostics <ArrowUpRight />
                </Link>
              </Button>
            )}
            {data.orderId && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/developer/ledger?order=${data.orderId}`}>
                  Ledger <ArrowUpRight />
                </Link>
              </Button>
            )}
          </span>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {data.branch ? <StatusBadge status={data.branch} tone={data.branch === 'refunded' || data.branch === 'cancelled' ? 'neutral' : 'danger'} /> : data.stuck ? <StatusBadge status="stuck" tone="danger" /> : data.current === 'reviewed' || data.current === 'paid_out' ? <StatusBadge status="complete" tone="success" /> : <StatusBadge status="in progress" tone="info" />}
          {data.current && !data.branch && data.waitingMs !== null && (
            <span className={cn('text-sm', data.stuck ? 'font-medium text-red-600' : 'text-muted-foreground')}>
              {STAGE_LABEL[data.current] || data.current} for {dur(data.waitingMs)}
            </span>
          )}
          {data.skipped.length > 0 && <Badge variant="destructive">skipped: {data.skipped.join(', ').replace(/_/g, ' ')}</Badge>}
        </div>
        <ol className="relative space-y-0">
          {data.steps.map((s, i) => {
            const done = Boolean(s.at);
            const Icon = s.skipped ? CircleX : done ? CircleCheck : CircleDashed;
            return (
              <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < data.steps.length - 1 && <span className={cn('absolute top-5 left-[9px] h-full w-px', done && i < reachedIdx ? 'bg-emerald-300' : 'bg-border')} />}
                <Icon className={cn('relative z-10 mt-0.5 size-5 shrink-0 bg-card', s.skipped ? 'text-red-600' : done ? 'text-emerald-600' : 'text-muted-foreground/40')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cn('text-sm font-medium', !done && 'text-muted-foreground')}>
                      {s.label}
                      {s.optional && !done && <span className="ml-1 text-xs font-normal">(optional)</span>}
                      {s.skipped && <span className="ml-2 text-xs font-normal text-red-600">never happened</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.at ? dateTime(s.at) : '—'}{s.afterMs !== null && <span className="ml-2 tabular-nums">{s.afterMs < 60_000 ? dur(s.afterMs) : `+${dur(s.afterMs)}`}</span>}</span>
                  </div>
                  {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={`Bids (${data.bids.length})`}>
          {data.bids.length ? (
            <ul className="space-y-1 text-xs">
              {data.bids.map((b, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{b.provider}</span>
                  <span className="text-muted-foreground">{b.status} · {dateTime(b.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No bids.</p>
          )}
        </Section>
        <Section title="Earlier attempts">
          {data.attempts.length ? (
            <ul className="space-y-1 text-xs">
              {data.attempts.map((a) => (
                <li key={a.orderId}>
                  <Link to={`/developer/transactions?id=${a.orderId}`} className="font-mono text-primary hover:underline">{a.orderId.slice(-8).toUpperCase()}</Link> {a.status} · {a.paymentStatus}
                  {a.reason && <span className="block text-muted-foreground">{a.reason}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </Section>
        <Section title="Disputes & refunds">
          {data.disputes.length || data.refund ? (
            <ul className="space-y-1 text-xs">
              {data.disputes.map((d) => (
                <li key={d.id}>
                  {d.title} · {d.status}{d.outcome ? ` · ${d.outcome}` : ''}
                </li>
              ))}
              {data.refund ? <li>Refunded {data.refund} kr</li> : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Journeys({ data, onOpen }: { data: TxJourneys; onOpen: (id: string) => void }) {
  const max = Math.max(1, data.jobs);
  const stuckCols: Column<TxJourneys['stuck'][number]>[] = [
    { key: 't', header: 'Job', cell: (s) => <span className="truncate">{s.title}</span> },
    { key: 's', header: 'Stuck at', cell: (s) => <Badge variant="outline">{STAGE_LABEL[s.stage] || s.stage}</Badge> },
    { key: 'w', header: 'For', align: 'right', cell: (s) => <span className="tabular-nums font-medium text-red-600">{dur(s.waitingMs)}</span> },
  ];
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Section title="How far jobs get" description={`${num(data.jobs)} jobs posted in the last ${data.days} days`}>
          <ul className="space-y-2">
            {data.funnel.map((f) => (
              <li key={f.key} className="text-sm">
                <div className="mb-0.5 flex justify-between gap-2">
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {num(f.reached)} · {f.share ?? 0}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(f.reached / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Ended in a branch: {Object.entries(data.branches).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(' · ') || 'none'}</p>
        </Section>
        <Section title="How long each step takes" description="Median and 90th percentile over jobs that made the step.">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-normal">Step</th>
                <th className="pb-2 text-right font-normal">Jobs</th>
                <th className="pb-2 text-right font-normal">Median</th>
                <th className="pb-2 text-right font-normal">p90</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.steps.map((s) => (
                <tr key={s.to}>
                  <td className="py-1.5 text-xs">{s.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-xs">{s.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-xs">{dur(s.p50)}</td>
                  <td className="py-1.5 text-right tabular-nums text-xs">{dur(s.p90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
      <Section title="Stuck right now" description="Waiting at a step longer than expected (bids 3 d, acceptance 7 d, payment 2 d, start 3 d, delivery 7 d, approval 7 d, payout 1 d). Click to trace.">
        <DataTable columns={stuckCols} rows={data.stuck} rowKey={(s) => s.serviceId} onRowClick={(s) => onOpen(s.serviceId)} emptyTitle="Nothing stuck" />
      </Section>
    </>
  );
}

export default function TransactionsPage() {
  const [f, setF] = useUrlFilters({ id: '', days: '90' });
  const [input, setInput] = useState('');
  const { data, isLoading, error, refetch } = useDevJourneys(Number(f.days));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Business Transactions"
        description="Every job end to end — posted → bid → accepted → paid → started → delivered → completed → paid out → reviewed — with the time between steps, the branches (cancelled, refunded, disputed) and where jobs are stuck. Paste a job, order, payment, payout or bid id to trace one."
        actions={
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) setF({ id: input.trim() });
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Trace any id…" className="w-56 bg-card pl-8 font-mono text-xs" aria-label="Trace id" />
              </div>
            </form>
            {!f.id && (
              <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
                <TabsList>
                  {['30', '90', '180', '365'].map((d) => (
                    <TabsTrigger key={d} value={d}>
                      {d} d
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {f.id ? (
        <Trace id={f.id} onBack={() => setF({ id: '' })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Jobs posted" icon={<Route />} loading={isLoading} value={num(data?.jobs)} hint={`last ${f.days} days`} />
            <StatCard label="Completed" icon={<CircleCheck />} tone="success" loading={isLoading} value={data ? `${data.funnel.find((x) => x.key === 'completed')?.share ?? 0}%` : '—'} hint="of posted jobs" />
            <StatCard label="Paid out" icon={<Workflow />} loading={isLoading} value={data ? num(data.funnel.find((x) => x.key === 'paid_out')?.reached) : '—'} hint="providers paid" />
            <StatCard label="Stuck" icon={data?.stuck.length ? <AlertTriangle /> : <Clock />} tone={data?.stuck.length ? 'danger' : 'success'} loading={isLoading} value={data?.stuck.length ?? '—'} hint="waiting longer than expected" />
          </div>
          {isLoading || !data ? <Skeleton className="h-80 w-full" /> : data.jobs ? <Journeys data={data} onOpen={(id) => setF({ id })} /> : <EmptyState title="No jobs posted in this period" />}
        </>
      )}
    </div>
  );
}
