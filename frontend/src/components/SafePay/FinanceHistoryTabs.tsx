import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search, WalletCards } from 'lucide-react';
import mainLink from '../../api/mainURLs';

type HistoryTab = 'transfers' | 'bank-payouts';
type Mode = 'current' | 'all' | 'test' | 'live';

interface FinanceItem {
  id: string;
  type: string;
  stripeTransferId?: string | null;
  stripePayoutId?: string;
  orderId?: string | null;
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
  lastSyncedAt?: string | null;
  destination?: { last4: string; bankName: string | null } | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  jobbloFee?: number | null;
  stripeDashboardUrl?: string;
  sourceTransactionId?: string | null;
  destinationPaymentId?: string | null;
  balanceTransactionId?: string | null;
}

interface FinanceResponse {
  items: FinanceItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean };
  mode: string;
  activeMode?: 'test' | 'live';
  testDataNotice: string | null;
  lastSyncedAt: string | null;
}

interface Props {
  admin?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  transferred: 'Overført til Stripe-konto',
  partially_reversed: 'Delvis tilbakeført',
  fully_reversed: 'Fullt tilbakeført',
  awaiting_customer_approval: 'Venter på kundegodkjenning',
  release_scheduled: 'Overføring planlagt',
  transfer_processing: 'Overføring behandles',
  transfer_failed: 'Overføring mislyktes',
  reconciliation_required: 'Avstemming kreves',
  unknown: 'Ukjent / ikke verifisert',
  pending: 'Venter',
  in_transit: 'På vei til bank',
  paid: 'Utbetalt av Stripe',
  failed: 'Mislyktes',
  canceled: 'Kansellert',
};

const STATUS_CLASSES: Record<string, string> = {
  transferred: 'bg-emerald-50 text-emerald-700',
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
  paid: 'bg-emerald-50 text-emerald-700',
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
  return value ? new Date(value).toLocaleString('nb-NO') : '–';
}

export default function FinanceHistoryTabs({ admin = false }: Props) {
  const [tab, setTab] = useState<HistoryTab>('transfers');
  const [mode, setMode] = useState<Mode>(admin ? 'all' : 'current');
  const [reconcileMode, setReconcileMode] = useState<'test' | 'live'>('test');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<FinanceResponse | null>(null);
  const [summary, setSummary] = useState<{ transfers: Array<{ _id: { currency: string; status: string; mode?: boolean }; count: number; amount: number }>; bankPayouts: Array<{ _id: { currency: string; status: string; mode?: boolean }; count: number; amount: number }> } | null>(null);
  const [selected, setSelected] = useState<FinanceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState('');
  const [reconcileCursor, setReconcileCursor] = useState<string | null>(null);
  const reconcileModeInitialized = useRef(false);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (admin && mode !== 'current') query.set('mode', mode);
    if (status) query.set('status', status);
    if (search.trim()) query.set('search', search.trim());
    if (dateFrom) query.set('dateFrom', dateFrom);
    if (dateTo) query.set('dateTo', dateTo);
    const root = admin ? '/api/admin/safepay/finance' : '/api/safepay/finance';
    const listPath = tab === 'transfers' ? 'transfers' : 'bank-payouts';
    const summaryPath = admin
      ? `/api/admin/safepay/finance/summary${mode === 'current' ? '' : `?mode=${mode}`}`
      : '/api/safepay/finance/summary';

    setLoading(true);
    setError('');
    Promise.all([
      mainLink.get<FinanceResponse>(`${root}/${listPath}?${query.toString()}`),
      mainLink.get<{
        transfers: Array<{ _id: { currency: string; status: string; mode?: boolean }; count: number; amount: number }>;
        bankPayouts: Array<{ _id: { currency: string; status: string; mode?: boolean }; count: number; amount: number }>;
      }>(summaryPath),
    ])
      .then(([listResponse, summaryResponse]) => {
        if (!active) return;
        setResult(listResponse.data);
        setSummary(summaryResponse.data);
        if (admin && !reconcileModeInitialized.current && listResponse.data.activeMode) {
          setReconcileMode(listResponse.data.activeMode);
          reconcileModeInitialized.current = true;
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const errorMessage = (requestError as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(errorMessage || 'Kunne ikke hente transaksjonshistorikken. Prøv igjen.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [admin, dateFrom, dateTo, mode, page, refreshKey, search, status, tab]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const reconcile = async () => {
    if (!admin) return;
    setReconciling(true);
    setReconcileMessage('');
    try {
      const response = await mainLink.post('/api/admin/safepay/finance/reconcile', {
        mode: reconcileMode,
        limit: 10,
        ...(reconcileCursor ? { cursorProviderId: reconcileCursor } : {}),
      });
      setReconcileCursor(response.data.nextCursorProviderId || null);
      setReconcileMessage(`Avstemming fullført for ${response.data.synchronizedAccounts} konto(er).${response.data.nextCursorProviderId ? ' Synkroniser igjen for neste side.' : ''}`);
      refresh();
    } catch (requestError) {
      const errorMessage = (requestError as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setReconcileMessage(errorMessage || 'Avstemming kunne ikke gjennomføres.');
    } finally {
      setReconciling(false);
    }
  };

  const rows = result?.items || [];
  const groups = tab === 'transfers' ? summary?.transfers || [] : summary?.bankPayouts || [];
  const summaryRows = groups.filter((group) =>
    mode === 'all' || mode === 'current' || group._id.mode === (mode === 'live')
  );

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stripe-transaksjonshistorikk</h2>
          <p className="mt-1 text-sm text-gray-500">Stripe Transfer til tilknyttet konto er ikke det samme som bankutbetaling.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin && (
            <select
              aria-label="Stripe-modus"
              value={mode}
              onChange={(event) => { setMode(event.target.value as Mode); setPage(1); }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Test + live</option>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          )}
          <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw size={15} /> Oppdater
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
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
              <button type="button" onClick={reconcile} disabled={reconciling} className="rounded-lg bg-custom-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {reconciling ? 'Avstemmer…' : 'Synkroniser'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-100" role="tablist" aria-label="Finanshistorikk">
        {([
          ['transfers', 'Transfer History'],
          ['bank-payouts', 'Bank Payout History'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => { setTab(value); setPage(1); setStatus(''); }}
            className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === value ? 'border-custom-green text-custom-green' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {summaryRows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {summaryRows.slice(0, 4).map((group) => (
            <div key={`${group._id.currency}-${group._id.status}-${group._id.mode}`} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">{STATUS_LABELS[group._id.status] || group._id.status} · {group._id.currency}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{money(group.amount, group._id.currency)}</p>
              <p className="text-xs text-gray-500">{group.count} transaksjon(er)</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Søk på Stripe-ID eller ordre" className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">Alle statuser</option>
          {(tab === 'transfers'
            ? ['transferred', 'partially_reversed', 'fully_reversed', 'awaiting_customer_approval', 'release_scheduled', 'transfer_processing', 'transfer_failed', 'reconciliation_required']
            : ['pending', 'in_transit', 'paid', 'failed', 'canceled']).map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
        <input aria-label="Fra dato" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
        <input aria-label="Til dato" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" />
      </div>

      {reconcileMessage && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{reconcileMessage}</p>}
      {result?.testDataNotice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{result.testDataNotice}</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button type="button" onClick={refresh} className="ml-2 font-semibold underline">Prøv igjen</button></div>}

      {loading ? (
        <div className="space-y-3" aria-label="Laster transaksjoner">
          {[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : !error && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
          <WalletCards className="mx-auto mb-2 text-gray-400" size={24} />
          Ingen transaksjoner funnet med disse filtrene.
        </div>
      ) : !error && (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-3">Dato</th>
                  {tab === 'transfers' && <th className="px-3 py-3">Ordre</th>}
                  {admin && <th className="px-3 py-3">Tilbyder / kunde</th>}
                  <th className="px-3 py-3">Beløp</th>
                  {tab === 'transfers' && <th className="px-3 py-3">Jobblo-gebyr</th>}
                  {tab === 'bank-payouts' && <th className="px-3 py-3">Forventet ankomst</th>}
                  {tab === 'bank-payouts' && <th className="px-3 py-3">Bank</th>}
                  <th className="px-3 py-3">Stripe-ID</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Modus</th>
                  <th className="px-3 py-3">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 whitespace-nowrap">{date(item.stripeCreatedAt)}</td>
                    {tab === 'transfers' && <td className="px-3 py-3 font-mono text-xs">{item.orderId || '–'}</td>}
                    {admin && <td className="px-3 py-3">{item.provider?.name || 'Ukjent tilbyder'}{item.customer?.name ? <span className="block text-xs text-gray-500">Kunde: {item.customer.name}</span> : null}</td>}
                    <td className="px-3 py-3 font-semibold">{money(item.amount, item.currency)}</td>
                    {tab === 'transfers' && <td className="px-3 py-3">{item.jobbloFee == null ? '–' : money(item.jobbloFee, item.currency)}</td>}
                    {tab === 'bank-payouts' && <td className="px-3 py-3">{date(item.arrivalDate)}</td>}
                    {tab === 'bank-payouts' && <td className="px-3 py-3">{item.destination ? `${item.destination.bankName || 'Bankkonto'} ···· ${item.destination.last4}` : 'Ikke tilgjengelig'}</td>}
                    <td className="px-3 py-3 font-mono text-xs">{item.stripeTransferId || item.stripePayoutId || '–'}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[item.status] || STATUS_CLASSES.unknown}`}>{STATUS_LABELS[item.status] || STATUS_LABELS.unknown}</span></td>
                    <td className="px-3 py-3 text-xs font-semibold uppercase">{item.mode}</td>
                    <td className="px-3 py-3"><button type="button" onClick={() => setSelected(item)} className="text-custom-green hover:underline">Vis</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map((item) => (
              <article key={item.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{money(item.amount, item.currency)}</p>
                    <p className="mt-1 text-xs text-gray-500">{date(item.stripeCreatedAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[item.status] || STATUS_CLASSES.unknown}`}>{STATUS_LABELS[item.status] || STATUS_LABELS.unknown}</span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-gray-600">{item.stripeTransferId || item.stripePayoutId || item.orderId || '–'}</p>
                {item.destination && <p className="mt-1 text-xs text-gray-500">{item.destination.bankName || 'Bankkonto'} ···· {item.destination.last4}</p>}
                <button type="button" onClick={() => setSelected(item)} className="mt-3 text-sm font-semibold text-custom-green">Vis detaljer</button>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
            <span>{result?.pagination.total || 0} transaksjoner · Sist synkronisert {date(result?.lastSyncedAt)}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Forrige</button>
              <span>{page} / {Math.max(1, result?.pagination.totalPages || 1)}</span>
              <button type="button" disabled={!result?.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Neste</button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="finance-detail-title" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="finance-detail-title" className="text-lg font-bold text-gray-900">{tab === 'transfers' ? 'Stripe Transfer' : 'Bankutbetaling fra Stripe'}</h3>
                <p className="mt-1 break-all font-mono text-xs text-gray-500">{selected.stripeTransferId || selected.stripePayoutId || selected.id}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100">Lukk</button>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Detail label="Status" value={STATUS_LABELS[selected.status] || STATUS_LABELS.unknown} />
              <Detail label="Stripe-modus" value={selected.mode.toUpperCase()} />
              <Detail label="Beløp" value={money(selected.amount, selected.currency)} />
              <Detail label="Stripe-konto" value={selected.stripeAccountId || '–'} />
              <Detail label="Opprettet" value={date(selected.stripeCreatedAt)} />
              <Detail label="Sist kontrollert" value={date(selected.lastSyncedAt)} />
              {selected.orderId && <Detail label="SafePay-ordre" value={selected.orderId} />}
              {selected.arrivalDate && <Detail label="Forventet ankomst" value={date(selected.arrivalDate)} />}
              {selected.amountReversed != null && selected.amountReversed > 0 && <Detail label="Tilbakeført beløp" value={money(selected.amountReversed, selected.currency)} />}
              {selected.destination && <Detail label="Bankdestinasjon" value={`${selected.destination.bankName || 'Bankkonto'} ···· ${selected.destination.last4}`} />}
              {selected.sourceTransactionId && <Detail label="Kildebetaling" value={selected.sourceTransactionId} />}
              {selected.destinationPaymentId && <Detail label="Destinasjonsbetaling" value={selected.destinationPaymentId} />}
              {selected.failureMessage && <Detail label="Feil" value={`${selected.failureMessage}${selected.failureCode ? ` (${selected.failureCode})` : ''}`} />}
            </dl>
            {selected.mode === 'test' && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Testdata viser ikke ekte penger eller bankbevegelser.</p>}
            {admin && selected.stripeDashboardUrl && (
              <a href={selected.stripeDashboardUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-custom-green">
                Åpne Stripe Dashboard <ArrowUpRight size={15} />
              </a>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium text-gray-900">{value}</dd></div>;
}
