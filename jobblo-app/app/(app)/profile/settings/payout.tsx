import React, { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, Info, Loader2, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useConnectStatus, useCreateAccountLinkMutation, useRefreshStatusMutation } from '../../../../src/hooks/usePayout';
import type { ConnectStatusResponse } from '../../../../src/services/payout.service';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../../src/components/ui/ErrorState';

type StatusKind = 'ready' | 'pending_verification' | 'started' | 'restricted' | 'not_configured';

function deriveStatus(s: ConnectStatusResponse): StatusKind {
  if (s.payoutReady) return 'ready';
  if (s.payoutOnboardingStatus === 'restricted') return 'restricted';
  if (s.payoutOnboardingStatus === 'pending_verification') return 'pending_verification';
  if (s.hasAccount && s.payoutOnboardingStatus === 'started') return 'started';
  if (!s.hasAccount || s.payoutOnboardingStatus === 'none') return 'not_configured';
  return 'started';
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
              Stripe Connect-kontoen din er verifisert og klar til å motta overføringer.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Administrer Stripe-konto';
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
              Stripe gjennomgår opplysningene dine. Vi oppdaterer statusen når kontoen er klar.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Åpne Stripe-konto';
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
              Fullfør Stripe Connect-oppsettet for å kunne sende forespørsler, starte oppdrag og motta utbetalinger.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Fullfør Stripe Connect-oppsett';
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
              Koble til Stripe Connect for å kunne sende forespørsler og motta betaling for oppdrag.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Koble til Stripe Connect';
    ctaIcon = <ShieldCheck size={17} color="#FFFFFF" />;
  }

  if (kind === 'restricted') {
    statusCard = (
      <View className="rounded-2xl border border-[#E6E7E1] bg-white p-5">
        <View className="flex-row items-start">
          <AlertCircle size={22} color="#63665F" />
          <View className="ml-3 flex-1">
            <Text className="text-[0.9375rem] font-bold text-[#0B0B0B]">Handling kreves</Text>
            <Text className="mt-2 text-[0.8125rem] leading-5 text-[#63665F]">
              Stripe trenger flere opplysninger eller verifisering. Åpne kontoen din hos Stripe for å se hva som mangler.
            </Text>
          </View>
        </View>
      </View>
    );
    ctaLabel = 'Oppdater Stripe-opplysninger';
    ctaIcon = <ExternalLink size={17} color="#FFFFFF" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2">
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
        </Pressable>

        <View className="mb-5">
          <Text className="text-[1.5rem] font-bold leading-tight text-[#0B0B0B]">Utbetalinger</Text>
          <Text className="mt-1 text-[0.9375rem] leading-6 text-[#63665F]">
            Administrer Stripe Connect-kontoen din og se status for utbetalinger.
          </Text>
        </View>

        {status.mode === 'test' ? (
          <View className="mb-4 rounded-2xl bg-white p-4">
            <Text className="text-xs font-semibold text-[#63665F]">Testmodus</Text>
            <Text className="mt-1 text-xs leading-5 text-[#63665F]">
              Dette er en testkonto. Ingen ekte bankoverføringer gjennomføres.
            </Text>
          </View>
        ) : null}

        {statusCard}

        <View className="mt-3 rounded-2xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Kontoinformasjon</Text>
            <Text className="text-xs text-[#85887F]">Status fra Stripe</Text>
          </View>
          {[
            ['Tilkoblingsstatus', kind === 'ready' ? 'Klar for utbetalinger' : kind === 'pending_verification' ? 'Venter på verifisering' : kind === 'restricted' ? 'Handling kreves' : kind === 'not_configured' ? 'Ikke tilkoblet' : 'Oppsett ikke fullført'],
            ['Identitetsverifisering', kind === 'ready' ? 'Fullført' : kind === 'pending_verification' ? 'Under behandling' : status.detailsSubmitted ? 'Opplysninger sendt' : 'Ikke fullført'],
            ['Klar for overføringer', status.transfersEnabled ? 'Ja' : status.hasAccount ? 'Nei' : 'Ikke tilkoblet'],
            ['Bankutbetalinger aktivert', status.payoutEnabled ? 'Ja' : status.hasAccount ? 'Nei' : 'Ikke tilkoblet'],
            ...(status.connectedAt
              ? [['Tilkoblet siden', new Date(status.connectedAt).toLocaleDateString('nb-NO')]]
              : []),
          ].map(([label, value]) => (
            <View key={label} className="min-h-12 flex-row items-center justify-between gap-4 border-t border-[#F0F1EC] py-3">
              <Text className="flex-1 text-[0.8125rem] text-[#63665F]">{label}</Text>
              <Text className="text-right text-[0.8125rem] font-medium text-[#30332F]">{value}</Text>
            </View>
          ))}
          {status.accountId ? (
            <View className="min-h-12 flex-row items-center justify-between gap-4 border-t border-[#F0F1EC] py-3">
              <Text className="text-[0.8125rem] text-[#63665F]">Stripe-konto</Text>
              <Text className="font-mono text-xs text-[#30332F]">
                {status.accountId.slice(0, 9)}…{status.accountId.slice(-4)}
              </Text>
            </View>
          ) : null}
          {kind !== 'ready' ? (
            <Text className="mt-3 rounded-xl bg-[#F4F6F0] p-3 text-xs leading-5 text-[#63665F]">
              Fullfør Stripe Connect-oppsettet for å kunne sende forespørsler, starte oppdrag og motta utbetalinger.
            </Text>
          ) : null}
        </View>

        {kind === 'pending_verification' ? (
          <Pressable
            onPress={() => refreshMutation.mutate(undefined, {
              onError: (error) => {
                const info = getErrorInfo(error);
                Alert.alert('Kunne ikke oppdatere status', info.message || 'Prøv igjen senere.');
              },
            })}
            disabled={pending}
            className="mt-3 min-h-11 flex-row items-center justify-center gap-2 rounded-xl border border-[#E6E7E1] bg-white px-4"
          >
            {refreshMutation.isPending ? <Loader2 size={16} color="#2E6641" /> : <Clock3 size={16} color="#2E6641" />}
            <Text className="text-sm font-semibold text-[#2E6641]">
              {refreshMutation.isPending ? 'Sjekker status...' : 'Sjekk status'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleCta}
          disabled={pending}
          className={[
            'mt-3 min-h-12 flex-row items-center justify-center rounded-xl px-5 py-3',
            pending ? 'opacity-70' : '',
          ].join(' ')}
          style={{ backgroundColor: '#2E6641' }}
        >
          {pending ? (
            <>
              <Loader2 size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text className="text-[0.9375rem] font-semibold text-white">
                {accountLinkMutation.isPending ? 'Åpner Stripe...' : 'Oppdaterer status...'}
              </Text>
            </>
          ) : (
            <>
              {ctaIcon}
              <Text className="ml-2 text-[0.9375rem] font-semibold text-white">{ctaLabel}</Text>
            </>
          )}
        </Pressable>

        <View className="mt-5 rounded-2xl border border-[#E6E7E1] bg-white p-5">
          <View className="flex-row items-center">
            <Info size={16} color="#63665F" />
            <Text className="ml-2 text-[0.9375rem] font-semibold text-[#0B0B0B]">Slik fungerer utbetalinger</Text>
          </View>
          {[
            { number: '1', title: 'Kunden betaler', description: 'Kunden fullfører betalingen gjennom SafePay.' },
            { number: '2', title: 'Oppdraget godkjennes', description: 'Du fullfører jobben, og kunden godkjenner arbeidet.' },
            { number: '3', title: 'Overføring til Stripe Connect', description: 'Jobblo overfører tilgjengelige midler til Stripe-kontoen din.' },
            { number: '4', title: 'Utbetaling til bankkonto', description: 'Stripe utbetaler etter kontoens utbetalingsplan.' },
          ].map((step) => (
            <View key={step.number} className="mt-4 flex-row gap-3">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-[#F4F6F0]">
                <Text className="text-xs font-bold text-[#2E6641]">{step.number}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[0.8125rem] font-semibold text-[#30332F]">{step.title}</Text>
                <Text className="mt-1 text-xs leading-5 text-[#63665F]">{step.description}</Text>
              </View>
            </View>
          ))}
          <Text className="mt-4 border-t border-[#F0F1EC] pt-3 text-xs leading-5 text-[#63665F]">
            En overføring til Stripe Connect betyr ikke at beløpet allerede er utbetalt til bankkontoen.
          </Text>
          <Pressable onPress={() => router.push('/profile/settings/safepay')} className="mt-4 self-start py-2">
            <Text className="text-sm font-semibold text-[#2E6641]">Se transaksjonshistorikk →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
