import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    CalendarDays,
    Banknote,
    Clock3,
    DollarSign,
    RefreshCw,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { nb } from 'date-fns/locale';
import { useSafePayFinanceSummary, useSafePayList } from '../../hooks/admin/safepay';
import type { SafePayContract, SafePayFinanceSummary } from '../../types/admin/safepay';
import {
    AdminEmptyState,
    AdminErrorState,
    AdminFilterSelect,
    AdminLoadingSkeleton,
    AdminPageHeader,
    AdminSearchInput,
    AdminStatusBadge,
} from '../../components/admin';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { ChatIdCell } from '../../components/admin/chat/ChatIdCell';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/developer/ui/table';
import { Button } from '../../components/developer/ui/button';
import { Calendar } from '../../components/developer/ui/calendar';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const STATUS_OPTIONS = [
    { label: 'Venter betaling', value: 'awaiting_payment' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Pågår', value: 'in_progress' },
    { label: 'Fullført', value: 'completed' },
    { label: 'Avbrutt', value: 'cancelled' },
    { label: 'Tvist', value: 'disputed' },
];

const PAYMENT_OPTIONS = [
    { label: 'Ubetalt', value: 'unpaid' },
    { label: 'Venter', value: 'pending' },
    { label: 'Betalt', value: 'paid' },
    { label: 'Refundert', value: 'refunded' },
];

type FinanceMetric = {
    key: string;
    currency: string;
    liveMode?: boolean;
    transferredAmount: number;
    transferredCount: number;
    pendingAmount: number;
    pendingCount: number;
    feeAmount: number;
};

function financeMetrics(summary?: SafePayFinanceSummary): FinanceMetric[] {
    if (!summary) return [];
    const scopes = new Map<string, FinanceMetric>();
    const getScope = (currency: string, liveMode?: boolean) => {
        const key = `${currency}:${liveMode ?? 'unknown'}`;
        if (!scopes.has(key)) {
            scopes.set(key, {
                key,
                currency,
                liveMode,
                transferredAmount: 0,
                transferredCount: 0,
                pendingAmount: 0,
                pendingCount: 0,
                feeAmount: 0,
            });
        }
        return scopes.get(key)!;
    };
    const settledStatuses = new Set(['transferred', 'partially_reversed', 'fully_reversed']);

    summary.transfers.forEach((group) => {
        const metric = getScope(group._id.currency, group._id.mode);
        if (settledStatuses.has(group._id.status ?? '')) {
            metric.transferredAmount += group.amount;
            metric.transferredCount += group.count;
            metric.feeAmount += group.jobbloFee ?? 0;
        }
    });
    summary.pendingTransfers.forEach((group) => {
        const metric = getScope(group._id.currency, group._id.mode);
        metric.pendingAmount += group.amount;
        metric.pendingCount += group.count;
    });
    return Array.from(scopes.values()).sort((a, b) =>
        a.currency.localeCompare(b.currency) || Number(a.liveMode) - Number(b.liveMode)
    );
}

function formatMinor(amount: number, currency: string) {
    const code = currency.toUpperCase();
    const formatter = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: code });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(amount / (10 ** fractionDigits));
}

function formatNok(amount: number) {
    return new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
        maximumFractionDigits: 2,
    }).format(amount);
}

function FinanceMetricCard({
    title,
    icon,
    metrics,
    amount,
    count,
    countLabel,
    mode,
}: {
    title: string;
    icon: ReactNode;
    metrics: FinanceMetric[];
    amount: (metric: FinanceMetric) => number;
    count: (metric: FinanceMetric) => number;
    countLabel: string;
    mode: SafePayFinanceSummary['mode'];
}) {
    return (
        <article className="flex min-h-44 flex-col justify-between rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">
                    {title}{mode === 'all' ? '' : ` · ${mode === 'live' ? 'Live' : 'Test'}`}
                </h3>
                <span className="rounded-md bg-primary/10 p-2 text-primary">{icon}</span>
            </div>
            {metrics.length ? (
                <div className="space-y-1.5">
                    {metrics.map((metric) => (
                        <div key={metric.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="text-xs text-muted-foreground">
                                {mode === 'all' ? `${metric.liveMode === undefined ? 'Ukjent modus' : metric.liveMode ? 'Live' : 'Test'} · ` : ''}
                                {metric.currency.toUpperCase()}
                            </span>
                            <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
                                {formatMinor(amount(metric), metric.currency)}
                            </span>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        {metrics.reduce((total, metric) => total + count(metric), 0).toLocaleString('nb-NO')} {countLabel}
                    </p>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Ingen finansposter registrert ennå.</p>
            )}
        </article>
    );
}

function parseLocalDate(value: string) {
    if (!value) return undefined;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function dateInputValue(value?: Date) {
    if (!value) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function dateLabel(value: string, placeholder: string) {
    const selected = parseLocalDate(value);
    return selected
        ? selected.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
        : placeholder;
}

function isPastConnectDeadline(contract: SafePayContract) {
    return contract.paymentStatus === 'paid'
        && !contract.startedAt
        && !!contract.providerConnectDeadlineAt
        && new Date(contract.providerConnectDeadlineAt).getTime() <= Date.now();
}

function FollowUpStatus({ contract }: { contract: SafePayContract }) {
    const status = contract.providerConnectTimeout?.status;
    if (status) return <AdminStatusBadge status={status} />;
    if (isPastConnectDeadline(contract)) {
        return <AdminStatusBadge status="deadline_expired" />;
    }
    return <span className="text-sm text-muted-foreground">–</span>;
}

function FollowUpPanel({
    contracts,
    total,
    loading,
    error,
    onRetry,
}: {
    contracts: SafePayContract[];
    total: number;
    loading: boolean;
    error: boolean;
    onRetry: () => void;
}) {
    if (!loading && !error && total === 0) return null;

    return (
        <section className="overflow-hidden rounded-lg border border-amber-200/80 bg-card" aria-labelledby="safepay-followup-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                        <AlertTriangle size={17} />
                    </span>
                    <div>
                        <h2 id="safepay-followup-title" className="text-sm font-semibold text-foreground">Krever oppfølging</h2>
                        <p className="text-xs text-muted-foreground">Kun aktive Connect-frister og refusjonssaker fra SafePay-dataene.</p>
                    </div>
                </div>
                {!loading && !error && total > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{total} saker</span>
                )}
            </div>
            {loading ? (
                <div className="p-5"><AdminLoadingSkeleton rows={2} /></div>
            ) : error ? (
                <div className="px-5 py-4">
                    <p className="text-sm text-red-700">Oppfølgingssaker kunne ikke lastes.</p>
                    <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">Prøv igjen</Button>
                </div>
            ) : (
                <>
                    <ul className="divide-y divide-amber-100">
                        {contracts.map((contract) => (
                            <li key={contract._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                <div className="min-w-0">
                                    <Link to={`/dashboard/safepay/${contract._id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                                        #{contract._id.slice(-8).toUpperCase()}
                                    </Link>
                                    <p className="mt-0.5 truncate text-sm text-foreground">
                                        {contract.serviceId?.title ?? 'Tjeneste ikke tilgjengelig'}
                                        {contract.providerId?.name ? ` · ${contract.providerId.name}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <FollowUpStatus contract={contract} />
                                    <Link
                                        to={`/dashboard/safepay/${contract._id}`}
                                        className="text-xs font-semibold text-primary hover:underline"
                                    >
                                        Se sak
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {total > contracts.length && (
                        <div className="border-t border-amber-100 px-5 py-3">
                            <Link to="/dashboard/safepay?timeoutReview=true" className="text-xs font-semibold text-primary hover:underline">
                                Vis alle {total} oppfølgingssaker
                            </Link>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

export default function SafePayPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [timeoutReview, setTimeoutReview] = useState(() => searchParams.get('timeoutReview') === 'true' ? 'true' : '');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [fromDateOpen, setFromDateOpen] = useState(false);
    const [toDateOpen, setToDateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [financeMode, setFinanceMode] = useState<SafePayFinanceSummary['mode']>('all');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 350);
        return () => window.clearTimeout(timer);
    }, [search]);

    const { data, isLoading, isFetching, isError, refetch } = useSafePayList({
        page,
        limit: 15,
        sortOrder,
        ...(statusFilter && { status: statusFilter }),
        ...(paymentFilter && { paymentStatus: paymentFilter }),
        ...(timeoutReview && { timeoutReview }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(debouncedSearch && { orderId: debouncedSearch }),
    });
    const attention = useSafePayList({ page: 1, limit: 4, timeoutReview: 'true' });
    const {
        data: financeSummary,
        isLoading: financeSummaryLoading,
        isError: financeSummaryError,
        refetch: refetchFinanceSummary,
    } = useSafePayFinanceSummary(financeMode);
    const financeData = financeMetrics(financeSummary);

    const clearFilters = () => {
        setSearch('');
        setDebouncedSearch('');
        setStatusFilter('');
        setPaymentFilter('');
        setTimeoutReview('');
        setSearchParams({});
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const activeFilterCount = [
        statusFilter,
        paymentFilter,
        timeoutReview,
        dateFrom,
        dateTo,
        debouncedSearch,
    ].filter(Boolean).length;

    const columns: ColumnDef<SafePayContract>[] = [
        {
            key: 'contract',
            header: 'Kontrakt',
            render: (contract) => (
                <div className="min-w-[108px]">
                    <Link to={`/dashboard/safepay/${contract._id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        #{contract._id.slice(-8).toUpperCase()}
                    </Link>
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(contract.createdAt).toLocaleDateString('nb-NO')}</p>
                </div>
            ),
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (contract) => (
                <div className="max-w-[190px]">
                    <p className="truncate text-sm font-medium text-foreground">{contract.serviceId?.title ?? '–'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Chat <ChatIdCell chatId={contract.chatId} reviewSource="safepay" /></p>
                </div>
            ),
        },
        {
            key: 'participants',
            header: 'Kunde / tilbyder',
            render: (contract) => (
                <div className="min-w-[160px] space-y-1">
                    <p className="truncate text-sm text-foreground">{contract.customerId?.name ?? 'Kunde –'}</p>
                    <p className="truncate text-xs text-muted-foreground">{contract.providerId?.name ?? 'Tilbyder –'}</p>
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Avtalt pris',
            render: (contract) => (
                <div className="whitespace-nowrap">
                    <p className="text-sm font-semibold text-foreground">{contract.agreedPrice != null ? formatNok(contract.agreedPrice) : '–'}</p>
                    {contract.fee != null && <p className="mt-1 text-xs text-muted-foreground">Gebyr {formatNok(contract.fee)}</p>}
                </div>
            ),
        },
        {
            key: 'orderStatus',
            header: 'Ordre',
            render: (contract) => <AdminStatusBadge status={contract.status} />,
        },
        {
            key: 'paymentStatus',
            header: 'Betaling',
            render: (contract) => <AdminStatusBadge status={contract.paymentStatus} />,
        },
        {
            key: 'connect',
            header: 'Connect-konto',
            render: (contract) => contract.safePayStatus?.providerConnectStatus
                ? <AdminStatusBadge status={contract.safePayStatus.providerConnectStatus} />
                : <span className="text-sm text-muted-foreground">–</span>,
        },
        {
            key: 'refund',
            header: 'Refusjon',
            render: (contract) => contract.safePayStatus?.refundStatus && contract.safePayStatus.refundStatus !== 'none'
                ? <AdminStatusBadge status={contract.safePayStatus.refundStatus} />
                : <span className="text-sm text-muted-foreground">–</span>,
        },
        {
            key: 'followUp',
            header: 'Frist / oppfølging',
            render: (contract) => <FollowUpStatus contract={contract} />,
        },
        {
            key: 'dispute',
            header: 'Tvist',
            render: (contract) => contract.dispute
                ? (
                    <Link to={`/dashboard/disputes/${contract.dispute._id}`} className="inline-flex items-center gap-1.5 hover:opacity-80">
                        <AlertTriangle size={13} className="text-rose-600" />
                        <AdminStatusBadge status={contract.dispute.status} />
                    </Link>
                )
                : <span className="text-sm text-muted-foreground/60">–</span>,
        },
        {
            key: 'actions',
            header: '',
            headerClassName: 'w-24',
            className: 'text-right',
            render: (contract) => (
                <Link to={`/dashboard/safepay/${contract._id}`} className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-muted/50">
                    Detaljer
                </Link>
            ),
        },
    ];

    const reload = () => {
        void refetch();
        void refetchFinanceSummary();
        void attention.refetch();
    };

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="SafePay"
                description="Oversikt over kontrakter, innbetalinger og oppfølging."
                actions={(
                    <Button variant="outline" onClick={reload} disabled={isFetching || financeSummaryLoading} className="gap-2 bg-card">
                        <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                        Oppdater
                    </Button>
                )}
            />

            <section aria-label="SafePay nøkkeltall" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                <div className="sm:col-span-2 xl:col-span-3 flex justify-end">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        Stripe-modus
                        <select
                            value={financeMode}
                            onChange={(event) => setFinanceMode(event.target.value as SafePayFinanceSummary['mode'])}
                            className="min-h-10 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <option value="all">Test + live</option>
                            <option value="test">Test</option>
                            <option value="live">Live</option>
                        </select>
                    </label>
                </div>
                {financeSummaryLoading ? Array.from({ length: 3 }, (_, index) => (
                    <div key={index} aria-hidden="true" className="min-h-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
                )) : financeSummaryError ? (
                    <div className="sm:col-span-2 xl:col-span-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                        Finansoversikten kunne ikke lastes.
                        <button type="button" onClick={() => { void refetchFinanceSummary(); }} className="ml-2 font-semibold underline">
                            Prøv igjen
                        </button>
                    </div>
                ) : financeSummary && (
                    <>
                        <FinanceMetricCard
                            title="Overført til Stripe Connect"
                            icon={<Banknote size={18} />}
                            metrics={financeData}
                            amount={(metric) => metric.transferredAmount}
                            count={(metric) => metric.transferredCount}
                            countLabel="bekreftede overføringer"
                            mode={financeMode}
                        />
                        <FinanceMetricCard
                            title="Avventer overføring"
                            icon={<Clock3 size={18} />}
                            metrics={financeData}
                            amount={(metric) => metric.pendingAmount}
                            count={(metric) => metric.pendingCount}
                            countLabel="oppdrag"
                            mode={financeMode}
                        />
                        <FinanceMetricCard
                            title="Jobblo-gebyrer"
                            icon={<DollarSign size={18} />}
                            metrics={financeData}
                            amount={(metric) => metric.feeAmount}
                            count={(metric) => metric.transferredCount}
                            countLabel="bekreftede overføringer"
                            mode={financeMode}
                        />
                    </>
                )}
            </section>

            <FollowUpPanel
                contracts={attention.data?.contracts ?? []}
                total={attention.data?.pagination?.total ?? 0}
                loading={attention.isLoading}
                error={attention.isError}
                onRetry={() => { void attention.refetch(); }}
            />

            <section aria-label="SafePay-kontrakter" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Kontrakter</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Filtrer og undersøk betalings- og oppfølgingsstatus.</p>
                    </div>
                    {data?.pagination && <span className="text-xs font-medium text-muted-foreground">{data.pagination.total} treff</span>}
                </div>

                <div className="grid grid-cols-1 gap-3 border-b border-border bg-card px-5 py-4 sm:grid-cols-2">
                    <AdminSearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Søk etter ordre-ID"
                        className="min-w-0"
                        inputClassName="!h-12 !max-h-none !rounded-md !border-border !bg-card !pl-11 !text-sm !text-foreground !placeholder:text-muted-foreground"
                    />
                    <AdminFilterSelect
                        value={statusFilter}
                        onChange={(value) => { setStatusFilter(value); setPage(1); }}
                        options={STATUS_OPTIONS}
                        placeholder="Alle statuser"
                        className="!h-12 !min-w-0 !w-full !rounded-md !border-border !bg-card !px-4 !text-sm !text-foreground"
                    />
                    <Popover.Root open={fromDateOpen} onOpenChange={setFromDateOpen}>
                        <Popover.Trigger asChild>
                            <button
                                type="button"
                                aria-label="Fra dato"
                                className="inline-flex min-h-12 min-w-0 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                <span className={dateFrom ? '' : 'text-muted-foreground'}>{dateLabel(dateFrom, 'Fra dato')}</span>
                                <CalendarDays size={18} className="shrink-0 text-muted-foreground" />
                            </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                            <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-50 rounded-lg border border-border bg-card p-2 shadow-lg">
                                <Calendar
                                    mode="single"
                                    locale={nb}
                                    selected={parseLocalDate(dateFrom)}
                                    disabled={dateTo ? { after: parseLocalDate(dateTo)! } : undefined}
                                    onSelect={(value) => {
                                        setDateFrom(dateInputValue(value));
                                        setPage(1);
                                        setFromDateOpen(false);
                                    }}
                                />
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>
                    <Popover.Root open={toDateOpen} onOpenChange={setToDateOpen}>
                        <Popover.Trigger asChild>
                            <button
                                type="button"
                                aria-label="Til dato"
                                className="inline-flex min-h-12 min-w-0 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-4 py-2 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                <span className={dateTo ? '' : 'text-muted-foreground'}>{dateLabel(dateTo, 'Til dato')}</span>
                                <CalendarDays size={18} className="shrink-0 text-muted-foreground" />
                            </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                            <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-50 rounded-lg border border-border bg-card p-2 shadow-lg">
                                <Calendar
                                    mode="single"
                                    locale={nb}
                                    selected={parseLocalDate(dateTo)}
                                    disabled={dateFrom ? { before: parseLocalDate(dateFrom)! } : undefined}
                                    onSelect={(value) => {
                                        setDateTo(dateInputValue(value));
                                        setPage(1);
                                        setToDateOpen(false);
                                    }}
                                />
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>
                    <details className="sm:col-span-2">
                        <summary className="w-fit cursor-pointer py-1 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            Flere filtre
                        </summary>
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <AdminFilterSelect value={paymentFilter} onChange={(value) => { setPaymentFilter(value); setPage(1); }} options={PAYMENT_OPTIONS} placeholder="Alle betalinger" className="!h-12 !min-w-0 !w-full !rounded-md !border-border !bg-card !px-4 !text-sm !text-foreground" />
                            <AdminFilterSelect value={timeoutReview} onChange={(value) => { setTimeoutReview(value); setSearchParams(value ? { timeoutReview: value } : {}); setPage(1); }} options={[{ label: 'Krever oppfølging', value: 'true' }]} placeholder="Connect / refusjon" className="!h-12 !min-w-0 !w-full !rounded-md !border-border !bg-card !px-4 !text-sm !text-foreground" />
                            <button
                                type="button"
                                onClick={clearFilters}
                                disabled={activeFilterCount === 0}
                                className="min-h-12 min-w-0 w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                Nullstill filtre
                            </button>
                        </div>
                    </details>
                </div>
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3" aria-label="Aktive filtre">
                        {debouncedSearch && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Søk: {debouncedSearch}</span>}
                        {statusFilter && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Ordre: {STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? statusFilter}</span>}
                        {paymentFilter && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Betaling: {PAYMENT_OPTIONS.find((option) => option.value === paymentFilter)?.label ?? paymentFilter}</span>}
                        {timeoutReview && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Connect / refusjon: Krever oppfølging</span>}
                        {dateFrom && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Fra: {dateLabel(dateFrom, 'Fra dato')}</span>}
                        {dateTo && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Til: {dateLabel(dateTo, 'Til dato')}</span>}
                    </div>
                )}

                {isLoading ? (
                    <div className="p-5"><AdminLoadingSkeleton rows={6} /></div>
                ) : isError ? (
                    <div className="p-5"><AdminErrorState onRetry={refetch} /></div>
                ) : !data?.contracts.length ? (
                    <div className="px-5 py-10">
                        <AdminEmptyState
                            title={activeFilterCount ? 'Ingen treff' : 'Ingen SafePay-kontrakter'}
                            description={activeFilterCount ? 'Prøv å endre eller nullstille filtrene.' : 'SafePay-kontrakter vises her når de opprettes.'}
                        />
                        {activeFilterCount > 0 && <div className="mt-3 text-center"><Button variant="outline" onClick={clearFilters}>Nullstill filtre</Button></div>}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b border-border bg-card hover:bg-white">
                                        {columns.map((column) => (
                                            <TableHead key={column.key} className={`h-11 whitespace-nowrap px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${column.headerClassName ?? ''}`}>
                                                {column.key === 'contract' ? (
                                                    <button type="button" onClick={() => setSortOrder((order) => order === 'desc' ? 'asc' : 'desc')} className="inline-flex items-center gap-1.5 hover:text-foreground" aria-label={`Sorter etter opprettet dato (${sortOrder === 'desc' ? 'nyeste først' : 'eldste først'})`}>
                                                        Kontrakt
                                                        {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                                                    </button>
                                                ) : column.header}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.contracts.map((contract) => (
                                        <TableRow key={contract._id} className="border-b border-border align-middle transition-colors hover:bg-muted/50">
                                            {columns.map((column) => (
                                                <TableCell key={column.key} className={`px-4 py-3.5 ${column.className ?? ''}`}>
                                                    {column.render(contract)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {data.pagination && (
                            <div>
                                <p className="border-t border-border bg-muted/50 px-5 py-3 text-xs text-muted-foreground">
                                    Connect viser kontotilkobling, ikke en bankutbetaling. Status for overføring til bank er ikke tilgjengelig i SafePay-dataene.
                                </p>
                                <div className="border-t border-border px-5">
                                    <AdminPagination pagination={data.pagination} onPageChange={setPage} />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
