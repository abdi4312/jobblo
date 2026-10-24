import { useState } from 'react';
import { AlertTriangle, CalendarClock, CircleSlash, RefreshCcw, Repeat, Search, Users } from 'lucide-react';
import { ago, dateTime, money, num } from '@/lib/devFormat';
import { useDevSubscription, useDevSubscriptions, useUrlFilters } from '../../features/developer/hooks';
import type { BillingOp, SubscriptionRow } from '../../api/developer';
import { CountBars, ErrorState, KeyValue, Mono, PageHeader, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

function SubscriptionSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useDevSubscription(id || undefined);
  const s = data?.subscription;
  const target = s?.pendingPlanChange?.targetPlanId;
  const events = s
    ? [
        ...(s.planHistory || []).map((h) => ({ at: h.effectiveAt, source: 'plan', title: `${h.changeType}: ${h.planName}`, detail: `${money(h.planPrice)}${h.operationId ? ` · ${h.operationId}` : ''}`, tone: 'info' as const })),
        ...(s.recoveryHistory || []).map((r) => ({ at: r.at, source: 'recovery', title: r.action.replace(/_/g, ' '), detail: r.invoiceId, tone: r.action.includes('reconciliation') ? ('danger' as const) : ('warning' as const) })),
        ...(data?.operations || []).map((o) => ({ at: o.createdAt || o.updatedAt, source: 'billing op', title: `${o.operationType} ${o.status}`, detail: o.lastErrorCode || o.operationId, tone: o.status === 'succeeded' ? ('success' as const) : o.status === 'pending' ? ('info' as const) : ('danger' as const) })),
      ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    : [];

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{s ? `${s.userId?.name || 'User'} · ${s.planId?.name || s.planType}` : 'Loading…'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {s && (
              <>
                <StatusBadge status={s.status} />
                <StatusBadge status={s.stripeMode} />
                {s.paymentRecoveryStatus !== 'none' && <StatusBadge status={s.paymentRecoveryStatus} label={`recovery ${s.paymentRecoveryStatus}`} />}
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        {isLoading || !s ? (
          <Skeleton className="m-4 h-60" />
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {data!.duplicates.length > 0 && (
              <div className="rounded-md border border-red-200/70 bg-red-50 p-3 text-sm text-red-700">
                Possible duplicate operations: {data!.duplicates.map((d) => `${d.key} ×${d.count}`).join(', ')}
              </div>
            )}
            <KeyValue
              items={[
                ['Stripe subscription', <Mono key="s">{s.stripeSubscriptionId}</Mono>],
                ['Stripe customer', <Mono key="c">{s.stripeCustomerId}</Mono>],
                ['Jobblo subscription', <Mono key="j">{s._id}</Mono>],
                ['Auto-renew', s.autoRenew ? 'on' : 'off'],
                ['Current period ends', dateTime(s.currentPeriodEnd)],
                ['Next renewal', dateTime(s.nextRenewalAt)],
                ['Cancellation effective', dateTime(s.cancellationEffectiveAt)],
                ['Grace period ends', dateTime(s.gracePeriodEndsAt)],
                ['Pending plan change', s.pendingPlanChange ? `${typeof target === 'object' ? target?.name : s.pendingPlanChange.targetPlanType} on ${dateTime(s.pendingPlanChange.effectiveAt)}` : '—'],
              ]}
            />
            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Activity ({events.length})</TabsTrigger>
                <TabsTrigger value="ops">Billing operations ({data!.operations.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="pt-3">
                <Timeline events={events} />
              </TabsContent>
              <TabsContent value="ops" className="pt-3">
                <ul className="divide-y rounded-md border text-sm">
                  {data!.operations.map((o) => (
                    <li key={o._id} className="space-y-0.5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <StatusBadge status={o.status} />
                          <span className="font-medium">{o.operationType.replace(/_/g, ' ')}</span>
                          {o.targetPlanId?.name && <span className="text-xs text-muted-foreground">→ {o.targetPlanId.name}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{ago(o.updatedAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Mono>{o.operationId}</Mono>
                        {o.attempts > 1 && <span>{o.attempts} attempts</span>}
                        {(o.lastErrorCode || o.lastErrorMessage) && <span className="text-red-600">{o.lastFailureStage ? `${o.lastFailureStage}: ` : ''}{o.lastErrorCode || o.lastErrorMessage}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SubscriptionsPage() {
  const [f, setF] = useUrlFilters({ status: '', recovery: '', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevSubscriptions({ status: f.status || undefined, recovery: f.recovery || undefined, q: f.q || undefined, page: f.page });
  const s = data?.summary;
  const problems = data?.operations.problems || [];
  const reconRequired = problems.filter((p) => p.status === 'reconciliation_required').length;

  const columns: Column<SubscriptionRow>[] = [
    { key: 'user', header: 'User', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.userId?.name || '—'}</div><div className="truncate text-xs text-muted-foreground">{r.userId?.email}</div></div> },
    { key: 'plan', header: 'Plan', cell: (r) => <span>{r.planId?.name || r.planType}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'recovery', header: 'Recovery', cell: (r) => (r.paymentRecoveryStatus === 'none' ? <span className="text-xs text-muted-foreground">—</span> : <StatusBadge status={r.paymentRecoveryStatus} />) },
    { key: 'renew', header: 'Auto-renew', cell: (r) => <span className="text-xs">{r.autoRenew ? 'on' : 'off'}</span> },
    { key: 'next', header: 'Next billing', cell: (r) => <span className="text-xs text-muted-foreground">{r.nextRenewalAt ? dateTime(r.nextRenewalAt) : '—'}</span> },
    { key: 'change', header: 'Pending change', cell: (r) => (r.pendingPlanChange ? <StatusBadge status="pending" label={`→ ${r.pendingPlanChange.targetPlanType}`} /> : <span className="text-xs text-muted-foreground">—</span>) },
    { key: 'mode', header: 'Mode', cell: (r) => <StatusBadge status={r.stripeMode} /> },
  ];

  const opColumns: Column<BillingOp>[] = [
    { key: 'type', header: 'Operation', cell: (o) => <span className="font-medium">{o.operationType.replace(/_/g, ' ')}</span> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { key: 'user', header: 'User', cell: (o) => <span className="text-xs">{o.userId?.name || '—'}</span> },
    { key: 'err', header: 'Diagnosis', className: 'max-w-[380px]', cell: (o) => <span className="block truncate text-xs text-red-600">{[o.lastFailureStage, o.lastErrorCode, o.lastErrorMessage].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (o) => <span className="tabular-nums">{o.attempts}</span> },
    { key: 'at', header: 'Updated', align: 'right', cell: (o) => <span className="text-xs text-muted-foreground">{ago(o.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Subscription state, renewals, plan changes, billing operations and webhook sync. Reconciliation stays a Super Admin action."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active" icon={<Users />} tone="success" loading={isLoading} value={num(s?.byStatus.active)} hint={`${num(s?.byStatus.pending)} pending checkout`} />
        <StatCard label="Past due" icon={<AlertTriangle />} tone={s?.byStatus.past_due ? 'warning' : 'neutral'} loading={isLoading} value={num(s?.byStatus.past_due)} hint={`${num(s?.byRecovery.retrying)} retrying`} />
        <StatCard label="Canceling / canceled" icon={<CircleSlash />} loading={isLoading} value={num((s?.byStatus.canceling || 0) + (s?.byStatus.canceled || 0))} hint={`${num(s?.autoRenewOff)} auto-renew off`} />
        <StatCard label="Renewing in 7d" icon={<CalendarClock />} loading={isLoading} value={num(s?.renewingSoon)} />
        <StatCard label="Plan changes" icon={<Repeat />} tone="info" loading={isLoading} value={num(s?.pendingChanges)} hint="scheduled" />
        <StatCard label="Failed ops" icon={<RefreshCcw />} tone={reconRequired ? 'danger' : problems.length ? 'warning' : 'success'} loading={isLoading} value={num(problems.length)} hint={`${reconRequired} need reconciliation`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Section title="Status" description="Click to filter">
          <CountBars counts={s?.byStatus || {}} selected={f.status} onSelect={(status) => setF({ status })} />
        </Section>
        <Section title="Payment recovery" description="Click to filter">
          <CountBars counts={s?.byRecovery || {}} selected={f.recovery} onSelect={(recovery) => setF({ recovery })} />
        </Section>
        <Section title="Active plans">
          <CountBars counts={Object.fromEntries((s?.byPlan || []).map((p) => [`${p.name || 'unknown'} (${p.type || '?'})`, p.n]))} />
        </Section>
        <Section title="Webhook sync" description={`${data?.webhooks.failed.length ?? 0} failed events`}>
          <CountBars counts={data?.webhooks.byStatus || {}} />
        </Section>
      </div>

      {problems.length > 0 && (
        <Section title="Failed & reconciliation-required operations" description="Idempotent billing operations that did not complete">
          <DataTable columns={opColumns} rows={problems} rowKey={(o) => o._id} />
        </Section>
      )}

      <Section
        title="Subscriptions"
        action={
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              setF({ q: search.trim() });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="sub_, cus_, user or subscription ID" className="h-7 w-60 pl-7 text-xs" aria-label="Search subscriptions" />
          </form>
        }
      >
        <DataTable columns={columns} rows={data?.subscriptions} loading={isLoading} rowKey={(r) => r._id} onRowClick={(r) => setSelected(r._id)} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} emptyTitle="No subscriptions match" />
      </Section>
      <SubscriptionSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
