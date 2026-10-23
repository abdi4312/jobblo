import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  CreditCard,
  Copy,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafePayHistory } from '../../../../src/hooks/useSafePayHistory';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { SafePayHistoryTransaction } from '../../../../src/services/safepayHistory.service';

const money = (value: number) =>
  `${new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} kr`;
const date = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
};

function status(value: string) {
  if (value === 'payment_received')
    return {
      label: 'Betaling mottatt',
      color: '#2E6641',
      icon: <CreditCard size={14} color="#2E6641" />,
    };
  if (value === 'waiting_connect')
    return { label: 'Venter på Stripe Connect', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'refund_pending')
    return { label: 'Refusjon pågår', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'refund_failed')
    return { label: 'Refusjon mislyktes', color: '#B4544A', icon: <XCircle size={14} color="#B4544A" /> };
  if (value === 'automatically_cancelled')
    return { label: 'Automatisk kansellert', color: '#63665F', icon: <XCircle size={14} color="#63665F" /> };
  if (value === 'transferred' || value === 'completed')
    return {
      label: 'Overført / utbetalt',
      color: '#2E6641',
      icon: <ShieldCheck size={14} color="#2E6641" />,
    };
  if (value === 'processing' || value === 'in_progress')
    return { label: 'Behandles', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'failed')
    return { label: 'Mislyktes', color: '#B4544A', icon: <XCircle size={14} color="#B4544A" /> };
  if (value === 'refunded')
    return { label: 'Refundert', color: '#63665F', icon: <Receipt size={14} color="#63665F" /> };
  if (value === 'cancelled')
    return { label: 'Kansellert', color: '#63665F', icon: <XCircle size={14} color="#63665F" /> };
  if (value === 'pending' || value === 'released_internal' || value === 'disputed')
    return { label: 'Venter', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'awaiting_payout')
    return { label: 'Avventer utbetaling', color: '#63665F', icon: <Clock3 size={14} color="#63665F" /> };
  if (value === 'connect_check')
    return { label: 'Stripe Connect-status kontrolleres', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'approval')
    return { label: 'Venter på godkjenning', color: '#63665F', icon: <Clock3 size={14} color="#63665F" /> };
  if (value === 'transfer_processing')
    return { label: 'Utbetaling behandles', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'transfer_failed')
    return { label: 'Utbetaling mislyktes', color: '#B4544A', icon: <XCircle size={14} color="#B4544A" /> };
  if (value === 'action_required')
    return { label: 'Handling kreves', color: '#B7791F', icon: <XCircle size={14} color="#B7791F" /> };
  if (value === 'reversed')
    return { label: 'Overføring reversert', color: '#63665F', icon: <XCircle size={14} color="#63665F" /> };
  return {
    label: value || 'Ukjent status',
    color: '#63665F',
    icon: <Clock3 size={14} color="#63665F" />,
  };
}

function Transaction({ transaction }: { transaction: SafePayHistoryTransaction }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [copiedReference, setCopiedReference] = useState(false);
  const providerStage = transaction.isProvider
    ? transaction.refundStatus === 'succeeded'
      ? 'refunded'
      : transaction.refundStatus === 'failed'
        ? 'refund_failed'
        : transaction.refundStatus === 'pending' || transaction.refundStatus === 'reconciliation_required'
          ? 'refund_pending'
          : transaction.cancellationReason === 'provider_stripe_connect_timeout' ||
              transaction.status === 'automatically_cancelled'
            ? 'automatically_cancelled'
            : transaction.providerTransferReversed
              ? 'reversed'
              : transaction.hasVerifiedProviderTransfer && (transaction.providerTransferAmountMinor || 0) > 0
                ? 'transferred'
                : transaction.payoutStatus === 'failed'
                  ? 'transfer_failed'
                  : transaction.payoutStatus === 'reconciliation_required'
                    ? 'action_required'
                    : transaction.providerConnectStatus === 'verification_retry'
                      ? 'connect_check'
                      : transaction.providerConnectStatus && transaction.providerConnectStatus !== 'ready'
                        ? 'awaiting_payout'
                      : transaction.payoutStatus || ['completed', 'refunded'].includes(transaction.status)
                        ? 'transfer_processing'
                        : 'approval'
    : null;
  const state = status(
    providerStage || (
      transaction.refundStatus === 'succeeded'
        ? 'refunded'
        : transaction.refundStatus === 'failed'
          ? 'refund_failed'
          : transaction.refundStatus === 'pending' || transaction.refundStatus === 'reconciliation_required'
            ? 'refund_pending'
            : transaction.status
    ),
  );
  const originalAmount = Number.isSafeInteger(transaction.originalPaymentAmountMinor)
    ? (transaction.originalPaymentAmountMinor || 0) / 100
    : transaction.amounts.totalCustomer;
  const confirmedRefund = transaction.refundStatus === 'succeeded'
    ? Math.min(originalAmount, (transaction.refundedAmountMinor || 0) / 100)
    : 0;
  const providerAmount = providerStage === 'transferred'
    ? (transaction.providerTransferAmountMinor || 0) / 100
    : ['refunded', 'refund_pending', 'refund_failed', 'automatically_cancelled', 'reversed'].includes(providerStage || '')
      ? 0
      : (transaction.payoutAmountMinor ?? Math.round(transaction.amounts.netProvider * 100)) / 100;
  const amount = transaction.isProvider
    ? providerAmount
    : Math.max(0, originalAmount - confirmedRefund);
  return (
    <View className="overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
      <Pressable onPress={() => setExpanded((value) => !value)} className="p-4">
        <View className="flex-row items-start">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]">
            <ShieldCheck size={21} color="#2E6641" />
          </View>
          <View className="ml-3 min-w-0 flex-1">
            <Text className="text-sm font-semibold text-[#0B0B0B]" numberOfLines={2}>
              {transaction.serviceTitle}
            </Text>
            <Text className="mt-1 text-xs text-[#63665F]" numberOfLines={1}>
              {transaction.isProvider
                ? `Jobbet for: ${transaction.customerName}`
                : transaction.hasVerifiedProviderTransfer
                  ? `Betalt til: ${transaction.providerName}`
                  : `Oppdragstaker: ${transaction.providerName}`}
            </Text>
            <Text className="mt-1 text-xs text-[#9B9E96]">{date(transaction.paymentDate)}</Text>
            {transaction.status === 'payment_received' &&
            transaction.providerConnectStatus !== 'ready' &&
            transaction.providerConnectDeadlineAt ? (
              <Text className="mt-1 text-xs text-[#B7791F]">
                {transaction.providerConnectStatus === 'verification_retry'
                  ? 'Stripe Connect-status kontrolleres på nytt'
                  : 'Venter på Stripe Connect'}
              </Text>
            ) : null}
          </View>
          <View className="ml-2 items-end">
            <Text
              className={[
                'text-sm font-bold',
                transaction.isProvider
                  ? providerStage === 'transferred' ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
                  : amount === 0 ? 'text-[#2E6641]' : 'text-[#B4544A]',
              ].join('')}
            >
              {transaction.isProvider
                ? providerStage === 'transferred' ? '+' : ''
                : amount > 0 ? '−' : ''}
              {money(amount)}
            </Text>
            <View className="mt-1 flex-row items-center">
              {state.icon}
              <Text className="ml-1 text-[0.6875rem] font-medium" style={{ color: state.color }}>
                {state.label}
              </Text>
            </View>
            {transaction.isProvider && (transaction.originalPaymentAmountMinor || 0) > 0 ? (
              <Text className="mt-1 text-[0.6875rem] font-medium text-[#63665F]">
                Kundens betaling er mottatt
              </Text>
            ) : null}
            {transaction.cancellationReason === 'provider_stripe_connect_timeout' ? (
              <Text className="mt-1 text-[0.6875rem] font-medium text-[#63665F]">
                Automatisk kansellert
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View className="border-t border-[#E6E7E1] bg-[#F4F6F0] px-4 py-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#63665F]">Betalingsdetaljer</Text>
          <Detail label="Avtalt pris" value={money(transaction.amounts.agreedPrice)} />
          <Detail
            label="SafePay avgift (3 %)"
            value={`${transaction.isProvider ? '−' : ''}${money(transaction.amounts.fee)}`}
          />
          {!transaction.isProvider ? (
            <Detail label="Opprinnelig betaling" value={`−${money(originalAmount)}`} />
          ) : (
            <>
              <Detail label="Oppdragsgiver betalte" value={money(originalAmount)} />
              <View className="my-3 border-t border-[#E6E7E1]" />
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#63665F]">
                Forventet utbetaling
              </Text>
              <Detail
                label={providerStage === 'transferred' ? 'Overført til Stripe Connect' : 'Forventet utbetaling'}
                value={`${providerStage === 'transferred' ? '+' : ''}${money(amount)}`}
              />
              {providerStage === 'awaiting_payout' ? (
                <View className="mt-2 rounded-xl bg-[#FFF8E8] p-3">
                  <Text className="text-xs leading-5 text-[#6B5425]">
                    Fullfør Stripe Connect-oppsettet for å kunne motta utbetaling når oppdraget er godkjent.
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push('/profile/settings/payout')}
                    className="mt-2 self-start"
                  >
                    <Text className="text-xs font-semibold text-[#2E6641] underline">Fullfør oppsett</Text>
                  </Pressable>
                </View>
              ) : null}
              {providerStage === 'connect_check' ? (
                <Text className="mt-2 text-xs leading-5 text-[#8A641F]">
                  Stripe Connect-status kunne ikke bekreftes. Vi prøver igjen; utbetalingsstatus er ikke fastslått ennå.
                </Text>
              ) : null}
              {providerStage === 'approval' ? (
                <Text className="mt-2 text-xs leading-5 text-[#63665F]">
                  Betalingen er mottatt. Utbetalingen skjer når oppdraget er godkjent.
                </Text>
              ) : null}
              {providerStage === 'transfer_processing' ? (
                <Text className="mt-2 text-xs leading-5 text-[#63665F]">
                  Oppdraget er godkjent. Stripe behandler overføringen til Stripe Connect.
                </Text>
              ) : null}
              {providerStage === 'transfer_failed' || providerStage === 'action_required' ? (
                <View className="mt-2 rounded-xl bg-[#FCEDEC] p-3">
                  <Text className="text-xs leading-5 text-[#8C3932]">
                    {transaction.payoutFailureMessage ||
                      'Utbetalingen er ikke bekreftet. Saken krever oppfølging.'}
                  </Text>
                  {['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(transaction.payoutFailureCode || '') ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push('/profile/settings/payout')}
                      className="mt-2 self-start"
                    >
                      <Text className="text-xs font-semibold text-[#2E6641] underline">Åpne Stripe Connect</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {providerStage === 'transferred' ? (
                <>
                  <Text className="mt-2 text-xs leading-5 text-[#63665F]">
                    Dette bekrefter overføring til Stripe Connect, ikke at beløpet er kommet til bankkontoen.
                  </Text>
                  {transaction.stripeTransferId ? (
                    <View className="mb-2 mt-2 flex-row items-center justify-between">
                      <Text className="text-xs text-[#63665F]">Stripe-overføring</Text>
                      <View className="flex-row items-center">
                        <Text className="text-xs font-medium text-[#0B0B0B]">
                          {`${transaction.stripeTransferId.slice(0, 6)}...${transaction.stripeTransferId.slice(-3)}`}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Kopier full Stripe-overføringsreferanse"
                          className="ml-2 rounded p-1"
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(transaction.stripeTransferId!);
                              setCopiedReference(true);
                            } catch {
                              Alert.alert('Kunne ikke kopiere', 'Prøv igjen senere.');
                            }
                          }}
                        >
                          {copiedReference
                            ? <ShieldCheck size={14} color="#2E6641" />
                            : <Copy size={14} color="#63665F" />}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {transaction.transferDate ? (
                    <Detail label="Overføringsdato" value={date(transaction.transferDate)} />
                  ) : null}
                  <Text className="mt-1 text-[11px] leading-4 text-[#63665F]">
                    Eventuelle bankutbetalinger vises i Stripe Connect-utbetalingshistorikken.
                  </Text>
                </>
              ) : null}
            </>
          )}
          {Number(transaction.refundAmountMinor || transaction.refundedAmountMinor) > 0 ||
          transaction.refundStatus !== 'none' ? (
            <>
              <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[#63665F]">Refusjonsdetaljer</Text>
              <Detail
                label="Refusjonsbeløp"
                value={money(
                  (transaction.refundStatus === 'succeeded'
                    ? transaction.refundedAmountMinor || 0
                    : transaction.refundAmountMinor || 0) / 100,
                )}
              />
              <Detail
                label="Refundert beløp"
                value={`+${money((transaction.refundedAmountMinor || 0) / 100)}`}
              />
              <Detail label="Netto betalt" value={money(Math.max(0, originalAmount - confirmedRefund))} />
              <Detail
                label="Refusjonsstatus"
                value={
                  transaction.refundStatus === 'succeeded'
                    ? 'Refundert'
                    : transaction.refundStatus === 'failed'
                      ? 'Refusjon mislyktes'
                      : transaction.refundStatus === 'pending' || transaction.refundStatus === 'reconciliation_required'
                        ? 'Refusjon pågår'
                        : 'Ingen refusjon'
                }
              />
              {!transaction.isProvider &&
              transaction.refundStatus === 'succeeded' &&
              transaction.paymentMethodBrand &&
              transaction.paymentMethodLast4 ? (
                <Detail
                  label="Refundert til"
                  value={`${transaction.paymentMethodBrand} •••• ${transaction.paymentMethodLast4}`}
                />
              ) : null}
              {transaction.stripeRefundId ? (
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs text-[#63665F]">Refusjonsreferanse</Text>
                  <View className="flex-row items-center">
                    <Text className="text-xs font-medium text-[#0B0B0B]">
                      {`${transaction.stripeRefundId.slice(0, 6)}...${transaction.stripeRefundId.slice(-3)}`}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Kopier full refusjonsreferanse"
                      className="ml-2 rounded p-1"
                      onPress={async () => {
                        try {
                          await Clipboard.setStringAsync(transaction.stripeRefundId!);
                          setCopiedReference(true);
                        } catch {
                          Alert.alert('Kunne ikke kopiere', 'Prøv igjen senere.');
                        }
                      }}
                    >
                      <Copy size={14} color={copiedReference ? '#2E6641' : '#63665F'} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {transaction.refundCompletedAt || transaction.refundFailedAt ? (
                <Detail label="Refusjonsdato" value={date(transaction.refundCompletedAt || transaction.refundFailedAt)} />
              ) : null}
            </>
          ) : null}
          {transaction.cancellationReason || transaction.refundReason ? (
            <>
            <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[#63665F]">Kanselleringsårsak</Text>
            <Detail
              label="Årsak"
              value={
                (transaction.cancellationReason || transaction.refundReason) === 'provider_stripe_connect_timeout'
                  ? 'Utføreren startet ikke oppdraget innen fristen'
                  : transaction.cancellationReason || transaction.refundReason || ''
              }
            />
            </>
          ) : null}
          {transaction.amounts.tax ? (
            <Detail label="MVA" value={money(transaction.amounts.tax)} />
          ) : null}
          <View className="mt-2 flex-row justify-between border-t border-[#E6E7E1] pt-3">
            <Text className="text-sm font-semibold text-[#0B0B0B]">
              {transaction.isProvider
                ? providerStage === 'transferred' ? 'Overført til Stripe Connect' : 'Forventet utbetaling'
                : 'Netto betalt'}
            </Text>
            <Text className={`text-sm font-bold ${
              transaction.isProvider
                ? providerStage === 'transferred' ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
                : 'text-[#0B0B0B]'
            }`}>
              {transaction.isProvider
                ? providerStage === 'transferred' ? '+' : ''
                : ''}
              {money(amount)}
            </Text>
          </View>
        </View>
      ) : null}
      <View className="absolute bottom-3 right-3">
        {expanded ? (
          <ChevronUp size={15} color="#9B9E96" />
        ) : (
          <ChevronDown size={15} color="#9B9E96" />
        )}
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row justify-between">
      <Text className="text-xs text-[#63665F]">{label}</Text>
      <Text className="text-xs font-medium text-[#0B0B0B]">{value}</Text>
    </View>
  );
}

export default function SafePayHistoryScreen() {
  const router = useRouter();
  const query = useSafePayHistory();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await query.refetch(); } finally { setRefreshing(false); }
  };
  if (query.isLoading)
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster SafePay-historikk..." />
      </SafeAreaView>
    );
  if (query.isError)
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste SafePay-historikk"
          message="SafePay-historikken kunne ikke hentes akkurat nå."
          onAction={() => void query.refetch()}
        />
      </SafeAreaView>
    );
  const data = query.data;
  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" />}>
        <Pressable
          onPress={() => router.back()}
          className="mb-5 flex-row items-center self-start py-2"
        >
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
        </Pressable>
        <View className="mb-5 flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]">
            <ShieldCheck size={21} color="#2E6641" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-bold text-[#0B0B0B]">SafePay historikk</Text>
            <Text className="mt-1 text-sm text-[#63665F]">
              Oversikt over betalinger og utbetalinger
            </Text>
          </View>
        </View>
        {data?.summary ? (
          <View className="flex-row flex-wrap gap-3">
            <Summary
              label="Totalt tjent"
              value={money(data.summary.totalEarned)}
              icon={<TrendingUp size={16} color="#2E6641" />}
            />
            <Summary
              label="Totalt brukt"
              value={money(data.summary.totalSpent)}
              icon={<TrendingDown size={16} color="#B4544A" />}
            />
            <Summary
              label="Avgifter"
              value={money(data.summary.totalFees)}
              icon={<Receipt size={16} color="#63665F" />}
            />
            <Summary
              label="Transaksjoner"
              value={String(data.summary.transactionCount)}
              icon={<Wallet size={16} color="#2E6641" />}
            />
          </View>
        ) : null}
        {!data?.history?.length ? (
          <EmptyState
            title="Ingen SafePay-historikk ennå"
            message="Når du fullfører jobber eller betaler for tjenester via SafePay, vil de vises her."
          />
        ) : (
          <View className="mt-5 gap-3">
            {data.history.map((transaction) => (
              <Transaction key={transaction.id} transaction={transaction} />
            ))}
          </View>
        )}
        <Pressable
          onPress={() => router.push('/profile/settings/payout')}
          className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5 active:bg-[#F4F6F0]"
        >
          <View className="flex-row items-center">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1E9]">
              <CreditCard size={18} color="#2E6641" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-[#0B0B0B]">Utbetalinger</Text>
              <Text className="mt-1 text-sm leading-5 text-[#63665F]">
                Sett opp eller administrer Stripe Connect for utbetalinger.
              </Text>
            </View>
            <ChevronRight size={18} color="#63665F" />
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View className="min-w-[47%] flex-1 rounded-3xl border border-[#E6E7E1] bg-white p-4">
      <View className="flex-row items-center">
        {icon}
        <Text className="ml-2 text-xs text-[#63665F]">{label}</Text>
      </View>
      <Text className="mt-2 text-base font-bold text-[#0B0B0B]">{value}</Text>
    </View>
  );
}
