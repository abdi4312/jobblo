import { ArrowLeft, Bug, Eye, Globe2, Link2Off, MonitorX, MousePointerClick, PackageX, Server, Terminal, Users } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { SessionProblemKind, SessionReplay, SessionsInfo } from '../../api/developer';
import { useDevSessionReplay, useDevSessions, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const KIND: Record<SessionProblemKind, { label: string; icon: React.ReactNode }> = {
  js_error: { label: 'JS error', icon: <Bug className="size-3.5" /> },
  render: { label: 'Broken screen', icon: <MonitorX className="size-3.5" /> },
  not_found: { label: 'Page not found', icon: <Link2Off className="size-3.5" /> },
  chunk: { label: 'Code failed to load', icon: <PackageX className="size-3.5" /> },
  api: { label: 'API failure', icon: <Server className="size-3.5" /> },
  console: { label: 'Console error', icon: <Terminal className="size-3.5" /> },
};
const STEP_ICON: Record<string, React.ReactNode> = {
  view: <Eye className="size-3.5" />,
  click: <MousePointerClick className="size-3.5" />,
  api: <Globe2 className="size-3.5" />,
  console: <Terminal className="size-3.5" />,
  error: <Bug className="size-3.5" />,
};

function Replay({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading, error, refetch } = useDevSessionReplay(id);
  const t0 = data ? +new Date(data.started) : 0;
  const offset = (at: string) => {
    const s = Math.max(0, Math.round((+new Date(at) - t0) / 1000));
    return s >= 60 ? `+${Math.floor(s / 60)}m ${s % 60}s` : `+${s}s`;
  };
  const row = (x: SessionReplay['timeline'][number], i: number) => {
    const isProblem = x.type === 'problem';
    const failedApi = x.type === 'api' && (x.status === 0 || (x.status ?? 0) >= 500);
    return (
      <li key={i} className={cn('flex list-none items-start gap-2 rounded-md px-2 py-1.5', isProblem && 'border border-red-200 bg-red-50')}>
        <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-[11px] text-muted-foreground tabular-nums">{offset(x.at)}</span>
        <span className={cn('w-4 shrink-0 pt-0.5 text-muted-foreground', isProblem && 'text-red-600', failedApi && 'text-amber-600')}>{isProblem ? KIND[x.kind as SessionProblemKind]?.icon : STEP_ICON[x.type]}</span>
        <div className="min-w-0 flex-1 text-sm">
          {x.type === 'view' && (
            <span>
              Opened <span className="font-mono text-xs">{x.page}</span>
              {x.ms ? <span className="text-xs text-muted-foreground"> · loaded in {x.ms} ms</span> : null}
            </span>
          )}
          {x.type === 'click' && <span>Clicked <span className="font-mono text-xs">{x.label}</span></span>}
          {x.type === 'api' && (
            <span className={cn(failedApi && 'text-amber-700')}>
              <span className="font-mono text-xs">{x.label}</span> → {x.status || 'network error'}
              {x.ms != null && <span className="text-xs text-muted-foreground"> · {x.ms} ms</span>}
            </span>
          )}
          {(x.type === 'console' || x.type === 'error') && <span className="text-muted-foreground">{x.label}</span>}
          {isProblem && (
            <div>
              <Badge variant="outline" className="mr-2 border-red-200 text-red-700">{KIND[x.kind as SessionProblemKind]?.label}</Badge>
              <span className="font-medium text-red-800">{x.label}</span>
              <div className="font-mono text-[11px] text-red-700/80">
                on {x.page}
                {x.source ? ` · ${x.source}` : ''}
              </div>
            </div>
          )}
        </div>
      </li>
    );
  };
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Session replay"
        description={data ? `${data.device} · ${data.browser || 'unknown browser'}${data.connection ? ` · ${data.connection}` : ''}${data.release ? ` · release ${data.release}` : ''} · ${dateTime(data.started)} → ${dateTime(data.ended)}` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft /> Sessions
          </Button>
        }
      />
      <Section title="What happened" description="Pages, clicks (by button/link label — never what was typed), API calls and console output before each problem. Emails, phone numbers and ids are masked in the browser and again on the server.">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <ol className="space-y-0.5">{data?.timeline.map(row)}</ol>}
      </Section>
    </div>
  );
}

export default function SessionsPage() {
  const [f, setF] = useUrlFilters({ days: '7', kind: '', session: '' });
  const { data, isLoading, error, refetch } = useDevSessions(Number(f.days), f.kind);
  if (f.session) return <Replay id={f.session} onBack={() => setF({ session: '' })} />;

  const sessionCols: Column<SessionsInfo['list'][number]>[] = [
    { key: 'w', header: 'When', cell: (s) => <span className="text-xs">{ago(s.last)}</span> },
    { key: 'k', header: 'Problems', cell: (s) => <div className="flex flex-wrap gap-1">{s.kinds.map((k) => <Badge key={k} variant="outline" className="gap-1">{KIND[k]?.icon}{KIND[k]?.label}</Badge>)}</div> },
    { key: 'm', header: 'Last problem', className: 'max-w-[360px]', cell: (s) => <span className="block truncate text-xs">{s.lastMessage}</span> },
    { key: 'p', header: 'Pages', className: 'max-w-[220px]', cell: (s) => <span className="block truncate font-mono text-[11px] text-muted-foreground">{s.pages.join(', ')}</span> },
    { key: 'd', header: 'Device', cell: (s) => <span className="text-xs">{s.device} · {s.browser || '—'}</span> },
  ];
  const groupCols: Column<SessionsInfo['groups'][number]>[] = [
    { key: 'k', header: 'Type', cell: (g) => <Badge variant="outline" className="gap-1">{KIND[g.kind]?.icon}{KIND[g.kind]?.label}</Badge> },
    { key: 'm', header: 'Problem', className: 'max-w-[440px]', cell: (g) => <div className="min-w-0"><div className="truncate text-sm font-medium">{g.message}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{g.pages.join(', ')}</div></div> },
    { key: 's', header: 'Visits hit', align: 'right', cell: (g) => <span className="tabular-nums font-medium">{num(g.sessions)}</span> },
    { key: 'n', header: 'Times', align: 'right', cell: (g) => <span className="tabular-nums">{num(g.n)}</span> },
    { key: 'l', header: 'Last', align: 'right', cell: (g) => <span className="text-xs text-muted-foreground">{ago(g.last)}</span> },
    { key: 'r', header: '', cell: (g) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setF({ session: g.sampleSession }); }}>Replay</Button> },
  ];
  const k = (key: SessionProblemKind) => data?.kinds[key]?.sessions ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sessions"
        description="Web visits that went wrong, with a replay of the steps before it: pages, clicks, API calls and console output. A masked breadcrumb trail — not a screen recording — sent only when something breaks. Anonymous; admin and developer pages are never recorded."
        actions={
          <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
            <TabsList>
              <TabsTrigger value="1">24 h</TabsTrigger>
              <TabsTrigger value="7">7 d</TabsTrigger>
              <TabsTrigger value="30">30 d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Problem-free visits" icon={<Users />} loading={isLoading} tone={data?.problemFree === null || data?.problemFree === undefined ? 'neutral' : data.problemFree >= 99 ? 'success' : data.problemFree >= 95 ? 'warning' : 'danger'} value={data?.problemFree === null || data?.problemFree === undefined ? '—' : `${data.problemFree}%`} hint={data ? `${num(data.affectedSessions)} of ${num(data.sessions)} visits hit a problem` : undefined} />
        <StatCard label="Broken screens" icon={<MonitorX />} loading={isLoading} tone={k('render') + k('chunk') ? 'danger' : 'success'} value={num(data ? k('render') + k('chunk') : undefined)} hint="render crashes + code that failed to load" />
        <StatCard label="Dead links" icon={<Link2Off />} loading={isLoading} tone={k('not_found') ? 'warning' : 'success'} value={num(data ? k('not_found') : undefined)} hint="visits that hit 'page not found'" />
        <StatCard label="API failures" icon={<Server />} loading={isLoading} tone={k('api') ? 'danger' : 'success'} value={num(data ? k('api') : undefined)} hint="visits with a 5xx or network error" />
        <StatCard label="JS / console errors" icon={<Terminal />} loading={isLoading} tone={k('js_error') + k('console') ? 'warning' : 'success'} value={num(data ? k('js_error') + k('console') : undefined)} hint="visits" />
      </div>
      <Tabs value={f.kind || 'all'} onValueChange={(kind) => setF({ kind: kind === 'all' ? '' : kind })}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {(Object.keys(KIND) as SessionProblemKind[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {KIND[key].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {data && !data.sessions ? (
        <EmptyState title="No visits recorded yet" description="The web app reports once this build is deployed." />
      ) : (
        <>
          <Section title="Problems" description="Grouped. 'Replay' opens one visit that hit it.">
            <DataTable columns={groupCols} rows={data?.groups} loading={isLoading} rowKey={(g) => g.fingerprint} emptyTitle="No problems in this period" />
          </Section>
          <Section title="Visits with problems" description="Click a visit to replay it.">
            <DataTable columns={sessionCols} rows={data?.list} loading={isLoading} rowKey={(s) => s.sessionId} onRowClick={(s) => setF({ session: s.sessionId })} emptyTitle="No visit hit a problem" />
          </Section>
        </>
      )}
    </div>
  );
}
