import { useState } from 'react';
import { CreditCard, RefreshCw, ShieldAlert } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import mainLink from '../../api/mainURLs';
import { AdminPageHeader } from '../../components/admin';

type BillingSummary = {
  mode: string;
  subscribers: number;
  statuses: Array<{ _id: string; count: number }>;
  failedInvoices: Array<{
    stripeSessionId: string;
    userId: string;
    planName: string;
    amount: number;
    currency: string;
    livemode: boolean | null;
    createdAt: string;
  }>;
  webhookReadiness: { ready: boolean; status: string; mode: string | null };
};

const statusLabels: Record<string, string> = {
  active: 'Aktive',
  past_due: 'Forfalt',
  inactive: 'Inaktive',
  cancelled: 'Avsluttet',
  expired: 'Utløpt',
};

export default function SubscriptionBillingAdminPage() {
  const [mode, setMode] = useState<'all' | 'test' | 'live'>('all');
  const [cursorUserId, setCursorUserId] = useState<string | null>(null);
  const [reconciliationComplete, setReconciliationComplete] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<BillingSummary>({
    queryKey: ['admin-subscription-billing', mode],
    queryFn: async () =>
      (await mainLink.get(`/api/admin/billing/subscriptions/summary?mode=${mode}`)).data,
  });
  const reconcile = useMutation({
    mutationFn: async () =>
      (
        await mainLink.post('/api/admin/billing/subscriptions/reconcile', {
          mode,
          limit: 10,
          ...(cursorUserId ? { cursorUserId } : {}),
        })
      ).data,
    onSuccess: (result) => {
      setCursorUserId(result.nextCursorUserId || null);
      setReconciliationComplete(!result.nextCursorUserId);
      toast.success(
        `Avstemming fullført for ${result.synchronized} abonnement(er).${
          result.results?.some((item: { status: string }) => item.status === 'failed')
            ? ' Enkelte poster må prøves igjen.'
            : ''
        }`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-billing'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast.error(error.response?.data?.message || 'Avstemming kunne ikke gjennomføres.'),
  });
  const counts = Object.fromEntries((data?.statuses || []).map(({ _id, count }) => [_id, count]));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Abonnementsfakturering"
        description="Abonnentstatus, mislykkede fakturaer og Stripe API-avstemming."
      />
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Stripe-modus
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as 'all' | 'test' | 'live');
                setCursorUserId(null);
                setReconciliationComplete(false);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="all">Test + Live</option>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <button
            type="button"
            disabled={mode === 'all' || reconcile.isPending || reconciliationComplete}
            onClick={() => reconcile.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2d4a3e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} className={reconcile.isPending ? 'animate-spin' : ''} />
            {reconcile.isPending
              ? 'Avstemmer…'
              : reconciliationComplete
                ? 'Avstemming fullført'
                : 'Avstem 10 abonnementer'}
          </button>
        </div>
        {mode === 'all' && (
          <p className="mt-2 text-xs text-gray-500">Velg test eller live for å starte avstemming.</p>
        )}
      </section>

      {isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Kunne ikke hente abonnementsoversikten.
        </div>
      ) : (
        <>
          <section aria-label="Abonnentstatus" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              ['Abonnenter', data?.subscribers ?? 0],
              ...Object.entries(statusLabels).map(([key, label]) => [label, counts[key] || 0]),
            ].map(([label, count]) => (
              <article key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-black text-gray-900">
                  {isLoading ? '…' : Number(count).toLocaleString('nb-NO')}
                </p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              {data?.webhookReadiness.ready ? (
                <CreditCard size={18} className="text-emerald-600" />
              ) : (
                <ShieldAlert size={18} className="text-amber-600" />
              )}
              <h2 className="font-bold text-gray-900">Webhook-status</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {data?.webhookReadiness.ready
                ? `Stripe-webhook er verifisert for ${data.webhookReadiness.mode?.toUpperCase()}-modus.`
                : `Webhook krever oppfølging (${data?.webhookReadiness.status || 'ukjent status'}).`}
            </p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">Mislykkede abonnementsbetalinger</h2>
            </div>
            {!data?.failedInvoices.length ? (
              <p className="p-5 text-sm text-gray-500">Ingen mislykkede betalinger registrert.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.failedInvoices.map((invoice) => (
                  <li
                    key={invoice.stripeSessionId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{invoice.planName || 'Abonnement'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {invoice.userId} · {new Date(invoice.createdAt).toLocaleDateString('nb-NO')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {invoice.livemode === false ? 'TEST' : invoice.livemode === true ? 'LIVE' : 'UKJENT'}
                      </span>
                      <span className="font-bold text-gray-900">
                        {new Intl.NumberFormat('nb-NO', {
                          style: 'currency',
                          currency: (invoice.currency || 'nok').toUpperCase(),
                        }).format(invoice.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
