import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowUpRight, CheckCircle2, CircleX, Copy, Play, Search, Wrench } from 'lucide-react';
import { ago, dateTime } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type CheckState, type RunbookApproval, type RunbookRunRow, type RunbookStep } from '../../api/developer';
import { useDevMe, useDevRunbook, useDevRunbooks, useUrlFilters } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, Section, StatusBadge } from '../../components/developer/kit';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Input } from '../../components/developer/ui/input';

const STATE_ICON: Record<CheckState, React.ReactNode> = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  warn: <AlertTriangle className="size-4 text-amber-600" />,
  fail: <CircleX className="size-4 text-red-600" />,
  error: <CircleX className="size-4 text-red-600" />,
};
const APPROVAL: Record<RunbookApproval, { label: string; className: string }> = {
  none: { label: 'read-only', className: 'text-muted-foreground' },
  operations: { label: 'operations access', className: 'text-sky-700 border-sky-200 bg-sky-50' },
  'step-up': { label: 'step-up code', className: 'text-amber-700 border-amber-200 bg-amber-50' },
  'change-request': { label: 'Super Admin approval', className: 'text-red-700 border-red-200 bg-red-50' },
  human: { label: 'manual — shell / dashboard', className: 'text-violet-700 border-violet-200 bg-violet-50' },
};

function StepRow({ step, i, run, canAct, onDone }: { step: RunbookStep; i: number; run?: RunbookRunRow; canAct: boolean; onDone: (i: number, note: string) => Promise<void> }) {
  const done = run?.steps.find((s) => s.index === i);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const runEndpoint = async () => {
    setBusy(true);
    try {
      if (step.endpoint === 'backup_run') await devApi.runBackup();
      if (step.endpoint === 'synthetic_run') await devApi.syntheticRun();
      toast.success('Started');
      qc.invalidateQueries({ queryKey: ['dev'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={cn('rounded-md border p-3', done && 'bg-muted/40')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium', done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'text-muted-foreground')}>{done ? '✓' : i + 1}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {step.kind === 'investigate' ? <Search className="size-3.5 text-muted-foreground" /> : <Wrench className="size-3.5 text-muted-foreground" />}
            <span className="text-sm">{step.text}</span>
            {step.approval && <Badge variant="outline" className={APPROVAL[step.approval].className}>{APPROVAL[step.approval].label}</Badge>}
          </div>
          {step.manual && (
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">{step.manual}</pre>
              <Button size="icon-sm" variant="ghost" aria-label="Copy" onClick={() => navigator.clipboard?.writeText(step.manual!).then(() => toast.success('Copied'))}>
                <Copy />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {step.link && (
              <Button size="sm" variant="outline" asChild>
                <Link to={step.link}>
                  Open <ArrowUpRight />
                </Link>
              </Button>
            )}
            {step.endpoint && canAct && (
              <Button size="sm" variant="outline" disabled={busy} onClick={runEndpoint}>
                <Play /> Run now
              </Button>
            )}
            {run && !run.closedAt && !done && canAct && (
              <>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-8 w-56" maxLength={1000} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onDone(i, note).finally(() => setBusy(false));
                  }}
                >
                  Mark done
                </Button>
              </>
            )}
          </div>
          {done && (
            <p className="text-xs text-muted-foreground">
              Done by {done.doneBy?.name || 'someone'} {ago(done.doneAt)}
              {done.note ? ` — ${done.note}` : ''}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function Detail({ runbookKey, incidentId, onBack }: { runbookKey: string; incidentId: string; onBack: () => void }) {
  const { data, isLoading, error, refetch } = useDevRunbook(runbookKey);
  const { data: me } = useDevMe();
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState('');
  const r = data?.runbook;
  const current = data?.runs.find((x) => !x.closedAt && (!incidentId || x.incidentId?._id === incidentId));
  const refresh = () => qc.invalidateQueries({ queryKey: ['dev', 'runbook', runbookKey] });

  const start = async () => {
    setRunning(true);
    try {
      await devApi.startRunbook(runbookKey, incidentId || undefined);
      await refresh();
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setRunning(false);
    }
  };
  const update = async (body: Parameters<typeof devApi.updateRunbookRun>[1]) => {
    try {
      await devApi.updateRunbookRun(current!._id, body);
      await refresh();
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-5">
      <PageHeader
        title={r?.title || 'Runbook'}
        description={r ? `${r.symptoms} Covers alerts: ${r.alerts.join(', ')}.` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft /> Runbooks
            </Button>
            {canAct && (
              <Button size="sm" disabled={running || isLoading} onClick={start}>
                <Play /> {running ? 'Running checks…' : current ? 'Re-run checks' : 'Start: run checks'}
              </Button>
            )}
          </div>
        }
      />
      {incidentId && (
        <p className="text-sm text-muted-foreground">
          Working on incident{' '}
          <Link to={`/developer/incidents?id=${incidentId}`} className="text-primary hover:underline">
            {data?.runs.find((x) => x.incidentId?._id === incidentId)?.incidentId?.title || incidentId}
          </Link>
          . Runs, ticked steps and notes are added to its timeline.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Section
          title="Diagnostic checks"
          description={current ? `Run ${ago(current.createdAt)} by ${current.startedBy?.name || '—'}` : 'Read-only. Start the runbook to run them now.'}
          action={current ? <StatusBadge status={current.state} /> : null}
        >
          <ul className="space-y-3">
            {(current?.checks || r?.checks.map((c) => ({ ...c, state: null, detail: '', ms: 0 })) || []).map((c) => (
              <li key={c.key} className="flex gap-2.5">
                <span className="mt-0.5">{c.state ? STATE_ICON[c.state as CheckState] : <span className="block size-4 rounded-full border" />}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.title}</div>
                  {c.detail && <div className="text-xs break-words text-muted-foreground">{c.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Steps" description="Investigate first, then recover. Recovery only uses existing gated workflows — the badge says what each needs.">
          <ol className="space-y-2">
            {r?.steps.map((s, i) => <StepRow key={i} step={s} i={i} run={current} canAct={canAct} onDone={(step, note) => update({ step, note: note || undefined })} />)}
          </ol>
          {current && canAct && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome — what fixed it?" className="h-8 min-w-60 flex-1" maxLength={2000} />
              <Button size="sm" variant="outline" onClick={() => update({ close: true, outcome: outcome || undefined })}>
                Close run
              </Button>
            </div>
          )}
        </Section>
      </div>
      <Section title="History">
        {data?.runs.length ? (
          <ul className="divide-y text-sm">
            {data.runs.map((x) => (
              <li key={x._id} className="flex flex-wrap items-center gap-3 py-2">
                <StatusBadge status={x.state} />
                <span>{dateTime(x.createdAt)}</span>
                <span className="text-muted-foreground">by {x.startedBy?.name || '—'}</span>
                <span className="text-muted-foreground">
                  {x.steps.length}/{r?.steps.length} steps
                </span>
                {x.incidentId && <span className="text-xs text-muted-foreground">incident: {x.incidentId.title}</span>}
                <span className="text-xs text-muted-foreground">{x.closedAt ? `closed${x.outcome ? ` — ${x.outcome}` : ''}` : 'open'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Never run" description="Start the runbook to record a run." />
        )}
      </Section>
    </div>
  );
}

export default function RunbooksPage() {
  const [f, setF] = useUrlFilters({ key: '', incident: '' });
  const { data, isLoading, error, refetch } = useDevRunbooks();
  if (f.key) return <Detail runbookKey={f.key} incidentId={f.incident} onBack={() => setF({ key: '', incident: '' })} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Runbooks"
        description="What to do when something breaks: live diagnostic checks, where to look, and the approved way to recover. Runbooks are matched to alerts, so an open incident links straight to its runbook. Recovery steps only point at workflows that are already gated (operations access, step-up, Super Admin approval, or a human with shell access) — nothing here moves money."
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.incidents.length > 0 && (
        <Section title="Open incidents" description="Pick the runbook to work the incident with.">
          <ul className="divide-y">
            {data.incidents.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <StatusBadge status={i.severity} />
                <span className="font-medium">{i.title}</span>
                <span className="text-xs text-muted-foreground">{ago(i.startedAt)}</span>
                <span className="ml-auto flex flex-wrap gap-2">
                  {i.runbooks.length ? (
                    i.runbooks.map((k) => (
                      <Button key={k} size="sm" variant="outline" onClick={() => setF({ key: k, incident: i._id })}>
                        {data.runbooks.find((r) => r.key === k)?.title}
                      </Button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No runbook for this alert yet</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data?.runbooks || []).map((r) => (
          <Card key={r.key} size="sm" role="button" tabIndex={0} className="cursor-pointer gap-2 transition-colors hover:border-primary/40" onClick={() => setF({ key: r.key })} onKeyDown={(e) => e.key === 'Enter' && setF({ key: r.key })}>
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                <StatusBadge status={r.severity} />
              </div>
              <p className="text-xs text-muted-foreground">{r.symptoms}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{r.checks.length} checks</span>
                <span>{r.steps.length} steps</span>
                <span>{r.lastRun ? `last run ${ago(r.lastRun.at)} · ${r.lastRun.state}` : 'never run'}</span>
                {r.openIncidents ? <span className="font-medium text-red-600">{r.openIncidents} open incident(s)</span> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
