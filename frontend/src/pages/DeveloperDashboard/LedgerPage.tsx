import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenCheck, CircleCheck, CircleX, Landmark, PiggyBank, Undo2, Vault, Wallet } from 'lucide-react';
import { dateTime, money, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { OrderLedger } from '../../api/developer';
import { useDevLedger, useDevLedgerOrder, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const kr = (ore: number | null | undefined) => money(ore === null || ore === undefined ? null : ore / 100);
const SEV_TONE = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' } as const;

function Journal({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useDevLedgerOrder(orderId || undefined);
  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{data?.title || 'Order ledger'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{orderId}</span>
            {data && <StatusBadge status={data.status} />}
            {data && <span>agreed {kr(data.agreed)}</span>}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto p-4 text-sm">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {error && <ErrorState error={error} />}
          {data && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/dashboard/orders/${data.orderId}`}>
                  Order detail <ArrowUpRight />
                </Link>
              </Button>
              {data.issues.map((i) => (
                <div key={i.code} className="flex items-start gap-2">
                  <StatusBadge status={i.severity} tone={SEV_TONE[i.severity]} />
                  <span className="text-xs">{i.detail}</span>
                </div>
              ))}
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">Entry</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                    <th className="pb-2 text-right font-normal">Escrow balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2">
                        <div>{e.label}</div>
                        <div className="text-muted-foreground">{e.at ? dateTime(e.at) : 'time not recorded'}{e.ref ? ` · ${e.ref}` : ''}</div>
                      </td>
                      <td className={cn('py-2 text-right tabular-nums', e.amount < 0 ? 'text-red-600' : 'text-emerald-600')}>{e.amount > 0 ? '+' : ''}{kr(e.amount)}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{kr(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={cn('rounded-md p-2 text-xs', data.held === 0 ? 'bg-emerald-50 text-emerald-800' : data.issues.length ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-800')}>
                {data.held === 0 ? 'Balanced — nothing left in escrow.' : `${kr(data.held)} held in escrow${data.issues.length ? ' on an order that should be settled.' : ' (order still open).'}`}
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function LedgerPage() {
  const [f, setF] = useUrlFilters({ month: '', order: '' });
  const { data, isLoading, error, refetch } = useDevLedger(f.month || undefined);
  const t = data?.totals;

  const columns: Column<OrderLedger>[] = [
    { key: 'o', header: 'Order', cell: (l) => <div className="min-w-0"><div className="truncate">{l.title || '—'}</div><div className="font-mono text-[11px] text-muted-foreground">{l.orderId.slice(-8).toUpperCase()} · {l.status}</div></div> },
    { key: 'c', header: 'Charged', align: 'right', cell: (l) => <span className="tabular-nums">{kr(l.charged)}</span> },
    { key: 'r', header: 'Refunded', align: 'right', cell: (l) => <span className="tabular-nums">{l.refunded ? kr(l.refunded) : '—'}</span> },
    { key: 'p', header: 'Paid out', align: 'right', cell: (l) => <span className="tabular-nums">{l.paidOut ? kr(l.paidOut) : '—'}</span> },
    { key: 'k', header: 'Kept', align: 'right', cell: (l) => <span className="tabular-nums">{l.kept ? kr(l.kept) : '—'}</span> },
    { key: 'h', header: 'Held', align: 'right', cell: (l) => <span className={cn('tabular-nums', l.held && l.issues.length ? 'font-semibold text-red-600' : l.held ? 'text-sky-700' : 'text-muted-foreground')}>{l.held ? kr(l.held) : '0'}</span> },
    { key: 'i', header: '', cell: (l) => (l.issues.length ? <Badge variant="destructive">{l.issues.length}</Badge> : <CircleCheck className="size-4 text-emerald-600" />) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial Ledger"
        description="Every paid order rebuilt as a ledger in øre — charged, refunded, paid to the provider, kept as platform fees, still held in escrow — cross-checked against Stripe refunds and transfers. A completed or cancelled order must end at zero."
        actions={
          <>
            <Input type="month" aria-label="Month" value={f.month} onChange={(e) => setF({ month: e.target.value })} className="h-8 w-40 bg-card" />
            {f.month && (
              <Button size="sm" variant="outline" className="bg-card" onClick={() => setF({ month: '' })}>
                All time
              </Button>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {t && (
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm', data.balanced ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50')}>
          {data.balanced ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleX className="size-4 text-red-600" />}
          <span className="font-medium">{kr(t.charged)} charged</span>
          <span>=</span>
          <span>{kr(t.refunded)} refunded</span>
          <span>+</span>
          <span>{kr(t.paidOut)} paid out</span>
          <span>+</span>
          <span>{kr(t.kept)} kept</span>
          <span>+</span>
          <span>{kr(t.held)} held</span>
          <span className="ml-auto text-xs text-muted-foreground">{num(data.orders)} paid orders · {data.period === 'all' ? 'all time' : data.period}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Charged" icon={<Wallet />} loading={isLoading} value={kr(t?.charged)} />
        <StatCard label="Refunded" icon={<Undo2 />} loading={isLoading} value={kr(t?.refunded)} hint={t?.charged ? `${((t.refunded / t.charged) * 100).toFixed(1)}% of charged` : ''} />
        <StatCard label="Paid to providers" icon={<Landmark />} loading={isLoading} value={kr(t?.paidOut)} />
        <StatCard label="Platform revenue" icon={<PiggyBank />} tone="success" loading={isLoading} value={kr(t?.kept)} hint={t ? `customer ${kr(t.customerFees)} + provider ${kr(t.providerFees)}` : ''} />
        <StatCard label="Escrow liability" icon={<Vault />} loading={isLoading} value={kr(data?.escrow.held)} hint={data ? `${data.escrow.orders} open orders · oldest ${data.escrow.oldestDays} d` : ''} />
        <StatCard label="Discrepancies" icon={<BookOpenCheck />} tone={data?.issues.length ? 'danger' : 'success'} loading={isLoading} value={data?.issues.length ?? '—'} hint={Object.entries(data?.issueCounts || {}).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(' · ') || 'books balance'} />
      </div>

      <Section title="Discrepancies" description="Orders whose money does not add up. Click for the order's journal.">
        {data?.issues.length ? (
          <ul className="divide-y">
            {data.issues.map((i, n) => (
              <li key={n}>
                <button type="button" className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-muted/30" onClick={() => setF({ order: i.orderId })}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={i.severity} tone={SEV_TONE[i.severity]} />
                      <span className="text-sm font-medium">{i.code.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-xs text-muted-foreground">{i.orderId.slice(-8).toUpperCase()} · {i.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.status}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Every order balances" />
        )}
      </Section>

      <Section title="Order ledgers" description="Orders with problems first. Held on an open order is normal escrow; held on a closed order is money nobody accounted for.">
        <DataTable columns={columns} rows={data?.ledgers} loading={isLoading} rowKey={(l) => l.orderId} onRowClick={(l) => setF({ order: l.orderId })} emptyTitle="No paid orders in this period" />
      </Section>

      <Journal orderId={f.order || null} onClose={() => setF({ order: '' })} />
    </div>
  );
}
