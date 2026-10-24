import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, Banknote, CheckCircle2, CreditCard, Search, Undo2 } from 'lucide-react';
import { ago, money, num } from '@/lib/devFormat';
import { useDevPayments, useUrlFilters } from '../../features/developer/hooks';
import type { FinancialOp, PaymentRow } from '../../api/developer';
import { CountBars, ErrorState, Mono, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Input } from '../../components/developer/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ range: '30d', status: '', refund: '', mode: 'all', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const { data, isLoading, isFetching, error, refetch } = useDevPayments({
    range: f.range as '30d',
    status: f.status || undefined,
    refund: f.refund || undefined,
    mode: f.mode === 'all' ? undefined : f.mode,
    q: f.q || undefined,
    page: f.page,
  });
  const s = data?.summary;
  const openIncidents = (data?.incidents || []).filter((i) => i.status === 'manual_review').reduce((a, i) => a + i.count, 0);
  const disputes = (data?.incidents || []).filter((i) => i.kind === 'charge_dispute').reduce((a, i) => a + i.count, 0);
  const duplicates = (data?.incidents || []).filter((i) => i.kind === 'duplicate_payment').reduce((a, i) => a + i.count, 0);

  const columns: Column<PaymentRow>[] = [
    {
      key: 'pi',
      header: 'PaymentIntent',
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-xs">{p.stripePaymentIntentId || '—'}</div>
          <div className="truncate text-[11px] text-muted-foreground">order {p.orderId?._id || '—'}</div>
        </div>
      ),
      className: 'max-w-[260px]',
    },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'refund', header: 'Refund', cell: (p) => (p.refundStatus === 'none' ? <span className="text-xs text-muted-foreground">—</span> : <StatusBadge status={p.refundStatus} />) },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <span className="tabular-nums">{p.capturedAmountMinor ? money(p.capturedAmountMinor, true) : money(p.amount)}</span> },
    { key: 'refunded', header: 'Refunded', align: 'right', cell: (p) => <span className="tabular-nums text-muted-foreground">{p.refundedAmountMinor ? money(p.refundedAmountMinor, true) : '—'}</span> },
    { key: 'parties', header: 'Customer → Provider', cell: (p) => <span className="text-xs text-muted-foreground">{p.orderId?.customerId?.name || '—'} → {p.orderId?.providerId?.name || '—'}</span> },
    { key: 'order', header: 'Order state', cell: (p) => (p.orderId ? <StatusBadge status={p.orderId.status} /> : '—') },
    { key: 'mode', header: 'Mode', cell: (p) => (p.stripeLivemode === null ? '—' : <StatusBadge status={p.stripeLivemode ? 'live' : 'test'} />) },
    { key: 'at', header: 'Created', align: 'right', cell: (p) => <span className="text-xs text-muted-foreground">{ago(p.createdAt)}</span> },
  ];

  const opColumns: Column<FinancialOp>[] = [
    { key: 'type', header: 'Operation', cell: (o) => <span className="font-medium">{o.type.replace(/_/g, ' ')}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (o) => <span className="tabular-nums">{money(o.amount, true)}</span> },
    { key: 'err', header: 'Error', cell: (o) => <span className="text-xs text-red-600">{o.lastErrorCode || o.lastErrorMessage || '—'}</span> },
    { key: 'key', header: 'Idempotency key', cell: (o) => <Mono>{o.operationKey}</Mono> },
    { key: 'at', header: 'Updated', align: 'right', cell: (o) => <span className="text-xs text-muted-foreground">{ago(o.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stripe Payments"
        description="Payment records, refunds, incidents and failed financial operations. Capture and refund actions stay with Super Admin."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Payments" icon={<CreditCard />} loading={isLoading} value={num(s?.count)} hint={`${num(s?.mode.live)} live · ${num(s?.mode.test)} test`} />
        <StatCard label="Gross volume" icon={<Banknote />} loading={isLoading} value={money(s?.gross)} />
        <StatCard label="Succeeded" icon={<CheckCircle2 />} tone="success" loading={isLoading} value={num((s?.byStatus.completed || 0) + (s?.byStatus.released || 0))} hint="completed + released" />
        <StatCard label="Refunded" icon={<Undo2 />} loading={isLoading} value={money(s?.refunded)} hint={`${num((s?.byStatus.refunded || 0) + (s?.byStatus.partially_refunded || 0))} payments`} />
        <StatCard label="Disputes" icon={<AlertOctagon />} tone={disputes ? 'danger' : 'neutral'} loading={isLoading} value={num(disputes)} hint={`${num(s ? s.byStatus.disputed || 0 : undefined)} payments disputed`} />
        <StatCard label="Needs review" icon={<AlertOctagon />} tone={openIncidents ? 'warning' : 'success'} loading={isLoading} value={num(openIncidents)} hint={`${num(duplicates)} duplicate payments`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Payment status" description="Click to filter">
          <CountBars counts={s?.byStatus || {}} selected={f.status} onSelect={(status) => setF({ status })} />
        </Section>
        <Section title="Refund status" description="Click to filter">
          <CountBars counts={s?.byRefund || {}} selected={f.refund} onSelect={(refund) => setF({ refund })} />
        </Section>
        <Section title="Stripe incidents" description="Disputes, refunds, duplicates and unmatched events">
          <CountBars counts={Object.fromEntries((data?.incidents || []).map((i) => [`${i.kind} (${i.status === 'manual_review' ? 'review' : 'done'})`, i.count]))} />
        </Section>
      </div>

      {data && data.failedOperations.length > 0 && (
        <Section title="Failed financial operations" description="Refunds and transfer reversals that did not complete">
          <DataTable columns={opColumns} rows={data.failedOperations} rowKey={(o) => o._id} onRowClick={(o) => o.orderId && navigate(`/developer/jobs?id=${o.orderId}`)} />
        </Section>
      )}

      <Section
        title="Payments"
        action={
          <div className="flex flex-wrap gap-2">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                setF({ q: search.trim() });
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="pi_, cs_, re_, order or user ID" className="h-7 w-60 pl-7 text-xs" aria-label="Search payments" />
            </form>
            <Select value={f.mode} onValueChange={(mode) => setF({ mode })}>
              <SelectTrigger size="sm" className="w-28" aria-label="Mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={data?.payments}
          loading={isLoading}
          rowKey={(p) => p._id}
          onRowClick={(p) => p.orderId && navigate(`/developer/jobs?id=${p.orderId._id}`)}
          pagination={data?.pagination}
          onPageChange={(p) => setF({ page: String(p) })}
          emptyTitle="No payments match"
        />
      </Section>
    </div>
  );
}
