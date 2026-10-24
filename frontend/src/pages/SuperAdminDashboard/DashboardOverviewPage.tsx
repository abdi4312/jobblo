import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Briefcase,
    ShoppingCart,
    DollarSign,
    Star,
    CreditCard,
    ArrowRight,
    RefreshCw,
    Activity,
} from 'lucide-react';
import { useDashboardOverview } from '../../hooks/admin';
import {
    AdminStatCard,
    AdminStatCardSkeleton,
    AdminChartCard,
    AdminActivityItem,
    AdminStatusBadge,
    AdminErrorState,
    AdminEmptyState,
    AdminPageHeader,
} from '../../components/admin';
import type {
    AdminActivity,
    TrendPoint,
    RecentUser,
    RecentService,
    RecentOrder,
    RoleDistribution,
    OrderStatusDistribution,
} from '../../types/admin';
import { format, formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

// ─── Simple bar chart using native SVG ────────────────────────────────────────
function BarChart({ data }: { data: TrendPoint[] }) {
    if (!data.length) return <AdminEmptyState description="Ingen registreringer siste 30 dager." className="py-6" />;

    const max = Math.max(...data.map((d) => d.count), 1);
    const chartWidth = 620;
    const chartHeight = 156;
    const left = 38;
    const right = 10;
    const top = 10;
    const bottom = 32;
    const plotWidth = chartWidth - left - right;
    const plotHeight = chartHeight - top - bottom;
    const slot = plotWidth / data.length;
    const barW = Math.min(12, Math.max(4, slot * 0.58));
    const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

    return (
        <div className="w-full" role="img" aria-label="Brukerregistreringer siste 30 dager">
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-44 w-full"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="registration-bars" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.45} />
                    </linearGradient>
                </defs>
                {[0, 0.5, 1].map((fraction) => {
                    const y = top + plotHeight * fraction;
                    const value = Math.round(max * (1 - fraction));
                    return (
                        <g key={fraction}>
                            <line x1={left} x2={chartWidth - right} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 4" />
                            <text x={left - 9} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{value}</text>
                        </g>
                    );
                })}
                {data.map((d, i) => {
                    const barH = d.count > 0 ? Math.max(3, (d.count / max) * plotHeight) : 0;
                    const x = left + i * slot + (slot - barW) / 2;
                    const y = top + plotHeight - barH;
                    return (
                        <g key={d._id}>
                            <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={Math.max(barH, 1)}
                                rx={Math.min(4, barW / 2)}
                                fill="url(#registration-bars)"
                                className="transition-opacity hover:opacity-70"
                            />
                            <title>{`${d._id}: ${d.count} bruker(e)`}</title>
                        </g>
                    );
                })}
                {labelIndexes.map((index) => {
                    const date = data[index]?._id ?? '';
                    return (
                        <text
                            key={index}
                            x={left + index * slot + slot / 2}
                            y={chartHeight - 7}
                            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
                            className="fill-muted-foreground text-[10px]"
                        >
                            {date.slice(8, 10)}.{date.slice(5, 7)}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── Donut chart for role distribution ───────────────────────────────────────
function DonutChart({ data }: { data: RoleDistribution }) {
    const COLORS: Record<string, string> = {
        user: 'var(--chart-1)',
        provider: 'var(--chart-2)',
        company: 'var(--chart-3)',
        superAdmin: 'var(--chart-4)',
    };
    const LABELS: Record<string, string> = {
        user: 'Bruker',
        provider: 'Tilbyder',
        company: 'Bedrift',
        superAdmin: 'Super Admin',
    };

    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    if (total === 0) return <AdminEmptyState description="Ingen brukerdata." className="py-6" />;

    let cumulative = 0;
    const r = 42;
    const cx = 60;
    const cy = 60;
    const circumference = 2 * Math.PI * r;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-7" role="img" aria-label="Rollefordeling">
            <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={13} />
                {entries.map(([role, count]) => {
                    const fraction = count / total;
                    const dash = fraction * circumference;
                    const offset = cumulative * circumference;
                    cumulative += fraction;
                    return (
                        <circle
                            key={role}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={COLORS[role] ?? 'var(--chart-5)'}
                            strokeWidth={13}
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeDashoffset={-offset}
                            className="transition-all duration-300"
                        >
                            <title>{`${LABELS[role] ?? role}: ${count}`}</title>
                        </circle>
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{total.toLocaleString('nb-NO')}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">brukere</span>
            </div>
            </div>
            <ul className="w-full max-w-[190px] space-y-3 text-sm">
                {entries.map(([role, count]) => (
                    <li key={role} className="flex items-center gap-2.5">
                        <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[role] ?? 'var(--chart-5)' }}
                            aria-hidden="true"
                        />
                        <span className="text-muted-foreground">{LABELS[role] ?? role}</span>
                        <span className="ml-auto font-semibold text-foreground tabular-nums">{count.toLocaleString('nb-NO')}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Order status horizontal bars ────────────────────────────────────────────
function OrderStatusChart({ data }: { data: OrderStatusDistribution }) {
    const entries = Object.entries(data).filter(([, v]) => (v ?? 0) > 0);
    const max = Math.max(...entries.map(([, v]) => v ?? 0), 1);

    const COLORS: Record<string, string> = {
        pending: 'bg-amber-400',
        accepted: 'bg-primary/60',
        in_progress: 'bg-primary/60',
        completed: 'bg-primary',
        cancelled: 'bg-rose-400',
        paid: 'bg-primary',
        awaiting_payment: 'bg-orange-400',
        declined: 'bg-rose-500',
    };
    const LABELS: Record<string, string> = {
        pending: 'Venter',
        accepted: 'Akseptert',
        in_progress: 'Pågår',
        completed: 'Fullført',
        cancelled: 'Avbrutt',
        paid: 'Betalt',
        awaiting_payment: 'Venter betaling',
        declined: 'Avslått',
    };

    if (!entries.length) return <AdminEmptyState description="Ingen ordredata." className="py-6" />;

    const total = entries.reduce((sum, [, count]) => sum + (count ?? 0), 0);

    return (
        <div className="space-y-4" role="list" aria-label="Ordrestatus-fordeling">
            {entries.map(([status, count]) => (
                <div key={status} role="listitem">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground font-medium">{LABELS[status] ?? status}</span>
                        <span className="text-foreground font-semibold tabular-nums">
                            {(count ?? 0).toLocaleString('nb-NO')}
                            <span className="ml-2 text-muted-foreground font-normal">{total ? Math.round(((count ?? 0) / total) * 100) : 0}%</span>
                        </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden" aria-hidden="true">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${COLORS[status] ?? 'bg-muted-foreground/30'}`}
                            style={{ width: `${((count ?? 0) / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Recent rows ──────────────────────────────────────────────────────────────
function RecentUsersTable({ users }: { users: RecentUser[] }) {
    if (!users.length) return <AdminEmptyState description="Ingen nye brukere." className="py-6" />;
    return (
        <ul className="divide-y divide-border" role="list">
            {users.map((u) => (
                <li key={u._id} className="flex items-center gap-3 py-2.5" role="listitem">
                    <img
                        src={
                            u.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2d4a3e&color=fff&size=40`
                        }
                        alt={u.name}
                        className="size-9 rounded-full object-cover shrink-0 ring-2 ring-border"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <AdminStatusBadge status={u.role} />
                </li>
            ))}
        </ul>
    );
}

function RecentServicesTable({ services }: { services: RecentService[] }) {
    if (!services.length) return <AdminEmptyState description="Ingen nye tjenester." className="py-6" />;
    return (
        <ul className="divide-y divide-border" role="list">
            {services.map((s) => (
                <li key={s._id} className="py-2.5 flex items-center gap-3" role="listitem">
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {s.userId?.name ?? 'Ukjent'} ·{' '}
                            {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: nb })}
                        </p>
                    </div>
                    <AdminStatusBadge status={s.status} />
                </li>
            ))}
        </ul>
    );
}

function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
    if (!orders.length) return <AdminEmptyState description="Ingen nye ordrer." className="py-6" />;
    return (
        <ul className="divide-y divide-border" role="list">
            {orders.map((o) => (
                <li key={o._id} className="py-2.5 flex items-center gap-3" role="listitem">
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">
                            {o.serviceId?.title ?? 'Ukjent tjeneste'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {o.customerId?.name ?? 'Ukjent kunde'} ·{' '}
                            {o.agreedPrice != null
                                ? `${o.agreedPrice.toLocaleString('nb-NO')} NOK`
                                : 'Pris ikke satt'}
                        </p>
                    </div>
                    <AdminStatusBadge status={o.status} />
                </li>
            ))}
        </ul>
    );
}

// ─── Section wrapper with "se alle" link ─────────────────────────────────────
function Section({
    title,
    to,
    children,
}: {
    title: string;
    to: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-card rounded-lg border border-border p-5 md:p-6 shadow-[0_2px_10px_rgba(24,49,38,0.025)]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                <Link
                    to={to}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-ring/50 rounded"
                >
                    Se alle <ArrowRight size={13} />
                </Link>
            </div>
            {children}
        </div>
    );
}

function groupRecentActivity(items: AdminActivity[]) {
    const groups = new Map<string, { item: AdminActivity; occurrences: number }>();

    for (const item of items) {
        const actorId =
            typeof item.adminId === 'object' && item.adminId ? item.adminId._id : null;
        const key = JSON.stringify([
            actorId,
            item.action,
            item.targetModel,
            actorId ? item.targetId : null,
            item.description,
        ]);
        const existing = groups.get(key);
        if (existing) existing.occurrences += 1;
        else groups.set(key, { item, occurrences: 1 });
    }

    return [...groups.values()];
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardOverviewPage() {
    const { data, dataUpdatedAt, isLoading, isFetching, isError, refetch } = useDashboardOverview();
    const activityGroups = useMemo(
        () => groupRecentActivity(data?.recentActivity ?? []),
        [data?.recentActivity]
    );

    // KPI cards config
    const cards = useMemo(() => {
        if (!data) return [];
        return [
            {
                title: 'Totale brukere',
                value: data.stats.totalUsers.value,
                icon: <Users size={18} />,
                change: data.stats.totalUsers.change,
                to: '/dashboard/users',
            },
            {
                title: 'Tjenester',
                value: data.stats.totalServices.value,
                icon: <Briefcase size={18} />,
                subtitle: `${data.stats.totalServices.thisMonth ?? 0} denne måneden`,
                to: '/dashboard/services',
            },
            {
                title: 'Ordrer',
                value: data.stats.totalOrders.value,
                icon: <ShoppingCart size={18} />,
                subtitle: `${data.stats.totalOrders.thisMonth ?? 0} denne måneden`,
                to: '/dashboard/orders',
            },
            {
                title: 'Inntekt (NOK)',
                value: data.stats.revenueThisMonth.value.toLocaleString('nb-NO'),
                icon: <DollarSign size={18} />,
                change: data.stats.revenueThisMonth.change,
                subtitle: 'Inntekt denne måneden',
            },
            {
                title: 'Aktive abonnementer',
                value: data.stats.activeSubscriptions.value,
                icon: <CreditCard size={18} />,
                to: '/dashboard/plans',
            },
            {
                title: 'Vurderinger',
                value: data.stats.totalReviews.value,
                icon: <Star size={18} />,
                to: '/dashboard/reviews',
            },
        ];
    }, [data]);

    if (isError) {
        return (
            <AdminErrorState
                title="Kunne ikke laste dashbord"
                description="Noe gikk galt ved henting av oversiktsdata."
                onRetry={refetch}
                className="min-h-[60vh]"
            />
        );
    }

    return (
        <div className="space-y-6 md:space-y-7">
            <AdminPageHeader
                title="Dashbord"
                description="Oversikt over plattformaktivitet"
                className="mb-0"
                actions={
                    <div className="flex items-center gap-3">
                        {dataUpdatedAt > 0 && (
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                                Oppdatert {format(new Date(dataUpdatedAt), 'HH:mm', { locale: nb })}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => void refetch()}
                            disabled={isFetching}
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/40 hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                            Oppdater
                        </button>
                    </div>
                }
            />

            {/* KPI stat cards */}
            <section aria-label="Nøkkeltall" className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Plattform i tall</h2>
                    <span className="text-xs text-muted-foreground">Sammendrag</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3.5">
                    {isLoading
                        ? Array.from({ length: 6 }).map((_, i) => <AdminStatCardSkeleton key={i} />)
                        : cards.map((c) => (
                            <AdminStatCard
                                key={c.title}
                                title={c.title}
                                value={c.value}
                                icon={c.icon}
                                change={c.change}
                                subtitle={c.subtitle}
                                to={c.to}
                            />
                        ))}
                </div>
            </section>

            {/* Charts row */}
            <section
                aria-label="Diagrammer"
                className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,1fr)] gap-4"
            >
                <div className="lg:col-span-2">
                    <AdminChartCard
                        title="Brukerregistreringer"
                        description="Siste 30 dager"
                        loading={isLoading}
                        isEmpty={!isLoading && (!data?.userRegistrationTrend?.length)}
                    >
                        {data && <BarChart data={data.userRegistrationTrend} />}
                    </AdminChartCard>
                </div>

                <AdminChartCard
                    title="Rollefordeling"
                    description="Alle brukere"
                    loading={isLoading}
                    isEmpty={!isLoading && !data}
                >
                    {data && <DonutChart data={data.roleDistribution} />}
                </AdminChartCard>
            </section>

            <section aria-label="Ordrestatus og aktivitet" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <AdminChartCard
                    title="Ordrestatus"
                    description={`${data?.stats.totalOrders.value.toLocaleString('nb-NO') ?? '–'} ordrer totalt`}
                    loading={isLoading}
                    isEmpty={!isLoading && !data}
                >
                    {data && <OrderStatusChart data={data.orderStatusDistribution} />}
                </AdminChartCard>

                {/* Recent activity */}
                <div className="bg-card rounded-lg border border-border p-5 md:p-6 shadow-[0_2px_10px_rgba(24,49,38,0.025)]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Activity size={16} />
                                </span>
                                <h3 className="text-[15px] font-semibold text-foreground">Siste adminaktivitet</h3>
                            </div>
                            <p className="mt-1.5 pl-10 text-xs text-muted-foreground">
                                {data?.recentActivity?.length ?? 0} siste hendelser · like systemmeldinger samles
                            </p>
                        </div>
                        <Link
                            to="/developer/audit"
                            className="inline-flex shrink-0 items-center gap-1 pt-1 text-xs font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
                        >
                            Aktivitetslogg <ArrowRight size={13} />
                        </Link>
                    </div>
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : !data?.recentActivity?.length ? (
                        <AdminEmptyState description="Ingen aktivitet registrert ennå." className="py-6" />
                    ) : (
                        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                            {activityGroups.map(({ item, occurrences }) => (
                                <AdminActivityItem key={item._id} item={item} occurrences={occurrences} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Recent rows */}
            <section
                aria-label="Siste oppføringer"
                className="grid grid-cols-1 xl:grid-cols-3 gap-4"
            >
                <Section title="Siste brukere" to="/dashboard/users">
                    {isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <RecentUsersTable users={data?.recentUsers ?? []} />
                    )}
                </Section>

                <Section title="Siste tjenester" to="/dashboard/services">
                    {isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <RecentServicesTable services={data?.recentServices ?? []} />
                    )}
                </Section>

                <Section title="Siste ordrer" to="/dashboard/orders">
                    {isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <RecentOrdersTable orders={data?.recentOrders ?? []} />
                    )}
                </Section>
            </section>
        </div>
    );
}
