/**
 * ApplyModal - centered modal dialog matching the web OrderRequestModal.
 * This is a presentation-only refactor; business logic remains in the mutation flow.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Send, X } from 'lucide-react-native';
import { Dialog } from '../ui/Dialog';
import type { CreateJobRequestPayload } from '../../types/Application';
import { TC, tc } from '../../theme/colors';

export interface ApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateJobRequestPayload) => void;
  jobTitle?: string;
  isLoading?: boolean;
  error?: string | null;
  connectStatus?: 'loading' | 'ready' | 'required' | 'unavailable';
  onGoToPayout?: () => void;
}

export const ApplyModal = React.memo(
  ({
    visible,
    onClose,
    onSubmit,
    jobTitle,
    isLoading = false,
    error,
    connectStatus = 'ready',
    onGoToPayout,
  }: ApplyModalProps) => {
    const [message, setMessage] = useState('');
    const maxLength = 500;
    const messageLength = message.length;
    const isValid = messageLength <= maxLength;

    const handleSubmit = useCallback(() => {
      if (!isValid || isLoading) return;

      const payload: CreateJobRequestPayload = {
        serviceId: '',
        ...(message.trim() && { message: message.trim() }),
      };

      onSubmit(payload);
    }, [isValid, isLoading, message, onSubmit]);

    const handleClose = useCallback(() => {
      if (!isLoading) {
        setMessage('');
        onClose();
      }
    }, [isLoading, onClose]);

    return (
      <Dialog visible={visible} onClose={handleClose}>
        <View className="w-full">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">Send forespørsel</Text>
            <Pressable
              onPress={handleClose}
              disabled={isLoading}
              className="h-8 w-8 items-center justify-center rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Lukk modal"
            >
              <X size={20} color={tc('#63665F', 'muted')} />
            </Pressable>
          </View>

          {jobTitle ? (
            <Text className="mb-4 text-sm text-muted">
              <Text className="font-medium text-ink">{jobTitle}</Text>
            </Text>
          ) : null}

          {connectStatus !== 'ready' ? (
            <View className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <Text className="text-sm font-semibold text-ink">
                {connectStatus === 'loading'
                  ? 'Kontrollerer Stripe Connect-status...'
                  : 'Du må fullføre og verifisere Stripe Connect-kontoen din før du kan sende forespørsler eller starte oppdrag.'}
              </Text>
              {connectStatus === 'unavailable' ? (
                <Text className="mt-2 text-sm text-muted">
                  Stripe Connect-status kan ikke bekreftes akkurat nå. Prøv igjen senere.
                </Text>
              ) : null}
              {connectStatus !== 'loading' ? (
                <Pressable
                  onPress={onGoToPayout}
                  className="mt-3 items-center rounded-xl bg-brand px-4 py-3"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-semibold text-white">Fullfør Stripe Connect</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {error && connectStatus === 'ready' ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <Text className="text-sm font-medium text-red-700">
                {typeof error === 'string' ? error : 'Kunne ikke sende forespørsel. Prøv igjen senere.'}
              </Text>
            </View>
          ) : null}

          {connectStatus === 'ready' ? (
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-ink">
                Melding til leverandøren <Text className="font-normal text-muted">(valgfritt)</Text>
              </Text>

              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Skriv en melding til leverandøren..."
                placeholderTextColor={TC.placeholder}
                multiline
                maxLength={maxLength}
                editable={!isLoading}
                numberOfLines={4}
                className="min-h-[104px] w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink"
                style={{
                  textAlignVertical: 'top',
                  fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                  shadowOpacity: 0,
                }}
              />

              <Text className="mt-1 text-right text-[11px] text-subtle">
                {messageLength}/{maxLength}
              </Text>
            </View>
          ) : null}

          {connectStatus === 'ready' ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleClose}
                disabled={isLoading}
                className={[
                  'flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 py-3',
                  isLoading ? 'opacity-60' : '',
                ].join(' ')}
              >
                <Text className="text-sm font-medium text-ink">Avbryt</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit}
                disabled={!isValid || isLoading}
                className={[
                  'flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#2F7E47] px-4 py-3',
                  (!isValid || isLoading) ? 'opacity-60' : '',
                ].join(' ')}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={16} color="#FFFFFF" />
                )}
                <Text className="text-sm font-semibold text-white">
                  {isLoading ? 'Sender...' : 'Send forespørsel'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Dialog>
    );
  }
);

ApplyModal.displayName = 'ApplyModal';
