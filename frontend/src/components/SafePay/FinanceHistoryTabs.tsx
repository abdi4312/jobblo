import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  HelpCircle,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { nb } from 'date-fns/locale';
import { Calendar } from '../Ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../Ui/select';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { getFinanceList, getFinanceSummary, reconcileFinance } from '../../api/safePayAPI';

type HistoryTab = 'transfers' | 'bank-payouts';
type Mode = 'current' | 'all' | 'test' | 'live';

interface FinanceItem {
  id: string;
  type: string;
  stripeTransferId?: string | null;
  stripePayoutId?: string;
  orderId?: string | null;
  orderTitle?: string | null;
  agreedPrice?: number | null;
  netProviderAmount?: number | null;
  provider?: { id: string; name: string | null } | null;
  customer?: { id: string; name: string | null };
  stripeAccountId: string;
  amount: number;
  amountReversed?: number | null;
  currency: string | null;
  status: string;
  stripeStatus?: string | null;
  mode: 'test' | 'live' | 'unknown';
  stripeCreatedAt?: string | null;
  arrivalDate?: string | null;
  payoutType?: 'automatic' | 'manual' | null;
  lastSyncedAt?: string | null;
  destination?: { last4: string; bankName: string | null } | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  jobbloFee?: number | null;
  stripeDashboardUrl?: string;
  sourceTransactionId?: string | null;
  destinationPaymentId?: string | null;
  balanceTransactionId?: string | null;
  audit?: Array<{ eventType?: string; status?: string; at?: string | null }>;
}

interface FinanceResponse {
  items: FinanceItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean };
  mode: string;
  activeMode?: 'test' | 'live';
  testDataNotice: string | null;
  lastSyncedAt: string | null;
  snapshotAt: string;
}

interface FinanceSummaryGroup {
  _id: { currency: string; status?: string; mode?: boolean };
  count: number;
  amount: number;
  jobbloFee?: number;
}

interface FinanceSummary {
  transfers: FinanceSummaryGroup[];
  bankPayouts: FinanceSummaryGroup[];
  pendingTransfers?: Array<{
    _id: { currency: string; mode?: boolean };
    count: number;
    amount: number;
  }>;
}

interface Props {
  admin?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  transferred: 'Overført',
  partially_reversed: 'Delvis tilbakeført',
  fully_reversed: 'Fullt tilbakeført',
  awaiting_customer_approval: 'Avventer',
  release_scheduled: 'Planlagt',
  transfer_processing: 'Behandles',
  transfer_failed: 'Mislyktes',
  reconciliation_required: 'Krever kontroll',
  unknown: 'Ikke verifisert',
  pending: 'Avventer',
  in_transit: 'Under behandling',
  paid: 'Utbetalt til bank',
  failed: 'Mislyktes',
  canceled: 'Kansellert',
};

const STATUS_CLASSES: Record<string, string> = {
  transferred: 'bg-[#eaf1e9] text-[#2e6641]',
  partially_reversed: 'bg-amber-50 text-amber-800',
  fully_reversed: 'bg-rose-50 text-rose-700',
  awaiting_customer_approval: 'bg-amber-50 text-amber-800',
  release_scheduled: 'bg-blue-50 text-blue-700',
  transfer_processing: 'bg-blue-50 text-blue-700',
  transfer_failed: 'bg-rose-50 text-rose-700',
  reconciliation_required: 'bg-orange-50 text-orange-800',
  unknown: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-50 text-amber-800',
  in_transit: 'bg-blue-50 text-blue-700',
  paid: 'bg-[#eaf1e9] text-[#2e6641]',
  failed: 'bg-rose-50 text-rose-700',
  canceled: 'bg-gray-100 text-gray-700',
};

function currencyDigits(currency: string) {
  const code = currency.toUpperCase();
  if (['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'].includes(code)) return 0;
  if (['BHD', 'JOD', 'KWD', 'OMR', 'TND'].includes(code)) return 3;
  return 2;
}

function money(minor: number, currency: string | null) {
  if (!currency || !Number.isSafeInteger(minor)) return '–';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: currencyDigits(currency),
    maximumFractionDigits: currencyDigits(currency),
  }).format(minor / 10 ** currencyDigits(currency));
}

function date(value?: string | null) {
  if (!value) return '–';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '–' : parsed.toLocaleString('nb-NO');
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

function shortReference(value?: string | null) {
  if (!value) return '–';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_CLASSES[value] || STATUS_CLASSES.unknown
      }`}
    >
      {STATUS_LABELS[value] || STATUS_LABELS.unknown}
    </span>
  );
}

export default function FinanceHistoryTabs({ admin = false }: Props) {
  const [tab, setTab] = useState<HistoryTab>('transfers');
  const [mode, setMode] = useState<Mode>(admin ? 'all' : 'current');
  const [reconcileMode, setReconcileMode] = useState<'test' | 'live'>('test');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<FinanceItem | null>(null);
  const [copiedReference, setCopiedReference] = useState('');
  const [copyError, setCopyError] = useState('');
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [reconcileMessage, setReconcileMessage] = useState('');
  const [reconcileCursor, setReconcileCursor] = useState<string | null>(null);
  const reconcileModeInitialized = useRef(false);
  const snapshotAtRef = useRef<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const listQuery = useQuery({
    // refreshKey is in the key so "Oppdater" and a reconcile force a fresh read, as before.
    queryKey: ['finance-history', admin, tab, mode, status, debouncedSearch, dateFrom, dateTo, page, refreshKey],
    enabled: !invalidDateRange,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (page > 1 && snapshotAtRef.current) query.set('snapshotAt', snapshotAtRef.current);
      if (admin && mode !== 'current') query.set('mode', mode);
      if (status) query.set('status', status);
      if (debouncedSearch) query.set('search', debouncedSearch);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) {
        const endOfDay = new Date(`${dateTo}T23:59:59.999`);
        query.set('dateTo', endOfDay.toISOString());
      }
      return getFinanceList<FinanceResponse>(admin, tab === 'transfers' ? 'transfers' : 'bank-payouts', query);
    },
  });
  const result = listQuery.data ?? null;
  const loading = listQuery.isFetching;
  const error = invalidDateRange || !listQuery.error
    ? ''
    : (listQuery.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      'Kunne ikke hente transaksjonshistorikken. Prøv igjen.';

  useEffect(() => {
    if (!listQuery.data) return;
    snapshotAtRef.current = listQuery.data.snapshotAt;
    if (admin && !reconcileModeInitialized.current && listQuery.data.activeMode) {
      setReconcileMode(listQuery.data.activeMode);
      reconcileModeInitialized.current = true;
    }
  }, [admin, listQuery.data]);

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', admin, mode, refreshKey],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () => getFinanceSummary<FinanceSummary>(admin, mode === 'current' ? 'all' : mode),
  });
  const summary = summaryQuery.data ?? null;
  const summaryLoading = summaryQuery.isFetching;
  const summaryError = summaryQuery.isError ? 'Økonomioversikten kunne ikke oppdateres.' : '';

  const reconcileMutation = useMutation({ mutationFn: reconcileFinance });
  const reconciling = reconcileMutation.isPending;

  const refresh = () => setRefreshKey((value) => value + 1);
  const reconcile = async () => {
    if (!admin) return;
    setReconcileMessage('');
    try {
      const data = await reconcileMutation.mutateAsync({
        mode: reconcileMode,
        limit: 10,
        ...(reconcileCursor ? { cursorProviderId: reconcileCursor } : {}),
      });
      setReconcileCursor(data.nextCursorProviderId || null);
      setReconcileMessage(`Avstemming fullført for ${data.synchronizedAccounts} konto(er).${data.nextCursorProviderId ? ' Synkroniser igjen for neste side.' : ''}`);
      refresh();
    } catch (requestError) {
      const errorMessage = (requestError as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setReconcileMessage(errorMessage || 'Avstemming kunne ikke gjennomføres.');
    }
  };

  const rows = result?.items || [];
  const modeMatches = <T extends { _id: { mode?: boolean } }>(group: T) =>
    !admin || mode === 'all' || group._id.mode === (mode === 'live');
  const transferGroups = (summary?.transfers || []).filter(modeMatches);
  const bankGroups = (summary?.bankPayouts || []).filter(modeMatches);
  const pendingGroups = (summary?.pendingTransfers || []).filter(modeMatches);
  const metricScopes = Array.from(new Map(
    [...transferGroups, ...pendingGroups].map((group) => {
      const scopedMode = admin ? group._id.mode : undefined;
      return [`${group._id.currency}:${scopedMode ?? 'current'}`, {
        currency: group._id.currency,
        mode: scopedMode,
      }];
    }),
  ).values());
  const bankScopes = Array.from(new Map(
    bankGroups.map((group) => {
      const scopedMode = admin ? group._id.mode : undefined;
      return [`${group._id.currency}:${scopedMode ?? 'current'}`, {
        currency: group._id.currency,
        mode: scopedMode,
      }];
    }),
  ).values());
  const transferMetrics = metricScopes.map(({ currency, mode: scopedMode }) => {
    const inScope = (group: FinanceSummaryGroup) =>
      group._id.currency === currency && (!admin || group._id.mode === scopedMode);
    const settled = transferGroups.filter((group) =>
      inScope(group) &&
      ['transferred', 'partially_reversed', 'fully_reversed'].includes(group._id.status || '')
    );
    const pending = pendingGroups.filter(inScope);
    return {
      key: `${currency}:${scopedMode ?? 'current'}`,
      currency,
      mode: scopedMode,
      transferredAmount: settled.reduce((sum, group) => sum + group.amount, 0),
      transferredCount: settled.reduce((sum, group) => sum + group.count, 0),
      pendingAmount: pending.reduce((sum, group) => sum + group.amount, 0),
      pendingCount: pending.reduce((sum, group) => sum + group.count, 0),
      feeAmount: settled.reduce((sum, group) => sum + (group.jobbloFee || 0), 0),
    };
  });
  const bankMetrics = bankScopes.map(({ currency, mode: scopedMode }) => ({
    key: `${currency}:${scopedMode ?? 'current'}`,
    currency,
    paid: bankGroups.filter((group) => group._id.currency === currency &&
      (!admin || group._id.mode === scopedMode) && group._id.status === 'paid'),
    processing: bankGroups.filter((group) => group._id.currency === currency &&
      (!admin || group._id.mode === scopedMode) &&
      ['pending', 'in_transit'].includes(group._id.status || '')),
    failed: bankGroups.filter((group) => group._id.currency === currency &&
      (!admin || group._id.mode === scopedMode) &&
      ['failed', 'canceled'].includes(group._id.status || '')),
    mode: scopedMode,
  }));
  const filtersActive = Boolean(search || status || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };
  const copyReference = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedReference(value);
      setCopyError('');
      window.setTimeout(() => setCopiedReference(''), 1500);
    } catch {
      setCopyError('Kunne ikke kopiere referansen.');
      window.setTimeout(() => setCopyError(''), 2500);
    }
  };

  useEffect(() => {
    if (!selected) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  const openDetails = (item: FinanceItem) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelected(item);
  };

  const trapDialogTab = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-[#e6e7e1] bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#17211a]">
              Transaksjoner og utbetalinger
            </h2>
            {result?.mode === 'test' && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Testmodus
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#63665f]">
            Følg overføringer til Stripe Connect og utbetalinger til bankkontoen din.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {admin && (
            <select
              aria-label="Stripe-modus"
              value={mode}
              onChange={(event) => { setMode(event.target.value as Mode); setPage(1); }}
              className="min-h-10 rounded-xl border border-[#dfe3dc] bg-white px-3 py-2 text-sm text-[#26332a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
            >
              <option value="all">Test + live</option>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#dfe3dc] px-3 py-2 text-sm font-semibold text-[#26332a] transition-colors hover:bg-[#f6f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
            {loading ? 'Oppdaterer…' : 'Oppdater'}
          </button>
          {admin && (
            <div className="inline-flex items-center gap-2">
              <select
                aria-label="Modus for avstemming"
                value={reconcileMode}
                onChange={(event) => {
                  setReconcileMode(event.target.value as 'test' | 'live');
                  reconcileModeInitialized.current = true;
                  setReconcileCursor(null);
                  setReconcileMessage('');
                }}
                className="min-h-10 rounded-xl border border-[#dfe3dc] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
              <button type="button" onClick={reconcile} disabled={reconciling} className="min-h-10 rounded-xl bg-[#2e6641] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641] focus-visible:ring-offset-2 disabled:opacity-60">
                {reconciling ? 'Avstemmer…' : 'Synkroniser'}
              </button>
            </div>
          )}
        </div>
      </div>

      {result?.lastSyncedAt && (
        <p className="text-xs text-[#747b72]">
          Sist synkronisert {date(result.lastSyncedAt)}
        </p>
      )}

      <div className="flex gap-1 border-b border-[#e6e7e1]" role="tablist" aria-label="Finanshistorikk">
        {([
          ['transfers', 'Overføringer'],
          ['bank-payouts', 'Bankutbetalinger'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`finance-tab-${value}`}
            aria-controls="finance-history-panel"
            aria-selected={tab === value}
            onClick={() => { setTab(value); setPage(1); setStatus(''); }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home'
                ? 'transfers'
                : event.key === 'End'
                  ? 'bank-payouts'
                  : value === 'transfers' ? 'bank-payouts' : 'transfers';
              setTab(next);
              setPage(1);
              setStatus('');
              window.requestAnimationFrame(() =>
                document.getElementById(`finance-tab-${next}`)?.focus()
              );
            }}
            className={`min-h-11 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2e6641] ${
              tab === value
                ? 'border-[#2e6641] text-[#2e6641]'
                : 'border-transparent text-[#747b72] hover:text-[#26332a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {summaryError && (
        <p role="status" className="flex items-center gap-2 text-sm text-[#747b72]">
          <AlertCircle size={15} /> {summaryError}
        </p>
      )}
      {copyError && <p role="status" aria-live="polite" className="text-sm text-rose-700">{copyError}</p>}
      {copiedReference && <p role="status" aria-live="polite" className="sr-only">Stripe-referanse kopiert.</p>}
      {tab === 'transfers' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {transferMetrics.map((metric) => (
            <div key={metric.key} className="flex min-h-28 flex-col justify-between rounded-2xl border border-[#e6e7e1] bg-[#fbfcfa] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#747b72]">
                    Overført til Stripe Connect{admin ? ` · ${metric.mode ? 'Live' : 'Test'}` : ''}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight text-[#26332a]">
                    {money(metric.transferredAmount, metric.currency)}
                  </p>
                </div>
                <span className="rounded-xl bg-[#eaf1e9] p-2 text-[#2e6641]"><Banknote size={18} /></span>
              </div>
              <p className="text-xs text-[#747b72]">{metric.transferredCount} bekreftede overføringer</p>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#e6e7e1] pt-3">
                <div>
                  <p className="text-[11px] text-[#747b72]">Avventer overføring</p>
                  <p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums text-[#26332a]">
                    {money(metric.pendingAmount, metric.currency)}
                  </p>
                  <p className="text-[11px] text-[#747b72]">{metric.pendingCount} oppdrag</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-[11px] text-[#747b72]">
                    Jobblo-gebyrer
                    <span className="group relative inline-flex" tabIndex={0}>
                      <HelpCircle size={12} aria-label="Gebyrer knyttet til bekreftede overføringer" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-[#26332a] p-2 text-[11px] font-normal text-white group-focus-within:block group-hover:block">
                        Registrerte gebyrer for bekreftede overføringer.
                      </span>
                    </span>
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums text-[#26332a]">
                    {money(metric.feeAmount, metric.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {summaryLoading && Array.from({ length: 3 }, (_, index) => (
            <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-2xl bg-[#f0f2ee] motion-reduce:animate-none" />
          ))}
          {!summaryLoading && !summaryError && transferMetrics.length === 0 && (
            <p className="text-sm text-[#747b72]">Ingen bekreftede eller ventende overføringer ennå.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {bankMetrics.map(({ key, currency, mode: scopedMode, paid, processing, failed }) => {
            const totals = (items: FinanceSummaryGroup[]) => ({
              amount: items.reduce((sum, item) => sum + item.amount, 0),
              count: items.reduce((sum, item) => sum + item.count, 0),
            });
            const paidTotal = totals(paid);
            const processingTotal = totals(processing);
            const failedTotal = totals(failed);
            return [
              { key: 'paid', label: 'Utbetalt til bank', total: paidTotal, icon: <Banknote size={18} /> },
              { key: 'processing', label: 'Under behandling', total: processingTotal, icon: <Clock3 size={18} /> },
              { key: 'failed', label: 'Mislykkede utbetalinger', total: failedTotal, icon: <AlertCircle size={18} /> },
            ].map((card) => (
              <div key={`${key}-${card.key}`} className="flex min-h-28 flex-col justify-between rounded-2xl border border-[#e6e7e1] bg-[#fbfcfa] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#747b72]">
                      {card.label}{admin ? ` · ${scopedMode ? 'Live' : 'Test'}` : ''}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight text-[#26332a]">
                      {money(card.total.amount, currency)}
                    </p>
                  </div>
                  <span className="rounded-xl bg-[#f0f2ee] p-2 text-[#59645b]">{card.icon}</span>
                </div>
                <p className="text-xs text-[#747b72]">{card.total.count} bankutbetalinger</p>
              </div>
            ));
          })}
          {summaryLoading && Array.from({ length: 3 }, (_, index) => (
            <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-2xl bg-[#f0f2ee] motion-reduce:animate-none" />
          ))}
          {!summaryLoading && !summaryError && bankMetrics.length === 0 && (
            <p className="text-sm text-[#747b72]">Ingen bankutbetalinger registrert ennå.</p>
          )}
        </div>
      )}

      <div
        id="finance-history-panel"
        role="tabpanel"
        aria-labelledby={`finance-tab-${tab}`}
        className="space-y-4"
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="relative min-w-0">
            <span className="sr-only">Søk etter ordre eller Stripe-ID</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858c83]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk etter ordre eller Stripe-ID"
              className="min-h-11 min-w-0 w-full rounded-xl border border-[#dfe3dc] bg-white py-2 pl-9 pr-9 text-sm text-[#26332a] placeholder:text-[#858c83] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
            />
            {search && (
              <button
                type="button"
                aria-label="Tøm søk"
                onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#747b72] hover:bg-[#f0f2ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <Select
            value={status || 'all'}
            onValueChange={(value) => { setStatus(value === 'all' ? '' : value); setPage(1); }}
          >
            <SelectTrigger
              aria-label="Status"
              className="min-h-11 min-w-0 w-full rounded-xl border-[#dfe3dc] bg-white px-3 py-2 text-sm text-[#26332a] focus:ring-2 focus:ring-[#2e6641]"
            >
              <SelectValue placeholder="Alle statuser" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#dfe3dc] bg-white text-[#26332a]">
              <SelectItem value="all">Alle statuser</SelectItem>
              {(tab === 'transfers'
                ? ['transferred', 'partially_reversed', 'fully_reversed', 'awaiting_customer_approval', 'release_scheduled', 'transfer_processing', 'transfer_failed', 'reconciliation_required']
                : ['pending', 'in_transit', 'paid', 'failed', 'canceled']).map((value) => (
                <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover.Root open={fromDateOpen} onOpenChange={setFromDateOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="Fra dato"
                className="inline-flex min-h-11 min-w-0 w-full items-center justify-between gap-2 rounded-xl border border-[#dfe3dc] bg-white px-3 py-2 text-left text-sm text-[#26332a] transition-colors hover:bg-[#fbfcfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
              >
                <span className={dateFrom ? '' : 'text-[#858c83]'}>{dateLabel(dateFrom, 'Fra dato')}</span>
                <CalendarDays size={16} className="shrink-0 text-[#747b72]" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={6}
                collisionPadding={12}
                className="z-50 rounded-2xl border border-[#e6e7e1] bg-white p-2 shadow-lg"
              >
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
                className="inline-flex min-h-11 min-w-0 w-full items-center justify-between gap-2 rounded-xl border border-[#dfe3dc] bg-white px-3 py-2 text-left text-sm text-[#26332a] transition-colors hover:bg-[#fbfcfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
              >
                <span className={dateTo ? '' : 'text-[#858c83]'}>{dateLabel(dateTo, 'Til dato')}</span>
                <CalendarDays size={16} className="shrink-0 text-[#747b72]" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={6}
                collisionPadding={12}
                className="z-50 rounded-2xl border border-[#e6e7e1] bg-white p-2 shadow-lg"
              >
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
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="min-h-11 min-w-0 rounded-xl border border-[#dfe3dc] px-3 py-2 text-sm font-semibold text-[#59645b] transition-colors hover:bg-[#f6f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Nullstill filtre
          </button>
        </div>
        {filtersActive && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Aktive filtre">
            {search.trim() && (
              <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-xs text-[#465249]">
                Søk: {search.trim()}
              </span>
            )}
            {status && (
              <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-xs text-[#465249]">
                Status: {STATUS_LABELS[status] || status}
              </span>
            )}
            {dateFrom && <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-xs text-[#465249]">Fra: {dateFrom}</span>}
            {dateTo && <span className="rounded-full bg-[#f0f2ee] px-3 py-1 text-xs text-[#465249]">Til: {dateTo}</span>}
          </div>
        )}
        {invalidDateRange && (
          <p role="alert" className="text-sm font-medium text-rose-700">«Fra dato» må være før eller samme dag som «Til dato».</p>
        )}

        {reconcileMessage && (
          <p role="status" className="rounded-xl border border-[#dfe3dc] bg-[#f6f8f4] px-3 py-2 text-sm text-[#465249]">
            {reconcileMessage}
          </p>
        )}
        {result?.testDataNotice && (
          <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            Testmodus — transaksjonene er simulerte og representerer ikke ekte bankoverføringer.
          </p>
        )}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <span>{error}{result ? ' Viser sist innlastede data.' : ''}</span>
            <button type="button" onClick={refresh} className="font-semibold underline underline-offset-2">Prøv igjen</button>
          </div>
        )}

        {loading && !result ? (
          <div className="space-y-3" aria-label="Laster transaksjoner" aria-busy="true">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((row) => <div key={row} className="h-28 animate-pulse rounded-2xl bg-[#f0f2ee] motion-reduce:animate-none" />)}
            </div>
            {[1, 2, 3, 4].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-[#f0f2ee] motion-reduce:animate-none" />)}
          </div>
        ) : !loading && !error && rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe3dc] px-5 py-12 text-center">
            <WalletCards className="mx-auto mb-3 text-[#858c83]" size={26} />
            <p className="font-semibold text-[#26332a]">
              {filtersActive ? 'Ingen treff med disse filtrene' : 'Ingen transaksjoner ennå'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-[#747b72]">
              {filtersActive
                ? 'Prøv et annet søk eller fjern noen filtre for å se flere resultater.'
                : tab === 'transfers'
                  ? 'Bekreftede overføringer til Stripe Connect vises her.'
                  : 'Stripe-bankutbetalinger vises her når de er registrert.'}
            </p>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-[#2e6641] hover:bg-[#eaf1e9]">
                Nullstill filtre
              </button>
            )}
          </div>
        ) : rows.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-[#e6e7e1] md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-[#f6f8f4] text-[11px] font-semibold uppercase tracking-wide text-[#747b72]">
                <tr>
                  <th className="px-4 py-3">Dato</th>
                  {tab === 'transfers' && <th className="px-4 py-3">Oppdrag</th>}
                  {admin && <th className="px-4 py-3">Tilbyder / kunde</th>}
                  <th className="px-4 py-3 text-right">Beløp</th>
                  {tab === 'transfers' && <th className="px-4 py-3 text-right">Gebyr</th>}
                  {tab === 'bank-payouts' && <th className="px-4 py-3">Ankomst</th>}
                  {tab === 'bank-payouts' && <th className="px-4 py-3">Bankdestinasjon</th>}
                  <th className="px-4 py-3">Stripe-referanse</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Modus</th>
                  <th className="px-4 py-3 text-right">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {rows.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[#fbfcfa] focus-within:bg-[#fbfcfa]">
                    <td className="whitespace-nowrap px-4 py-3.5 text-[#59645b]">{date(item.stripeCreatedAt)}</td>
                    {tab === 'transfers' && (
                      <td className="max-w-48 px-4 py-3.5">
                        <p className="truncate font-medium text-[#26332a]" title={item.orderTitle || undefined}>
                          {item.orderId ? (
                            <Link
                              to={admin ? `/dashboard/orders/${item.orderId}` : `/provider/orders/${item.orderId}`}
                              className="rounded-sm hover:text-[#2e6641] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                            >
                              {item.orderTitle || 'SafePay-oppdrag'}
                            </Link>
                          ) : item.orderTitle || 'SafePay-oppdrag'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#858c83]" title={item.orderId || undefined}>
                          {item.orderId ? `#${item.orderId.slice(-8)}` : 'Ingen ordre koblet'}
                        </p>
                      </td>
                    )}
                    {admin && (
                      <td className="px-4 py-3.5 text-[#26332a]">
                        {item.provider?.name || 'Ukjent tilbyder'}
                        {item.customer?.name ? <span className="mt-0.5 block text-xs text-[#747b72]">Kunde: {item.customer.name}</span> : null}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-[#26332a]">
                      {money(item.amount, item.currency)}
                    </td>
                    {tab === 'transfers' && (
                      <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[#59645b]">
                        {item.jobbloFee == null ? '–' : money(item.jobbloFee, item.currency)}
                      </td>
                    )}
                    {tab === 'bank-payouts' && <td className="whitespace-nowrap px-4 py-3.5 text-[#59645b]">{date(item.arrivalDate)}</td>}
                    {tab === 'bank-payouts' && (
                      <td className="px-4 py-3.5 text-[#59645b]">
                        {item.destination ? `${item.destination.bankName || 'Bankkonto'} ···· ${item.destination.last4}` : 'Ikke tilgjengelig'}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex max-w-40 items-center gap-1">
                        <span className="truncate font-mono text-xs text-[#59645b]" title={item.stripeTransferId || item.stripePayoutId || undefined}>
                          {shortReference(item.stripeTransferId || item.stripePayoutId)}
                        </span>
                        {(item.stripeTransferId || item.stripePayoutId) && (
                          <button
                            type="button"
                            aria-label="Kopier Stripe-referanse"
                            title="Kopier full Stripe-referanse"
                            onClick={() => void copyReference(item.stripeTransferId || item.stripePayoutId)}
                            className="rounded-md p-1.5 text-[#747b72] transition-colors hover:bg-[#eaf1e9] hover:text-[#2e6641] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                          >
                            {copiedReference === (item.stripeTransferId || item.stripePayoutId)
                              ? <Check size={14} />
                              : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge value={item.status} /></td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${item.mode === 'live' ? 'text-[#2e6641]' : 'text-[#747b72]'}`}>
                        {item.mode === 'unknown' ? 'Ukjent' : item.mode === 'test' ? 'Test' : 'Live'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDetails(item)}
                        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#2e6641] transition-colors hover:bg-[#eaf1e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                      >
                        Vis detaljer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#e6e7e1] bg-white p-4 transition-colors hover:bg-[#fbfcfa]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-semibold tabular-nums text-[#26332a]">{money(item.amount, item.currency)}</p>
                    <p className="mt-1 text-xs text-[#747b72]">{date(item.stripeCreatedAt)}</p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>
                {tab === 'transfers' && (
                  <div className="mt-3">
                    <p className="truncate text-sm font-medium text-[#26332a]">
                      {item.orderId ? (
                        <Link
                          to={admin ? `/dashboard/orders/${item.orderId}` : `/provider/orders/${item.orderId}`}
                          className="rounded-sm hover:text-[#2e6641] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                        >
                          {item.orderTitle || 'SafePay-oppdrag'}
                        </Link>
                      ) : item.orderTitle || 'SafePay-oppdrag'}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[#858c83]">{item.orderId ? `Ordre #${item.orderId.slice(-8)}` : 'Ingen ordre koblet'}</p>
                  </div>
                )}
                <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t border-[#edf0eb] pt-3">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-mono text-xs text-[#59645b]" title={item.stripeTransferId || item.stripePayoutId || undefined}>
                      {shortReference(item.stripeTransferId || item.stripePayoutId)}
                    </span>
                    {(item.stripeTransferId || item.stripePayoutId) && (
                      <button
                        type="button"
                        aria-label="Kopier Stripe-referanse"
                        onClick={() => void copyReference(item.stripeTransferId || item.stripePayoutId)}
                        className="rounded-md p-1.5 text-[#747b72] hover:bg-[#eaf1e9] hover:text-[#2e6641] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                      >
                        {copiedReference === (item.stripeTransferId || item.stripePayoutId)
                          ? <Check size={14} />
                          : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetails(item)}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#2e6641] hover:bg-[#eaf1e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                  >
                    Detaljer
                  </button>
                </div>
                {item.destination && <p className="mt-2 text-xs text-[#747b72]">{item.destination.bankName || 'Bankkonto'} ···· {item.destination.last4}</p>}
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-[#e6e7e1] pt-3 text-sm text-[#747b72] sm:flex-row sm:items-center sm:justify-between">
            <span>
              {result?.pagination.total || 0} {tab === 'transfers' ? 'overføringer' : 'bankutbetalinger'}
              {result?.lastSyncedAt ? ` · Sist synkronisert ${date(result.lastSyncedAt)}` : ''}
            </span>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="min-h-10 rounded-xl border border-[#dfe3dc] px-3 py-2 font-medium text-[#465249] transition-colors hover:bg-[#f6f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641] disabled:opacity-45">Forrige</button>
              <span className="min-w-16 text-center text-xs font-medium tabular-nums">{page} / {Math.max(1, result?.pagination.totalPages || 1)}</span>
              <button type="button" disabled={!result?.pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)} className="min-h-10 rounded-xl border border-[#dfe3dc] px-3 py-2 font-medium text-[#465249] transition-colors hover:bg-[#f6f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641] disabled:opacity-45">Neste</button>
            </div>
          </div>
        </>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#17211a]/40 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-detail-title"
            tabIndex={-1}
            ref={dialogRef}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapDialogTab}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#e6e7e1] bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#edf0eb] pb-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#747b72]">
                  {tab === 'transfers' ? 'Overføring til Stripe Connect' : 'Bankutbetaling'}
                </p>
                <h3 id="finance-detail-title" className="mt-1 truncate text-lg font-semibold text-[#26332a]">
                  {selected.orderTitle || (tab === 'transfers' ? 'SafePay-oppdrag' : 'Utbetaling til bank')}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge value={selected.status} />
                  <span className="text-xs font-medium uppercase tracking-wide text-[#747b72]">
                    {selected.mode === 'unknown' ? 'Modus ukjent' : selected.mode === 'test' ? 'Testmodus' : 'Livemodus'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Lukk transaksjonsdetaljer"
                onClick={() => setSelected(null)}
                className="rounded-xl p-2 text-[#59645b] transition-colors hover:bg-[#f0f2ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
              >
                <X size={18} />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Beløp" value={money(selected.amount, selected.currency)} />
              <Detail label={tab === 'transfers' ? 'Overføringsdato' : 'Opprettet'} value={date(selected.stripeCreatedAt)} />
              {selected.orderId && (
                <Detail label="SafePay-ordre" value={`#${selected.orderId.slice(-8)}`} title={selected.orderId} />
              )}
              {selected.agreedPrice != null && (
                <Detail label="Avtalt pris" value={money(Math.round(selected.agreedPrice * 100), selected.currency)} />
              )}
              {selected.jobbloFee != null && (
                <Detail label="Registrert Jobblo-gebyr" value={money(selected.jobbloFee, selected.currency)} />
              )}
              {selected.netProviderAmount != null && (
                <Detail label="Netto til oppdragstaker" value={money(selected.netProviderAmount, selected.currency)} />
              )}
              {admin && selected.provider?.name && <Detail label="Oppdragstaker" value={selected.provider.name} />}
              {selected.customer?.name && <Detail label="Oppdragsgiver" value={selected.customer.name} />}
              {selected.arrivalDate && <Detail label="Forventet bankankomst" value={date(selected.arrivalDate)} />}
              {selected.destination && (
                <Detail label="Bankdestinasjon" value={`${selected.destination.bankName || 'Bankkonto'} ···· ${selected.destination.last4}`} />
              )}
              {selected.amountReversed != null && selected.amountReversed > 0 && (
                <Detail label="Tilbakeført beløp" value={money(selected.amountReversed, selected.currency)} />
              )}
              <Detail label="Sist verifisert" value={date(selected.lastSyncedAt)} />
              {selected.payoutType && (
                <Detail label="Utbetalingstype" value={selected.payoutType === 'automatic' ? 'Automatisk' : 'Manuell'} />
              )}
              {admin && selected.stripeAccountId && (
                <Detail label="Stripe Connect-konto" value={shortReference(selected.stripeAccountId)} title={selected.stripeAccountId} />
              )}
            </dl>
            {(selected.stripeTransferId || selected.stripePayoutId) && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#e6e7e1] bg-[#fbfcfa] p-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#747b72]">{tab === 'transfers' ? 'Stripe-overføringsreferanse' : 'Stripe-utbetalingsreferanse'}</p>
                  <p className="mt-1 truncate font-mono text-sm text-[#26332a]" title={selected.stripeTransferId || selected.stripePayoutId}>
                    {selected.stripeTransferId || selected.stripePayoutId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyReference(selected.stripeTransferId || selected.stripePayoutId)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#2e6641] hover:bg-[#eaf1e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]"
                >
                  {copiedReference === (selected.stripeTransferId || selected.stripePayoutId)
                    ? <Check size={15} />
                    : <Copy size={15} />}
                  {copiedReference === (selected.stripeTransferId || selected.stripePayoutId) ? 'Kopiert' : 'Kopier'}
                </button>
              </div>
            )}
            {selected.failureMessage && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {selected.failureMessage}{selected.failureCode ? ` (${selected.failureCode})` : ''}
              </p>
            )}
            {selected.audit && selected.audit.length > 0 && (
              <div className="mt-5 border-t border-[#edf0eb] pt-4">
                <h4 className="text-sm font-semibold text-[#26332a]">Registrerte hendelser</h4>
                <ol className="mt-3 space-y-2">
                  {selected.audit.slice(-5).reverse().map((entry, index) => (
                    <li key={`${entry.eventType || entry.status}-${entry.at || index}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#465249]">
                        {entry.status ? STATUS_LABELS[entry.status] || entry.status : entry.eventType || 'Statusoppdatering'}
                      </span>
                      <time className="text-[#747b72]">{date(entry.at)}</time>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {selected.mode === 'test' && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
                Testmodus — transaksjonene er simulerte og representerer ikke ekte bankoverføringer.
              </p>
            )}
            {admin && selected.stripeDashboardUrl && (
              <a href={selected.stripeDashboardUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#2e6641] hover:bg-[#eaf1e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e6641]">
                Åpne Stripe Dashboard <ArrowUpRight size={15} />
              </a>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3">
      <dt className="text-xs text-[#747b72]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#26332a]" title={title}>{value}</dd>
    </div>
  );
}
