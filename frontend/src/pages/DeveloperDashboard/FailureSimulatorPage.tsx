import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, BellOff, FlaskConical, OctagonX, Play, ShieldAlert, Square } from 'lucide-react';
import { ago, dateTime, num, until } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type FailureExperiment, type FaultType, type StartFailureInput } from '../../api/developer';
import { useDevFailures, useDevMe } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';

const HINT: Record<FaultType, string> = {
  http_latency: 'Adds delay to API requests under a route prefix. Expect: latency SLO burn, slower synthetic probes.',
  http_error: 'Returns 5xx for a share of requests under a route prefix. Expect: API error-rate alert, SLO fast burn.',
  stripe: 'Every Stripe API call fails. Expect: checkout/payout errors, reconciliation flags, dependency map "down".',
  email: 'Every email send fails (logged as failed). Expect: email delivery SLO burn.',
  push: 'Every push send fails. Expect: push delivery SLO burn.',
  stripe_webhook: 'Webhook deliveries get 503 so Stripe retries. Expect: payments stay pending until it ends, then catch up.',
  scheduler: 'Chosen job throws on every run. Expect: scheduler-failure alert, background-jobs SLO burn.',
};

function describe(e: FailureExperiment) {
  if (e.type === 'http_latency') return `+${num(e.latencyMs)} ms on ${e.target}`;
  if (e.type === 'http_error') return `${e.errorRate}% → ${e.statusCode} on ${e.target}`;
  if (e.type === 'scheduler') return `job: ${e.target === '*' ? 'all jobs' : e.target}`;
  return e.label;
}

function StartForm({ types, jobs, maxMinutes, disabled }: { types: Record<FaultType, { label: string }>; jobs: string[]; maxMinutes: number; disabled: boolean }) {
  const qc = useQueryClient();
  const [v, setV] = useState<StartFailureInput>({ type: 'http_error', target: '/api/', errorRate: 50, statusCode: 503, latencyMs: 1500, durationMinutes: 10, reason: '' });
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      await devApi.startFailure(v);
      toast.success('Experiment started — watch alerts, SLOs and the dependency map');
      setV({ ...v, reason: '' });
      qc.invalidateQueries({ queryKey: ['dev', 'failures'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const route = v.type === 'http_latency' || v.type === 'http_error';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Fault</Label>
          <Select value={v.type} onValueChange={(type) => setV({ ...v, type: type as FaultType, target: type === 'scheduler' ? '*' : type.startsWith('http') ? '/api/' : undefined })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(types) as FaultType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {types[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fx-dur">Duration (minutes, max {maxMinutes})</Label>
          <Input id="fx-dur" type="number" min={1} max={maxMinutes} value={v.durationMinutes} onChange={(e) => setV({ ...v, durationMinutes: Number(e.target.value) })} />
        </div>
        {route && (
          <div className="space-y-1.5">
            <Label htmlFor="fx-target">Route prefix</Label>
            <Input id="fx-target" value={v.target ?? ''} onChange={(e) => setV({ ...v, target: e.target.value })} placeholder="/api/orders" className="font-mono text-xs" />
          </div>
        )}
        {v.type === 'http_latency' && (
          <div className="space-y-1.5">
            <Label htmlFor="fx-lat">Added latency (ms)</Label>
            <Input id="fx-lat" type="number" min={50} max={30000} value={v.latencyMs} onChange={(e) => setV({ ...v, latencyMs: Number(e.target.value) })} />
          </div>
        )}
        {v.type === 'http_error' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="fx-rate">Error rate %</Label>
              <Input id="fx-rate" type="number" min={1} max={100} value={v.errorRate} onChange={(e) => setV({ ...v, errorRate: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={String(v.statusCode)} onValueChange={(c) => setV({ ...v, statusCode: Number(c) })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[500, 502, 503, 504].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {v.type === 'scheduler' && (
          <div className="space-y-1.5">
            <Label>Job</Label>
            <Select value={v.target || '*'} onValueChange={(target) => setV({ ...v, target })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All jobs</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{HINT[v.type]}</p>
      <div className="space-y-1.5">
        <Label htmlFor="fx-reason">Hypothesis / reason</Label>
        <Textarea id="fx-reason" rows={2} maxLength={300} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="e.g. An API error-rate alert should open within 5 minutes" />
      </div>
      <Button disabled={disabled || busy || v.reason.trim().length < 5} onClick={start}>
        <Play /> Start experiment
      </Button>
    </div>
  );
}

function ExperimentCard({ e, canAct, onStop }: { e: FailureExperiment; canAct: boolean; onStop: () => void }) {
  const i = e.impact;
  const rate = (w: { requests: number; c5xx: number }) => (w.requests ? `${((w.c5xx / w.requests) * 100).toFixed(1)}%` : '—');
  return (
    <div className={cn('rounded-md border p-4', e.status === 'running' && 'border-amber-300 bg-amber-50/40')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.label}</span>
            <StatusBadge status={e.status} tone={e.status === 'running' ? 'warning' : 'neutral'} />
            <span className="font-mono text-xs text-muted-foreground">{describe(e)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">“{e.reason}”</p>
          <p className="text-xs text-muted-foreground">
            {e.startedBy?.name || '—'} · started {dateTime(e.startedAt)} · {e.status === 'running' ? `ends ${until(e.endsAt)}` : e.stoppedAt ? `stopped by ${e.stoppedBy?.name || '—'} ${ago(e.stoppedAt)}` : `ended ${ago(e.endsAt)}`}
          </p>
        </div>
        {canAct && e.status === 'running' && (
          <Button size="sm" variant="destructive" onClick={onStop}>
            <Square /> Stop
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
        <div>
          <div className="text-muted-foreground">Alert fired</div>
          <div className={cn('flex items-center gap-1 font-medium', i.detected ? 'text-emerald-600' : 'text-red-600')}>
            {i.detected ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
            {i.detected ? `after ${i.detectionSeconds}s` : e.status === 'running' ? 'not yet' : 'no'}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">API 5xx rate</div>
          <div className="tabular-nums">
            {rate(i.api.before)} → <span className="font-medium">{rate(i.api.during)}</span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">p95</div>
          <div className="tabular-nums">
            {i.api.before.p95 ?? '—'} → <span className="font-medium">{i.api.during.p95 ?? '—'}</span> ms
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Failed sends / jobs</div>
          <div className="tabular-nums">
            {Object.entries(i.deliveryFailures).map(([k, n]) => `${k} ${n}`).join(' · ') || '0'} / {i.schedulerFailures}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Synthetic failures</div>
          <div className="tabular-nums">{i.syntheticFailures}</div>
        </div>
      </div>
      {i.incidents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {i.incidents.map((inc) => (
            <Badge key={inc._id} variant="outline" className="text-xs">
              {inc.severity} · {inc.title}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FailureSimulatorPage() {
  const { data: me } = useDevMe();
  const { data, isLoading, error, refetch } = useDevFailures();
  const qc = useQueryClient();
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const running = data?.experiments.filter((e) => e.status === 'running') || [];
  const past = data?.experiments.filter((e) => e.status !== 'running') || [];
  const tested = past.filter((e) => e.type !== 'http_latency');
  const detectedShare = tested.length ? Math.round((tested.filter((e) => e.impact.detected).length / tested.length) * 100) : null;

  const stop = async (id: string | 'all') => {
    try {
      const r = await devApi.stopFailure(id);
      toast.success(`Stopped ${r.data.data.stopped} experiment(s)`);
      qc.invalidateQueries({ queryKey: ['dev', 'failures'] });
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Failure Simulator"
        description="Break things on purpose — in staging only — and check that alerts fire, SLOs burn, retries and reconciliation recover. Every experiment is time-boxed, audited and can be stopped at once."
        actions={
          canAct && running.length > 0 ? (
            <Button size="sm" variant="destructive" onClick={() => stop('all')}>
              <OctagonX /> Stop all
            </Button>
          ) : null
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && !data.availability.enabled && (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="size-4" /> Simulator disabled on this instance
          </div>
          <ul className="mt-1 list-disc pl-5 text-sky-800">
            {data.availability.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-sky-700">Set ENABLE_FAILURE_SIMULATOR=true on a staging instance with a Stripe test key to use it. Production can never enable it.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Running now" icon={<FlaskConical />} tone={running.length ? 'warning' : 'neutral'} loading={isLoading} value={running.length} hint={running.map((r) => r.label).join(', ') || 'nothing injected'} />
        <StatCard label="Detected by alerts" icon={<Bell />} tone={detectedShare === null ? 'neutral' : detectedShare >= 80 ? 'success' : 'warning'} loading={isLoading} value={detectedShare === null ? '—' : `${detectedShare}%`} hint="of finished fault experiments" />
        <StatCard label="Experiments" icon={<FlaskConical />} loading={isLoading} value={data?.experiments.length ?? 0} hint="last 20" />
        <StatCard label="Status" icon={<ShieldAlert />} tone={data?.availability.enabled ? 'warning' : 'success'} loading={isLoading} value={data?.availability.enabled ? 'Armed' : 'Disabled'} hint={data?.availability.enabled ? 'faults can be injected here' : 'safe — no faults possible'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Section title="New experiment" description="Write down what you expect to happen first — the result below tells you whether it did.">
          {data && canAct ? <StartForm types={data.types} jobs={data.schedulerJobs} maxMinutes={data.maxMinutes} disabled={!data.availability.enabled} /> : <p className="text-sm text-muted-foreground">Operations access is needed to run experiments.</p>}
        </Section>
        <Section title="Running" description="Refreshes every 5 seconds while something is running.">
          {running.length ? <div className="space-y-3">{running.map((e) => <ExperimentCard key={e._id} e={e} canAct={canAct} onStop={() => stop(e._id)} />)}</div> : <EmptyState title="Nothing running" />}
        </Section>
      </div>

      <Section title="Results" description="Did monitoring notice? Detection time is from the start of the experiment to the first incident.">
        {past.length ? <div className="space-y-3">{past.map((e) => <ExperimentCard key={e._id} e={e} canAct={false} onStop={() => undefined} />)}</div> : <EmptyState title="No experiments yet" />}
      </Section>
    </div>
  );
}
