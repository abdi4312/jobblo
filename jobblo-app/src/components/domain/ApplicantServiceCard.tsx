import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Briefcase, ChevronRight, MapPin, UserRound } from 'lucide-react-native';
import type { ApplicantOverviewService } from '../../types/Applicants';
import { ApplicantAvatarStack } from './ApplicantAvatarStack';
import { ServiceStatusBadge } from './ServiceStatusBadge';
import { TC, tc } from '../../theme/colors';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(value?: number) {
  return typeof value === 'number' ? `${value.toLocaleString('nb-NO')} kr` : null;
}

export function ApplicantServiceCard({
  service,
  onPress,
}: {
  service: ApplicantOverviewService;
  onPress?: (serviceId: string) => void;
}) {
  const awaitingChoice = service.applicantCount > 0 && !service.selectedWorker;

  return (
    <Pressable
      onPress={() => onPress?.(service._id)}
      disabled={!onPress}
      className="rounded-xl border border-line bg-surface p-5 active:opacity-90"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint">
          <Briefcase size={18} color={TC.brandText} />
        </View>

        <View className="min-w-0 flex-1">
          <View className="mb-1.5 flex-row flex-wrap gap-1.5">
            <ServiceStatusBadge status={service.status} />
            {awaitingChoice ? (
              <View className="self-start rounded-full bg-brand-deep px-2.5 py-1">
                <Text className="text-[0.8125rem] font-semibold text-white">Velg utfører</Text>
              </View>
            ) : null}
          </View>

          <Text className="text-[1rem] font-semibold tracking-[-0.02em] text-ink" numberOfLines={2}>
            {service.title}
          </Text>

          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            <Text className="text-[0.8125rem] text-muted">{formatDate(service.createdAt)}</Text>
            {service.location?.city ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-subtle">·</Text>
                <MapPin size={12} color={tc('#9B9E96', 'subtle')} />
                <Text className="text-[0.8125rem] text-muted">{service.location.city}</Text>
              </View>
            ) : null}
            {formatPrice(service.price) ? (
              <Text className="text-subtle">·</Text>
            ) : null}
            {formatPrice(service.price) ? (
              <Text className="text-[0.8125rem] font-semibold text-ink">{formatPrice(service.price)}</Text>
            ) : null}
          </View>
        </View>

        <View className="shrink-0 items-end gap-1.5">
          <ApplicantAvatarStack avatars={service.applicantAvatars} applicantCount={service.applicantCount} />
          <Text className="text-[0.8125rem] text-muted">
            <Text className="font-semibold text-ink">{service.applicantCount}</Text>{' '}
            {service.applicantCount === 1 ? 'søker' : 'søkere'}
          </Text>
        </View>
        <ChevronRight size={18} color={tc('#9B9E96', 'subtle')} />
      </View>

      {service.selectedWorker ? (
        <View className="mt-4 flex-row items-center gap-2 border-t border-line pt-3.5">
          <View className="h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-tint">
            {service.selectedWorker.avatarUrl ? (
              <Image source={{ uri: service.selectedWorker.avatarUrl }} className="h-full w-full" />
            ) : (
              <UserRound size={12} color={TC.brandText} />
            )}
          </View>
          <Text className="flex-1 text-[0.8125rem] text-muted" numberOfLines={2}>
            Valgt utfører:{' '}
            <Text className="font-semibold text-ink">{service.selectedWorker.name}</Text>
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
