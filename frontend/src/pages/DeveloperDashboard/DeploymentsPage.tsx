import { Link } from 'react-router-dom';
import { ExternalLink, GitBranch, GitCommit, Rocket, ShieldAlert, Timer } from 'lucide-react';
import { ago, dateTime, duration, ms, num, pct } from '@/lib/devFormat';
import { useDevDeployments } from '../../features/developer/hooks';
import type { GithubRun } from '../../api/developer';
import { EmptyState, ErrorState, KeyValue, Mono, NotConfigured, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';

const runTone = (r: GithubRun) => (r.status !== 'completed' ? 'processing' : r.conclusion === 'success' ? 'ok' : r.conclusion === 'cancelled' || r.conclusion === 'skipped' ? 'idle' : 'failed');

function Delta({ before, after, unit = '', lowerIsBetter = true }: { before: number | null; after: number | null; unit?: string; lowerIsBetter?: boolean }) {
  if (before == null || after == null) return <span className="text-muted-foreground">—</span>;
  const worse = lowerIsBetter ? after > before : after < before;
  return (
    <span className="tabular-nums">
      {before}
      {unit} → <span className={after === before ? '' : worse ? 'text-red-600' : 'text-emerald-600'}>{after}{unit}</span>
    </span>
  );
}

export default function DeploymentsPage() {
  const { data, isLoading, isFetching, error, refetch } = useDevDeployments();
  const c = data?.current;
  const cmp = data?.comparison;
  const runs = data?.github.runs || [];
  const lastRun = runs[0];

  const columns: Column<GithubRun>[] = [
    { key: 'status', header: 'Result', cell: (r) => <StatusBadge status={runTone(r)} label={r.status === 'completed' ? r.conclusion || 'done' : r.status} /> },
    { key: 'name', header: 'Workflow', className: 'max-w-[360px]', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.title || r.name}</div><div className="text-xs text-muted-foreground">{r.name} · {r.event}</div></div> },
    { key: 'branch', header: 'Branch / commit', cell: (r) => <span className="flex items-center gap-1.5 text-xs"><GitBranch className="size-3" />{r.branch}<Mono>{r.sha}</Mono></span> },
    { key: 'actor', header: 'By', cell: (r) => <span className="text-xs">{r.actor || '—'}</span> },
    { key: 'dur', header: 'Duration', align: 'right', cell: (r) => <span className="tabular-nums">{ms(r.durationMs)}</span> },
    { key: 'at', header: 'Started', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.createdAt)}</span> },
    { key: 'link', header: '', cell: (r) => <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open in GitHub"><ExternalLink className="size-3.5" /></a> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="CI/CD & Deployments"
        description="What is running, what CI built, and whether the current release introduced errors."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Version" icon={<Rocket />} loading={isLoading} value={c?.version || '—'} hint={c?.environment} />
        <StatCard label="Commit" icon={<GitCommit />} loading={isLoading} value={c?.commit ? c.commit.slice(0, 7) : 'unknown'} hint={c?.branch || 'set GIT_COMMIT_SHA / GIT_BRANCH at build'} />
        <StatCard label="Deployed" icon={<Timer />} loading={isLoading} value={c ? ago(c.deployedAt) : '—'} hint={c ? `from ${c.deployedAtSource}` : ''} />
        <StatCard label="New errors since deploy" icon={<ShieldAlert />} tone={data?.newErrors.length ? 'danger' : 'success'} loading={isLoading} value={num(data?.newErrors.length)} hint="error groups first seen after deploy" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Current release">
          {c && (
            <KeyValue
              items={[
                ['Environment', <StatusBadge key="e" status={c.environment} tone={c.environment === 'production' ? 'danger' : 'info'} />],
                ['Deployed at', dateTime(c.deployedAt)],
                ['Node', c.node],
                ['Delivery', c.deliveredBy],
                ['Last CI run', lastRun ? <span key="r" className="flex items-center gap-2"><StatusBadge status={runTone(lastRun)} label={lastRun.conclusion || lastRun.status} />{ago(lastRun.createdAt)}</span> : '—'],
              ]}
            />
          )}
        </Section>
        <Section title="Post-deployment health" description={cmp ? `Same-length window before vs after deploy (${cmp.windowHours}h)` : undefined} className="lg:col-span-2">
          {cmp && (
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ['Errors logged', <Delta key="a" before={cmp.before.errors} after={cmp.after.errors} />],
                ['API 5xx rate', <Delta key="b" before={cmp.before.errorRate} after={cmp.after.errorRate} unit="%" />],
                ['P95 latency', <Delta key="c" before={cmp.before.p95} after={cmp.after.p95} unit="ms" />],
                ['Requests', <span key="d" className="tabular-nums">{num(cmp.before.requests)} → {num(cmp.after.requests)}</span>],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Uptime since deploy: {duration((Date.now() - new Date(c?.deployedAt || Date.now()).getTime()) / 1000)} · rollbacks: {data?.rollback.reason}</p>
        </Section>
      </div>

      <Section title="Errors introduced by this release" description="Error groups whose first occurrence is after the deploy time">
        {data?.newErrors.length ? (
          <ul className="divide-y rounded-md border text-sm">
            {data.newErrors.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.message}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {e.errorCode} · {e.route}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {num(e.count)}× · first {ago(e.firstSeen)}
                </span>
                <Link className="shrink-0 text-xs text-primary hover:underline" to="/developer/errors">
                  Triage
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No new errors" description="Nothing first appeared after this deployment." />
        )}
      </Section>

      <Section title="GitHub Actions" description={data?.github.repo}>
        {!data ? null : !data.github.configured ? (
          <NotConfigured title="GitHub not connected" description={data.github.reason || ''} />
        ) : data.github.error ? (
          <ErrorState error={{ message: data.github.error }} />
        ) : (
          <DataTable columns={columns} rows={runs} rowKey={(r) => String(r.id)} emptyTitle="No workflow runs" />
        )}
        {data && <p className="mt-3 text-xs text-muted-foreground">CI checks backend and frontend tests on pull requests (.github/workflows/ci.yml). Deployment success rate: {runs.length ? pct((runs.filter((r) => r.conclusion === 'success').length / runs.filter((r) => r.status === 'completed').length) * 100 || 0) : '—'}.</p>}
      </Section>
    </div>
  );
}
