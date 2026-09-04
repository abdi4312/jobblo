import { useState } from 'react';
import { CreditCard, History, Package, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import mainLink from '../../../api/mainURLs';
import { useQuery } from '@tanstack/react-query';

interface Transaction {
  _id: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  type: 'subscription' | 'extra_contact';
  createdAt: string;
}

interface ContactSummary {
  includedLimit: number;
  includedUsed: number;
  includedRemaining: number;
  perContactPrice: number | null;
  contactUnlockMinutes: number | null;
  paidPurchased: number;
  paidUsed: number;
  paidAvailable: number;
  totalPaidForExtraContacts: number;
}

interface CurrentSubscription {
  hasPlan: boolean;
  plan: string | null;
  planType: 'private' | 'business';
  contacts: ContactSummary;
}

export function SubscriptionView() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['userTransactions', page],
    queryFn: async () => {
      const res = await mainLink.get(`/api/transactions/user?page=${page}&limit=5`);
      return res.data;
    },
  });

  const { data: currentSubscription, isLoading: isSubscriptionLoading } = useQuery<CurrentSubscription | null>({
    queryKey: ['my-subscription'],
    queryFn: async () => (await mainLink.get<{ subscription: CurrentSubscription | null }>('/api/stripe/subscription')).data.subscription,
  });

  const transactions = data?.transactions || [];
  const totalPages = data?.totalPages || 1;
  const contacts = currentSubscription?.contacts;
  const includedProgress = contacts && contacts.includedLimit > 0
    ? Math.min(contacts.includedUsed / contacts.includedLimit, 1)
    : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Current Plan Card */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="text-orange-custom" size={20} />
          Gjeldende abonnement
        </h3>
        <div className="bg-linear-to-br from-[#2d4a3e] to-[#1a2e26] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">
                Aktiv plan
              </p>
              <h4 className="text-3xl font-black">{currentSubscription?.hasPlan ? currentSubscription.plan : 'Ingen aktivt abonnement'}</h4>
              <p className="text-white/60 text-xs mt-2">
                Din kontotype er satt til{' '}
                <span className="text-white font-bold">
                  {currentSubscription?.planType === 'private' ? 'privat' : currentSubscription?.planType || 'privat'}
                </span>
              </p>
            </div>
            <button
              onClick={() => (window.location.href = '/membership')}
              className="bg-white text-[#2d4a3e] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors shadow-md"
            >
              Administrer plan
            </button>
          </div>
          {/* Decorative Pattern */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
          <CreditCard className="text-orange-custom" size={20} />
          Kontakter
        </h3>
        {isSubscriptionLoading || !contacts ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center text-sm font-medium text-gray-500">
            Laster kontaktinformasjon...
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Inkludert', contacts.includedLimit],
                ['Brukt', contacts.includedUsed],
                ['Igjen', contacts.includedRemaining],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-[#F5F6F1] p-4">
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                  <p className="mt-1 text-sm font-medium text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-600">
              {contacts.includedUsed} / {contacts.includedLimit} brukt
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#2E6641]" style={{ width: `${includedProgress * 100}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2">
              <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Ekstra kontakt</span><strong>{contacts.perContactPrice === null ? 'Abonnement kreves' : `${contacts.perContactPrice} NOK`}</strong></div>
              {contacts.contactUnlockMinutes !== null ? <div className="flex justify-between gap-3 text-sm"><span className="text-gray-500">Tilgang til nye oppdrag</span><strong>{contacts.contactUnlockMinutes === 0 ? 'Tilgang i sanntid' : `Tilgang etter ${contacts.contactUnlockMinutes} min`}</strong></div> : null}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <h4 className="text-sm font-bold text-gray-900">Betalte ekstra kontakter</h4>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3"><span className="text-gray-500">Kjøpt</span><strong>{contacts.paidPurchased}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Brukt</span><strong>{contacts.paidUsed}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Tilgjengelig</span><strong>{contacts.paidAvailable}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-gray-500">Betalt for ekstra kontakter</span><strong>{contacts.totalPaidForExtraContacts} NOK</strong></div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <History className="text-orange-custom" size={20} />
          Kjøpshistorikk
        </h3>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Loader2 className="animate-spin text-orange-custom mb-2" size={32} />
            <p className="text-gray-500 font-medium">Laster transaksjoner...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Plan / Vare
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Dato
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Beløp
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx: Transaction) => (
                    <tr key={tx._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#E0883515] flex items-center justify-center text-orange-custom">
                            <CreditCard size={16} />
                          </div>
                          <span className="font-bold text-gray-900">
                            {tx.planName === null ? tx.type : tx.planName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-gray-900">
                        {tx.amount} <span className="text-[10px] uppercase">{tx.currency}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            tx.status === 'succeeded'
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : 'bg-orange-50 text-orange-600 border border-orange-100'
                          }`}
                        >
                          {tx.status === 'succeeded' ? 'Fullført' : tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginering */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-500 font-medium">
                  Side <span className="text-gray-900">{page}</span> av{' '}
                  <span className="text-gray-900">{totalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    title="Forrige side"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    title="Neste side"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <CreditCard className="mx-auto text-gray-300 mb-3" size={40} strokeWidth={1.5} />
            <p className="text-gray-500 font-medium">Ingen kjøpshistorikk funnet.</p>
            <button
              onClick={() => (window.location.href = '/membership')}
              className="mt-4 text-orange-custom font-bold text-sm hover:underline"
            >
              Se planer
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
