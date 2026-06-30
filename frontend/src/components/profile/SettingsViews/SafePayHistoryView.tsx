import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  ArrowRight,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useState } from 'react';
import { useSafePayHistory } from '../../../features/profile/hooks';
import { Spinner } from '../../Ui/Spinner';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../../stores/userStore';

export const SafePayHistoryView = () => {
  const user = useUserStore((state) => state.user);
  const { data, isLoading } = useSafePayHistory(user?._id);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner />
      </div>
    );
  }

  const history = data?.history || [];
  const summary = data?.summary || {
    totalEarned: 0,
    totalSpent: 0,
    totalFees: 0,
    totalTax: 0,
    transactionCount: 0,
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('no-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpand = (id: string) => {
    if (expandedTransaction === id) {
      setExpandedTransaction(null);
    } else {
      setExpandedTransaction(id);
    }
  };

  return (
    <section className="flex flex-col gap-8 max-w-2xl w-full">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-bold text-gray-900">SafePay historikk</h2>
        <p className="text-[15px] text-[#555] leading-[1.4] font-normal">
          Oversikt over alle utbetalinger og betalinger gjennom SafePay.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-[#16a34a]" />
            <span className="text-[13px] font-medium text-gray-500">Totalt tjent</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900">{Math.abs(summary.totalEarned)} kr</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-[#dc2626]" />
            <span className="text-[13px] font-medium text-gray-500">Totalt brukt</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900">{Math.abs(summary.totalSpent)} kr</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={18} className="text-[#6b7280]" />
            <span className="text-[13px] font-medium text-gray-500">Avgifter</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900">{Math.abs(summary.totalFees)} kr</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-custom-green" />
            <span className="text-[13px] font-medium text-gray-500">Transaksjoner</span>
          </div>
          <p className="text-[24px] font-bold text-gray-900">{summary.transactionCount}</p>
        </div>
      </div>

      {/* History List */}
      <div className="flex flex-col gap-4">
        {history.length > 0 ? (
          history.map((transaction: any) => (
            <div
              key={transaction.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(transaction.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-custom-green-light flex items-center justify-center shrink-0">
                      <ShieldCheck size={24} className="text-custom-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[16px] font-bold text-gray-900 truncate">
                        {transaction.serviceTitle}
                      </h4>
                      <p className="text-[14px] text-gray-500">
                        {transaction.isProvider
                          ? `Jobbet for: ${transaction.customerName}`
                          : `Betalt til: ${transaction.providerName}`}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-1">
                        {formatDate(transaction.paymentDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p
                        className={`text-[18px] font-bold ${transaction.isProvider ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}
                      >
                        {transaction.isProvider ? '+' : '-'}
                        {transaction.isProvider
                          ? transaction.amounts.netProvider
                          : transaction.amounts.totalCustomer}{' '}
                        kr
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[12px] text-green-600">
                        <CheckCircle2 size={14} />
                        <span>Utbetalt</span>
                      </div>
                    </div>
                    <ArrowRight
                      size={18}
                      className={`text-gray-400 transition-transform ${expandedTransaction === transaction.id ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expandedTransaction === transaction.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">Avtalt pris</span>
                      <span className="text-gray-900 font-medium">
                        {transaction.amounts.agreedPrice} kr
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">SafePay avgift (3%)</span>
                      <span className="text-gray-900 font-medium">
                        {transaction.amounts.fee} kr
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">MVA</span>
                      <span className="text-gray-900 font-medium">
                        {transaction.amounts.tax} kr
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between text-[14px]">
                        <span className="text-gray-700 font-semibold">
                          {transaction.isProvider ? 'Du mottar' : 'Du betalte'}
                        </span>
                        <span
                          className={`text-gray-900 font-bold ${transaction.isProvider ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}
                        >
                          {transaction.isProvider ? '+' : '-'}
                          {transaction.isProvider
                            ? transaction.amounts.netProvider
                            : transaction.amounts.totalCustomer}{' '}
                          kr
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck size={32} className="text-gray-200" strokeWidth={1.5} />
            </div>
            <p className="text-gray-400 font-bold text-lg mb-2">Ingen SafePay-historikk ennå</p>
            <p className="text-gray-400 text-[14px] text-center max-w-sm">
              Når du fullfører jobber eller betaler for tjenester via SafePay, vil de vises her.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
