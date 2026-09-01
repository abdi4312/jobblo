import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../../src/store/authStore';
import { deleteCurrentUser } from '../../../../src/services/profile.service';

const CONFIRM_WORD = 'SLETT';

type DeleteErrorCode =
  | 'active_orders_exist'
  | 'active_subscription_exists'
  | 'subscription_check_unavailable'
  | undefined;

function extractError(err: unknown): { message: string; code: DeleteErrorCode } {
  const response = (
    err as {
      response?: { status?: number; data?: { error?: string; message?: string; code?: string } };
    }
  )?.response;
  const data = response?.data;
  return {
    message: data?.error || data?.message || 'Kunne ikke slette profilen. Prøv igjen.',
    code: (data?.code as DeleteErrorCode) || undefined,
  };
}

const inputClass =
  'rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3.5 text-[0.9375rem] text-[#0B0B0B] font-semibold tracking-widest text-center';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const userId = user && typeof user._id === 'string' ? user._id : null;

  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !!userId;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCurrentUser(id),
    onSuccess: async () => {
      try {
        await logout();
      } finally {
        router.replace('/(auth)/login');
      }
    },
  });

  const handleDelete = () => {
    if (!canDelete || !userId || deleteMutation.isPending) return;
    deleteMutation.mutate(userId);
  };

  const errorInfo = deleteMutation.isError ? extractError(deleteMutation.error) : null;
  const isActiveOrders = errorInfo?.code === 'active_orders_exist';
  const isActiveSubscription = errorInfo?.code === 'active_subscription_exists';

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="mb-5 flex-row items-center self-start py-2"
          >
            <ArrowLeft size={18} color="#63665F" />
            <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
          </Pressable>

          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="mb-5 flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FBF4F2]">
                <Trash2 size={18} color="#B4544A" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-lg font-bold text-[#0B0B0B]">Slett profil</Text>
                <Text className="mt-1 text-xs leading-4 text-[#63665F]">
                  Denne handlingen kan ikke angres.
                </Text>
              </View>
            </View>

            <View className="flex flex-col gap-3 mb-5">
              <Text className="text-[0.875rem] leading-relaxed text-[#0B0B0B]">
                Det er trist å se deg dra! Sletting av profilen din er irreversibel. Alle
                personopplysningene dine blir fjernet, og du blir logget ut av alle enheter.
              </Text>
              <Text className="text-[0.875rem] leading-relaxed text-[#63665F]">
                Personlige opplastede filer som profilbilde, banner og sertifikater blir slettet fra
                lagring. Fullførte transaksjonsjournaler beholdes i henhold til bokføringslovens
                krav, men uten dine normale profildata knyttet til dem.
              </Text>
            </View>

            <View className="mb-5 flex flex-row items-start gap-3 rounded-2xl border border-[#F4D6D1] bg-[#FBF4F2] p-4">
              <ShieldAlert size={18} color="#B4544A" className="mt-0.5 shrink-0" />
              <View className="flex-1">
                <Text className="text-[0.8125rem] font-semibold text-[#8A3C32]">
                  Kontroller før du sletter
                </Text>
                <Text className="mt-1 text-[0.75rem] leading-relaxed text-[#8A3C32]">
                  Pågående oppdrag og betalinger (SafePay) må fullføres eller avsluttes før du kan
                  slette. Aktivt abonnement må avsluttes og perioden må være utløpt først.
                </Text>
              </View>
            </View>

            {isActiveSubscription ? (
              <View className="mb-5 rounded-2xl border border-[#F4D6D1] bg-[#FBF4F2] p-4">
                <View className="flex-row items-start gap-2">
                  <AlertTriangle size={16} color="#B4544A" />
                  <View className="flex-1">
                    <Text className="text-[0.8125rem] font-semibold text-[#8A3C32]">
                      Aktivt abonnement finnes
                    </Text>
                    <Text className="mt-1 text-[0.75rem] leading-relaxed text-[#8A3C32]">
                      {errorInfo?.message}
                    </Text>
                    <Pressable
                      onPress={() => router.push('/profile/settings/subscription')}
                      className="mt-3 rounded-full bg-[#B4544A] px-4 py-2.5 self-start"
                    >
                      <Text className="text-[0.8125rem] font-semibold text-white">
                        Gå til abonnementer
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

            {isActiveOrders ? (
              <View className="mb-5 rounded-2xl border border-[#F4E3C7] bg-[#FBF6EC] p-4">
                <View className="flex-row items-start gap-2">
                  <AlertTriangle size={16} color="#92651B" />
                  <View className="flex-1">
                    <Text className="text-[0.8125rem] font-semibold text-[#7A5412]">
                      Pågående oppdrag
                    </Text>
                    <Text className="mt-1 text-[0.75rem] leading-relaxed text-[#7A5412]">
                      {errorInfo?.message}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {errorInfo && !isActiveOrders && !isActiveSubscription ? (
              <View className="mb-5 rounded-2xl border border-[#F4D6D1] bg-[#FBF4F2] p-4">
                <Text className="text-[0.8125rem] font-semibold text-[#8A3C32]">
                  Klarte ikke å slette profilen
                </Text>
                <Text className="mt-1 text-[0.75rem] leading-relaxed text-[#8A3C32]">
                  {errorInfo.message}
                </Text>
              </View>
            ) : null}

            <View className="mb-3">
              <Text className="mb-1.5 text-[0.8125rem] font-semibold text-[#0B0B0B]">
                Bekreft sletting
              </Text>
              <Text className="mb-3 text-[0.75rem] leading-relaxed text-[#63665F]">
                Skriv ordet <Text className="font-bold text-[#B4544A]">{CONFIRM_WORD}</Text>{' '}
                nedenfor for å bekrefte at du forstår at handlingen ikke kan angres.
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={(value) => {
                  setConfirmText(value);
                  if (deleteMutation.isError) deleteMutation.reset();
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                placeholder={CONFIRM_WORD}
                placeholderTextColor="#BFBFBF"
                maxLength={10}
                className={[inputClass, canDelete ? 'border-[#B4544A] bg-[#FBF4F2]' : ''].join(' ')}
              />
            </View>

            <Pressable
              onPress={handleDelete}
              disabled={!canDelete || deleteMutation.isPending}
              className={[
                'items-center rounded-xl py-3.5',
                canDelete && !deleteMutation.isPending
                  ? 'bg-[#B4544A] active:opacity-90'
                  : 'bg-[#C8CAC3] opacity-70',
              ].join(' ')}
            >
              <Text className="text-sm font-bold text-white">
                {deleteMutation.isPending ? 'Sletter profilen din...' : 'Slett profilen min'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={deleteMutation.isPending}
              className="mt-3 items-center py-2.5"
            >
              <Text className="text-sm font-semibold text-[#63665F]">
                Avbryt og behold profilen
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
