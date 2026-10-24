import { AlertTriangle, CheckCircle2, CircleX, ExternalLink, FlaskConical, GitBranch, Repeat, ShieldCheck } from 'lucide-react';
import { ago, dateTime, duration, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { QualityInfo } from '../../api/developer';
import { useDevQuality, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const STATE_ICON = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  warn: <AlertTriangle className="size-4 text-amber-600" />,
  fail: <CircleX className="size-4 text-red-600" />,
};
const VERDICT = {
  clear: { text: 'Release clear', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  warning: { text: 'Release allowed, with warnings', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  blocked: { text: 'Release blocked', className: 'border-red-200 bg-red-50 text-red-800' },
};

export default function QualityPage() {
  const [f, setF] = useUrlFilters({ days: '30' });
  const { data, isLoading, error, refetch } = useDevQuality(Number(f.days));
  const backend = data?.suites.find((s) => s.suite === 'backend');

  const runCols: Column<QualityInfo['runs'][number]>[] = [
    { key: 's', header: '', cell: (r) => (r.failed ? STATE_ICON.fail : STATE_ICON.pass) },
    { key: 'a', header: 'When', cell: (r) => <span className="text-xs">{dateTime(r.at)}</span> },
    { key: 'su', header: 'Suite', cell: (r) => <Badge variant="outline">{r.suite}{r.source === 'local' ? ' · local' : ''}</Badge> },
    { key: 'b', header: 'Branch / commit', cell: (r) => <span className="font-mono text-xs">{r.branch || '—'} {r.sha ? `· ${r.sha.slice(0, 7)}` : ''}</span> },
    { key: 't', header: 'Tests', align: 'right', cell: (r) => <span className="tabular-nums">{num(r.passed)}/{num(r.tests)}</span> },
    { key: 'f', header: 'Failed', align: 'right', cell: (r) => <span className={cn('tabular-nums', r.failed && 'font-medium text-red-600')}>{r.failed || '—'}</span> },
    { key: 'c', header: 'Coverage', align: 'right', cell: (r) => <span className="tabular-nums">{r.coverage?.lines != null ? `${r.coverage.lines}%` : '—'}</span> },
    { key: 'd', header: 'Time', align: 'right', cell: (r) => <span className="text-xs tabular-nums">{r.durationMs ? duration(Math.round(r.durationMs / 1000)) : '—'}</span> },
    { key: 'u', header: '', cell: (r) => (r.ciUrl ? <a href={r.ciUrl} target="_blank" rel="noreferrer" className="text-primary" aria-label="Open CI run"><ExternalLink className="size-3.5" /></a> : null) },
  ];
  const failingCols: Column<QualityInfo['failing'][number]>[] = [
    { key: 't', header: 'Test', className: 'max-w-[520px]', cell: (x) => <div className="min-w-0"><div className="truncate font-medium">{x.title}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{x.file}</div>{x.message && <div className="truncate font-mono text-[11px] text-red-700">{x.message.split('\n')[0]}</div>}</div> },
    { key: 'n', header: 'Failures', align: 'right', cell: (x) => <span className="tabular-nums font-medium">{x.count}</span> },
    { key: 'b', header: 'Branches', cell: (x) => <span className="font-mono text-[11px]">{x.branches.join(', ') || '—'}</span> },
    { key: 'l', header: 'Last', align: 'right', cell: (x) => <span className="text-xs text-muted-foreground">{ago(x.lastAt)}</span> },
  ];
  const ciCols: Column<QualityInfo['ci']['runs'][number]>[] = [
    { key: 's', header: '', cell: (r) => <StatusBadge status={r.status === 'completed' ? r.conclusion || 'unknown' : r.status} /> },
    { key: 'n', header: 'Workflow', className: 'max-w-[360px]', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.name} · {r.event}</div></div> },
    { key: 'b', header: 'Branch', cell: (r) => <span className="font-mono text-xs">{r.branch} · {r.sha}</span> },
    { key: 'a', header: 'Attempt', align: 'right', cell: (r) => <span className={cn('tabular-nums', r.attempt > 1 && 'font-medium text-amber-600')}>{r.attempt}</span> },
    { key: 'd', header: 'Took', align: 'right', cell: (r) => <span className="text-xs tabular-nums">{r.durationMs ? duration(Math.round(r.durationMs / 1000)) : '—'}</span> },
    { key: 'w', header: 'When', align: 'right', cell: (r) => <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{ago(r.createdAt)}</a> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Test & Quality"
        description="Test results reported by CI (failures, flaky tests, coverage trend), GitHub Actions checks, and the gates that decide whether the current state may be released."
        actions={
          <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
            <TabsList>
              <TabsTrigger value="7">7 d</TabsTrigger>
              <TabsTrigger value="30">30 d</TabsTrigger>
              <TabsTrigger value="90">90 d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && (
        <div className={cn('rounded-lg border p-4', VERDICT[data.verdict].className)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="size-5" /> {VERDICT[data.verdict].text}
            </div>
            {!data.ingestEnabled && <span className="text-xs">Test reporting is off — set QUALITY_INGEST_TOKEN here and the QUALITY_REPORT_URL / QUALITY_INGEST_TOKEN secrets in GitHub.</span>}
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 md:grid-cols-2">
            {data.gates.map((g) => (
              <li key={g.key} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">{STATE_ICON[g.state]}</span>
                <span>
                  <span className="font-medium">{g.label}</span>
                  {g.blocking ? '' : <span className="text-xs opacity-70"> (advisory)</span>} — <span className="opacity-80">{g.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Backend tests" icon={<FlaskConical />} loading={isLoading} tone={backend ? (backend.latest.failed ? 'danger' : 'success') : 'neutral'} value={backend ? `${num(backend.latest.passed)}/${num(backend.latest.tests)}` : '—'} hint={backend ? `latest ${backend.latest.branch || ''} · ${ago(backend.latest.at)}` : 'no run reported'} />
        <StatCard label="Coverage (lines)" icon={<CheckCircle2 />} loading={isLoading} value={backend?.latest.coverage?.lines != null ? `${backend.latest.coverage.lines}%` : '—'} hint={backend?.coverageDelta != null ? `${backend.coverageDelta >= 0 ? '+' : ''}${backend.coverageDelta} pt vs previous` : 'functions / branches in the chart'} />
        <StatCard label="Run pass rate" icon={<GitBranch />} loading={isLoading} tone={backend && backend.passRate < 90 ? 'warning' : 'success'} value={backend ? `${backend.passRate}%` : '—'} hint={backend ? `${backend.runs} runs` : undefined} />
        <StatCard label="Flaky tests" icon={<Repeat />} loading={isLoading} tone={data?.flaky.length ? 'warning' : 'success'} value={num(data?.flaky.length)} hint="failed and passed on one commit" />
        <StatCard label="CI success" icon={<ShieldCheck />} loading={isLoading} tone={data?.ci.successRate == null ? 'neutral' : data.ci.successRate >= 90 ? 'success' : 'warning'} value={data?.ci.successRate == null ? '—' : `${data.ci.successRate}%`} hint={data?.ci.configured ? `${data.ci.reruns} re-runs in the last 25` : 'GitHub not connected'} />
      </div>

      {data && !data.runs.length ? (
        <EmptyState title="No test runs reported yet" description="CI sends them after each backend run once the secrets are set; locally: npm run test:quality, then node scripts/quality-report.js backend jest-results.json coverage/coverage-summary.json" />
      ) : (
        <>
          <Section title="Coverage trend" description="Line, branch and function coverage per reported run.">
            <TimeSeriesChart
              data={data?.coverage.map((c) => ({ t: c.t, lines: c.lines, branches: c.branches, functions: c.functions }))}
              height={200}
              series={[
                { key: 'lines', label: 'Lines %', color: 'var(--chart-1)' },
                { key: 'branches', label: 'Branches %', color: 'var(--chart-2)' },
                { key: 'functions', label: 'Functions %', color: 'var(--chart-4)' },
              ]}
            />
          </Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Failing tests" description="Most often failing across reported runs.">
              <DataTable columns={failingCols} rows={data?.failing} loading={isLoading} rowKey={(x) => x.id} emptyTitle="No test failed in this period" />
            </Section>
            <Section title="Flaky tests" description="Failed in one run and passed in another on the same commit — the code did not change, the result did.">
              {data?.flaky.length ? (
                <ul className="divide-y text-sm">
                  {data.flaky.map((x) => (
                    <li key={x.id} className="py-2">
                      <div className="font-medium">{x.id}</div>
                      <div className="text-xs text-muted-foreground">{x.flips} commit(s) · last {ago(x.lastAt)} · {x.shas.map((s) => s.slice(0, 7)).join(', ')}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None detected. A flaky test shows up after a re-run of the same commit.</p>
              )}
            </Section>
          </div>
          <Section title="Test runs">
            <DataTable columns={runCols} rows={data?.runs} loading={isLoading} rowKey={(r) => r._id} />
          </Section>
          {backend?.latest.slowest?.length ? (
            <Section title="Slowest test files (latest backend run)">
              <ul className="divide-y text-sm">
                {backend.latest.slowest.map((s) => (
                  <li key={s.file} className="flex justify-between py-1.5">
                    <span className="font-mono text-xs">{s.file}</span>
                    <span className="tabular-nums text-muted-foreground">{(s.durationMs / 1000).toFixed(1)} s</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
      <Section title="CI checks (GitHub Actions)" description={data?.ci.configured ? 'Last 25 workflow runs. Attempt > 1 = someone re-ran it.' : data?.ci.reason || undefined}>
        <DataTable columns={ciCols} rows={data?.ci.runs} loading={isLoading} rowKey={(r) => String(r.id)} emptyTitle={data?.ci.configured ? 'No workflow runs' : 'GitHub not connected'} />
      </Section>
    </div>
  );
}
