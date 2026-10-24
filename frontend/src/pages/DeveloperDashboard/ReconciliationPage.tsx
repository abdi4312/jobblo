import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, CheckCircle2, Download, Info, Scale } from 'lucide-react';
import { ago, dateTime, downloadCsv, ms, num } from '@/lib/devFormat';
import { useDevReconciliation, useUrlFilters } from '../../features/developer/hooks';
import type { ReconIssue } from '../../api/developer';
import { CountBars, ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];

export default function ReconciliationPage() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ severity: 'all', category: '' });
  const { data, isLoading, isFetching, error, refetch } = useDevReconciliation();
  const rows = useMemo(
    () => (data?.issues || []).filter((i) => (f.severity === 'all' || i.severity === f.severity) && (!f.category || i.category === f.category)),
    [data, f.severity, f.category]
  );

  const columns: Column<ReconIssue>[] = [
    { key: 'sev', header: 'Severity', cell: (i) => <StatusBadge status={i.severity} /> },
    { key: 'cat', header: 'Category', cell: (i) => <span className="font-medium">{i.category.replace(/_/g, ' ')}</span> },
    { key: 'entity', header: 'Record', cell: (i) => <div className="text-xs"><div>{i.entity}</div><div className="font-mono text-muted-foreground">{i.id}</div></div> },
    { key: 'detail', header: 'Detail', className: 'max-w-[420px]', cell: (i) => <span className="block truncate text-xs text-muted-foreground" title={i.detail}>{i.detail}</span> },
    { key: 'at', header: 'Seen', align: 'right', cell: (i) => <span className="text-xs text-muted-foreground">{ago(i.at)}</span> },
  ];

  const b = data?.bySeverity || {};
  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial Reconciliation"
        description="Jobblo's records checked against each other and against Stripe-synced data. Rows with an order open its full job timeline."
        actions={
          <>
            <Button variant="outline" size="sm" className="bg-card" disabled={!rows.length} onClick={() => downloadCsv(`reconciliation-${new Date().toISOString().slice(0, 10)}.csv`, rows as unknown as Record<string, unknown>[])}>
              <Download /> Export report
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Open issues" icon={<Scale />} tone={data?.total ? 'warning' : 'success'} loading={isLoading} value={num(data?.total)} hint={data ? `generated ${ago(data.generatedAt)}` : ''} />
        <StatCard label="Critical" icon={<AlertOctagon />} tone={b.critical ? 'danger' : 'success'} loading={isLoading} value={num(b.critical || 0)} />
        <StatCard label="High" icon={<AlertTriangle />} tone={b.high ? 'warning' : 'neutral'} loading={isLoading} value={num(b.high || 0)} />
        <StatCard label="Medium" icon={<Info />} loading={isLoading} value={num(b.medium || 0)} />
        <StatCard label="Low" icon={<CheckCircle2 />} loading={isLoading} value={num(b.low || 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="By category" description="Click to filter" className="lg:col-span-2">
          <CountBars counts={data?.byCategory || {}} selected={f.category} onSelect={(category) => setF({ category })} />
        </Section>
        <Section title="Reconciliation jobs" description="Latest scheduler runs">
          {data?.lastRuns.length ? (
            <ul className="space-y-2 text-sm">
              {data.lastRuns.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">{r.job}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(r.startedAt)} · {ms(r.durationMs)}</span>
                  </span>
                  <StatusBadge status={r.ok ? 'ok' : 'failed'} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No runs recorded yet (they run daily).</p>
          )}
        </Section>
      </div>

      <Section
        title="Issues"
        description={`${rows.length} shown`}
        action={
          <Select value={f.severity} onValueChange={(severity) => setF({ severity })}>
            <SelectTrigger size="sm" className="w-36 capitalize" aria-label="Severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s === 'all' ? 'All severities' : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          rowKey={(i) => `${i.category}:${i.id}`}
          onRowClick={(i) => i.orderId && navigate(`/developer/jobs?id=${i.orderId}`)}
          emptyTitle="All reconciled"
          emptyDescription="No mismatches between local records, Stripe-synced data and billing operations."
        />
      </Section>
    </div>
  );
}
