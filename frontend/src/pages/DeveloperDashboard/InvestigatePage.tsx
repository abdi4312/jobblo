import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ScanSearch, Search } from 'lucide-react';
import { ago } from '@/lib/devFormat';
import type { InvestigateKind, InvestigateMatch } from '../../api/developer';
import { useDevInvestigate, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, IssueList, PageHeader, Section, StatusBadge, Timeline } from '../../components/developer/kit';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';

const KIND_LABEL: Record<InvestigateKind, string> = {
  objectId: 'Database ID',
  stripe: 'Stripe reference',
  ip: 'IP address',
  email: 'Email',
  reference: 'Error reference / request ID',
};

const e = encodeURIComponent;
/** Where each kind of record is inspected in full. */
const hrefOf = (m: InvestigateMatch): string | null => {
  switch (m.type) {
    case 'user':
      return `/developer/users?id=${m.id}`;
    case 'payment':
    case 'payout':
    case 'dispute':
      return m.orderId ? `/developer/jobs?id=${m.orderId}` : null;
    case 'ticket':
      return `/developer/tickets?q=${m.id}`;
    case 'incident':
      return `/developer/incidents?id=${m.id}`;
    case 'error':
      return `/developer/errors?q=${e(m.id)}`;
    case 'webhook':
      return `/developer/webhooks?q=${e(m.id)}`;
    case 'subscription':
      return m.userId ? `/developer/users?id=${m.userId}` : '/developer/subscriptions';
    case 'approval':
      return '/developer/approvals?view=all';
    case 'ip':
      return `/developer/ips?q=${e(m.id)}`;
    case 'audit':
      return '/developer/audit';
    default:
      return null;
  }
};

export default function InvestigatePage() {
  const [f, setF] = useUrlFilters({ q: '' });
  const [input, setInput] = useState(f.q);
  useEffect(() => setInput(f.q), [f.q]);
  const { data, isFetching, error, refetch } = useDevInvestigate(f.q || undefined);
  const nothing = data && !data.matches.length && !data.orders.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investigate"
        description="Paste anything — an order, user, job, payment or ticket ID, a Stripe reference (pi_, cs_, ch_, re_, evt_, sub_, cus_, tr_, acct_), an error reference, a request ID, an email or an IP — and see every linked record and one merged timeline."
      />
      <form
        className="flex max-w-3xl gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          setF({ q: input.trim() });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={input} onChange={(ev) => setInput(ev.target.value)} placeholder="6a98… · pi_… · ERR-… · name@example.no · 203.0.113.7" className="bg-card pl-8 font-mono text-xs" aria-label="Investigate" />
        </div>
        <Button type="submit" disabled={!input.trim()}>
          Investigate
        </Button>
      </form>

      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {!f.q && <EmptyState icon={<ScanSearch />} title="Start with any identifier" description="Results link to the page where each record is inspected in full." />}
      {f.q && isFetching && !data && <Skeleton className="h-40 w-full" />}
      {data && (
        <p className="text-xs text-muted-foreground">
          Read as <Badge variant="outline">{KIND_LABEL[data.kind]}</Badge> · {data.matches.length} linked record{data.matches.length === 1 ? '' : 's'} · {data.orders.length + data.moreOrders} order{data.orders.length + data.moreOrders === 1 ? '' : 's'}
        </p>
      )}
      {nothing && <EmptyState title="Nothing found" description="No record in this database references that value. Stripe objects from another account or mode will not appear here." />}

      {data?.matches.length ? (
        <Section title="Linked records">
          <ul className="divide-y rounded-md border bg-card">
            {data.matches.map((m) => {
              const href = hrefOf(m);
              const body = (
                <>
                  <Badge variant="secondary" className="w-24 justify-center capitalize">
                    {m.type}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.label}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {m.id}
                      {m.detail ? <span className="font-sans"> · {m.detail}</span> : null}
                    </div>
                  </div>
                  {m.status && <StatusBadge status={m.status} />}
                  <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{m.at ? ago(m.at) : ''}</span>
                  {href && <ArrowUpRight className="size-4 text-muted-foreground" />}
                </>
              );
              return (
                <li key={`${m.type}-${m.id}`}>
                  {href ? (
                    <Link to={href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {data?.orders.map((o) => (
        <Section
          key={o._id}
          title={`Order · ${o.title}`}
          description={`${o._id} · ${o.agreedPrice ?? '—'} NOK · customer ${o.customer?.name || '—'} · provider ${o.provider?.name || '—'}`}
          action={
            <span className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/developer/transactions?id=${o._id}`}>
                  Trace journey <ArrowUpRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`/developer/jobs?id=${o._id}`}>
                  Job Diagnostics <ArrowUpRight />
                </Link>
              </Button>
            </span>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1">Order <StatusBadge status={o.status} /></span>
            <span className="flex items-center gap-1">Payment <StatusBadge status={o.paymentStatus} /></span>
            <span className="flex items-center gap-1">SafePay <StatusBadge status={o.safePay || 'none'} /></span>
            <span className="flex items-center gap-1">Payout <StatusBadge status={o.payout || 'none'} /></span>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Health</h4>
              <IssueList issues={o.issues} />
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Timeline</h4>
              <Timeline events={o.timeline} reverse />
            </div>
          </div>
        </Section>
      ))}
      {data?.moreOrders ? <p className="text-xs text-muted-foreground">+{data.moreOrders} more orders match — open Job Diagnostics to see them all.</p> : null}
    </div>
  );
}
