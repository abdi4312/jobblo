import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  Play,
  Trash2,
  X,
} from 'lucide-react-native';
import type { MyApplication } from '../../types/Application';
import { ApplicationFlowSteps } from './ApplicationFlowSteps';
import { orderStatusLabel } from '../../constants/orderStatus';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { TC, tc } from '../../theme/colors';

const ORDER_STATUS: Record<string, { label: string; tone: 'quiet' | 'moving' | 'action' | 'closed' }> = {
  awaiting_payment: { label: 'Venter på betaling', tone: 'quiet' },
  paid: { label: 'Klar til å starte', tone: 'action' },
  in_progress: { label: 'Under arbeid', tone: 'moving' },
  ready_for_review: { label: 'Til godkjenning', tone: 'quiet' },
  completed: { label: 'Fullført', tone: 'closed' },
  disputed: { label: 'Tvist', tone: 'action' },
  refunded: { label: 'Refundert', tone: 'closed' },
  cancelled: { label: 'Kansellert', tone: 'closed' },
};

const STATUS_TONE = {
  quiet: 'bg-surface-2 text-muted',
  moving: 'bg-tint text-brand-text',
  action: 'bg-brand-deep text-white',
  closed: 'border border-line bg-surface text-subtle',
} as const;

function formatDateShort(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function formatPrice(value?: number) {
  if (typeof value !== 'number') return '—';
  return `${value.toLocaleString('nb-NO')} kr`;
}

function getInitials(name?: string, lastName?: string) {
  const first = name?.trim()?.[0] ?? '?';
  const last = lastName?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

function getOrderStatusTone(value?: string | null) {
  return value ? ORDER_STATUS[value]?.tone ?? 'quiet' : null;
}

function getOrderStatusLabel(value?: string | null) {
  return value ? ORDER_STATUS[value]?.label ?? orderStatusLabel(value) : null;
}

export function ApplicationCard({
  application,
  onWithdraw,
  isWithdrawing,
  onViewJob,
  onChat,
  onOrder,
  onContract,
}: {
  application: MyApplication;
  onWithdraw?: (requestId: string) => void;
  isWithdrawing?: boolean;
  onViewJob?: (serviceId?: string) => void;
  onChat?: (chatId?: string) => void;
  onOrder?: (orderId?: string) => void;
  onContract?: (orderId?: string) => void;
}) {
  const service = application.service;
  const status = application.status;
  const badgeStatus = status === 'pending' ? 'pending' : status === 'accepted' ? 'accepted' : 'declined';
  const orderStatus = application.order?.status ?? null;
  const orderStatusLabel = getOrderStatusLabel(orderStatus);
  const orderStatusTone = getOrderStatusTone(orderStatus);
  const chatId = application.chat?._id ?? null;
  const orderId = typeof application.order?._id === 'string' && application.order._id.trim() ? application.order._id.trim() : null;
  const price = application.order?.agreedPrice ?? service?.price;
  const showAgreedPrice = application.order?.agreedPrice != null && application.order.agreedPrice !== service?.price;
  const hasOrder = !!orderId;
  const canWithdraw = status === 'pending' && !hasOrder;

  const actionButtonClass =
    'flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2';
  const primaryActionClass =
    'flex-row items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2';

  return (
    <View className="overflow-hidden rounded-xl border border-line bg-surface">
      <View className="p-5">
        <View className="flex-row items-start gap-4">
          <View className="flex h-11 w-11 items-center justify-center rounded-xl bg-tint">
            <Briefcase size={18} color={TC.brandText} />
          </View>

          <View className="min-w-0 flex-1">
            <View className="mb-1.5 flex-row flex-wrap items-center gap-1.5">
              <ApplicationStatusBadge status={badgeStatus} />
              {orderStatusLabel && (
                <View className={['self-start rounded-full px-2.5 py-1', STATUS_TONE[orderStatusTone ?? 'quiet']].join(' ')}>
                  <Text className="text-[0.8125rem] font-semibold text-current">{orderStatusLabel}</Text>
                </View>
              )}
            </View>

            <Text className="text-[1rem] font-semibold text-ink" numberOfLines={2}>
              {service?.title || 'Oppdrag'}
            </Text>

            <Text className="mt-1 text-[0.8125rem] text-muted">
              Søkt {formatDateShort(application.appliedAt)}
              {' · '}
              {service?.location?.city || 'Norge'}
            </Text>

            {service?.customer ? (
              <View className="mt-2.5 flex-row items-center gap-2">
                {service.customer.avatarUrl ? (
                  <View className="h-6 w-6 overflow-hidden rounded-full border border-line bg-tint">
                    <Image source={{ uri: service.customer.avatarUrl }} className="h-full w-full" />
                  </View>
                ) : (
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-tint">
                    <Text className="text-[0.6875rem] font-semibold text-brand-text">
                      {getInitials(service.customer.name, service.customer.lastName)}
                    </Text>
                  </View>
                )}
                <Text className="text-[0.8125rem] text-muted">
                  Oppdragsgiver:{' '}
                  <Text className="font-medium text-ink">
                    {service.customer.name} {service.customer.lastName || ''}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>

          <View className="items-end">
            <Text className="text-[1rem] font-bold text-ink">{formatPrice(price as number)}</Text>
            {showAgreedPrice && (
              <Text className="mt-0.5 text-[0.8125rem] text-subtle">Avtalt pris</Text>
            )}
          </View>
        </View>

        <ApplicationFlowSteps
          applicationStatus={application.status}
          orderStatus={application.order?.status}
        />

        {application.message ? (
          <View className="mt-4 rounded-lg border-l-2 border-brand-text bg-surface-2 px-3 py-2.5">
            <Text className="text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Din melding
            </Text>
            <Text className="mt-1 text-[0.875rem] leading-relaxed text-ink" numberOfLines={2}>
              {application.message}
            </Text>
          </View>
        ) : null}

        {application.nextAction ? (
          <View className="mt-3 flex-row items-center gap-2">
            <ArrowRight size={14} color={TC.brandText} />
            <Text className="text-[0.8125rem] text-muted" numberOfLines={2}>
              {application.nextAction}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-5 py-3.5">
        {application.order?.status === 'paid' && application.order?._id ? (
          <Pressable onPress={() => onOrder?.(application.order?._id)} className={primaryActionClass}>
            <Play size={13} color="#FFFFFF" />
            <Text className="text-[0.8125rem] font-semibold text-white">Start jobben</Text>
          </Pressable>
        ) : null}

        {application.order?.status === 'in_progress' && application.order?._id ? (
          <Pressable onPress={() => onOrder?.(application.order?._id)} className={primaryActionClass}>
            <Text className="text-[0.8125rem] font-semibold text-white">Fortsett arbeidet</Text>
            <ArrowRight size={13} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {(application.order?.status === 'ready_for_review' || application.order?.status === 'completed') && orderId ? (
          <Pressable onPress={() => onOrder?.(application.order?._id)} className={primaryActionClass}>
            <CheckCircle2 size={13} color="#FFFFFF" />
            <Text className="text-[0.8125rem] font-semibold text-white">Se detaljer</Text>
          </Pressable>
        ) : null}

        {service?._id ? (
          <Pressable onPress={() => onViewJob?.(service._id)} className={actionButtonClass}>
            <Eye size={13} color={TC.ink} />
            <Text className="text-[0.8125rem] font-medium text-ink">Vis oppdrag</Text>
          </Pressable>
        ) : null}

        {chatId ? (
          <Pressable onPress={() => onChat?.(chatId)} className={actionButtonClass}>
            <MessageCircle size={13} color={TC.ink} />
            <Text className="text-[0.8125rem] font-medium text-ink">Chat</Text>
          </Pressable>
        ) : null}

        {orderId ? (
          <Pressable onPress={() => onContract?.(orderId)} className={actionButtonClass}>
            <FileText size={13} color={TC.ink} />
            <Text className="text-[0.8125rem] font-medium text-ink">Se kontrakt</Text>
          </Pressable>
        ) : null}

        {canWithdraw ? (
          <Pressable
            onPress={() => onWithdraw?.(application._id)}
            disabled={isWithdrawing}
            className={['ml-auto flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2', isWithdrawing ? 'opacity-60' : ''].join(' ')}
          >
            <X size={13} color={tc('#63665F', 'muted')} />
            <Text className="text-[0.8125rem] font-medium text-muted">
              {isWithdrawing ? 'Trekker…' : 'Trekk tilbake'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
