import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, Download, HandCoins, Landmark, ShieldCheck, Undo2 } from 'lucide-react';
import { ago, downloadCsv, money, num } from '@/lib/devFormat';
import { useDevSafePay, useUrlFilters } from '../../features/developer/hooks';
import type { SafePayRecord, StuckOrder } from '../../api/developer';
import { CountBars, ErrorState, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default function SafePayPage() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ range: '30d', status: '', page: '1' });
  const { data, isLoading, isFetching, error, refetch } = useDevSafePay({ range: f.range as '30d', status: f.status || undefined, page: f.page });
  const s = data?.summary;
  const open = (orderId: string) => navigate(`/developer/jobs?id=${orderId}`);
  const funded = (s?.byStatus.payment_received || 0) + (s?.byStatus.in_progress || 0) + (s?.byStatus.waiting_connect || 0);
  const critical = (data?.stuck || []).filter((x) => x.issues.some((i) => i.severity === 'critical')).length;

  const stuckColumns: Column<StuckOrder>[] = [
    { key: 'order', header: 'Order', cell: (r) => <span className="font-mono text-xs">{r.orderId}</span> },
    { key: 'status', header: 'State', cell: (r) => <div className="flex gap-1"><StatusBadge status={r.status} /><StatusBadge status={r.paymentStatus} /></div> },
    {
      key: 'issues',
      header: 'Problem',
      cell: (r) => {
        const top = [...r.issues].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])[0];
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusBadge status={top.severity} />
              <span className="font-medium">{top.code.replace(/_/g, ' ')}</span>
              {r.issues.length > 1 && <span className="text-xs text-muted-foreground">+{r.issues.length - 1} more</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{top.detail}</div>
          </div>
        );
      },
      className: 'max-w-[520px]',
    },
    { key: 'updated', header: 'Updated', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.updatedAt)}</span> },
  ];

  const recordColumns: Column<SafePayRecord>[] = [
    { key: 'job', header: 'Job', className: 'max-w-[240px]', cell: (r) => <span className="block truncate">{r.serviceTitle}</span> },
    { key: 'parties', header: 'Customer → Provider', cell: (r) => <span className="text-xs text-muted-foreground">{r.customerId?.name || '—'} → {r.providerId?.name || '—'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'refund', header: 'Refund', cell: (r) => (r.refundStatus === 'none' ? <span className="text-xs text-muted-foreground">—</span> : <StatusBadge status={r.refundStatus} />) },
    { key: 'customer', header: 'Customer paid', align: 'right', cell: (r) => <span className="tabular-nums">{money(r.amounts.totalCustomer)}</span> },
    { key: 'fee', header: 'Fee', align: 'right', cell: (r) => <span className="tabular-nums text-muted-foreground">{money(r.amounts.fee)}</span> },
    { key: 'net', header: 'Provider net', align: 'right', cell: (r) => <span className="tabular-nums">{money(r.amounts.netProvider)}</span> },
    { key: 'mode', header: 'Mode', cell: (r) => (r.stripeLivemode === undefined || r.stripeLivemode === null ? '—' : <StatusBadge status={r.stripeLivemode ? 'live' : 'test'} />) },
    { key: 'at', header: 'Created', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="SafePay"
        description="Escrow lifecycle, money split, stuck-transaction detection and Stripe-vs-database checks. Click any row for the full job timeline."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button variant="outline" size="sm" className="bg-card" disabled={!data?.stuck.length} onClick={() => downloadCsv('safepay-stuck.csv', (data?.stuck || []).map((r) => ({ orderId: r.orderId, status: r.status, paymentStatus: r.paymentStatus, issues: r.issues.map((i) => `${i.severity}:${i.code}`).join(' | '), updatedAt: r.updatedAt })))}>
              <Download /> Export stuck
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="SafePay jobs" icon={<ShieldCheck />} loading={isLoading} value={num(Object.values(s?.byStatus || {}).reduce((a, b) => a + b, 0))} hint="in range" />
        <StatCard label="Funds held" icon={<Landmark />} tone="info" loading={isLoading} value={num(funded)} hint="paid, not yet released" />
        <StatCard label="Customer paid" icon={<Banknote />} loading={isLoading} value={money(s?.amounts?.customer)} hint={`fees ${money(s?.amounts?.fee)}`} />
        <StatCard label="Provider net" icon={<HandCoins />} loading={isLoading} value={money(s?.amounts?.provider)} />
        <StatCard label="Refunded" icon={<Undo2 />} loading={isLoading} value={money(s?.amounts?.refunded)} hint={`${num(s?.byStatus.refunded)} refunded jobs`} />
        <StatCard label="Stuck / inconsistent" icon={<AlertTriangle />} tone={critical ? 'danger' : data?.stuck.length ? 'warning' : 'success'} loading={isLoading} value={num(data?.stuck.length)} hint={`${critical} critical`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Lifecycle status" description="Click to filter the records below">
          <CountBars counts={s?.byStatus || {}} selected={f.status} onSelect={(status) => setF({ status })} />
        </Section>
        <Section title="Refund states">
          <CountBars counts={s?.byRefund || {}} />
        </Section>
        <Section title="Connect-timeout refunds" description="Order.providerConnectTimeout, all time">
          <CountBars counts={s?.timeoutStates || {}} />
        </Section>
      </div>

      <Section
        title="Stuck & inconsistent transactions"
        description={data ? `Same rules as the scheduler: review auto-release after ${data.rules.autoReleaseDays}d, abandoned checkout after ${data.rules.abandonedOrderHours}h, 5-min payout lock lease` : undefined}
      >
        <DataTable columns={stuckColumns} rows={data?.stuck} loading={isLoading} rowKey={(r) => r.orderId} onRowClick={(r) => open(r.orderId)} emptyTitle="Nothing stuck" emptyDescription="Every scanned SafePay order passes the health rules." />
      </Section>

      <Section title="SafePay records" description={f.status ? `Filtered: ${f.status.replace(/_/g, ' ')}` : 'All statuses'}>
        <DataTable columns={recordColumns} rows={data?.records} loading={isLoading} rowKey={(r) => r._id} onRowClick={(r) => open(r.orderId)} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} />
      </Section>
    </div>
  );
}
