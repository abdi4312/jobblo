import { useState } from 'react';
import { CheckCircle2, CircleDashed, KeyRound, Play, Search, ShieldOff, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateTime, ms } from '@/lib/devFormat';
import { useDevRunChecks, useDevTrace, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, JsonView, Mono, PageHeader, Section, StatusBadge } from '../../components/developer/kit';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';

function CheckIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <CircleDashed className="size-4 text-muted-foreground" />;
  return ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />;
}

function checkDetail(c: Record<string, unknown>) {
  if (c.skipped) return String(c.skipped);
  if (c.error) return String(c.error);
  if (c.detail) return String(c.detail);
  if (c.status) return `${c.status}${c.mode ? ` · ${c.mode}` : ''}`;
  if (c.daysLeft !== undefined && c.daysLeft !== null) return `${c.daysLeft} days left · ${c.issuer || ''}`;
  if (Array.isArray(c.addresses)) return `${c.host} → ${(c.addresses as string[]).join(', ')}`;
  return '';
}

export default function ToolsPage() {
  const checks = useDevRunChecks();
  const [f, setF] = useUrlFilters({ trace: '' });
  const [traceInput, setTraceInput] = useState(f.trace);
  const trace = useDevTrace(f.trace || undefined);
  const result = checks.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Developer Tools"
        description="Safe troubleshooting. No terminal, no database writes, no secret values — by design."
        actions={
          <Button size="sm" onClick={() => checks.mutate()} disabled={checks.isPending}>
            <Play /> {checks.isPending ? 'Running…' : 'Run readiness checks'}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title="System readiness"
          description={result ? `Ran ${dateTime(result.ranAt)}` : 'MongoDB, Stripe, webhook, scheduler, DNS and SSL'}
          className="lg:col-span-2"
          action={result && <StatusBadge status={result.checks.some((c) => c.ok === false) ? 'failing' : 'healthy'} label={`${result.checks.filter((c) => c.ok).length}/${result.checks.filter((c) => c.ok !== null).length} passing`} />}
        >
          {checks.error && <ErrorState error={checks.error} />}
          {checks.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : result ? (
            <ul className="divide-y rounded-md border">
              {result.checks.map((c) => (
                <li key={c.key} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <CheckIcon ok={c.ok} />
                  <span className="w-48 shrink-0 font-medium text-foreground">{c.label}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{checkDetail(c)}</span>
                  {c.ms !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ms(c.ms)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Play />} title="No checks run yet" description="Run the readiness checks to ping every dependency. Each run is written to the audit log." />
          )}
        </Section>

        <Section title="Environment variables" description="Presence only — values are never sent to the browser">
          {result ? (
            <ul className="space-y-1.5">
              {result.env.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 truncate font-mono">
                    <KeyRound className="size-3 text-muted-foreground" />
                    {e.name}
                  </span>
                  <StatusBadge status={e.present ? 'ok' : 'n/a'} label={e.present ? 'set' : 'missing'} tone={e.present ? 'success' : 'warning'} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Run the checks to see which variables are set.</p>
          )}
        </Section>
      </div>

      <Section title="Trace lookup" description="Find everything recorded for a request ID, error reference (ERR-…), Stripe event or object ID">
        <form
          className="mb-4 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setF({ trace: traceInput.trim() });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={traceInput} onChange={(e) => setTraceInput(e.target.value)} placeholder="X-Request-ID, ERR-…, evt_…, pi_…" className="pl-8 font-mono text-xs" aria-label="Trace ID" />
          </div>
          <Button type="submit" variant="outline" disabled={!traceInput.trim()}>
            Look up
          </Button>
        </form>
        {trace.isFetching ? (
          <Skeleton className="h-24 w-full" />
        ) : trace.error ? (
          <ErrorState error={trace.error} />
        ) : trace.data ? (
          trace.data.errors.length + trace.data.activity.length + trace.data.webhooks.length === 0 ? (
            <EmptyState title="Nothing found" description={`No errors, audit entries or webhook events reference ${trace.data.id}.`} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                { title: 'Errors', items: trace.data.errors.map((e) => ({ id: e._id, head: `${e.statusCode ?? ''} ${e.message}`, sub: `${e.referenceId} · ${dateTime(e.createdAt)}`, body: e })) },
                { title: 'Audit / activity', items: trace.data.activity.map((a) => ({ id: a._id, head: a.description, sub: dateTime(a.createdAt), body: a.metadata })) },
                { title: 'Webhooks', items: trace.data.webhooks.map((w) => ({ id: w._id, head: w.type, sub: `${w.eventId} · ${w.status}`, body: w })) },
              ].map((col) => (
                <div key={col.title} className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">
                    {col.title} ({col.items.length})
                  </h4>
                  {col.items.map((i) => (
                    <details key={i.id} className="rounded-md border bg-card p-2.5 text-sm">
                      <summary className="cursor-pointer list-none">
                        <div className="truncate font-medium">{i.head}</div>
                        <div className="truncate text-xs text-muted-foreground">{i.sub}</div>
                      </summary>
                      <JsonView value={i.body} className="mt-2" />
                    </details>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Paste an ID from a response header (<Mono>X-Request-ID</Mono>) or an error toast.
          </p>
        )}
      </Section>

      <Section title="Guardrails" description="Production tools are deliberately limited">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {['No arbitrary terminal commands', 'No unrestricted database writes', 'Secret values are never visible', 'Every tool run is audited'].map((t, i) => (
            <div key={t} className={cn('flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground')}>
              {i === 3 ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <ShieldOff className="size-3.5" />}
              {t}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
