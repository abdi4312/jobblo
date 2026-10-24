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
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { Chip } from '../../../../src/components/ui/Chip';
import { ListRow } from '../../../../src/components/ui/ListRow';
import type { SafePayHistoryTransaction } from '../../../../src/services/safepayHistory.service';
import { TC, tc } from '../../../../src/theme/colors';
import { SafePayHistorySkeleton } from '../../../../src/components/skeletons/ScreenSkeletons';

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
      color: TC.brandText,
      icon: <CreditCard size={14} color={TC.brandText} />,
    };
  if (value === 'waiting_connect')
    return { label: 'Venter på Stripe Connect', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'refund_pending')
    return { label: 'Refusjon pågår', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'refund_failed')
    return { label: 'Refusjon mislyktes', color: tc('#B4544A', 'danger'), icon: <XCircle size={14} color={tc('#B4544A', 'danger')} /> };
  if (value === 'automatically_cancelled')
    return { label: 'Automatisk kansellert', color: tc('#63665F', 'muted'), icon: <XCircle size={14} color={tc('#63665F', 'muted')} /> };
  if (value === 'transferred' || value === 'completed')
    return {
      label: 'Overført / utbetalt',
      color: TC.brandText,
      icon: <ShieldCheck size={14} color={TC.brandText} />,
    };
  if (value === 'processing' || value === 'in_progress')
    return { label: 'Behandles', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'failed')
    return { label: 'Mislyktes', color: tc('#B4544A', 'danger'), icon: <XCircle size={14} color={tc('#B4544A', 'danger')} /> };
  if (value === 'refunded')
    return { label: 'Refundert', color: tc('#63665F', 'muted'), icon: <Receipt size={14} color={tc('#63665F', 'muted')} /> };
  if (value === 'cancelled')
    return { label: 'Kansellert', color: tc('#63665F', 'muted'), icon: <XCircle size={14} color={tc('#63665F', 'muted')} /> };
  if (value === 'pending' || value === 'released_internal' || value === 'disputed')
    return { label: 'Venter', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'awaiting_payout')
    return { label: 'Avventer utbetaling', color: tc('#63665F', 'muted'), icon: <Clock3 size={14} color={tc('#63665F', 'muted')} /> };
  if (value === 'connect_check')
    return { label: 'Stripe Connect-status kontrolleres', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'approval')
    return { label: 'Venter på godkjenning', color: tc('#63665F', 'muted'), icon: <Clock3 size={14} color={tc('#63665F', 'muted')} /> };
  if (value === 'transfer_processing')
    return { label: 'Utbetaling behandles', color: '#B7791F', icon: <Clock3 size={14} color="#B7791F" /> };
  if (value === 'transfer_failed')
    return { label: 'Utbetaling mislyktes', color: tc('#B4544A', 'danger'), icon: <XCircle size={14} color={tc('#B4544A', 'danger')} /> };
  if (value === 'action_required')
    return { label: 'Handling kreves', color: '#B7791F', icon: <XCircle size={14} color="#B7791F" /> };
  if (value === 'reversed')
    return { label: 'Overføring reversert', color: tc('#63665F', 'muted'), icon: <XCircle size={14} color={tc('#63665F', 'muted')} /> };
  return {
    label: value || 'Ukjent status',
    color: tc('#63665F', 'muted'),
    icon: <Clock3 size={14} color={tc('#63665F', 'muted')} />,
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
    ? providerStage === 'transferred' ? 'text-brand-text' : 'text-ink'
    : amount === 0 ? 'text-brand-text' : 'text-ink';
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
        className="p-4 active:bg-[#FAFAF7] dark:bg-surface-2"
      >
        <View className="flex-row items-start gap-3">
          <View className={`h-11 w-11 items-center justify-center rounded-2xl ${incoming ? 'bg-tint' : 'bg-surface-2'}`}>
            {incoming ? <ArrowDownLeft size={20} color={TC.brandText} /> : <ArrowUpRight size={20} color={TC.ink2} />}
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-[0.9375rem] font-semibold text-ink" numberOfLines={2}>
                {transaction.serviceTitle}
              </Text>
              <Text className={`text-[0.9375rem] font-bold tabular-nums ${amountColor}`}>
                {amountSign}
                {money(amount)}
              </Text>
            </View>
            <Text className="mt-0.5 text-[0.8125rem] text-muted" numberOfLines={1}>
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
                <Text className="text-[0.8125rem] font-semibold" style={{ color: state.color }}>
                  {state.label}
                </Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Text className="text-[0.8125rem] font-medium text-subtle">{expanded ? 'Skjul' : 'Detaljer'}</Text>
                {expanded ? <ChevronUp size={14} color={tc('#9B9E96', 'subtle')} /> : <ChevronDown size={14} color={tc('#9B9E96', 'subtle')} />}
              </View>
            </View>
            {transaction.status === 'payment_received' &&
            transaction.providerConnectStatus !== 'ready' &&
            transaction.providerConnectDeadlineAt ? (
              <Text className="mt-2 text-[0.8125rem] text-[#B7791F]">
                {transaction.providerConnectStatus === 'verification_retry'
                  ? 'Stripe Connect-status kontrolleres på nytt'
                  : 'Venter på Stripe Connect'}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View className="border-t border-line-soft bg-[#FAFAF7] dark:bg-surface-2 px-4 pb-4 pt-3">
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
                  <Text className="font-semibold text-brand-text underline" onPress={() => router.push('/profile/settings/payout')}>
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
                    <Text className="font-semibold text-brand-text underline" onPress={() => router.push('/profile/settings/payout')}>
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

          <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3">
            <Text className="text-[0.875rem] font-semibold text-ink">
              {incoming ? (providerStage === 'transferred' ? 'Overført til Stripe Connect' : 'Forventet utbetaling') : 'Netto betalt'}
            </Text>
            <Text className={`text-[0.9375rem] font-bold tabular-nums ${incoming && providerStage === 'transferred' ? 'text-brand-text' : 'text-ink'}`}>
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
                step.state === 'done' ? 'bg-brand' : step.state === 'failed' ? 'bg-danger-solid' : 'bg-[#B7791F]'
              }`}
            >
              {step.state === 'done' ? <Check size={13} color="#FFFFFF" /> : step.state === 'failed' ? <XCircle size={13} color="#FFFFFF" /> : <Clock3 size={13} color="#FFFFFF" />}
            </View>
            {index < steps.length - 1 ? <View className="w-0.5 flex-1 bg-[#DCEBDD] dark:bg-tint" style={{ minHeight: 14 }} /> : null}
          </View>
          <View className="min-w-0 flex-1 pb-3">
            <Text className="text-[0.8125rem] font-semibold text-ink">{step.label}</Text>
            {step.date ? <Text className="text-[0.8125rem] text-muted">{step.date}</Text> : null}
            {step.note ? (
              <Text className={`text-[0.8125rem] ${step.state === 'failed' ? 'text-[#8C3932]' : step.state === 'current' ? 'text-[#8A641F]' : 'text-muted'}`}>{step.note}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Light background matching a status colour, for the status pill. */
function toneBg(color: string) {
  if (color === TC.brandText) return 'bg-tint';
  if (color === '#B7791F') return 'bg-warn-tint';
  if (color === tc('#B4544A', 'danger')) return 'bg-danger-tint';
  return 'bg-surface-2';
}

function DetailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-1.5 mt-3 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-subtle">{children}</Text>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 py-1">
      <Text className="text-[0.8125rem] text-muted">{label}</Text>
      <Text className="shrink text-right text-[0.8125rem] font-medium text-ink">{value}</Text>
    </View>
  );
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const box = tone === 'error' ? 'bg-danger-tint' : tone === 'warn' ? 'bg-warn-tint' : 'bg-surface-2';
  const text = tone === 'error' ? 'text-[#8C3932]' : tone === 'warn' ? 'text-[#6B5425]' : 'text-muted';
  return (
    <View className={`mt-2 rounded-xl px-3 py-2.5 ${box}`}>
      <Text className={`text-[0.8125rem] leading-5 ${text}`}>{children}</Text>
    </View>
  );
}

function Reference({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text className="text-[0.8125rem] text-muted">{label}</Text>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={`Kopier ${label.toLowerCase()}`}
        hitSlop={6}
        className="flex-row items-center gap-1.5 rounded-full bg-surface px-2.5 py-1"
      >
        <Text className="text-[0.8125rem] font-medium text-ink">{`${value.slice(0, 6)}…${value.slice(-3)}`}</Text>
        {copied ? <Check size={13} color={TC.brandText} /> : <Copy size={13} color={tc('#63665F', 'muted')} />}
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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <SafePayHistorySkeleton />
      </SafeAreaView>
    );
  if (query.isError)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
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
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={TC.brandText} colors={[TC.brandText]} />}
      >
        <ScreenHeader title="SafePay-historikk" subtitle="Betalinger, utbetalinger og refusjoner" icon={ShieldCheck} />

        {data?.summary ? (
          <Card className="rounded-2xl mb-5 overflow-hidden">
            <View className="flex-row">
              <SummaryCell label="Totalt tjent" value={money(data.summary.totalEarned)} icon={<TrendingUp size={15} color={TC.brandText} />} />
              <SummaryCell divider label="Totalt brukt" value={money(data.summary.totalSpent)} icon={<TrendingDown size={15} color={tc('#B4544A', 'danger')} />} />
            </View>
            <View className="flex-row border-t border-line-soft">
              <SummaryCell label="Avgifter" value={money(data.summary.totalFees)} icon={<Receipt size={15} color={tc('#63665F', 'muted')} />} />
              <SummaryCell divider label="Transaksjoner" value={String(data.summary.transactionCount)} icon={<Wallet size={15} color={TC.brandText} />} />
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
              <View className="h-14 w-14 items-center justify-center rounded-full bg-tint">
                <ShieldCheck size={24} color={TC.brandText} />
              </View>
            }
            title="Ingen SafePay-historikk ennå"
            message="Når du betaler for eller fullfører oppdrag med SafePay, vises de her."
          />
        ) : !visible.length ? (
          <Text className="my-8 text-center text-[0.875rem] text-muted">
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
    <View className={`flex-1 px-4 py-3.5 ${divider ? 'border-l border-line-soft' : ''}`}>
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="text-[0.8125rem] text-muted">{label}</Text>
      </View>
      <Text className="mt-1.5 text-[1rem] font-bold tabular-nums text-ink" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
