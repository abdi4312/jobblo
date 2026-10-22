import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
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
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { Chip } from '../../../../src/components/ui/Chip';
import { ListRow } from '../../../../src/components/ui/ListRow';
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
  // Which reference was copied last, so only that button shows the tick.
  const [copiedReference, setCopiedReference] = useState<'transfer' | 'refund' | null>(null);
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
  const incoming = transaction.isProvider;
  const amountColor = incoming
    ? providerStage === 'transferred' ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
    : amount === 0 ? 'text-[#2E6641]' : 'text-[#0B0B0B]';
  const amountSign = incoming ? (providerStage === 'transferred' ? '+' : '') : amount > 0 ? '−' : '';

  const copy = async (key: 'transfer' | 'refund', value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedReference(key);
    } catch {
      Alert.alert('Kunne ikke kopiere', 'Prøv igjen senere.');
    }
  };

  return (
    <Card className="rounded-2xl overflow-hidden">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${transaction.serviceTitle}, ${amountSign}${money(amount)}, ${state.label}`}
        className="p-4 active:bg-[#FAFAF7]"
      >
        <View className="flex-row items-start gap-3">
          <View className={`h-11 w-11 items-center justify-center rounded-2xl ${incoming ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]'}`}>
            {incoming ? <ArrowDownLeft size={20} color="#2E6641" /> : <ArrowUpRight size={20} color="#3C3F38" />}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>
                {transaction.serviceTitle}
              </Text>
              <Text className={`text-[0.9375rem] font-bold tabular-nums ${amountColor}`}>
                {amountSign}
                {money(amount)}
              </Text>
            </View>
            <Text className="mt-0.5 text-[0.8125rem] text-[#63665F]" numberOfLines={1}>
              {incoming
                ? `Fra ${transaction.customerName}`
                : transaction.hasVerifiedProviderTransfer
                  ? `Betalt til ${transaction.providerName}`
                  : `Til ${transaction.providerName}`}
              {date(transaction.paymentDate) ? ` · ${date(transaction.paymentDate)}` : ''}
            </Text>
            <View className="mt-2.5 flex-row items-center justify-between gap-2">
              <View className={`flex-row items-center gap-1 self-start rounded-full px-2.5 py-1 ${toneBg(state.color)}`}>
                {state.icon}
                <Text className="text-[0.6875rem] font-semibold" style={{ color: state.color }}>
                  {state.label}
                </Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Text className="text-[0.75rem] font-medium text-[#9B9E96]">{expanded ? 'Skjul' : 'Detaljer'}</Text>
                {expanded ? <ChevronUp size={14} color="#9B9E96" /> : <ChevronDown size={14} color="#9B9E96" />}
              </View>
            </View>
            {transaction.status === 'payment_received' &&
            transaction.providerConnectStatus !== 'ready' &&
            transaction.providerConnectDeadlineAt ? (
              <Text className="mt-2 text-[0.75rem] text-[#B7791F]">
                {transaction.providerConnectStatus === 'verification_retry'
                  ? 'Stripe Connect-status kontrolleres på nytt'
                  : 'Venter på Stripe Connect'}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View className="border-t border-[#EFF0EA] bg-[#FAFAF7] px-4 pb-4 pt-3">
          {!incoming && transaction.refundStatus && transaction.refundStatus !== 'none' ? (
            <RefundSteps
              status={transaction.refundStatus}
              paidAt={date(transaction.paymentDate)}
              doneAt={date(transaction.refundCompletedAt || transaction.refundFailedAt)}
            />
          ) : null}
          <DetailHeading>Betaling</DetailHeading>
          <Detail label="Avtalt pris" value={money(transaction.amounts.agreedPrice)} />
          <Detail label="SafePay-avgift (3 %)" value={`${incoming ? '−' : ''}${money(transaction.amounts.fee)}`} />
          {!incoming ? (
            <Detail label="Opprinnelig betaling" value={`−${money(originalAmount)}`} />
          ) : (
            <>
              <Detail label="Oppdragsgiver betalte" value={money(originalAmount)} />
              <DetailHeading>Utbetaling</DetailHeading>
              <Detail
                label={providerStage === 'transferred' ? 'Overført til Stripe Connect' : 'Forventet utbetaling'}
                value={`${providerStage === 'transferred' ? '+' : ''}${money(amount)}`}
              />
              {providerStage === 'awaiting_payout' ? (
                <Notice tone="warn">
                  Fullfør Stripe Connect-oppsettet for å kunne motta utbetaling når oppdraget er godkjent.
                  <Text className="font-semibold text-[#2E6641] underline" onPress={() => router.push('/profile/settings/payout')}>
                    {' '}Fullfør oppsett
                  </Text>
                </Notice>
              ) : null}
              {providerStage === 'connect_check' ? (
                <Notice tone="warn">
                  Stripe Connect-status kunne ikke bekreftes. Vi prøver igjen; utbetalingsstatus er ikke fastslått ennå.
                </Notice>
              ) : null}
              {providerStage === 'approval' ? (
                <Notice>Betalingen er mottatt. Utbetalingen skjer når oppdraget er godkjent.</Notice>
              ) : null}
              {providerStage === 'transfer_processing' ? (
                <Notice>Oppdraget er godkjent. Stripe behandler overføringen til Stripe Connect.</Notice>
              ) : null}
              {providerStage === 'transfer_failed' || providerStage === 'action_required' ? (
                <Notice tone="error">
                  {transaction.payoutFailureMessage || 'Utbetalingen er ikke bekreftet. Saken krever oppfølging.'}
                  {['PAYOUT_SETUP_REQUIRED', 'PAYOUT_NOT_ENABLED'].includes(transaction.payoutFailureCode || '') ? (
                    <Text className="font-semibold text-[#2E6641] underline" onPress={() => router.push('/profile/settings/payout')}>
                      {' '}Åpne Stripe Connect
                    </Text>
                  ) : null}
                </Notice>
              ) : null}
              {providerStage === 'transferred' ? (
                <>
                  {transaction.stripeTransferId ? (
                    <Reference
                      label="Stripe-overføring"
                      value={transaction.stripeTransferId}
                      copied={copiedReference === 'transfer'}
                      onCopy={() => void copy('transfer', transaction.stripeTransferId!)}
                    />
                  ) : null}
                  {transaction.transferDate ? <Detail label="Overføringsdato" value={date(transaction.transferDate)} /> : null}
                  <Notice>
                    Dette bekrefter overføring til Stripe Connect, ikke at beløpet er på bankkontoen. Bankutbetalinger
                    vises i Stripe Connect.
                  </Notice>
                </>
              ) : null}
            </>
          )}

          {Number(transaction.refundAmountMinor || transaction.refundedAmountMinor) > 0 || transaction.refundStatus !== 'none' ? (
            <>
              <DetailHeading>Refusjon</DetailHeading>
              <Detail
                label="Refusjonsbeløp"
                value={money(
                  (transaction.refundStatus === 'succeeded'
                    ? transaction.refundedAmountMinor || 0
                    : transaction.refundAmountMinor || 0) / 100,
                )}
              />
              <Detail label="Refundert beløp" value={`+${money((transaction.refundedAmountMinor || 0) / 100)}`} />
              <Detail
                label="Status"
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
              {!incoming && transaction.refundStatus === 'succeeded' && transaction.paymentMethodBrand && transaction.paymentMethodLast4 ? (
                <Detail label="Refundert til" value={`${transaction.paymentMethodBrand} •••• ${transaction.paymentMethodLast4}`} />
              ) : null}
              {transaction.stripeRefundId ? (
                <Reference
                  label="Refusjonsreferanse"
                  value={transaction.stripeRefundId}
                  copied={copiedReference === 'refund'}
                  onCopy={() => void copy('refund', transaction.stripeRefundId!)}
                />
              ) : null}
              {transaction.refundCompletedAt || transaction.refundFailedAt ? (
                <Detail label="Refusjonsdato" value={date(transaction.refundCompletedAt || transaction.refundFailedAt)} />
              ) : null}
            </>
          ) : null}

          {transaction.cancellationReason || transaction.refundReason ? (
            <>
              <DetailHeading>Kansellering</DetailHeading>
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
          {transaction.amounts.tax ? <Detail label="MVA" value={money(transaction.amounts.tax)} /> : null}

          <View className="mt-3 flex-row items-center justify-between border-t border-[#E6E7E1] pt-3">
            <Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">
              {incoming ? (providerStage === 'transferred' ? 'Overført til Stripe Connect' : 'Forventet utbetaling') : 'Netto betalt'}
            </Text>
            <Text className={`text-[0.9375rem] font-bold tabular-nums ${incoming && providerStage === 'transferred' ? 'text-[#2E6641]' : 'text-[#0B0B0B]'}`}>
              {incoming && providerStage === 'transferred' ? '+' : ''}
              {money(amount)}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/** Customer view of a refund in three steps, same as the web "Refusjonsstatus". */
function RefundSteps({ status, paidAt, doneAt }: { status: string; paidAt: string; doneAt: string }) {
  const done = status === 'succeeded';
  const failed = status === 'failed';
  const steps = [
    { label: 'Betaling mottatt', state: 'done', date: paidAt, note: '' },
    { label: 'Refusjon startet', state: 'done', date: '', note: '' },
    {
      label: done ? 'Refundert til kortet ditt' : failed ? 'Refusjon mislyktes' : 'Venter på bekreftelse fra Stripe',
      state: done ? 'done' : failed ? 'failed' : 'current',
      date: done || failed ? doneAt : '',
      note: done
        ? 'Det kan ta noen virkedager før beløpet vises på kontoen din.'
        : failed
          ? 'Saken er sendt til manuell behandling. Kontakt kundesenteret ved spørsmål.'
          : 'Dette tar vanligvis noen minutter.',
    },
  ];
  return (
    <View className="mb-1 mt-1">
      <DetailHeading>Refusjonsstatus</DetailHeading>
      {steps.map((step, index) => (
        <View key={step.label} className="flex-row gap-3">
          <View className="items-center">
            <View
              className={`h-6 w-6 items-center justify-center rounded-full ${
                step.state === 'done' ? 'bg-[#2E6641]' : step.state === 'failed' ? 'bg-[#B4544A]' : 'bg-[#B7791F]'
              }`}
            >
              {step.state === 'done' ? <Check size={13} color="#FFFFFF" /> : step.state === 'failed' ? <XCircle size={13} color="#FFFFFF" /> : <Clock3 size={13} color="#FFFFFF" />}
            </View>
            {index < steps.length - 1 ? <View className="w-0.5 flex-1 bg-[#DCEBDD]" style={{ minHeight: 14 }} /> : null}
          </View>
          <View className="min-w-0 flex-1 pb-3">
            <Text className="text-[0.8125rem] font-semibold text-[#0B0B0B]">{step.label}</Text>
            {step.date ? <Text className="text-[0.75rem] text-[#63665F]">{step.date}</Text> : null}
            {step.note ? (
              <Text className={`text-[0.75rem] ${step.state === 'failed' ? 'text-[#8C3932]' : step.state === 'current' ? 'text-[#8A641F]' : 'text-[#63665F]'}`}>{step.note}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Light background matching a status colour, for the status pill. */
function toneBg(color: string) {
  if (color === '#2E6641') return 'bg-[#EAF1E9]';
  if (color === '#B7791F') return 'bg-[#FBF5E9]';
  if (color === '#B4544A') return 'bg-[#FBF4F2]';
  return 'bg-[#F4F6F0]';
}

function DetailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-1.5 mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">{children}</Text>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 py-1">
      <Text className="text-[0.8125rem] text-[#63665F]">{label}</Text>
      <Text className="shrink text-right text-[0.8125rem] font-medium text-[#0B0B0B]">{value}</Text>
    </View>
  );
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const box = tone === 'error' ? 'bg-[#FBF4F2]' : tone === 'warn' ? 'bg-[#FBF5E9]' : 'bg-[#F4F6F0]';
  const text = tone === 'error' ? 'text-[#8C3932]' : tone === 'warn' ? 'text-[#6B5425]' : 'text-[#63665F]';
  return (
    <View className={`mt-2 rounded-xl px-3 py-2.5 ${box}`}>
      <Text className={`text-[0.75rem] leading-5 ${text}`}>{children}</Text>
    </View>
  );
}

function Reference({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text className="text-[0.8125rem] text-[#63665F]">{label}</Text>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={`Kopier ${label.toLowerCase()}`}
        hitSlop={6}
        className="flex-row items-center gap-1.5 rounded-full bg-white px-2.5 py-1"
      >
        <Text className="text-[0.75rem] font-medium text-[#0B0B0B]">{`${value.slice(0, 6)}…${value.slice(-3)}`}</Text>
        {copied ? <Check size={13} color="#2E6641" /> : <Copy size={13} color="#63665F" />}
      </Pressable>
    </View>
  );
}

type Filter = 'all' | 'paid' | 'received';

export default function SafePayHistoryScreen() {
  const router = useRouter();
  const query = useSafePayHistory();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await query.refetch(); } finally { setRefreshing(false); }
  };
  if (query.isLoading)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster SafePay-historikk..." />
      </SafeAreaView>
    );
  if (query.isError)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste SafePay-historikk"
          message="SafePay-historikken kunne ikke hentes akkurat nå."
          onAction={() => void query.refetch()}
        />
      </SafeAreaView>
    );
  const data = query.data;
  const history = data?.history ?? [];
  const paidCount = history.filter((t) => !t.isProvider).length;
  const receivedCount = history.length - paidCount;
  const visible = history.filter((t) => (filter === 'all' ? true : filter === 'received' ? t.isProvider : !t.isProvider));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#2E6641" colors={['#2E6641']} />}
      >
        <ScreenHeader title="SafePay-historikk" subtitle="Betalinger, utbetalinger og refusjoner" icon={ShieldCheck} />

        {data?.summary ? (
          <Card className="rounded-2xl mb-5 overflow-hidden">
            <View className="flex-row">
              <SummaryCell label="Totalt tjent" value={money(data.summary.totalEarned)} icon={<TrendingUp size={15} color="#2E6641" />} />
              <SummaryCell divider label="Totalt brukt" value={money(data.summary.totalSpent)} icon={<TrendingDown size={15} color="#B4544A" />} />
            </View>
            <View className="flex-row border-t border-[#EFF0EA]">
              <SummaryCell label="Avgifter" value={money(data.summary.totalFees)} icon={<Receipt size={15} color="#63665F" />} />
              <SummaryCell divider label="Transaksjoner" value={String(data.summary.transactionCount)} icon={<Wallet size={15} color="#2E6641" />} />
            </View>
          </Card>
        ) : null}

        {history.length ? (
          <View className="mb-4 flex-row gap-2">
            <Chip label="Alle" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Betalt" count={paidCount} selected={filter === 'paid'} onPress={() => setFilter('paid')} />
            <Chip label="Mottatt" count={receivedCount} selected={filter === 'received'} onPress={() => setFilter('received')} />
          </View>
        ) : null}

        {!history.length ? (
          <EmptyState
            icon={
              <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EAF1E9]">
                <ShieldCheck size={24} color="#2E6641" />
              </View>
            }
            title="Ingen SafePay-historikk ennå"
            message="Når du betaler for eller fullfører oppdrag med SafePay, vises de her."
          />
        ) : !visible.length ? (
          <Text className="my-8 text-center text-[0.875rem] text-[#63665F]">
            {filter === 'paid' ? 'Du har ikke betalt for noen oppdrag ennå.' : 'Du har ikke mottatt noen betalinger ennå.'}
          </Text>
        ) : (
          <View className="gap-3">
            {visible.map((transaction) => (
              <Transaction key={transaction.id} transaction={transaction} />
            ))}
          </View>
        )}

        <SectionLabel className="mt-6">Utbetalinger</SectionLabel>
        <Card className="rounded-2xl overflow-hidden">
          <ListRow
            icon={CreditCard}
            label="Stripe Connect"
            description="Sett opp eller administrer utbetalinger"
            onPress={() => router.push('/profile/settings/payout')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCell({ label, value, icon, divider = false }: { label: string; value: string; icon: React.ReactNode; divider?: boolean }) {
  return (
    <View className={`flex-1 px-4 py-3.5 ${divider ? 'border-l border-[#EFF0EA]' : ''}`}>
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-[0.75rem] text-[#63665F]">{label}</Text>
      </View>
      <Text className="mt-1.5 text-[1rem] font-bold tabular-nums text-[#0B0B0B]" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
