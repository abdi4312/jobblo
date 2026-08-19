/**
 * ApplyModal - centered modal dialog matching the web OrderRequestModal.
 * This is a presentation-only refactor; business logic remains in the mutation flow.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Send, X } from 'lucide-react-native';
import { Dialog } from '../ui/Dialog';
import type { CreateJobRequestPayload } from '../../types/Application';

export interface ApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateJobRequestPayload) => void;
  jobTitle?: string;
  isLoading?: boolean;
  error?: string | null;
}

export const ApplyModal = React.memo(
  ({ visible, onClose, onSubmit, jobTitle, isLoading = false, error }: ApplyModalProps) => {
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
            <Text className="text-lg font-bold text-[#0B0B0B]">Send forespørsel</Text>
            <Pressable
              onPress={handleClose}
              disabled={isLoading}
              className="h-8 w-8 items-center justify-center rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Lukk modal"
            >
              <X size={20} color="#63665F" />
            </Pressable>
          </View>

          {jobTitle ? (
            <Text className="mb-4 text-sm text-[#63665F]">
              <Text className="font-medium text-[#0B0B0B]">{jobTitle}</Text>
            </Text>
          ) : null}

          {error ? (
            <View className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <Text className="text-sm font-medium text-red-700">
                {typeof error === 'string' ? error : 'Kunne ikke sende forespørsel. Prøv igjen senere.'}
              </Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#0B0B0B]">
              Melding til leverandøren <Text className="font-normal text-[#63665F]">(valgfritt)</Text>
            </Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Skriv en melding til leverandøren..."
              placeholderTextColor="#9B9E96"
              multiline
              maxLength={maxLength}
              editable={!isLoading}
              numberOfLines={4}
              className="min-h-[104px] w-full rounded-xl border border-[#E6E7E1] bg-white px-4 py-3 text-sm text-[#0B0B0B]"
              style={{
                textAlignVertical: 'top',
                fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                shadowOpacity: 0,
              }}
            />

            <Text className="mt-1 text-right text-[11px] text-[#9B9E96]">
              {messageLength}/{maxLength}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleClose}
              disabled={isLoading}
              className={[
                'flex-1 items-center justify-center rounded-xl border border-[#E6E7E1] bg-white px-4 py-3',
                isLoading ? 'opacity-60' : '',
              ].join(' ')}
            >
              <Text className="text-sm font-medium text-[#0B0B0B]">Avbryt</Text>
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
        </View>
      </Dialog>
    );
  }
);

ApplyModal.displayName = 'ApplyModal';
