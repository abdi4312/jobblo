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
import type { TrendPoint, RecentUser, RecentService, RecentOrder, RoleDistribution, OrderStatusDistribution } from '../../types/admin';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

// ─── Simple bar chart using native SVG ────────────────────────────────────────
function BarChart({ data }: { data: TrendPoint[] }) {
    if (!data.length) return <AdminEmptyState description="Ingen registreringer siste 30 dager." className="py-6" />;

    const max = Math.max(...data.map((d) => d.count), 1);
    const barW = Math.max(4, Math.floor(280 / data.length) - 3);

    return (
        <div className="overflow-x-auto pb-1" role="img" aria-label="Brukerregistreringer siste 30 dager">
            <svg
                viewBox={`0 0 ${data.length * (barW + 3)} 120`}
                className="w-full min-w-[260px] h-32"
                preserveAspectRatio="xMinYMin meet"
            >
                {data.map((d, i) => {
                    const barH = Math.max(2, (d.count / max) * 100);
                    const x = i * (barW + 3);
                    const y = 110 - barH;
                    return (
                        <g key={d._id}>
                            <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={barH}
                                rx={2}
                                className="fill-[#2d4a3e] opacity-80 hover:opacity-100 transition-opacity"
                            />
                            <title>{`${d._id}: ${d.count} bruker(e)`}</title>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── Donut chart for role distribution ───────────────────────────────────────
function DonutChart({ data }: { data: RoleDistribution }) {
    const COLORS: Record<string, string> = {
        user: '#6b7280',
        provider: '#6366f1',
        company: '#8b5cf6',
        superAdmin: '#ef4444',
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
    const r = 40;
    const cx = 60;
    const cy = 60;
    const circumference = 2 * Math.PI * r;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4" role="img" aria-label="Rollefordeling">
            <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
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
                            stroke={COLORS[role] ?? '#9ca3af'}
                            strokeWidth={18}
                            strokeDasharray={`${dash} ${circumference}`}
                            strokeDashoffset={-offset}
                            className="transition-all duration-300"
                        >
                            <title>{`${LABELS[role] ?? role}: ${count}`}</title>
                        </circle>
                    );
                })}
            </svg>
            <ul className="space-y-1.5 text-sm">
                {entries.map(([role, count]) => (
                    <li key={role} className="flex items-center gap-2">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[role] ?? '#9ca3af' }}
                            aria-hidden="true"
                        />
                        <span className="text-gray-600">{LABELS[role] ?? role}</span>
                        <span className="ml-auto font-semibold text-gray-800">{count}</span>
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
        pending: 'bg-yellow-400',
        accepted: 'bg-blue-400',
        in_progress: 'bg-indigo-500',
        completed: 'bg-green-500',
        cancelled: 'bg-red-400',
        paid: 'bg-emerald-500',
        awaiting_payment: 'bg-orange-400',
        declined: 'bg-rose-400',
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

    return (
        <div className="space-y-2.5" role="list" aria-label="Ordrestatus-fordeling">
            {entries.map(([status, count]) => (
                <div key={status} role="listitem">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium">{LABELS[status] ?? status}</span>
                        <span className="text-gray-800 font-semibold">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden" aria-hidden="true">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${COLORS[status] ?? 'bg-gray-400'}`}
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
        <ul className="divide-y divide-gray-50" role="list">
            {users.map((u) => (
                <li key={u._id} className="flex items-center gap-3 py-2.5" role="listitem">
                    <img
                        src={
                            u.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=2d4a3e&color=fff&size=40`
                        }
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
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
        <ul className="divide-y divide-gray-50" role="list">
            {services.map((s) => (
                <li key={s._id} className="py-2.5 flex items-center gap-3" role="listitem">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                        <p className="text-xs text-gray-400 truncate">
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
        <ul className="divide-y divide-gray-50" role="list">
            {orders.map((o) => (
                <li key={o._id} className="py-2.5 flex items-center gap-3" role="listitem">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                            {o.serviceId?.title ?? 'Ukjent tjeneste'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
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
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                <Link
                    to={to}
                    className="flex items-center gap-1 text-xs text-[#2d4a3e] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 rounded"
                >
                    Se alle <ArrowRight size={13} />
                </Link>
            </div>
            {children}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardOverviewPage() {
    const { data, isLoading, isError, refetch } = useDashboardOverview();

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
                subtitle: 'Denne måneden',
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
        <div className="space-y-6">
            <AdminPageHeader
                title="Dashbord"
                description="Oversikt over plattformaktivitet"
            />

            {/* KPI stat cards */}
            <section aria-label="Nøkkeltall">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
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
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
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

            <section aria-label="Ordrestatus" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AdminChartCard
                    title="Ordrestatus"
                    description="Fordeling av alle ordrer"
                    loading={isLoading}
                    isEmpty={!isLoading && !data}
                >
                    {data && <OrderStatusChart data={data.orderStatusDistribution} />}
                </AdminChartCard>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">
                        Siste adminaktivitet
                    </h3>
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : !data?.recentActivity?.length ? (
                        <AdminEmptyState description="Ingen aktivitet registrert ennå." className="py-6" />
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {data.recentActivity.map((item) => (
                                <AdminActivityItem key={item._id} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Recent rows */}
            <section
                aria-label="Siste oppføringer"
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
                <Section title="Siste brukere" to="/dashboard/users">
                    {isLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
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
                                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
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
                                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
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
