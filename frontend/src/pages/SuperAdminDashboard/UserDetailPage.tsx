import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';
import { ArrowLeft, ArrowUpRight, Banknote, ShieldOff, Briefcase, Mail, MapPin, MessageSquare, MonitorSmartphone, Phone, ShoppingCart, Star } from 'lucide-react';
import { ago, dateTime, money, num } from '@/lib/devFormat';
import { fetchUserOverview, type AdminUserOverview } from '../../api/admin/details';
import { useUrlFilters } from '../../features/developer/hooks';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/developer/ui/avatar';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

type O = AdminUserOverview;
const initials = (name?: string) => (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
const ROLE: Record<string, string> = { user: 'Bruker', provider: 'Tilbyder', company: 'Bedrift', superAdmin: 'Super Admin', developer: 'Utvikler' };

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  if (!shown.length) return <p className="text-sm text-muted-foreground">Ingen data.</p>;
  return (
    <dl className="grid content-start grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Person({ p }: { p: { _id: string; name: string; avatarUrl?: string } | null }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  return (
    <Link to={`/dashboard/users/${p._id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 hover:underline">
      <Avatar size="sm">
        <AvatarImage src={p.avatarUrl} alt="" />
        <AvatarFallback>{initials(p.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{p.name}</span>
    </Link>
  );
}

const TABS = [
  ['overview', 'Oversikt'],
  ['orders', 'Ordrer'],
  ['services', 'Tjenester'],
  ['chats', 'Chatter'],
  ['reviews', 'Vurderinger'],
  ['money', 'Økonomi'],
  ['support', 'Tvister og support'],
  ['devices', 'Enheter'],
  ['activity', 'Adminlogg'],
] as const;

export default function UserDetailPage() {
  const { id = '' } = useParams();
  const [f, setF] = useUrlFilters({ tab: 'overview' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useUserStore((s) => s.user);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'user-overview', id], queryFn: () => fetchUserOverview(id), enabled: Boolean(id) });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const u = data.user;
  const s = data.stats;
  const status = u.isDeleted ? 'deleted' : u.accountStatus || 'active';

  const orderCols: Column<O['orders'][number]>[] = [
    { key: 'title', header: 'Oppdrag', className: 'max-w-[260px]', cell: (o) => <div className="min-w-0"><div className="truncate font-medium">{o.title || '—'}</div><div className="font-mono text-xs text-muted-foreground">{o._id.slice(-8).toUpperCase()}</div></div> },
    { key: 'role', header: 'Rolle', cell: (o) => <Badge variant="outline">{o.role === 'customer' ? 'Kunde' : 'Tilbyder'}</Badge> },
    { key: 'other', header: 'Motpart', cell: (o) => <Person p={o.counterpart} /> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { key: 'pay', header: 'Betaling', cell: (o) => <StatusBadge status={o.paymentStatus} /> },
    { key: 'price', header: 'Beløp', align: 'right', cell: (o) => <span className="tabular-nums">{money(o.agreedPrice)}</span> },
    { key: 'at', header: 'Opprettet', align: 'right', cell: (o) => <span className="text-xs text-muted-foreground">{dateTime(o.createdAt)}</span> },
  ];
  const chatCols: Column<O['chats'][number]>[] = [
    { key: 'other', header: 'Med', cell: (c) => <Person p={c.counterpart} /> },
    { key: 'service', header: 'Tjeneste', className: 'max-w-[220px]', cell: (c) => <span className="block truncate">{c.service || '—'}</span> },
    { key: 'last', header: 'Siste melding', className: 'max-w-[320px]', cell: (c) => <span className="block truncate text-xs text-muted-foreground">{c.lastMessage || '—'}</span> },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
    { key: 'at', header: 'Aktiv', align: 'right', cell: (c) => <span className="text-xs text-muted-foreground">{ago(c.updatedAt)}</span> },
  ];

  let body: ReactNode = null;
  switch (f.tab) {
    case 'orders':
      body = <DataTable columns={orderCols} rows={data.orders} rowKey={(o) => o._id} onRowClick={(o) => navigate(`/dashboard/orders/${o._id}`)} emptyTitle="Ingen ordrer" />;
      break;
    case 'services':
      body = (
        <DataTable
          columns={[
            { key: 'title', header: 'Tjeneste', cell: (x) => <Link to={`/dashboard/services/${x._id}/edit`} className="font-medium text-primary hover:underline">{x.title}</Link> },
            { key: 'status', header: 'Status', cell: (x) => <StatusBadge status={x.status} /> },
            { key: 'price', header: 'Pris', align: 'right', cell: (x) => <span className="tabular-nums">{money(x.price)}</span> },
            { key: 'at', header: 'Publisert', align: 'right', cell: (x) => <span className="text-xs text-muted-foreground">{dateTime(x.createdAt)}</span> },
          ]}
          rows={data.services}
          rowKey={(x) => x._id}
          emptyTitle="Ingen tjenester publisert"
        />
      );
      break;
    case 'chats':
      body = <DataTable columns={chatCols} rows={data.chats} rowKey={(c) => c._id} onRowClick={(c) => navigate(`/dashboard/chats/${c._id}`)} emptyTitle="Ingen chatter" />;
      break;
    case 'reviews':
      body = data.reviews.length ? (
        <ul className="divide-y">
          {data.reviews.map((r) => (
            <li key={r._id} className="flex gap-3 py-3">
              <Person p={r.reviewerId} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`size-3.5 ${i < r.rating ? 'fill-current' : 'text-muted-foreground/30'}`} />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">{ago(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Ingen vurderinger mottatt.</p>
      );
      break;
    case 'money':
      body = (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Facts
              rows={[
                ['Betalt som kunde', money(s.asCustomer.paidValue)],
                ['Utbetalt som tilbyder', money(s.paidOut)],
                ['Mislykkede utbetalinger', s.payoutsFailed ? <span className="text-red-600">{s.payoutsFailed}</span> : '0'],
                ['Poeng', num(u.pointsBalance)],
              ]}
            />
            <Facts
              rows={[
                ['Utbetalingsoppsett', u.payoutOnboardingStatus ? <StatusBadge status={u.payoutOnboardingStatus} /> : null],
                ['Utbetalinger aktivert', u.payoutEnabled ? 'Ja' : 'Nei'],
                ['Betaling aktivert', u.chargesEnabled ? 'Ja' : 'Nei'],
                ['Utbetalingsmetode', u.payoutMethod || null],
                ['Abonnement', data.subscription ? <span>{data.subscription.planId?.name || data.subscription.planType} <StatusBadge status={data.subscription.status} /></span> : 'Ingen'],
                ['Neste fornyelse', data.subscription?.nextRenewalAt ? dateTime(data.subscription.nextRenewalAt) : null],
              ]}
            />
          </div>
          <DataTable
            columns={[
              { key: 'order', header: 'Ordre', cell: (x) => <Link to={`/dashboard/orders/${x.orderId}`} className="font-mono text-xs text-primary hover:underline">{String(x.orderId).slice(-8).toUpperCase()}</Link> },
              { key: 'status', header: 'Status', cell: (x) => <StatusBadge status={x.status} /> },
              { key: 'net', header: 'Netto', align: 'right', cell: (x) => <span className="tabular-nums">{money(x.netProviderAmount)}</span> },
              { key: 'src', header: 'Kilde', cell: (x) => <span className="text-xs">{x.releaseSource?.replace(/_/g, ' ') || '—'}</span> },
              { key: 'err', header: '', className: 'max-w-[220px]', cell: (x) => <span className="block truncate text-xs text-red-600">{x.failureReason}</span> },
              { key: 'at', header: 'Opprettet', align: 'right', cell: (x) => <span className="text-xs text-muted-foreground">{dateTime(x.createdAt)}</span> },
            ]}
            rows={data.payouts}
            rowKey={(x) => x._id}
            emptyTitle="Ingen utbetalinger"
          />
        </div>
      );
      break;
    case 'support':
      body = (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Tvister ({data.disputes.length})</h4>
            {data.disputes.length ? (
              <ul className="divide-y">
                {data.disputes.map((d) => (
                  <li key={d._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link to={`/dashboard/disputes/${d._id}`} className="truncate text-primary hover:underline">{d.title}</Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {String(d.openedBy) === u._id && <Badge variant="outline">åpnet av bruker</Badge>}
                      <StatusBadge status={d.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen tvister.</p>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Supportsaker ({data.tickets.length})</h4>
            {data.tickets.length ? (
              <ul className="divide-y">
                {data.tickets.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">{t.subject}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-muted-foreground">{ago(t.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen supportsaker.</p>
            )}
          </div>
        </div>
      );
      break;
    case 'devices':
      body = (
        <DataTable
          columns={[
            { key: 'dev', header: 'Enhet', cell: (x) => <span>{x.deviceName || x.device || '—'}</span> },
            { key: 'br', header: 'Nettleser / OS', cell: (x) => <span className="text-xs">{[x.browser, x.os].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'loc', header: 'Sted', cell: (x) => <span className="text-xs">{x.location || '—'}</span> },
            { key: 'ip', header: 'IP', cell: (x) => <span className="font-mono text-xs">{x.ip || '—'}</span> },
            { key: 'state', header: 'Status', cell: (x) => <StatusBadge status={!x.expiresAt || new Date(x.expiresAt) > new Date() ? 'active' : 'expired'} /> },
            { key: 'used', header: 'Sist brukt', align: 'right', cell: (x) => <span className="text-xs text-muted-foreground">{ago(x.lastUsed || x.createdAt)}</span> },
          ]}
          rows={data.sessions}
          rowKey={(x) => x._id}
          emptyTitle="Ingen innlogginger registrert"
        />
      );
      break;
    case 'activity':
      body = data.activity.length ? (
        <ul className="divide-y">
          {data.activity.map((a) => (
            <li key={a._id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{a.description}</div>
                <div className="text-xs text-muted-foreground">{a.adminId?.name || 'System'} · {a.action.replace(/_/g, ' ')}</div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{dateTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Ingen administrative handlinger på denne brukeren.</p>
      );
      break;
    default:
      body = (
        <div className="grid gap-6 lg:grid-cols-2">
          <Facts
            rows={[
              ['Fullt navn', [u.name, u.lastName].filter(Boolean).join(' ')],
              ['E-post', <a key="e" href={`mailto:${u.email}`} className="text-primary hover:underline">{u.email}</a>],
              ['Telefon', u.phone || null],
              ['Bedrift', u.companyName ? `${u.companyName}${u.orgNumber ? ` (org.nr ${u.orgNumber})` : ''}` : null],
              ['Nettside', u.website || null],
              ['Adresse', [u.address, [u.postNumber, u.postSted].filter(Boolean).join(' '), u.country].filter(Boolean).join(', ') || null],
              ['Områder', u.locations?.length ? u.locations.join(', ') : null],
              ['Ferdigheter', u.skills?.length ? <span className="flex flex-wrap gap-1">{u.skills.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}</span> : null],
              ['Om', u.bio || null],
            ]}
          />
          <Facts
            rows={[
              ['Rolle', ROLE[u.role] || u.role],
              ['Status', <StatusBadge key="s" status={status} />],
              ['E-post verifisert', u.verified ? 'Ja' : 'Nei'],
              ['BankID', u.identityVerification?.verifiedAt ? `Verifisert ${dateTime(u.identityVerification.verifiedAt)}` : 'Ikke verifisert'],
              ['Pålogging via', u.oauthProviders?.length ? u.oauthProviders.map((p) => p.provider).join(', ') : 'E-post og passord'],
              ['Plan', u.planType || null],
              ['Vilkår godtatt', u.termsAcceptedAt ? `${u.termsVersion || ''} · ${dateTime(u.termsAcceptedAt)}` : 'Nei'],
              ['Registrert', dateTime(u.createdAt)],
              ['Sist innlogget', u.lastLogin ? `${dateTime(u.lastLogin)} (${ago(u.lastLogin)})` : 'Aldri'],
              ['Tofaktor (app)', u.mfaEnabledAt ? `På siden ${dateTime(u.mfaEnabledAt)}` : ['superAdmin', 'developer'].includes(u.role) ? 'Ikke satt opp — kreves ved neste innlogging' : 'Av'],
              ['Deaktivert', u.deactivatedAt ? dateTime(u.deactivatedAt) : null],
              ['Slettet', u.deletedAt ? dateTime(u.deletedAt) : null],
            ]}
          />
        </div>
      );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={u.avatarUrl} alt="" />
            <AvatarFallback className="text-lg">{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <PageHeader title={[u.name, u.lastName].filter(Boolean).join(' ')} />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <Badge variant="outline">{ROLE[u.role] || u.role}</Badge>
              <StatusBadge status={status} />
              {u.verified && <Badge variant="secondary">Verifisert</Badge>}
              {u.identityVerification?.verifiedAt && <Badge variant="secondary">BankID</Badge>}
              <span className="flex items-center gap-1"><Mail className="size-3.5" /> {u.email}</span>
              {u.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" /> {u.phone}</span>}
              {u.postSted && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {u.postSted}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="bg-card" asChild>
            <Link to="/dashboard/users">
              <ArrowLeft /> Brukere
            </Link>
          </Button>
          {u.mfaEnabledAt && u._id !== me?._id && (
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={async () => {
                if (!window.confirm(`Fjerne autentiseringsappen for ${u.email}? Brukeren logges ut overalt og må sette opp en ny ved neste innlogging. Gjør dette bare når du har bekreftet hvem som ber om det.`)) return;
                try {
                  await mainLink.post(`/api/admin/users/${u._id}/mfa/reset`);
                  toast.success('Autentiseringsappen er fjernet');
                  qc.invalidateQueries();
                } catch (e) {
                  toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Kunne ikke tilbakestille');
                }
              }}
            >
              <ShieldOff /> Tilbakestill 2FA
            </Button>
          )}
          <Button variant="outline" size="sm" className="bg-card" asChild>
            <Link to={`/developer/users?id=${u._id}`}>
              Teknisk <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Som kunde" icon={<ShoppingCart />} value={num(s.asCustomer.count)} hint={`${s.asCustomer.active} aktive · ${money(s.asCustomer.paidValue)} betalt`} />
        <StatCard label="Som tilbyder" icon={<Briefcase />} value={num(s.asProvider.count)} hint={`${s.asProvider.completed} fullført · ${s.services} tjenester`} />
        <StatCard label="Vurdering" icon={<Star />} value={s.averageRating ? s.averageRating.toFixed(1) : '—'} hint={`${s.reviewsReceived} mottatt · ${s.reviewsGiven} gitt`} />
        <StatCard label="Utbetalt" icon={<Banknote />} tone={s.payoutsFailed ? 'danger' : 'neutral'} value={money(s.paidOut)} hint={s.payoutsFailed ? `${s.payoutsFailed} mislykket` : 'til tilbyder'} />
        <StatCard label="Chatter" icon={<MessageSquare />} value={num(s.chats)} hint={`${s.disputes} tvister`} />
        <StatCard label="Aktive økter" icon={<MonitorSmartphone />} value={num(s.activeSessions)} hint={u.lastLogin ? `sist ${ago(u.lastLogin)}` : 'aldri innlogget'} />
      </div>

      <Section
        title={TABS.find(([k]) => k === f.tab)?.[1] || 'Oversikt'}
        action={
          <Tabs value={f.tab} onValueChange={(tab) => setF({ tab })}>
            <TabsList className="flex-wrap">
              {TABS.map(([k, label]) => (
                <TabsTrigger key={k} value={k}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      >
        {body}
      </Section>
    </div>
  );
}
