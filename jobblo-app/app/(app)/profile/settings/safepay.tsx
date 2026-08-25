import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  CreditCard,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafePayHistory } from '../../../../src/hooks/useSafePayHistory';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { SafePayHistoryTransaction } from '../../../../src/services/safepayHistory.service';

const money = (value: number) =>
  `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(Number(value) || 0)} kr`;
const date = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
};

function status(value: string) {
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
  return {
    label: value || 'Ukjent status',
    color: '#63665F',
    icon: <Clock3 size={14} color="#63665F" />,
  };
}

function Transaction({ transaction }: { transaction: SafePayHistoryTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const state = status(transaction.status);
  const amount = transaction.isProvider
    ? transaction.amounts.netProvider
    : transaction.amounts.totalCustomer;
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
                : `Betalt til: ${transaction.providerName}`}
            </Text>
            <Text className="mt-1 text-xs text-[#9B9E96]">{date(transaction.paymentDate)}</Text>
          </View>
          <View className="ml-2 items-end">
            <Text
              className={[
                'text-sm font-bold',
                transaction.isProvider ? 'text-[#2E6641]' : 'text-[#B4544A]',
              ].join('')}
            >
              {transaction.isProvider ? '+' : '-'}
              {money(amount)}
            </Text>
            <View className="mt-1 flex-row items-center">
              {state.icon}
              <Text className="ml-1 text-[0.6875rem] font-medium" style={{ color: state.color }}>
                {state.label}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View className="border-t border-[#E6E7E1] bg-[#F4F6F0] px-4 py-4">
          <Detail label="Avtalt pris" value={money(transaction.amounts.agreedPrice)} />
          <Detail label="SafePay avgift" value={money(transaction.amounts.fee)} />
          {transaction.amounts.tax ? (
            <Detail label="MVA" value={money(transaction.amounts.tax)} />
          ) : null}
          <View className="mt-2 flex-row justify-between border-t border-[#E6E7E1] pt-3">
            <Text className="text-sm font-semibold text-[#0B0B0B]">
              {transaction.isProvider ? 'Du mottar' : 'Du betalte'}
            </Text>
            <Text className="text-sm font-bold text-[#0B0B0B]">
              {transaction.isProvider ? '+' : '-'}
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
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
          onPress={() => router.push('/profile/settings/payout' as any)}
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
