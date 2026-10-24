import { useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Timer, XCircle } from 'lucide-react';
import { ago, dateTime, every, ms, num, until } from '@/lib/devFormat';
import { useDevScheduler, useUrlFilters } from '../../features/developer/hooks';
import type { SchedulerJob, SchedulerRun } from '../../api/developer';
import { ErrorState, JsonView, Mono, NotConfigured, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

export default function SchedulerPage() {
  const [f, setF] = useUrlFilters({ range: '7d', job: 'all', ok: 'all', page: '1' });
  const [run, setRun] = useState<SchedulerRun | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevScheduler({
    range: f.range as '7d',
    job: f.job === 'all' ? undefined : f.job,
    ok: f.ok === 'failed' ? 'false' : undefined,
    page: f.page,
  });
  const jobs = data?.jobs || [];
  const failing = jobs.filter((j) => j.status === 'failing').length;
  const missed = jobs.filter((j) => j.status === 'missed').length;
  const totalRuns = jobs.reduce((a, j) => a + j.runs, 0);
  const totalFailures = jobs.reduce((a, j) => a + j.failures, 0);

  const jobColumns: Column<SchedulerJob>[] = [
    { key: 'name', header: 'Job', cell: (j) => <span className="font-mono text-xs">{j.name}</span> },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
    { key: 'every', header: 'Schedule', cell: (j) => <span className="text-xs text-muted-foreground">every {every(j.everyMs)}</span> },
    { key: 'last', header: 'Last run', cell: (j) => (j.lastRunAt ? <span className="flex items-center gap-1.5 text-xs">{j.lastOk ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <XCircle className="size-3.5 text-red-600" />}{ago(j.lastRunAt)}</span> : <span className="text-xs text-muted-foreground">never</span>) },
    { key: 'next', header: 'Next run', cell: (j) => <span className="text-xs text-muted-foreground">{until(j.nextRunAt)}</span> },
    { key: 'dur', header: 'Avg duration', align: 'right', cell: (j) => <span className="tabular-nums">{ms(j.avgMs)}</span> },
    { key: 'runs', header: 'Runs', align: 'right', cell: (j) => <span className="tabular-nums">{num(j.runs)}</span> },
    { key: 'fail', header: 'Failures', align: 'right', cell: (j) => <span className={`tabular-nums ${j.failures ? 'text-red-600' : 'text-muted-foreground'}`}>{num(j.failures)}</span> },
  ];

  const runColumns: Column<SchedulerRun>[] = [
    { key: 'job', header: 'Job', cell: (r) => <span className="font-mono text-xs">{r.job}</span> },
    { key: 'ok', header: 'Result', cell: (r) => <StatusBadge status={r.ok ? 'ok' : 'failed'} /> },
    { key: 'started', header: 'Started', cell: (r) => <span className="text-xs">{dateTime(r.startedAt)}</span> },
    { key: 'dur', header: 'Duration', align: 'right', cell: (r) => <span className="tabular-nums">{ms(r.durationMs)}</span> },
    { key: 'error', header: 'Error', className: 'max-w-[360px]', cell: (r) => <span className="block truncate text-xs text-red-600">{r.error || ''}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scheduler"
        description="Background jobs run by the API's built-in scheduler, with run history and missed-run detection."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && !data.enabled && (
        <div className="rounded-md border border-sky-200/70 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          The scheduler is disabled on the instance that answered (ENABLE_SCHEDULER=false). Run history from other instances is still shown.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Registered jobs" icon={<CalendarClock />} loading={isLoading} value={num(jobs.length)} hint={data?.startedAt ? `started ${ago(data.startedAt)}` : ''} />
        <StatCard label="Failing" icon={<XCircle />} tone={failing ? 'danger' : 'success'} loading={isLoading} value={num(failing)} hint="last run failed" />
        <StatCard label="Missed" icon={<AlertTriangle />} tone={missed ? 'warning' : 'success'} loading={isLoading} value={num(missed)} hint="no run for 1.5× interval" />
        <StatCard label="Runs in range" icon={<Timer />} loading={isLoading} value={num(totalRuns)} />
        <StatCard label="Failures in range" icon={<Clock />} tone={totalFailures ? 'warning' : 'neutral'} loading={isLoading} value={num(totalFailures)} />
      </div>

      <Section title="Jobs" description="Manual execution is intentionally not available from the dashboard">
        <DataTable columns={jobColumns} rows={jobs} loading={isLoading} rowKey={(j) => j.name} onRowClick={(j) => setF({ job: j.name })} />
      </Section>

      <Section
        title="Run history"
        description={f.job === 'all' ? 'All jobs' : `Filtered to ${f.job}`}
        action={
          <div className="flex gap-2">
            <Select value={f.job} onValueChange={(job) => setF({ job })}>
              <SelectTrigger size="sm" className="w-56" aria-label="Job">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All jobs</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.name} value={j.name}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={f.ok} onValueChange={(ok) => setF({ ok })}>
              <SelectTrigger size="sm" className="w-28" aria-label="Result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="failed">Failed only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {data && !totalRuns && !data.runs.length ? (
          <NotConfigured title="No runs recorded yet" description="Runs are recorded from now on. The first jobs start a few minutes after the API boots." />
        ) : (
          <DataTable columns={runColumns} rows={data?.runs} loading={isLoading} rowKey={(r) => r._id} onRowClick={setRun} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} />
        )}
      </Section>

      <Sheet open={Boolean(run)} onOpenChange={(o) => !o && setRun(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {run && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-mono text-sm">{run.job}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <StatusBadge status={run.ok ? 'ok' : 'failed'} /> {dateTime(run.startedAt)} · {ms(run.durationMs)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto p-4">
                {run.error && <div className="rounded-md border border-red-200/70 bg-red-50 p-3 text-sm text-red-700">{run.error}</div>}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Result</h4>
                  <JsonView value={run.result ?? null} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Run ID <Mono>{run._id}</Mono> · trigger {run.trigger}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
