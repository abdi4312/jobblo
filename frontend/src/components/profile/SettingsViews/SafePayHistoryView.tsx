import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Banknote,
  Clock,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useSafePayHistory } from '../../../features/profile/hooks';
import { Spinner } from '../../Ui/Spinner';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../../stores/userStore';
import FinanceHistoryTabs from '../../SafePay/FinanceHistoryTabs';

const PayoutStatusBanner = () => {
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();

  const isEnabled = Boolean((user as any)?.payoutEnabled);
  const hasAccount = Boolean((user as any)?.stripeConnectAccountId);

  if (isEnabled) {
    return (
      <button
        type="button"
        onClick={() => navigate('/settings/payout')}
        className="w-full flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 hover:bg-green-100 transition-colors text-left"
      >
        <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-green-900">
              Stripe Connect utbetalingskonto er aktiv
            </span>
            <span className="text-[13px] text-green-800">
              Utbetalinger overføres automatisk til din verifiserte Stripe-konto.
            </span>
          </div>
          <span className="text-[12px] font-semibold text-green-700 flex items-center gap-1">
            Se Stripe-innstillinger
            <ArrowRight size={13} />
          </span>
        </div>
      </button>
    );
  }

  if (hasAccount) {
    return (
      <button
        type="button"
        onClick={() => navigate('/settings/payout')}
        className="w-full flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition-colors text-left"
      >
        <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-amber-900">
              Verifisering kreves for utbetalinger
            </span>
            <span className="text-[13px] text-amber-800">
              Din Stripe Connect-konto krever fullføring før utbetalinger kan frigis.
            </span>
          </div>
          <span className="text-[12px] font-semibold text-amber-700 flex items-center gap-1 bg-white/70 px-3 py-1.5 rounded-xl shrink-0 w-fit">
            Fullfør verifisering
            <ArrowRight size={13} />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate('/settings/payout')}
      className="w-full flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100 transition-colors text-left"
    >
      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-amber-900">
            Ingen utbetalingskonto er satt opp
          </span>
          <span className="text-[13px] text-amber-800">
            Før du kan motta penger for jobber, må du koble til Stripe Connect.
          </span>
        </div>
        <span className="text-[12px] font-semibold text-amber-700 flex items-center gap-1 bg-white/70 px-3 py-1.5 rounded-xl shrink-0 w-fit">
          <Banknote size={14} />
          Sett opp Stripe-utbetaling
          <ArrowRight size={13} />
        </span>
      </div>
    </button>
  );
};

export const SafePayHistoryView = () => {
  const user = useUserStore((state) => state.user);
  const { data, isLoading } = useSafePayHistory(user?._id);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [copiedReference, setCopiedReference] = useState<string | null>(null);

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
    return new Date(date).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMoney = (value: number) =>
    `${new Intl.NumberFormat('nb-NO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0)} kr`;

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedReference(reference);
      window.setTimeout(() => setCopiedReference(null), 1500);
    } catch {
      toast.error('Kunne ikke kopiere referansen');
    }
  };

  const historyStatus = (transaction: any) => {
    if (transaction.refundStatus === 'succeeded') return 'refunded';
    if (transaction.refundStatus === 'pending' || transaction.refundStatus === 'reconciliation_required') {
      return 'refund_pending';
    }
    if (transaction.refundStatus === 'failed') return 'refund_failed';
    return transaction.status;
  };

  const providerPayoutStage = (transaction: any) => {
    if (transaction.refundStatus === 'succeeded') {
      return { key: 'refunded', label: 'Refundert', tone: 'text-gray-600' };
    }
    if (transaction.refundStatus === 'failed') {
      return { key: 'refund_failed', label: 'Refusjon mislyktes', tone: 'text-red-600' };
    }
    if (transaction.refundStatus === 'pending' ||
        transaction.refundStatus === 'reconciliation_required') {
      return { key: 'refund_pending', label: 'Refusjon pågår', tone: 'text-amber-600' };
    }
    if (transaction.cancellationReason === 'provider_stripe_connect_timeout' ||
        transaction.status === 'automatically_cancelled') {
      return { key: 'cancelled', label: 'Automatisk kansellert', tone: 'text-gray-600' };
    }
    if (transaction.providerTransferReversed) {
      return { key: 'reversed', label: 'Overføring reversert', tone: 'text-gray-600' };
    }
    if (transaction.hasVerifiedProviderTransfer &&
        transaction.providerTransferAmountMinor > 0) {
      return { key: 'transferred', label: 'Overført til Stripe Connect', tone: 'text-green-600' };
    }
    if (transaction.payoutStatus === 'failed') {
      return { key: 'failed', label: 'Utbetaling mislyktes', tone: 'text-red-600' };
    }
    if (transaction.payoutStatus === 'reconciliation_required') {
      return { key: 'action', label: 'Handling kreves', tone: 'text-amber-700' };
    }
    if (transaction.providerConnectStatus === 'verification_retry') {
      return { key: 'connect_check', label: 'Stripe Connect-status kontrolleres', tone: 'text-amber-600' };
    }
    if (transaction.providerConnectStatus &&
        transaction.providerConnectStatus !== 'ready') {
      return { key: 'connect', label: 'Avventer utbetaling', tone: 'text-gray-600' };
    }
    if (transaction.payoutStatus ||
        ['completed', 'refunded'].includes(transaction.status)) {
      return { key: 'processing', label: 'Utbetaling behandles', tone: 'text-amber-600' };
    }
    return { key: 'approval', label: 'Venter på godkjenning', tone: 'text-gray-600' };
  };

  const toggleExpand = (id: string) => {
    setExpandedTransaction(expandedTransaction === id ? null : id);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'transferred':
      case 'completed':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-green-600 font-medium">
            <CheckCircle2 size={14} />
            <span>Overført / Utbetalt</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-blue-600 font-medium">
            <Clock size={14} className="animate-spin" />
            <span>Behandles</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-red-600 font-medium">
            <XCircle size={14} />
            <span>Mislyktes (Kan prøves på nytt)</span>
          </div>
        );
      case 'payment_received':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-blue-600 font-medium">
            <CheckCircle2 size={14} />
            <span>Betaling mottatt</span>
          </div>
        );
      case 'waiting_connect':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-amber-600 font-medium">
            <Clock size={14} />
            <span>Venter på Stripe Connect</span>
          </div>
        );
      case 'refund_pending':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-amber-600 font-medium">
            <Clock size={14} />
            <span>Refusjon pågår</span>
          </div>
        );
      case 'refund_failed':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-red-600 font-medium">
            <XCircle size={14} />
            <span>Refusjon mislyktes</span>
          </div>
        );
      case 'automatically_cancelled':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-gray-600 font-medium">
            <XCircle size={14} />
            <span>Automatisk kansellert</span>
          </div>
        );
      case 'refunded':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-green-600 font-medium">
            <CheckCircle2 size={14} />
            <span>Refundert</span>
          </div>
        );
      case 'pending':
      case 'released_internal':
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-amber-600 font-medium">
            <Clock size={14} />
            <span>Venter på verifisering</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-end gap-1 text-[12px] text-gray-500 font-medium">
            <span>{status || 'Fullført'}</span>
          </div>
        );
    }
  };

  return (
    <section className="flex w-full max-w-none flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-bold text-gray-900">SafePay historikk</h2>
        <p className="text-[15px] text-[#555] leading-[1.4] font-normal">
          Oversikt over alle utbetalinger og betalinger gjennom SafePay.
        </p>
      </div>

      {/* Payout setup warning for providers / earners */}
      <PayoutStatusBanner />

      <FinanceHistoryTabs />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-[#e6e7e1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#16a34a]" />
            <span className="text-xs font-medium text-gray-500">Bekreftet overført</span>
          </div>
          <p className="whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight text-gray-900">{formatMoney(summary.totalEarned)}</p>
          <p className="mt-1 text-[11px] text-gray-500">Til Stripe Connect, ikke bankkonto</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#e6e7e1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingDown size={18} className="text-[#dc2626]" />
            <span className="text-xs font-medium text-gray-500">Netto betalt</span>
          </div>
          <p className="whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight text-gray-900">{formatMoney(summary.totalSpent)}</p>
          <p className="mt-1 text-[11px] text-gray-500">Etter bekreftede refusjoner</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#e6e7e1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <Receipt size={18} className="text-[#6b7280]" />
            <span className="text-xs font-medium text-gray-500">Netto SafePay-avgifter</span>
          </div>
          <p className="whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight text-gray-900">{formatMoney(summary.totalFees)}</p>
          <p className="mt-1 text-[11px] text-gray-500">Etter bekreftede refusjoner</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-[#e6e7e1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <Wallet size={18} className="text-custom-green" />
            <span className="text-xs font-medium text-gray-500">SafePay-oppføringer</span>
          </div>
          <p className="whitespace-nowrap text-lg font-semibold tabular-nums tracking-tight text-gray-900">{summary.transactionCount}</p>
          <p className="mt-1 text-[11px] text-gray-500">Betalinger og oppdrag i historikken</p>
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
                          : transaction.hasVerifiedProviderTransfer
                            ? `Betalt til: ${transaction.providerName}`
                            : `Oppdragstaker: ${transaction.providerName}`}
                      </p>
                      <p className="text-[12px] text-gray-400 mt-1">
                        {formatDate(transaction.paymentDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      {transaction.isProvider ? (
                        (() => {
                          const stage = providerPayoutStage(transaction);
                          const actualTransfer = stage.key === 'transferred';
                          const refunded = ['refunded', 'refund_pending', 'refund_failed', 'cancelled'].includes(stage.key);
                          const displayedAmount = actualTransfer
                            ? transaction.providerTransferAmountMinor / 100
                            : refunded
                              ? 0
                              : transaction.payoutAmountMinor / 100;
                          return (
                            <>
                              <p className={`text-[18px] font-bold ${
                                actualTransfer ? 'text-[#2E6641]' : 'text-gray-800'
                              }`}>
                                {actualTransfer ? '+' : ''}{formatMoney(displayedAmount)}
                              </p>
                              <div className={`flex items-center justify-end gap-1 text-[12px] font-medium ${stage.tone}`}>
                                {actualTransfer
                                  ? <CheckCircle2 size={14} />
                                  : stage.key === 'failed' || stage.key === 'refund_failed'
                                    ? <XCircle size={14} />
                                    : <Clock size={14} />}
                                <span>{stage.label}</span>
                              </div>
                              {transaction.originalPaymentAmountMinor > 0 &&
                                !['refunded', 'refund_pending', 'refund_failed', 'cancelled'].includes(stage.key) && (
                                  <p className="mt-1 text-[11px] text-blue-700">
                                    Kundens betaling er mottatt
                                  </p>
                                )}
                            </>
                          );
                        })()
                      ) : (
                        <>
                      <p
                        className={`text-[18px] font-bold ${
                          transaction.isProvider || (
                            transaction.refundStatus === 'succeeded' &&
                            transaction.amounts.totalCustomer -
                              Math.min(transaction.amounts.totalCustomer, transaction.refundedAmountMinor / 100) === 0
                          )
                            ? 'text-[#16a34a]'
                            : 'text-[#dc2626]'
                        }`}
                      >
                        {transaction.isProvider
                          ? formatMoney(transaction.providerTransferAmountMinor / 100)
                          : transaction.refundStatus === 'succeeded'
                            ? formatMoney(Math.max(
                                0,
                                transaction.amounts.totalCustomer -
                                  Math.min(transaction.amounts.totalCustomer, transaction.refundedAmountMinor / 100),
                              ))
                            : `−${formatMoney(transaction.amounts.totalCustomer)}`}
                      </p>
                      {renderStatusBadge(historyStatus(transaction))}
                      {transaction.cancellationReason === 'provider_stripe_connect_timeout' &&
                        <div className="mt-1 text-[11px] text-gray-600">Automatisk kansellert</div>}
                      {transaction.status === 'payment_received' &&
                        transaction.providerConnectStatus !== 'ready' &&
                        transaction.providerConnectDeadlineAt && (
                          <p className="mt-1 text-[11px] text-amber-600">
                            {transaction.providerConnectStatus === 'verification_retry'
                              ? 'Stripe Connect-status kontrolleres på nytt'
                              : 'Venter på Stripe Connect'}
                          </p>
                        )}
                            </>
                      )}
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
                    <h5 className="text-xs font-bold uppercase tracking-wide text-gray-600">Betalingsdetaljer</h5>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">Avtalt pris</span>
                      <span className="text-gray-900 font-medium">
                        {formatMoney(transaction.amounts.agreedPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">SafePay avgift (3 %)</span>
                      <span className="text-gray-900 font-medium">
                        {transaction.isProvider ? '−' : ''}{formatMoney(transaction.amounts.fee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-gray-500">
                        {transaction.isProvider ? 'Oppdragsgiver betalte' : 'Opprinnelig betaling'}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {transaction.isProvider ? '' : '−'}{formatMoney(
                          Number.isSafeInteger(transaction.originalPaymentAmountMinor)
                            ? transaction.originalPaymentAmountMinor / 100
                            : transaction.amounts.totalCustomer,
                        )}
                      </span>
                    </div>
                    {transaction.isProvider && (
                      <>
                        <div className="my-4 border-t border-gray-200" />
                        <h5 className="text-xs font-bold uppercase tracking-wide text-gray-600">
                          Forventet utbetaling
                        </h5>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">
                            {providerPayoutStage(transaction).key === 'transferred'
                              ? 'Overført til Stripe Connect'
                              : 'Forventet utbetaling'}
                          </span>
                          <span className={`font-semibold ${
                            transaction.hasVerifiedProviderTransfer &&
                            transaction.providerTransferAmountMinor > 0 &&
                            transaction.refundStatus !== 'succeeded'
                              ? 'text-[#2E6641]'
                              : 'text-gray-900'
                          }`}>
                            {transaction.hasVerifiedProviderTransfer &&
                            transaction.providerTransferAmountMinor > 0 &&
                            transaction.refundStatus !== 'succeeded'
                              ? '+'
                              : ''}
                            {formatMoney(
                              transaction.hasVerifiedProviderTransfer
                                ? transaction.providerTransferAmountMinor / 100
                                : ['refunded', 'refund_pending', 'refund_failed', 'cancelled', 'reversed'].includes(
                                    providerPayoutStage(transaction).key,
                                  )
                                  ? 0
                                  : transaction.payoutAmountMinor / 100,
                            )}
                          </span>
                        </div>
                        {transaction.originalPaymentAmountMinor > 0 && (
                          <p className="text-[13px] text-blue-700">
                            Kundens betaling er mottatt
                          </p>
                        )}
                        {providerPayoutStage(transaction).key === 'connect' && (
                          <div className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">
                            Fullfør Stripe Connect-oppsettet for å kunne motta utbetaling når oppdraget er godkjent.
                            {' '}
                            <Link
                              to="/settings/payout"
                              className="font-semibold underline underline-offset-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Fullfør oppsett
                            </Link>
                          </div>
                        )}
                        {providerPayoutStage(transaction).key === 'connect_check' && (
                          <p className="text-[13px] text-amber-700">
                            Stripe Connect-status kunne ikke bekreftes. Vi prøver igjen; utbetalingsstatus er ikke fastslått ennå.
                          </p>
                        )}
                        {providerPayoutStage(transaction).key === 'approval' && (
                          <p className="text-[13px] text-gray-600">
                            Betalingen er mottatt. Utbetalingen skjer når oppdraget er godkjent.
                          </p>
                        )}
                        {providerPayoutStage(transaction).key === 'processing' && (
                          <p className="text-[13px] text-gray-600">
                            Oppdraget er godkjent. Stripe behandler overføringen til Stripe Connect.
                          </p>
                        )}
                        {providerPayoutStage(transaction).key === 'failed' ||
                        providerPayoutStage(transaction).key === 'action' ? (
                          <div className="rounded-xl bg-red-50 p-3 text-[13px] text-red-800">
                            {transaction.payoutFailureMessage ||
                              'Utbetalingen er ikke bekreftet. Saken krever oppfølging.'}
                            {['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(transaction.payoutFailureCode) && (
                              <Link
                                to="/settings/payout"
                                className="ml-1 font-semibold underline underline-offset-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Åpne Stripe Connect
                              </Link>
                            )}
                          </div>
                        ) : null}
                        {transaction.hasVerifiedProviderTransfer && transaction.providerTransferAmountMinor > 0 && (
                          <>
                            <p className="text-[12px] text-gray-600">
                              Overført til Stripe Connect. Dette bekrefter ikke at beløpet er kommet til bankkontoen.
                            </p>
                            {transaction.stripeTransferId && (
                              <div className="flex items-center justify-between gap-4 text-[12px]">
                                <span className="text-gray-500">Stripe-overføring</span>
                                <span className="flex items-center gap-2 font-mono text-gray-700">
                                  {`${transaction.stripeTransferId.slice(0, 6)}...${transaction.stripeTransferId.slice(-3)}`}
                                  <button
                                    type="button"
                                    aria-label="Kopier full Stripe-overføringsreferanse"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void copyReference(transaction.stripeTransferId);
                                    }}
                                    className="rounded p-1 hover:bg-gray-200"
                                  >
                                    {copiedReference === transaction.stripeTransferId
                                      ? <Check size={14} />
                                      : <Copy size={14} />}
                                  </button>
                                </span>
                              </div>
                            )}
                            {transaction.transferDate && (
                              <div className="flex justify-between text-[13px]">
                                <span className="text-gray-500">Overføringsdato</span>
                                <span className="text-gray-800">{formatDate(transaction.transferDate)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <p className="text-[12px] text-gray-500">
                          Eventuelle bankutbetalinger vises i Stripe Connect-utbetalingshistorikken.
                        </p>
                      </>
                    )}
                    {(Number(transaction.refundAmountMinor || transaction.refundedAmountMinor) > 0 ||
                      transaction.refundStatus !== 'none') && (
                      <>
                        <h5 className="pt-3 text-xs font-bold uppercase tracking-wide text-gray-600">Refusjonsdetaljer</h5>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">Refusjonsbeløp</span>
                          <span className="text-gray-900 font-medium">
                            {formatMoney(
                              (transaction.refundStatus === 'succeeded'
                                ? transaction.refundedAmountMinor || 0
                                : transaction.refundAmountMinor || 0) / 100,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">Refundert beløp</span>
                          <span className="text-gray-900 font-medium">
                            +{formatMoney(transaction.refundedAmountMinor / 100)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">Netto betalt</span>
                          <span className="text-gray-900 font-medium">
                            {formatMoney(Math.max(
                              0,
                              (Number.isSafeInteger(transaction.originalPaymentAmountMinor)
                                ? transaction.originalPaymentAmountMinor / 100
                                : transaction.amounts.totalCustomer) -
                                (transaction.refundStatus === 'succeeded'
                                  ? transaction.refundedAmountMinor / 100
                                  : 0),
                            ))}
                          </span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">Refusjonsstatus</span>
                          <span className="text-gray-900 font-medium">
                            {transaction.refundStatus === 'succeeded' ? 'Refundert' :
                              transaction.refundStatus === 'failed' ? 'Refusjon mislyktes' :
                                transaction.refundStatus === 'pending' ||
                                transaction.refundStatus === 'reconciliation_required' ? 'Refusjon pågår' : 'Ingen refusjon'}
                          </span>
                        </div>
                        {!transaction.isProvider &&
                          transaction.refundStatus === 'succeeded' &&
                          transaction.paymentMethodBrand &&
                          transaction.paymentMethodLast4 && (
                          <div className="flex justify-between text-[14px]">
                            <span className="text-gray-500">Refundert til</span>
                            <span className="text-gray-900 font-medium capitalize">
                              {transaction.paymentMethodBrand} •••• {transaction.paymentMethodLast4}
                            </span>
                          </div>
                        )}
                        {(transaction.refundCompletedAt || transaction.refundFailedAt) && (
                          <div className="flex justify-between text-[14px]">
                            <span className="text-gray-500">Refusjonsdato</span>
                            <span className="text-gray-900 font-medium">
                              {formatDate(transaction.refundCompletedAt || transaction.refundFailedAt)}
                            </span>
                          </div>
                        )}
                        {transaction.stripeRefundId && (
                          <div className="flex items-center justify-between gap-4 text-[12px]">
                            <span className="text-gray-500">Refusjonsreferanse</span>
                            <span className="flex items-center gap-2 font-mono text-gray-700">
                              {`${transaction.stripeRefundId.slice(0, 6)}...${transaction.stripeRefundId.slice(-3)}`}
                              <button
                                type="button"
                                aria-label="Kopier full refusjonsreferanse"
                                title="Kopier full refusjonsreferanse"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void copyReference(transaction.stripeRefundId);
                                }}
                                className="rounded p-1 hover:bg-gray-200"
                              >
                                {copiedReference === transaction.stripeRefundId
                                  ? <Check size={14} />
                                  : <Copy size={14} />}
                              </button>
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {(transaction.cancellationReason || transaction.refundReason) && (
                      <>
                        <h5 className="pt-3 text-xs font-bold uppercase tracking-wide text-gray-600">Kanselleringsårsak</h5>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray-500">Årsak</span>
                          <span className="text-gray-900 font-medium">
                            {(transaction.cancellationReason || transaction.refundReason) === 'provider_stripe_connect_timeout'
                              ? 'Utføreren fullførte ikke Stripe Connect-oppsettet innen fristen'
                              : transaction.cancellationReason || transaction.refundReason}
                          </span>
                        </div>
                      </>
                    )}
                    {transaction.amounts.tax > 0 && (
                      <div className="flex justify-between text-[14px]">
                        <span className="text-gray-500">MVA</span>
                        <span className="text-gray-900 font-medium">
                          {formatMoney(transaction.amounts.tax)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between text-[14px]">
                        <span className="text-gray-700 font-semibold">
                          {transaction.isProvider
                            ? providerPayoutStage(transaction).key === 'transferred'
                              ? 'Overført til Stripe Connect'
                              : 'Forventet utbetaling'
                            : 'Netto betalt'}
                        </span>
                        <span
                          className={`text-gray-900 font-bold ${
                            (transaction.isProvider &&
                              providerPayoutStage(transaction).key === 'transferred') ||
                            (!transaction.isProvider &&
                              transaction.refundStatus === 'succeeded' &&
                              transaction.amounts.totalCustomer -
                                Math.min(
                                  transaction.amounts.totalCustomer,
                                  transaction.refundedAmountMinor / 100,
                                ) === 0)
                              ? 'text-[#16a34a]'
                              : 'text-[#dc2626]'
                          }`}
                        >
                          {transaction.isProvider
                            ? `${providerPayoutStage(transaction).key === 'transferred' ? '+' : ''}${formatMoney(
                                providerPayoutStage(transaction).key === 'transferred'
                                  ? transaction.providerTransferAmountMinor / 100
                                  : ['refunded', 'refund_pending', 'refund_failed', 'cancelled', 'reversed'].includes(
                                      providerPayoutStage(transaction).key,
                                    )
                                    ? 0
                                    : transaction.payoutAmountMinor / 100,
                              )}`
                            : formatMoney(Math.max(
                                0,
                                transaction.amounts.totalCustomer -
                                  (transaction.refundStatus === 'succeeded'
                                    ? transaction.refundedAmountMinor / 100
                                    : 0),
                              ))}
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
