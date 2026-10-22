import React from 'react';
import { Image, Text, View } from 'react-native';
import { CreditCard, FileText, Lock, ShieldCheck, Users } from 'lucide-react-native';
import type { SafePayCalculation, SafePayOrder, SafePayService, SafePayStartDeadline } from '../../types/SafePay';
import { Button } from '../ui/Button';

function nameOf(party: SafePayOrder['customerId']) {
  return `${party?.name ?? 'Ukjent'} ${party?.lastName ?? ''}`.trim();
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Party({ role, party, rating }: { role: string; party: SafePayOrder['customerId']; rating?: number }) {
  const name = nameOf(party);
  return (
    <View className="min-w-0 flex-1 rounded-2xl bg-[#F4F6F0] p-4">
      <View className="mx-auto h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
        {party?.avatarUrl ? <Image source={{ uri: party.avatarUrl }} className="h-full w-full" /> : <Text className="text-[0.9375rem] font-semibold text-[#2E6641]">{initials(name)}</Text>}
      </View>
      <Text className="mt-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">{role}</Text>
      <Text className="mt-1 text-center text-[0.875rem] font-semibold text-[#0B0B0B]" numberOfLines={2}>{name}</Text>
      {rating !== undefined ? <Text className="mt-1 text-center text-[0.75rem] text-[#63665F]">{rating > 0 ? `★ ${rating}` : 'Ingen vurderinger ennå'}</Text> : null}
    </View>
  );
}

export function SafePayPartiesCard({ order }: { order: SafePayOrder }) {
  return (
    <View className="mb-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
      <View className="mb-4 flex-row items-center gap-2"><Users size={16} color="#2E6641" /><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Avtale mellom</Text></View>
      <View className="flex-row items-center gap-2">
        <Party role="Oppdragsgiver" party={order.customerId} />
        <View className="w-12 items-center gap-1"><ShieldCheck size={18} color="#2E6641" /><Text className="text-center text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-[#2E6641]">SafePay</Text></View>
        <Party role="Oppdragstaker" party={order.providerId} rating={order.providerId?.averageRating} />
      </View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View className="flex-row items-baseline justify-between gap-3 border-b border-[#E6E7E1] py-2.5"><Text className="shrink-0 text-[0.8125rem] text-[#63665F]">{label}</Text><Text className={['text-right text-[0.875rem]', strong ? 'font-semibold' : '', 'text-[#0B0B0B]'].join(' ')}>{value}</Text></View>;
}

export function DigitalContractCard({ service, order, calculation, contractDate, duration }: { service: SafePayService; order: SafePayOrder; calculation: SafePayCalculation; contractDate?: string | null; duration?: string | null }) {
  return (
    <View className="mb-4 rounded-3xl border border-[#E6E7E1] bg-white p-5">
      <View className="mb-4 flex-row items-center gap-2"><FileText size={16} color="#2E6641" /><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Digital kontrakt</Text></View>
      <View className="rounded-2xl bg-[#F4F6F0] px-4">
        <Row label="Oppdrag" value={service.title} strong />
        {service.location?.city ? <Row label="Sted" value={service.location.city} /> : null}
        {contractDate ? <Row label="Dato" value={contractDate} /> : null}
        {duration ? <Row label="Estimert tid" value={duration} /> : null}
        <Row label="Oppdragsbeløp" value={`${calculation.basePrice.toLocaleString('nb-NO')} kr`} strong />
        <Row label="Betalingsmetode" value="SafePay — holdes til godkjenning" />
        <Row label="Kontrakt-ID" value={`#JB-${order._id.substring(0, 8).toUpperCase()}`} />
      </View>
      <Text className="mt-4 text-[0.75rem] leading-relaxed text-[#63665F]">Kontrakten sendes til begge parter på e-post og lagres under «Kontrakt» i menyen. Den er juridisk bindende og beskytter deg ved en eventuell tvist.</Text>
    </View>
  );
}

export function SafePayPaymentCard({
  calculation,
  isPaid,
  providerName,
  onPay,
  isPending,
  startDeadline,
  paidAction,
}: {
  calculation: SafePayCalculation;
  isPaid: boolean;
  providerName?: string;
  onPay: () => void;
  isPending: boolean;
  /** The auto-refund promise shown before paying (same sentence as the web checkout). */
  startDeadline?: SafePayStartDeadline | null;
  /** Shown once paid, e.g. "Se status på oppdraget". */
  paidAction?: { label: string; onPress: () => void };
}) {
  const deadlineText = startDeadline
    ? startDeadline.testMinutes
      ? `${startDeadline.testMinutes} minutter`
      : `${startDeadline.days} ${startDeadline.days === 1 ? 'dag' : 'dager'}`
    : null;
  return (
    <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
      <View className="mb-4 flex-row items-center gap-2"><CreditCard size={16} color="#2E6641" /><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Betaling</Text></View>
      <Row label="Oppdragsbeløp" value={`${calculation.basePrice.toLocaleString('nb-NO')} kr`} />
      <Row label="SafePay-gebyr (3 %)" value={`${calculation.fee.toLocaleString('nb-NO')} kr`} />
      <View className="flex-row items-baseline justify-between gap-3 pt-3"><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{isPaid ? 'Betalt' : 'Totalt å betale nå'}</Text><Text className="text-[1.25rem] font-bold text-[#0B0B0B]">{calculation.total.toLocaleString('nb-NO')} kr</Text></View>
      {!isPaid ? <><View className="mt-5 flex-row items-center gap-3 rounded-2xl border border-[#E6E7E1] p-3.5"><View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F4F6F0]"><CreditCard size={16} color="#63665F" /></View><View className="min-w-0 flex-1"><Text className="text-[0.875rem] font-semibold text-[#0B0B0B]">Kort</Text><Text className="text-[0.75rem] text-[#63665F]">Du fullfører betalingen sikkert hos Stripe i neste steg.</Text></View></View><View className="mt-4 flex-row gap-3 rounded-2xl bg-[#EAF1E9] p-4"><Lock size={16} color="#2E6641" /><Text className="flex-1 text-[0.8125rem] leading-relaxed text-[#2E6641]">{calculation.total.toLocaleString('nb-NO')} kr trekkes nå, men {providerName ?? 'oppdragstakeren'} mottar {calculation.providerNet.toLocaleString('nb-NO')} kr først når du har godkjent jobben. Er du ikke fornøyd, kan du opprette en tvist.{deadlineText ? `\n\nStarter ikke ${providerName ?? 'oppdragstakeren'} oppdraget innen ${deadlineText} etter betaling, kanselleres det automatisk og du får hele beløpet (${calculation.total.toLocaleString('nb-NO')} kr) refundert.` : ''}</Text></View></> : <View className="mt-5 flex-row items-center gap-2 rounded-2xl bg-[#EAF1E9] px-4 py-3.5"><ShieldCheck size={17} color="#2E6641" /><Text className="font-semibold text-[#2E6641]">Betalingen er gjennomført</Text></View>}
      {!isPaid ? <View className="mt-4"><Button label={isPending ? 'Sender deg til Stripe…' : `Bekreft og betal ${calculation.total.toLocaleString('nb-NO')} kr`} onPress={onPay} disabled={isPending} fullWidth /></View> : null}
      {isPaid && paidAction ? <View className="mt-4"><Button label={paidAction.label} onPress={paidAction.onPress} fullWidth /></View> : null}
    </View>
  );
}

/** Same texts as the web ContractViewModal's cancellation section. */
export function SafePayCancelledCard({ order, total }: { order: SafePayOrder; total: number }) {
  const reason = order.cancellationReason === 'provider_stripe_connect_timeout'
    ? 'Oppdragstakeren startet ikke oppdraget innen fristen.'
    : order.cancellationReason || 'Oppdraget er kansellert.';
  const refund = order.paymentStatus === 'refunded'
    ? `Full refusjon (${total.toLocaleString('nb-NO')} kr) er bekreftet. Det kan ta 1–2 virkedager før pengene vises på kontoen din.`
    : ['failed', 'manual_review'].includes(order.providerConnectTimeout?.status ?? '')
      ? 'Refusjonen kunne ikke bekreftes automatisk og følges opp manuelt.'
      : order.paymentStatus === 'paid' || order.providerConnectTimeout?.status
        ? 'Oppdraget er kansellert og refusjonen behandles. Når Stripe har bekreftet refusjonen, kan det ta 1–2 virkedager før pengene vises på kontoen din.'
        : null;
  return (
    <View className="rounded-3xl border border-[#F1D9D5] bg-[#FBF4F2] p-5">
      <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#B4453A]">Kansellert</Text>
      <Text className="mt-2 text-[0.9375rem] font-semibold text-[#0B0B0B]">{reason}</Text>
      {refund ? <Text className="mt-2 text-[0.8125rem] leading-relaxed text-[#63665F]">{refund}</Text> : null}
      {order.providerConnectDeadlineAt ? <Text className="mt-2 text-[0.75rem] text-[#9B9E96]">Fristen utløp: {new Date(order.providerConnectDeadlineAt).toLocaleString('nb-NO')}</Text> : null}
    </View>
  );
}

export function SafePayCheckoutSkeleton() {
  return <View className="gap-4 px-4 pt-6"><View className="h-4 w-24 rounded bg-[#E6E7E1]" /><View className="h-24 rounded-2xl bg-[#E6E7E1]" /><View className="h-40 rounded-3xl bg-[#E6E7E1]" /><View className="h-64 rounded-3xl bg-[#E6E7E1]" /></View>;
}