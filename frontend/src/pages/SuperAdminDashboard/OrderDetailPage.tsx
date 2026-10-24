import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Banknote, CalendarClock, Mail, MessageSquare, Phone, ShieldCheck, Wallet } from 'lucide-react';
import { ago, dateTime, money } from '@/lib/devFormat';
import { fetchOrderDetail } from '../../api/admin/details';
import { ErrorState, EmptyState, IssueList, PageHeader, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/developer/ui/avatar';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';

const initials = (name?: string) => (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function Party({ label, person, extra }: { label: string; person: { _id: string; name: string; email?: string; phone?: string; avatarUrl?: string } | null; extra?: ReactNode }) {
  return (
    <Section title={label}>
      {person ? (
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            <AvatarImage src={person.avatarUrl} alt="" />
            <AvatarFallback>{initials(person.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <Link to={`/dashboard/users/${person._id}`} className="font-medium text-primary hover:underline">
              {person.name}
            </Link>
            {person.email && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="size-3.5" /> <a href={`mailto:${person.email}`} className="truncate hover:underline">{person.email}</a>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5" /> {person.phone}
              </div>
            )}
            {extra}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ikke tilknyttet.</p>
      )}
    </Section>
  );
}

/** Label/value rows; empty values are skipped. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return <p className="text-sm text-muted-foreground">Ingen data.</p>;
  return (
    <dl className="grid content-start grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'order-detail', id], queryFn: () => fetchOrderDetail(id), enabled: Boolean(id) });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const o = data.order;
  const p = data.payment;
  const po = data.payout;
  const sp = data.safePay;
  const critical = data.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={o.service?.title || 'Ordre'}
        description={`Ordre ${o._id} · opprettet ${dateTime(o.createdAt)}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="bg-card" asChild>
              <Link to="/dashboard/orders">
                <ArrowLeft /> Ordrer
              </Link>
            </Button>
            {o.chatId && (
              <Button variant="outline" size="sm" className="bg-card" asChild>
                <Link to={`/dashboard/chats/${o.chatId}`}>
                  <MessageSquare /> Chat
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="bg-card" asChild>
              <Link to={`/dashboard/safepay/${o._id}`}>
                <ShieldCheck /> SafePay
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="bg-card" asChild>
              <Link to={`/developer/jobs?id=${o._id}`}>
                Teknisk <ArrowUpRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ordrestatus" icon={<CalendarClock />} value={<StatusBadge status={o.status} />} hint={`oppdatert ${ago(str(o.updatedAt))}`} />
        <StatCard label="Avtalt pris" icon={<Banknote />} value={money(o.agreedPrice)} hint={o.checkoutAmountMinor ? `kunden betalte ${money(o.checkoutAmountMinor, true)}` : undefined} />
        <StatCard label="Betaling" icon={<Wallet />} tone={o.paymentStatus === 'paid' ? 'success' : 'neutral'} value={<StatusBadge status={o.paymentStatus} />} hint={sp ? `SafePay: ${String(sp.status).replace(/_/g, ' ')}` : 'Ingen SafePay-historikk'} />
        <StatCard
          label="Helse"
          icon={<ShieldCheck />}
          tone={critical ? 'danger' : data.issues.length ? 'warning' : 'success'}
          value={data.issues.length ? `${data.issues.length} funn` : 'OK'}
          hint={data.issues.length ? data.issues.map((i) => i.code.replace(/_/g, ' ')).join(', ') : 'Ingen avvik funnet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Party label="Kunde" person={o.customer} />
        <Party
          label="Tilbyder"
          person={o.provider}
          extra={
            o.provider && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="outline">{o.provider.connectAccount ? 'Stripe Connect' : 'Ingen Connect-konto'}</Badge>
                <Badge variant="outline">{o.provider.payoutEnabled ? 'Utbetaling aktiv' : 'Utbetaling ikke aktiv'}</Badge>
              </div>
            )
          }
        />
        <Section title="Oppdrag">
          <Facts
            rows={[
              ['Tjeneste', o.service ? <span>{o.service.title} <StatusBadge status={o.service.status} /></span> : null],
              ['Startet', str(o.startedAt) && dateTime(str(o.startedAt))],
              ['Klar for godkjenning', str(o.readyForReviewAt) && dateTime(str(o.readyForReviewAt))],
              ['Fullført', str(o.completedAt) && dateTime(str(o.completedAt))],
              ['Kanselleringsårsak', o.cancellationReason || null],
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Betaling">
          {p ? (
            <Facts
              rows={[
                ['Status', <StatusBadge key="s" status={str(p.status)} />],
                ['Beløp', money(Number(p.amount))],
                ['Refusjon', str(p.refundStatus) && str(p.refundStatus) !== 'none' ? <StatusBadge key="r" status={str(p.refundStatus)} /> : null],
                ['PaymentIntent', str(p.stripePaymentIntentId) && <span className="font-mono text-xs">{str(p.stripePaymentIntentId)}</span>],
                ['Refusjons-ID', str(p.stripeRefundId) && <span className="font-mono text-xs">{str(p.stripeRefundId)}</span>],
                ['Registrert', dateTime(str(p.createdAt))],
              ]}
            />
          ) : (
            <EmptyState title="Ingen betaling" description="Kunden har ikke betalt for denne ordren." />
          )}
        </Section>
        <Section title="Utbetaling til tilbyder">
          {po ? (
            <Facts
              rows={[
                ['Status', <StatusBadge key="s" status={str(po.status)} />],
                ['Brutto', money(Number(po.grossAmount))],
                ['Netto til tilbyder', money(Number(po.netProviderAmount))],
                ['Kilde', str(po.releaseSource)?.replace(/_/g, ' ') ?? null],
                ['Overføring', str(po.stripeTransferId) && <span className="font-mono text-xs">{str(po.stripeTransferId)}</span>],
                ['Fullført', str(po.transferCompletedAt) && dateTime(str(po.transferCompletedAt))],
                ['Feil', str(po.failureReason) || str(po.failureCode)],
              ]}
            />
          ) : (
            <EmptyState title="Ingen utbetaling ennå" />
          )}
        </Section>
        <Section title="Helsesjekk" description="Avvik mellom ordre, betaling, SafePay og utbetaling.">
          <IssueList issues={data.issues} empty="Ingen avvik — ordren er konsistent." />
        </Section>
      </div>

      {data.disputes.length > 0 && (
        <Section title="Tvister">
          <ul className="divide-y">
            {data.disputes.map((d) => (
              <li key={String(d._id)} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link to={`/dashboard/disputes/${String(d._id)}`} className="truncate font-medium text-primary hover:underline">
                  {str(d.title) || 'Tvist'}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={str(d.status)} />
                  <span className="text-xs text-muted-foreground">{ago(str(d.openedAt))}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Tidslinje" description="Alt som har skjedd med ordren, i rekkefølge.">
          <Timeline events={data.timeline} reverse />
        </Section>
        <Section title="Varsler sendt">
          {data.notifications.length ? (
            <ul className="space-y-2">
              {data.notifications.map((n) => (
                <li key={n._id} className="rounded-md border p-2 text-xs">
                  <div className="flex justify-between gap-2 text-muted-foreground">
                    <span>{n.type}</span>
                    <span>{ago(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-foreground">{n.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen varsler.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
