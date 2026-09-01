import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Archive, Check, Heart, MapPin, MessageCircle, ShieldCheck, Star, Users, X } from 'lucide-react-native';
import { Button } from '../ui/Button';
import type { ActiveApplicantOrder, ApplicantApplication } from '../../types/Applicants';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function statusLabel(status: string) {
  if (status === 'accepted') return 'Valgt';
  if (status === 'declined') return 'Avslått';
  return 'Venter på svar';
}

function activeOrderLabel(order: ActiveApplicantOrder | null) {
  if (!order) return 'Velg og start SafePay';
  if (order.status === 'awaiting_payment') return 'Gå til betaling';
  if (order.status === 'paid' || order.status === 'in_progress') return 'Betalt';
  if (order.status === 'ready_for_review' || order.status === 'completed') return 'Se godkjenning';
  return 'Se aktiv kontrakt';
}

export function ApplicantCard({
  application,
  activeOrder,
  isTop,
  isCompared,
  isSelecting,
  isStartingChat,
  onFavorite,
  onCompare,
  onArchive,
  onDecline,
  onSelect,
  onChat,
}: {
  application: ApplicantApplication;
  activeOrder: ActiveApplicantOrder | null;
  isTop: boolean;
  isCompared: boolean;
  isSelecting: boolean;
  isStartingChat: boolean;
  onFavorite: (requestId: string) => void;
  onCompare: (applicantId: string) => void;
  onArchive: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onSelect: (application: ApplicantApplication) => void;
  onChat: (applicantId: string) => void;
}) {
  const { applicant } = application;
  const actionLabel = isSelecting ? 'Starter…' : activeOrderLabel(activeOrder);

  return (
    <View className={['rounded-[20px] border bg-white p-4', application.favorite ? 'border-2 border-[#D6B84C]' : application.archived ? 'border-[#E6E7E1] opacity-60' : 'border-[#E6E7E1]'].join(' ')}>
      <View className="flex-row items-start gap-3">
        <View className="relative h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full bg-[#EAF1E9]">
          <View className="h-12 w-12 overflow-hidden rounded-full">
            {applicant.avatarUrl ? <Image source={{ uri: applicant.avatarUrl }} className="h-full w-full" /> : <View className="h-full w-full items-center justify-center"><Text className="text-[1rem] font-medium text-[#122A1C]">{getInitials(applicant.name)}</Text></View>}
          </View>
          {isTop ? <View className="absolute -right-2 -top-1 rounded-full border-2 border-white bg-[#2E6641] px-1.5 py-0.5"><Text className="text-[0.5625rem] font-medium text-white">Topp</Text></View> : null}
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]" numberOfLines={1}>{applicant.name}</Text>
            {applicant.verified ? <View className="flex-row items-center gap-0.5"><ShieldCheck size={13} color="#2E6641" /><Text className="text-[0.6875rem] font-medium text-[#2E6641]">Verifisert</Text></View> : null}
          </View>
          <Text className="mt-1 text-[0.75rem] text-[#63665F]" numberOfLines={2}>{applicant.skills.length > 0 ? applicant.skills.join(' · ') : 'Generell hjelp'}</Text>
          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
            <View className="flex-row items-center">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={11} color="#63665F" fill={index < Math.floor(applicant.rating) ? '#63665F' : 'none'} />)}</View>
            <Text className="text-[0.6875rem] text-[#63665F]">{applicant.rating} · {applicant.reviewCount} anmeldelser · {applicant.completedJobs} oppdrag</Text>
          </View>
        </View>

        <View className="self-start rounded-full bg-[#F4F6F0] px-2.5 py-1"><Text className="text-[0.6875rem] font-semibold text-[#63665F]">{statusLabel(application.status)}</Text></View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-start gap-x-5 gap-y-2 border-t border-[#E6E7E1] pt-3">
        <View><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{applicant.completedJobs}</Text><Text className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">Fullførte</Text></View>
        <View><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{applicant.rating}★</Text><Text className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">Rating</Text></View>
        <View><Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">{applicant.responseRate ?? '—'}</Text><Text className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">Svar%</Text></View>
        <View className="min-w-0 flex-1"><Text className="text-[0.8125rem] text-[#63665F]" numberOfLines={1}>Søkt {formatDate(application.appliedAt)}</Text>{applicant.locations.length > 0 ? <View className="mt-1 flex-row items-center gap-1"><MapPin size={12} color="#9B9E96" /><Text className="flex-1 text-[0.75rem] text-[#63665F]" numberOfLines={1}>{applicant.locations.join(' · ')}</Text></View> : null}</View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center gap-1">
        <Pressable onPress={() => onFavorite(application._id)} accessibilityLabel="Marker som favoritt" className={['h-9 w-9 items-center justify-center rounded-full', application.favorite ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]'].join(' ')}><Heart size={17} color="#2E6641" fill={application.favorite ? '#2E6641' : 'none'} /></Pressable>
        <Pressable onPress={() => onCompare(applicant._id)} accessibilityLabel="Legg til i sammenligning" className={['h-9 w-9 items-center justify-center rounded-full', isCompared ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]'].join(' ')}><Users size={17} color="#2E6641" /></Pressable>
        <Pressable onPress={() => onArchive(application._id)} accessibilityLabel={application.archived ? 'Gjenopprett fra arkiv' : 'Arkiver søker'} className="h-9 w-9 items-center justify-center rounded-full bg-[#F4F6F0]"><Archive size={17} color="#63665F" /></Pressable>
        <Pressable onPress={() => onDecline(application._id)} accessibilityLabel="Avslå søker" className="h-9 w-9 items-center justify-center rounded-full bg-[#FBF4F2]"><X size={17} color="#B4544A" /></Pressable>
      </View>

      {application.message ? <View className="my-4 rounded-xl border-l-[3px] border-[#2E6641] bg-[#F4F6F0] px-3 py-2.5"><View className="flex-row items-center gap-1"><MessageCircle size={12} color="#9B9E96" /><Text className="text-[0.6875rem] text-[#63665F]">Melding fra søker</Text></View><Text className="mt-1 text-[0.8125rem] leading-relaxed text-[#0B0B0B]">{application.message}</Text></View> : null}

      <View className="gap-2">
        <Button label={actionLabel} onPress={() => onSelect(application)} disabled={isSelecting} icon={<Check size={16} color="#FFFFFF" />} fullWidth />
        <Button label={isStartingChat ? 'Åpner melding…' : 'Send melding'} onPress={() => onChat(applicant._id)} disabled={isStartingChat} variant="secondary" icon={<MessageCircle size={16} color="#0B0B0B" />} fullWidth />
      </View>
    </View>
  );
}
