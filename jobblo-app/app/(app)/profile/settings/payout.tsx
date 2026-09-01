import React, { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, Info, Loader2, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useConnectStatus, useCreateAccountLinkMutation, useRefreshStatusMutation } from '../../../../src/hooks/usePayout';
import type { ConnectStatusResponse } from '../../../../src/services/payout.service';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../../src/components/ui/ErrorState';

type StatusKind = 'ready' | 'pending_verification' | 'started' | 'not_configured';

function deriveStatus(s: ConnectStatusResponse): StatusKind {
  if (s.payoutEnabled && s.payoutOnboardingStatus === 'enabled') return 'ready';
  if (s.detailsSubmitted && !s.payoutEnabled) return 'pending_verification';
  if (s.hasAccount && s.payoutOnboardingStatus === 'started') return 'started';
  if (!s.hasAccount || s.payoutOnboardingStatus === 'none') return 'not_configured';
  return s.detailsSubmitted ? 'pending_verification' : s.hasAccount ? 'started' : 'not_configured';
}

function getErrorInfo(error: unknown) {
  const err = error as { response?: { status?: number; data?: { error?: string; message?: string } } };
  const status = err?.response?.status;
  const message = err?.response?.data?.error || err?.response?.data?.message;
  return { status, message };
}

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const statusQuery = useConnectStatus();
  const accountLinkMutation = useCreateAccountLinkMutation();
  const refreshMutation = useRefreshStatusMutation();
  const onboardingLaunchedRef = useRef(false);

  // Keep latest callbacks in refs so the AppState listener is subscribed exactly
  // once instead of re-subscribing on every render (react-query returns new
  // query/mutation objects each render).
  const refreshRef = useRef(refreshMutation.mutate);
  const refetchRef = useRef(statusQuery.refetch);

  useEffect(() => {
    refreshRef.current = refreshMutation.mutate;
    refetchRef.current = statusQuery.refetch;
  }, [refreshMutation.mutate, statusQuery.refetch]);

  // Only refresh Stripe state when THIS screen actually launched onboarding.
  // Avoids hitting the Stripe API on every unrelated app foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!onboardingLaunchedRef.current) return;
      onboardingLaunchedRef.current = false;
      refreshRef.current(undefined, {
        onError: () => void refetchRef.current(),
      });
    });
    return () => sub.remove();
  }, []);

  const handleCta = () => {
    accountLinkMutation.mutate(undefined, {
      onSuccess: async (response) => {
        if (typeof response.url !== 'string' || !response.url.trim()) {
          Alert.alert('Kunne ikke åpne Stripe', 'Fikk ingen onboarding-lenke fra serveren. Prøv igjen.');
          return;
        }
        onboardingLaunchedRef.current = true;
        try {
          await Linking.openURL(response.url.trim());
        } catch {
          onboardingLaunchedRef.current = false;
          Alert.alert('Kunne ikke åpne Stripe', 'Kunne ikke åpne onboarding-lenken. Prøv igjen.');
        }
      },
      onError: (error) => {
        const info = getErrorInfo(error);
        if (info.status === 401) {
          Alert.alert('Pålogging kreves', 'Du må være innlogget for å sette opp utbetalinger.');
          return;
        }
        Alert.alert(
          'Kunne ikke starte Stripe-onboarding',
          info.message || 'Sjekk internettforbindelsen din og prøv igjen.'
        );
      },
    });
  };

  if (statusQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster utbetalingsstatus..." />
      </SafeAreaView>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    const info = getErrorInfo(statusQuery.error);
    const title = info.status === 401 ? 'Pålogging kreves' : 'Kunne ikke laste utbetalingsstatus';
    const message =
      info.status === 500
        ? 'Serverfeil. Prøv igjen litt senere.'
        : info.message || 'Utbetalingsstatusen kunne ikke hentes akkurat nå.';
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title={title}
          message={message}
          actionLabel="Prøv igjen"
          onAction={() => void statusQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const status = statusQuery.data;
  const kind = deriveStatus(status);
  const pending = accountLinkMutation.isPending || refreshMutation.isPending;

  let statusCard;
  let ctaLabel: string;
  let ctaIcon: React.ReactNode;

  if (kind === 'ready') {
    statusCard = (
      <View className="rounded-3xl border border-[#D1E7D9] bg-[#F2F9F4] p-5">
        <View className="flex-row items-start">
          <View className="h-9 w-9 items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 size={22} color="#2E6641" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-[0.9375rem] font-bold text-[#173A24]">Klar for utbetalinger</Text>
              <View className="ml-2 mt-0.5 rounded-full bg-[#C9E6D2] px-2 py-0.5">
                <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#173A24]">
                  Verifisert
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[0.8125rem] leading-5 text-[#173A24]">
              Din Stripe Connect-konto er aktiv og klar til å motta midler direkte når oppdrag godkjennes via SafePay.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Oppdater eller endre Stripe-opplysninger';
    ctaIcon = <ExternalLink size={17} color="#FFFFFF" />;
  } else if (kind === 'pending_verification') {
    statusCard = (
      <View className="rounded-3xl border border-[#F1E1C4] bg-[#FBF5E9] p-5">
        <View className="flex-row items-start">
          <View className="h-9 w-9 items-center justify-center shrink-0 mt-0.5">
            <Clock3 size={22} color="#B7791F" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-[0.9375rem] font-bold text-[#614109]">Verifisering kreves</Text>
              <View className="ml-2 mt-0.5 rounded-full bg-[#F0DDB7] px-2 py-0.5">
                <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#614109]">
                  Under behandling
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[0.8125rem] leading-5 text-[#614109]">
              Stripe behandler opplysningene dine. Du kan bli bedt om ytterligere dokumentasjon eller identitetsverifisering i Stripe Dashboard.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Fullfør verifisering i Stripe';
    ctaIcon = <ExternalLink size={17} color="#FFFFFF" />;
  } else if (kind === 'started') {
    statusCard = (
      <View className="rounded-3xl border border-[#F1E1C4] bg-[#FBF5E9] p-5">
        <View className="flex-row items-start">
          <View className="h-9 w-9 items-center justify-center shrink-0 mt-0.5">
            <AlertCircle size={22} color="#B7791F" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-[0.9375rem] font-bold text-[#614109]">Onboarding startet</Text>
              <View className="ml-2 mt-0.5 rounded-full bg-[#F0DDB7] px-2 py-0.5">
                <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#614109]">
                  Ufullstendig
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[0.8125rem] leading-5 text-[#614109]">
              Stripe-onboardingen er startet, men ikke fullført. Fortsett i Stripes portal for å legge inn bankinformasjon og fullføre identitetsverifisering.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Fortsett Stripe-onboarding';
    ctaIcon = <ExternalLink size={17} color="#FFFFFF" />;
  } else {
    statusCard = (
      <View className="rounded-3xl border border-[#F1E1C4] bg-[#FBF5E9] p-5">
        <View className="flex-row items-start">
          <View className="h-9 w-9 items-center justify-center shrink-0 mt-0.5">
            <AlertCircle size={22} color="#B7791F" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-[0.9375rem] font-bold text-[#614109]">Ikke satt opp</Text>
              <View className="ml-2 mt-0.5 rounded-full bg-[#F0DDB7] px-2 py-0.5">
                <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#614109]">
                  Handling kreves
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[0.8125rem] leading-5 text-[#614109]">
              Du må koble til din utbetalingskonto via Stripe Connect for å kunne motta utbetalinger for utførte jobber.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Start Stripe-onboarding';
    ctaIcon = <ShieldCheck size={17} color="#FFFFFF" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2">
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
        </Pressable>

        <View className="mb-5">
          <Text className="text-[1.5rem] font-bold leading-tight text-[#0B0B0B]">Utbetalingsinformasjon</Text>
          <Text className="mt-1 text-[0.9375rem] leading-6 text-[#63665F]">
            Jobblo bruker <Text className="font-semibold text-[#0B0B0B]">Stripe Connect</Text> for trygg og direkte
            utbetaling til din bankkonto for fullførte oppdrag.
          </Text>
        </View>

        {statusCard}

        <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF1E9]">
              <ShieldCheck size={22} color="#2E6641" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[1rem] font-bold text-[#0B0B0B]">Stripe Connect-oppsett</Text>
              <Text className="mt-1 text-[0.8125rem] text-[#63665F]">
                Sikker ID-verifisering og registrering av bankkonto
              </Text>
            </View>
          </View>

          <Text className="mt-4 text-[0.875rem] leading-6 text-[#63665F]">
            Ved å trykke på knappen nedenfor blir du sendt til Stripes trygge onboarding-portal i nettleseren din, der du kan legge inn bankinformasjon og gjennomføre identitetsverifisering. Jobblo lagrer ingen bankopplysninger eller identitetsdokumenter lokalt.
          </Text>

          <Pressable
            onPress={handleCta}
            disabled={pending}
            className={[
              'mt-5 flex-row items-center justify-center rounded-2xl px-5 py-3.5 shadow-sm',
              pending ? 'opacity-70' : '',
            ].join(' ')}
            style={{ backgroundColor: '#2E6641' }}
          >
            {pending ? (
              <>
                <Loader2 size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text className="text-[0.9375rem] font-semibold text-white">
                  {accountLinkMutation.isPending ? 'Kobler til Stripe...' : 'Oppdaterer status...'}
                </Text>
              </>
            ) : (
              <>
                {ctaIcon}
                <Text className="ml-2 text-[0.9375rem] font-semibold text-white">{ctaLabel}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-center">
            <Info size={16} color="#63665F" />
            <Text className="ml-2 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-[#63665F]">
              Informasjon om utbetalingstid
            </Text>
          </View>
          <Text className="mt-3 text-[0.8125rem] leading-6 text-[#63665F]">
            Din utbetalingstid fastlegges av din utbetalingsplan i Stripe. Når oppdragsgiver godkjenner jobben via
            SafePay, frigjøres midlene umiddelbart til din tilknyttede Stripe Connect-konto. Nøyaktig ankomsttid til
            bankkontoen din avhenger av Stripes schema, kontoens land, og forhåndsverifisering.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
