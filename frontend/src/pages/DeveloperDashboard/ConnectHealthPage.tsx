import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Banknote, BadgeCheck, CircleSlash, Clock, Landmark, RefreshCw, ShieldX, Unlink } from 'lucide-react';
import { ago, dateTime, money, num, until } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type ConnectProviderRow } from '../../api/developer';
import { useDevConnectHealth, useDevConnectProvider, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const SEV_TONE = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' } as const;
const human = (req: string) => req.replace(/[._]/g, ' ');

function Requirements({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className={cn('mb-1 text-xs font-medium', tone)}>
        {title} ({items.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((r) => (
          <Badge key={r} variant="outline" className="font-mono text-[10px]">
            {human(r)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ProviderSheet({ userId, onClose, canAct }: { userId: string | null; onClose: () => void; canAct: boolean }) {
  const { data, isLoading, error } = useDevConnectProvider(userId || undefined);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const resync = async () => {
    setBusy(true);
    try {
      const r = await devApi.connectResync(userId!);
      const d = r.data.data;
      toast.success(`Resynced: ${d.before.status} → ${d.after.status}`);
      qc.invalidateQueries({ queryKey: ['dev', 'connect'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const s = data?.stripe;
  return (
    <Sheet open={Boolean(userId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{data?.user.name || 'Provider'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {s && <StatusBadge status={s.ready ? 'payout ready' : s.payoutOnboardingStatus} tone={s.ready ? 'success' : s.disabledReason ? 'danger' : 'warning'} />}
            <span className="font-mono text-xs">{data?.user.accountId || 'no account'}</span>
            <Badge variant="outline">{data?.mode}</Badge>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto p-4 text-sm">
          {isLoading && <Skeleton className="h-60 w-full" />}
          {error && <ErrorState error={error} />}
          {data && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/dashboard/users/${data.user._id}`}>
                    Admin user page <ArrowUpRight />
                  </Link>
                </Button>
                {canAct && data.user.accountId && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={resync}>
                    <RefreshCw className={cn(busy && 'animate-spin')} /> Resync flags from Stripe
                  </Button>
                )}
              </div>
              {data.stripeError && <ErrorState error={new Error(data.stripeError)} />}
              {data.issues.length > 0 && (
                <ul className="space-y-1.5">
                  {data.issues.map((i) => (
                    <li key={i.code} className="flex items-start gap-2">
                      <StatusBadge status={i.severity} tone={SEV_TONE[i.severity]} />
                      <span className="text-xs">{i.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s && (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                    {[
                      ['Payouts', s.payoutEnabled],
                      ['Transfers', s.transfersEnabled],
                      ['Charges', s.chargesEnabled],
                      ['Details submitted', s.detailsSubmitted],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{k}</span>
                        <span className={v ? 'text-emerald-600' : 'text-red-600'}>{v ? 'enabled' : 'off'}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Country</span>
                      <span>{s.country} · {s.defaultCurrency?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Payout schedule</span>
                      <span>{s.payoutSchedule ? `${s.payoutSchedule.interval}, ${s.payoutSchedule.delay_days} d` : '—'}</span>
                    </div>
                  </div>
                  {s.disabledReason && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">Disabled: {human(s.disabledReason)}</p>}
                  {s.currentDeadline && <p className="text-xs text-amber-700">Requirements must be completed {until(s.currentDeadline)} ({dateTime(s.currentDeadline)}).</p>}
                  <div className="space-y-3">
                    <Requirements title="Past due — payouts blocked" items={s.pastDue} tone="text-red-700" />
                    <Requirements title="Currently due" items={s.currentlyDue.filter((r) => !s.pastDue.includes(r))} tone="text-amber-700" />
                    <Requirements title="Under review by Stripe" items={s.pendingVerification} tone="text-sky-700" />
                    <Requirements title="Eventually due" items={s.eventuallyDue.filter((r) => !s.currentlyDue.includes(r))} tone="text-muted-foreground" />
                  </div>
                  {s.errors.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-red-700">Verification errors</div>
                      <ul className="space-y-1 text-xs">
                        {s.errors.map((e, i) => (
                          <li key={i}>
                            <span className="font-mono">{human(e.requirement)}</span> — {e.reason || e.code}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="text-xs">
                    <span className="text-muted-foreground">Capabilities: </span>
                    {Object.entries(s.capabilities).map(([k, v]) => (
                      <Badge key={k} variant={v === 'active' ? 'secondary' : 'outline'} className="mr-1">
                        {human(k)}: {v}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Bank accounts: </span>
                    {s.externalAccounts.length ? s.externalAccounts.map((x) => `${x.bank || 'bank'} ••${x.last4} (${x.currency?.toUpperCase()}, ${x.status})`).join(', ') : 'none'}
                  </div>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Held SafePay orders ({data.heldOrders.length})</h4>
                  {data.heldOrders.length ? (
                    <ul className="space-y-1 text-xs">
                      {data.heldOrders.map((o) => (
                        <li key={o._id} className="flex justify-between gap-2">
                          <Link to={`/dashboard/orders/${o._id}`} className="font-mono text-primary hover:underline">{o._id.slice(-8).toUpperCase()}</Link>
                          <span>{o.status} · {money(o.agreedPrice)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">None.</p>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Transfers to this provider</h4>
                  {data.payouts.length ? (
                    <ul className="space-y-1 text-xs">
                      {data.payouts.map((p) => (
                        <li key={p._id} className="flex justify-between gap-2">
                          <span>{money(p.netProviderAmount)} · {ago(p.createdAt)}</span>
                          <StatusBadge status={p.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">None.</p>
                  )}
                </div>
              </div>
              {data.bankPayouts.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Payouts to bank</h4>
                  <ul className="space-y-1 text-xs">
                    {data.bankPayouts.map((b) => (
                      <li key={b._id} className="flex justify-between gap-2">
                        <span>{money(b.amount / 100)} {b.currency} · {ago(b.createdAt)}{b.failureMessage ? ` · ${b.failureMessage}` : ''}</span>
                        <StatusBadge status={b.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ConnectHealthPage() {
  const [f, setF] = useUrlFilters({ user: '' });
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevConnectHealth();
  const qc = useQueryClient();
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const s = data?.summary;

  const rescan = async () => {
    try {
      qc.setQueryData(['dev', 'connect'], await devApi.connectHealth(true));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const columns: Column<ConnectProviderRow>[] = [
    { key: 'p', header: 'Provider', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate font-mono text-[11px] text-muted-foreground">{r.accountId}</div></div> },
    { key: 'stripe', header: 'Stripe', cell: (r) => (r.stripe ? <StatusBadge status={r.stripe.ready ? 'ready' : r.stripe.status} tone={r.stripe.ready ? 'success' : r.stripe.disabledReason ? 'danger' : 'warning'} /> : <StatusBadge status="missing" tone="danger" />) },
    { key: 'due', header: 'Due / past due', align: 'right', cell: (r) => <span className={cn('tabular-nums text-xs', r.stripe?.pastDue && 'font-medium text-red-600')}>{r.stripe ? `${r.stripe.currentlyDue} / ${r.stripe.pastDue}` : '—'}</span> },
    { key: 'deadline', header: 'Deadline', cell: (r) => <span className="text-xs text-muted-foreground">{r.stripe?.currentDeadline ? until(r.stripe.currentDeadline) : '—'}</span> },
    { key: 'db', header: 'Our flags', cell: (r) => <span className={cn('text-xs', r.issues.some((i) => i.code.startsWith('db_says')) && 'font-medium text-amber-700')}>{r.db.status}{r.db.payoutEnabled ? ' · enabled' : ''}</span> },
    { key: 'held', header: 'Held for them', align: 'right', cell: (r) => <span className={cn('tabular-nums', r.heldNok && r.stripe && !r.stripe.ready && 'font-semibold text-red-600')}>{r.heldNok ? money(r.heldNok) : '—'}</span> },
    { key: 'issues', header: 'Issues', className: 'max-w-[300px]', cell: (r) => <span className="flex flex-wrap gap-1">{r.issues.slice(0, 3).map((i) => <Badge key={i.code} variant={i.severity === 'critical' || i.severity === 'high' ? 'destructive' : 'outline'} className="text-[10px]">{i.code.replace(/_/g, ' ')}</Badge>)}{r.issues.length > 3 && <span className="text-xs text-muted-foreground">+{r.issues.length - 3}</span>}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stripe Connect Health"
        description="Every provider's connected account as Stripe sees it — onboarding, verification requirements, deadlines, capabilities — compared with our own flags, and the SafePay money that cannot be paid out because of it. Uses the same readiness rule as the real payout gate."
        actions={
          <Button size="sm" variant="outline" className="bg-card" onClick={rescan} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} /> Rescan Stripe
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.stripeError && <ErrorState error={new Error(`Stripe: ${data.stripeError}`)} onRetry={rescan} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Payout-ready" icon={<BadgeCheck />} tone={s && s.ready < s.accounts ? 'warning' : 'success'} loading={isLoading} value={s ? `${s.ready} / ${s.accounts}` : '—'} hint={data ? `${data.mode} mode` : ''} />
        <StatCard label="Restricted" icon={<ShieldX />} tone={s?.restricted ? 'danger' : 'success'} loading={isLoading} value={s?.restricted ?? '—'} hint="disabled or past-due requirements" />
        <StatCard label="Money blocked" icon={<Banknote />} tone={s?.blockedNok ? 'danger' : 'success'} loading={isLoading} value={money(s?.blockedNok)} hint="held for providers who cannot be paid" />
        <StatCard label="Working without account" icon={<CircleSlash />} tone={data?.withoutAccount.length ? 'warning' : 'success'} loading={isLoading} value={data?.withoutAccount.length ?? '—'} hint="providers with orders, no Connect" />
        <StatCard label="Stale flags" icon={<Clock />} tone={s?.staleFlags ? 'warning' : 'success'} loading={isLoading} value={s?.staleFlags ?? '—'} hint="our database disagrees with Stripe" />
        <StatCard label="Failed payouts" icon={<Landmark />} tone={s && s.failedPayouts + s.bankFailures ? 'danger' : 'success'} loading={isLoading} value={s ? s.failedPayouts + s.bankFailures : '—'} hint={s ? `${s.failedPayouts} transfers · ${s.bankFailures} to bank (90 d)` : ''} />
      </div>

      <Section title="Connected providers" description="Worst problems first. Click a provider for live requirements, capabilities, bank accounts and money.">
        <DataTable columns={columns} rows={data?.providers} loading={isLoading} rowKey={(r) => r.userId} onRowClick={(r) => setF({ user: r.userId })} emptyTitle="No connected accounts" />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Providers working without a Connect account" description="They have orders in the last 90 days but can never receive a payout.">
          {data?.withoutAccount.length ? (
            <ul className="divide-y text-sm">
              {data.withoutAccount.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/dashboard/users/${p.userId}`} className="truncate hover:underline">
                    {p.name} <span className="text-xs text-muted-foreground">{p.email}</span>
                  </Link>
                  <span className="shrink-0 text-xs">
                    {num(p.orders)} orders{p.heldNok ? <span className="ml-1 font-medium text-red-600">· {money(p.heldNok)} held</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="None" />
          )}
        </Section>
        <Section title="Stripe accounts not linked to any user" description="Created in this Stripe mode but no Jobblo user points at them — abandoned onboarding or a lost link.">
          {data?.orphanAccounts.length ? (
            <ul className="divide-y text-xs">
              {data.orphanAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Unlink className="size-3 text-muted-foreground" /> {a.id}
                  </span>
                  <span className="text-muted-foreground">
                    {a.jobbloUserId ? `metadata user ${a.jobbloUserId.slice(-6)}` : 'no metadata'} · {a.created ? ago(a.created) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="None" />
          )}
        </Section>
      </div>

      {(data?.failedPayouts.length || data?.bankFailures.length) ? (
        <Section title="Failed money movement">
          <ul className="divide-y text-sm">
            {data!.failedPayouts.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">Transfer to {p.providerId?.name || '—'} · {money(p.netProviderAmount)} · {p.failureCode || p.failureReason || ''}</span>
                <StatusBadge status={p.status} tone="danger" />
              </li>
            ))}
            {data!.bankFailures.map((b) => (
              <li key={b._id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">Bank payout {b.providerId?.name || b.stripeAccountId} · {money(b.amount / 100)} {b.currency} · {b.failureMessage || b.failureCode}</span>
                <StatusBadge status="failed" tone="danger" />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <ProviderSheet userId={f.user || null} onClose={() => setF({ user: '' })} canAct={canAct} />
    </div>
  );
}
