import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Banknote, Briefcase, CreditCard, HelpCircle, Users } from 'lucide-react';
import { ago, dateTime, money, num } from '@/lib/devFormat';
import type { ImpactDetail, ImpactNumbers, ImpactOverview } from '../../api/developer';
import { useDevUserImpact, useDevUserImpactScope, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const SOURCE: Record<string, { label: string; to: (id: string) => string }> = {
  error: { label: 'Errors', to: () => '/developer/errors' },
  incident: { label: 'Incident', to: (id) => `/developer/incidents?id=${id}` },
  release: { label: 'Deployment impact', to: (id) => `/developer/deployment-impact?id=${id}` },
};

function Headline({ n }: { n: ImpactNumbers }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      <b className="text-foreground">{num(n.users)}</b> users · <b className="text-foreground">{num(n.jobs)}</b> jobs · {money(n.jobValueNok)}
    </span>
  );
}

function Detail({ q, onBack }: { q: Record<string, string>; onBack: () => void }) {
  const { data, isLoading, error, refetch } = useDevUserImpactScope(q, true);
  const peopleCols: Column<ImpactDetail['people'][number]>[] = [
    { key: 'n', header: 'User', cell: (u) => <Link to={`/developer/users?id=${u.id}`} className="font-medium text-primary hover:underline">{u.name}</Link> },
    { key: 'e', header: 'Email', cell: (u) => <span className="font-mono text-xs">{u.email}</span> },
    { key: 'r', header: 'Role', cell: (u) => <span className="text-xs">{u.role}</span> },
    { key: 'h', header: 'How', cell: (u) => <Badge variant="outline">{u.how === 'direct' ? 'hit the error' : 'on an affected job'}</Badge> },
    { key: 'c', header: 'Errors seen', align: 'right', cell: (u) => <span className="tabular-nums">{u.hits || '—'}</span> },
  ];
  const jobCols: Column<ImpactDetail['jobRows'][number]>[] = [
    { key: 'i', header: 'Job', cell: (j) => <Link to={`/developer/jobs?id=${j.id}`} className="font-mono text-xs text-primary hover:underline">{j.id.slice(-8).toUpperCase()}</Link> },
    { key: 's', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
    { key: 'p', header: 'Payment', cell: (j) => <span className="text-xs">{j.paymentStatus || '—'}</span> },
    { key: 'v', header: 'Value', align: 'right', cell: (j) => <span className="tabular-nums">{money(j.valueNok)}</span> },
    { key: 't', header: '', cell: (j) => <Link to={`/developer/transactions?id=${j.id}`} className="text-xs text-primary hover:underline">Trace journey</Link> },
  ];
  const payCols: Column<ImpactDetail['paymentRows'][number]>[] = [
    { key: 'o', header: 'Job', cell: (p) => <Link to={`/developer/ledger?order=${p.orderId}`} className="font-mono text-xs text-primary hover:underline">{p.orderId.slice(-8).toUpperCase()}</Link> },
    { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'r', header: 'Refund', cell: (p) => <span className="text-xs">{p.refundStatus && p.refundStatus !== 'none' ? p.refundStatus : '—'}</span> },
    { key: 'a', header: 'Amount', align: 'right', cell: (p) => <span className="tabular-nums">{money(p.amountNok)}</span> },
    { key: 'c', header: 'Created', align: 'right', cell: (p) => <span className="text-xs text-muted-foreground">{dateTime(p.createdAt)}</span> },
  ];
  const src = SOURCE[q.kind];

  return (
    <div className="space-y-5">
      <PageHeader
        title={data?.label || 'User impact'}
        description={data ? `${dateTime(data.from)} → ${dateTime(data.to)} · ${num(data.occurrences)} error occurrences${data.sampled ? ' (first 5,000 analysed)' : ''}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft /> Overview
            </Button>
            {src && q.id && (
              <Button variant="outline" size="sm" asChild>
                <Link to={src.to(q.id)}>
                  {src.label} <ArrowUpRight />
                </Link>
              </Button>
            )}
          </div>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Users affected" icon={<Users />} loading={isLoading} tone={data?.users ? 'warning' : 'success'} value={num(data?.users)} hint={data ? `${data.usersDirect} hit it · ${data.usersViaJob} via a job` : undefined} />
        <StatCard label="Jobs affected" icon={<Briefcase />} loading={isLoading} value={num(data?.jobs)} />
        <StatCard label="Payments" icon={<CreditCard />} loading={isLoading} value={num(data?.payments)} />
        <StatCard label="Money on those jobs" icon={<Banknote />} loading={isLoading} value={money(data?.jobValueNok)} hint={data ? `${money(data.capturedNok)} captured` : undefined} />
        <StatCard label="Unattributed" icon={<HelpCircle />} loading={isLoading} value={num(data?.unattributed)} hint="no user or job in the log" />
      </div>
      {data && !data.occurrences && !data.jobs ? (
        <EmptyState title="Nobody was affected" description="No error occurrences matched this scope." />
      ) : (
        <>
          <Section title="Users" description="'Hit the error' = signed-in user on the failing request. 'On an affected job' = customer or provider of a job named in the error.">
            <DataTable columns={peopleCols} rows={data?.people} loading={isLoading} rowKey={(u) => u.id} emptyTitle="No users could be attributed" />
          </Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Jobs">
              <DataTable columns={jobCols} rows={data?.jobRows} loading={isLoading} rowKey={(j) => j.id} emptyTitle="No jobs named in these errors" />
            </Section>
            <Section title="Payments">
              <DataTable columns={payCols} rows={data?.paymentRows} loading={isLoading} rowKey={(p) => p.id} emptyTitle="No payments on these jobs" />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

export default function ImpactPage() {
  const [f, setF] = useUrlFilters({ days: '7', kind: '', id: '', from: '', to: '' });
  const [win, setWin] = useState({ from: '', to: '' });
  const { data, isLoading, error, refetch } = useDevUserImpact(Number(f.days));
  if (f.kind) {
    const q: Record<string, string> = { kind: f.kind };
    if (f.id) q.id = f.id;
    if (f.from) q.from = f.from;
    if (f.to) q.to = f.to;
    return <Detail q={q} onBack={() => setF({ kind: '', id: '', from: '', to: '' })} />;
  }
  const open = (kind: string, id: string) => setF({ kind, id });

  const errCols: Column<ImpactOverview['errors'][number]>[] = [
    { key: 'm', header: 'Error', className: 'max-w-[420px]', cell: (e) => <div className="min-w-0"><div className="truncate font-medium">{e.message || e.errorCode}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{e.errorCode} · {e.route || 'no route'}</div></div> },
    { key: 's', header: 'Severity', cell: (e) => <StatusBadge status={e.severity} /> },
    { key: 'u', header: 'Users hit', align: 'right', cell: (e) => <span className="tabular-nums font-medium">{num(e.users)}</span> },
    { key: 'j', header: 'Jobs named', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.jobs)}</span> },
    { key: 'n', header: 'Occurrences', align: 'right', cell: (e) => <span className="tabular-nums">{num(e.occurrences)}</span> },
    { key: 'l', header: 'Last', align: 'right', cell: (e) => <span className="text-xs text-muted-foreground">{ago(e.last)}</span> },
  ];
  const incCols: Column<ImpactOverview['incidents'][number]>[] = [
    { key: 't', header: 'Incident', cell: (i) => <span className="font-medium">{i.title}</span> },
    { key: 's', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
    { key: 'i', header: 'Impact', cell: (i) => (i.impact ? <Headline n={i.impact} /> : '—') },
    { key: 'd', header: 'Started', align: 'right', cell: (i) => <span className="text-xs text-muted-foreground">{ago(i.startedAt)}</span> },
  ];
  const relCols: Column<ImpactOverview['releases'][number]>[] = [
    { key: 'v', header: 'Release', cell: (r) => <span className="font-medium">{r.version} <span className="font-mono text-[11px] text-muted-foreground">{r.commit?.slice(0, 7)}</span></span> },
    { key: 'i', header: 'Impact of new errors', cell: (r) => (r.impact ? <Headline n={r.impact} /> : '—') },
    { key: 'o', header: 'New error hits', align: 'right', cell: (r) => <span className="tabular-nums">{num(r.impact?.occurrences)}</span> },
    { key: 'd', header: 'Deployed', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.deployedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Impact"
        description="Who an error, incident or release actually hurt: signed-in users on failing requests, plus the customers and providers of every job named in the errors, with the payments and money on those jobs. Rows with no user or job are counted as unattributed, never guessed."
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
      <Section title="Analyze a time window" description="Everything that failed between two moments (max 31 days), e.g. an outage someone reported.">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (win.from) setF({ kind: 'window', id: '', from: new Date(win.from).toISOString(), to: win.to ? new Date(win.to).toISOString() : '' });
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <Input type="datetime-local" required value={win.from} onChange={(e) => setWin({ ...win, from: e.target.value })} className="w-56" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To (empty = now)
            <Input type="datetime-local" value={win.to} onChange={(e) => setWin({ ...win, to: e.target.value })} className="w-56" />
          </label>
          <Button type="submit" size="sm">Analyze</Button>
        </form>
      </Section>
      <Section title="Errors by people affected" description="Error groups ranked by distinct signed-in users hit, then by jobs named. Open one for the full list.">
        <DataTable columns={errCols} rows={data?.errors} loading={isLoading} rowKey={(e) => e.id} onRowClick={(e) => open('error', e.id)} emptyTitle="No errors in this period" />
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Incidents">
          <DataTable columns={incCols} rows={data?.incidents} loading={isLoading} rowKey={(i) => i.id} onRowClick={(i) => open('incident', i.id)} emptyTitle="No incidents" />
        </Section>
        <Section title="Releases" description="Only error groups first seen after the release count against it.">
          <DataTable columns={relCols} rows={data?.releases} loading={isLoading} rowKey={(r) => r.id} onRowClick={(r) => open('release', r.id)} emptyTitle="No recorded releases" />
        </Section>
      </div>
    </div>
  );
}
