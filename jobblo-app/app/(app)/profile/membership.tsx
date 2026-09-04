import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/store/authStore';
import { useCurrentSubscription } from '../../../src/hooks/useSubscription';
import { queryKeys } from '../../../src/queryKeys';
import {
  useCreateCheckoutSessionMutation,
  usePlans,
} from '../../../src/hooks/useMembership';
import type { SubscriptionPlan } from '../../../src/services/plans.service';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';
import { ErrorState } from '../../../src/components/ui/ErrorState';

type PlanType = 'private' | 'business';
const canPurchaseMembershipInApp = Platform.OS !== 'android';

const money = (value: number) =>
  `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Number(value) || 0)} kr`;

function getErrorInfo(error: unknown) {
  const err = error as {
    response?: { status?: number; data?: { error?: string; message?: string; code?: string } };
  };
  const status = err?.response?.status;
  const message = err?.response?.data?.error || err?.response?.data?.message;
  // The checkout endpoint returns a machine-readable `code` alongside the Norwegian
  // message. The message is what the user reads; the code is what decides whether the
  // screen also needs to correct stale state.
  const code = err?.response?.data?.code;
  return { status, message, code };
}

/**
 * Whether the user currently holds a PAID Stripe subscription.
 *
 * Every account gets a free subscription row at signup
 * (`utils/subscription.ensureDefaultSubscription`), so the mere existence of a
 * subscription document proves nothing. The presence of a
 * `stripeSubscriptionId` is what distinguishes a real paid Stripe subscription
 * from that free default.
 *
 * `cancelAtPeriodEnd` deliberately does NOT clear this: a subscription that is
 * set to cancel is still active and still billing until the period ends, so
 * starting a second one would still overlap.
 *
 * Status handling: the backend reports `stripeStatus: 'unknown'` when its live
 * Stripe lookup throws, so 'unknown' is NOT a usable signal and we fall back to
 * the locally stored status in that case. When neither status is conclusive we
 * treat the subscription as paid, which fails closed — it blocks a second
 * purchase rather than risking a duplicate charge.
 *
 * This is a display gate only. The rule itself lives on the server, in
 * `services/stripe/subscriptionState.js`, which refuses a duplicate checkout with
 * HTTP 409 `active_subscription_exists` no matter what this screen shows. The list
 * below mirrors the settled statuses that server treats as non-blocking, so the two
 * agree and the button is not offered for a purchase the server will reject.
 * `unpaid` is deliberately NOT settled: Stripe has stopped retrying, but the
 * subscription is not cancelled and its open invoice stays payable.
 */
function hasPaidSubscription(sub: {
  stripeSubscriptionId?: string | null;
  status?: string;
  stripeStatus?: string;
} | null | undefined): boolean {
  if (!sub?.stripeSubscriptionId) return false;
  const dead = ['canceled', 'cancelled', 'incomplete_expired', 'expired'];
  const stripeStatus = sub.stripeStatus?.toLowerCase();
  const localStatus = sub.status?.toLowerCase();
  // Live Stripe status wins, but only when it is actually conclusive.
  if (stripeStatus && stripeStatus !== 'unknown') return !dead.includes(stripeStatus);
  if (localStatus) return !dead.includes(localStatus);
  return true;
}
  export default function MembershipScreen() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const plansQuery = usePlans();
    const subscriptionQuery = useCurrentSubscription();
    const checkoutMutation = useCreateCheckoutSessionMutation();
    const subscription = subscriptionQuery.data;
    const role = typeof user?.role === 'string' ? user.role : undefined;
    const allowedPlanType: PlanType = role === 'company' ? 'business' : 'private';
    const defaultType: PlanType = allowedPlanType;
    const [userType, setUserType] = useState<PlanType | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const activeType = userType ?? defaultType;
    const typePlans = useMemo(
      () => (plansQuery.data ?? []).filter((plan) => plan.type === activeType),
      [plansQuery.data, activeType]
    );
    const currentPlanId = useMemo(() => {
      if (!subscription) return null;
      if (subscription.planId) {
        const byId = typePlans.find((plan) => plan._id === subscription.planId);
        if (byId) return byId._id;
      }
      return typePlans.find((plan) => plan.name === subscription.plan)?._id ?? null;
    }, [subscription, typePlans]);


function planFeatures(plan: SubscriptionPlan): string[] {
  if (plan.featuresText?.length) return plan.featuresText;
  const features: string[] = [];
  const freeContact = plan.entitlements?.freeContact;
  if (typeof freeContact === 'number') {
    features.push(freeContact > 0 ? `${freeContact} gratis kontakter` : 'Ingen gratis kontakter inkludert');
  }
  const radius = plan.entitlements?.radius;
  if (typeof radius === 'number' && radius > 0) features.push(`Søkeradius ${radius} km`);
  const perContact = plan.entitlements?.perContactPrice;
  if (typeof perContact === 'number' && perContact > 0) features.push(`${money(perContact)} per ekstra kontakt`);
  if (plan.entitlements?.hasBadge) features.push('Verifisert merke på profilen');
  if (plan.entitlements?.hasAnalytics) features.push('Tilgang til statistikk');
  return features;
}
    useEffect(() => {
      if (selectedId || typePlans.length === 0) return;
      const firstPaid = typePlans.find((plan) => plan.price > 0);
      setSelectedId(currentPlanId ?? firstPaid?._id ?? typePlans[0]._id);
    }, [selectedId, typePlans, currentPlanId]);

    const selectedPlan = typePlans.find((plan) => plan._id === selectedId) ?? null;
    const isAllowedForAccount = selectedPlan?.type === allowedPlanType;
    const isFree = !!selectedPlan && selectedPlan.price <= 0;
    const isCurrent = !!selectedPlan && selectedPlan._id === currentPlanId;
    const alreadyPaid = hasPaidSubscription(subscription?.hasPlan ? subscription : null);
    const canCheckout =
      !!selectedPlan && isAllowedForAccount && !isFree && !isCurrent && !alreadyPaid;

    const selectPlan = (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
    };

    const switchType = (type: PlanType) => {
      if (type === activeType) return;
      setUserType(type);
      setSelectedId(null);
    };

    // Additional logic can be added here if needed
    // ...

  // There is no mobile-aware return URL: the backend sends Stripe to the WEB
  // success/cancel pages (FRONTEND_URL), and no deep-link allow-list exists. So
  // we cannot be told the outcome. We only refetch server state when the app
  // comes back to the foreground after WE launched checkout.
  //
  // Purchase is NEVER inferred from openURL succeeding or the browser closing.
  // The Stripe webhook provisions the subscription; this refetch just reads it.
  // ---------------------------------------------------------------------------
  const queryClient = useQueryClient();
  const checkoutLaunchedRef = useRef(false);
  const refetchSubscriptionRef = useRef(subscriptionQuery.refetch);

  useEffect(() => {
    refetchSubscriptionRef.current = subscriptionQuery.refetch;
  }, [subscriptionQuery.refetch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!checkoutLaunchedRef.current) return;
      checkoutLaunchedRef.current = false;
      // A fresh purchase also writes a Transaction row, so refresh BOTH the current
      // subscription and its purchase history rather than guessing the outcome.
      void refetchSubscriptionRef.current();
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription.history });
    });
    return () => sub.remove();
  }, [queryClient]);

  const handleCheckout = () => {
    if (!canPurchaseMembershipInApp) return;
    // Re-assert every precondition at the call site. The render tree already
    // hides the button in these states, but the invariant should not depend on
    // the button being the only possible trigger.
    if (!selectedPlan || !isAllowedForAccount || isFree || isCurrent || alreadyPaid) return;
    checkoutMutation.mutate(
      { planId: selectedPlan._id },
      {
        onSuccess: async (response) => {
          if (typeof response.url !== 'string' || !response.url.trim()) {
            Alert.alert('Kunne ikke åpne betaling', 'Fikk ingen betalingslenke fra serveren. Prøv igjen.');
            return;
          }
          checkoutLaunchedRef.current = true;
          try {
            await Linking.openURL(response.url.trim());
          } catch {
            checkoutLaunchedRef.current = false;
            Alert.alert('Kunne ikke åpne betaling', 'Kunne ikke åpne betalingslenken. Prøv igjen.');
          }
        },
        onError: (error) => {
          const info = getErrorInfo(error);
          if (info.status === 401) {
            Alert.alert('Pålogging kreves', 'Du må være innlogget for å kjøpe medlemskap.');
            return;
          }

          // The server refused because this account already has a Stripe subscription
          // that can bill it. That is the authoritative answer, and reaching it means
          // what this screen was showing is out of date — the subscription was bought
          // on another device, or in the seconds since this screen loaded. Refetch so
          // the CTA switches to "administrer abonnementet" instead of inviting another
          // attempt that cannot succeed.
          //
          // No local state is written from this: the server's message is shown and its
          // subscription endpoint is asked again. The guard is not reimplemented here.
          if (info.code === 'active_subscription_exists') {
            void subscriptionQuery.refetch();
            Alert.alert(
              'Du har allerede et abonnement',
              info.message ||
                'Du har allerede et aktivt abonnement. Administrer det eksisterende abonnementet før du kjøper en ny plan.',
              [
                { text: 'Lukk', style: 'cancel' },
                {
                  text: 'Administrer',
                  onPress: () => router.push('/profile/settings/subscription'),
                },
              ]
            );
            return;
          }

          // The plan was retired between this screen loading and the purchase. The
          // catalogue is cached for five minutes, so refetch it rather than leaving a
          // plan on screen that can no longer be bought.
          if (info.code === 'plan_inactive') {
            void plansQuery.refetch();
            Alert.alert(
              'Planen er ikke tilgjengelig',
              info.message || 'Denne planen er ikke tilgjengelig lenger. Velg en annen plan.'
            );
            return;
          }

          if (info.code === 'plan_type_not_allowed') {
            setSelectedId(null);
            void Promise.all([plansQuery.refetch(), subscriptionQuery.refetch()]);
            Alert.alert(
              'Planen passer ikke kontotypen',
              info.message ||
                (allowedPlanType === 'business'
                  ? 'Privatplaner er tilgjengelige for privatkontoer.'
                  : 'Bedriftsplaner er tilgjengelige for bedriftskontoer.')
            );
            return;
          }

          // Two copies of the same request in flight — a double tap, or a retry over a
          // slow connection. One of them is creating the session.
          if (info.code === 'checkout_in_progress') {
            Alert.alert(
              'Betalingen er under behandling',
              info.message || 'Vent et øyeblikk og prøv igjen.'
            );
            return;
          }

          Alert.alert(
            'Kunne ikke starte betalingen',
            info.message || 'Sjekk internettforbindelsen din og prøv igjen.'
          );
        },
      }
    );
  };

  if (plansQuery.isLoading || subscriptionQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster medlemskap..." />
      </SafeAreaView>
    );
  }

  if (plansQuery.isError) {
    const info = getErrorInfo(plansQuery.error);
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <ErrorState
          title="Kunne ikke laste medlemskap"
          message={
            info.status === 500
              ? 'Serverfeil. Prøv igjen litt senere.'
              : info.message || 'Planene kunne ikke hentes akkurat nå.'
          }
          actionLabel="Prøv igjen"
          onAction={() => void plansQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const checkoutPending = checkoutMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} className="mb-5 flex-row items-center self-start py-2">
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Innstillinger</Text>
        </Pressable>

        <View className="mb-5 flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1E9]">
            <Sparkles size={21} color="#2E6641" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-2xl font-bold text-[#0B0B0B]">Medlemskap</Text>
            <Text className="mt-1 text-sm leading-5 text-[#63665F]">
              Velg planen som passer deg best.
            </Text>
          </View>
        </View>

        {/* Current plan, straight from the server */}
        {subscription?.hasPlan ? (
          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">
              Din nåværende plan
            </Text>
            <View className="mt-2 flex-row items-center">
              <Text className="text-lg font-bold text-[#0B0B0B]">{subscription.plan}</Text>
              {alreadyPaid ? (
                <View className="ml-2 rounded-full bg-[#C9E6D2] px-2 py-0.5">
                  <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#173A24]">
                    Betalt
                  </Text>
                </View>
              ) : (
                <View className="ml-2 rounded-full bg-[#ECEDE7] px-2 py-0.5">
                  <Text className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#63665F]">
                    Gratis
                  </Text>
                </View>
              )}
            </View>
            <Text className="mt-1 text-[0.8125rem] text-[#63665F]">
              {subscription.planType === 'business' ? 'Bedrift' : 'Privatperson'}
              {subscription.cancelAtPeriodEnd ? ' · avsluttes ved periodeslutt' : ''}
            </Text>
          </View>
        ) : null}

        {/* Account type switcher */}
        <View className="mt-5 flex-row self-start rounded-full border border-[#E6E7E1] bg-white p-1">
          {(['private', 'business'] as const).map((type) => {
            const active = activeType === type;
            return (
              <Pressable
                key={type}
                onPress={() => switchType(type)}
                className={['rounded-full px-5 py-2.5', active ? '' : 'active:bg-[#F4F6F0]'].join(' ')}
                style={active ? { backgroundColor: '#2E6641' } : undefined}
              >
                <Text
                  className={[
                    'text-[0.875rem] font-semibold',
                    active ? 'text-white' : 'text-[#63665F]',
                  ].join(' ')}
                >
                  {type === 'private' ? 'Privatperson' : 'Bedrift'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Plan cards */}
        {typePlans.length === 0 ? (
          <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-6">
            <Text className="text-center text-[0.9375rem] font-semibold text-[#0B0B0B]">
              Ingen planer tilgjengelig
            </Text>
            <Text className="mt-2 text-center text-[0.8125rem] leading-5 text-[#63665F]">
              Det finnes ingen aktive planer for{' '}
              {activeType === 'private' ? 'privatpersoner' : 'bedrifter'} akkurat nå.
            </Text>
          </View>
        ) : (
          <View className="mt-5 gap-3">
            {typePlans.map((plan) => {
              const selected = plan._id === selectedId;
              const isPlanCurrent = plan._id === currentPlanId;
              const features = planFeatures(plan);
              return (
                <Pressable
                  key={plan._id}
                  onPress={() => selectPlan(plan._id)}
                  className={[
                    'rounded-3xl border bg-white p-5',
                    selected ? 'border-[#2E6641]' : 'border-[#E6E7E1] active:bg-[#F4F6F0]',
                  ].join(' ')}
                  style={selected ? { borderWidth: 2 } : undefined}
                >
                  <View className="flex-row items-start">
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center flex-wrap">
                        <Text className="text-[1.0625rem] font-bold text-[#0B0B0B]">{plan.name}</Text>
                        {isPlanCurrent ? (
                          <View className="ml-2 flex-row items-center rounded-full bg-[#C9E6D2] px-2 py-0.5">
                            <BadgeCheck size={12} color="#173A24" />
                            <Text className="ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#173A24]">
                              Din plan
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="mt-1 flex-row items-baseline">
                        <Text className="text-[1.375rem] font-bold text-[#0B0B0B]">
                          {plan.price > 0 ? money(plan.price) : 'Gratis'}
                        </Text>
                        <Text className="ml-1 text-[0.8125rem] text-[#63665F]">
                          {plan.price > 0 ? 'per måned' : 'alltid'}
                        </Text>
                      </View>
                    </View>
                    <View
                      className={[
                        'ml-3 h-6 w-6 items-center justify-center rounded-full border-2',
                        selected ? 'border-[#2E6641]' : 'border-[#D8DAD2]',
                      ].join(' ')}
                      style={selected ? { backgroundColor: '#2E6641' } : undefined}
                    >
                      {selected ? <Check size={14} color="#FFFFFF" /> : null}
                    </View>
                  </View>

                  {features.length > 0 ? (
                    <View className="mt-3 gap-2">
                      {features.map((feature, index) => (
                        <View key={`${plan._id}-f${index}`} className="flex-row items-start">
                          <View className="mt-0.5">
                            <Check size={14} color="#2E6641" />
                          </View>
                          <Text className="ml-2 flex-1 text-[0.8125rem] leading-5 text-[#63665F]">
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Coupon — only meaningful for a paid plan we can actually buy */}
        {/* Summary + CTA */}
        {selectedPlan ? (
          <View className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[0.875rem] text-[#63665F]">{selectedPlan.name}</Text>
              <Text className="text-[0.875rem] font-medium text-[#0B0B0B]">
                {selectedPlan.price > 0 ? money(selectedPlan.price) : 'Gratis'}
              </Text>
            </View>

            <View className="mt-3 flex-row items-center justify-between border-t border-[#E6E7E1] pt-3">
              <Text className="text-[0.9375rem] font-bold text-[#0B0B0B]">Å betale</Text>
              <Text className="text-[1.125rem] font-bold text-[#0B0B0B]">
                {isFree ? 'Gratis' : money(selectedPlan.price)}
              </Text>
            </View>
            {!isFree ? (
              <Text className="mt-1 text-[0.75rem] text-[#9B9E96]">
                Per måned. Endelig beløp bekreftes av Stripe.
              </Text>
            ) : null}

            {/*
              CTA states, in priority order:
                1. Already this plan          -> nothing to buy
                2. Free plan                  -> no Stripe, no downgrade claim
                3. Already has a paid plan    -> blocked, routed to management
                4. Otherwise                  -> start Stripe Checkout
            */}
            {isCurrent ? (
              <View className="mt-4 rounded-2xl bg-[#F4F6F0] px-4 py-3.5">
                <Text className="text-center text-[0.875rem] font-semibold text-[#0B0B0B]">
                  Dette er planen du har nå
                </Text>
              </View>
            ) : isFree ? (
              <View className="mt-4">
                <View className="rounded-2xl bg-[#F4F6F0] px-4 py-3.5">
                  <Text className="text-center text-[0.875rem] leading-5 text-[#63665F]">
                    {alreadyPaid
                      ? 'Du har et betalt abonnement. For å gå ned til gratisplanen må du avslutte abonnementet under Abonnementer.'
                      : 'Gratisplanen krever ingen betaling.'}
                  </Text>
                </View>
              </View>
            ) : !isAllowedForAccount ? (
              <View className="mt-4 rounded-2xl border border-[#E6E7E1] bg-[#F4F6F0] px-4 py-3.5">
                <Text className="text-center text-[0.875rem] leading-5 text-[#63665F]">
                  {allowedPlanType === 'business'
                    ? 'Privatplaner er tilgjengelige for privatkontoer.'
                    : 'Bedriftsplaner er tilgjengelige for bedriftskontoer.'}
                </Text>
              </View>
            ) : alreadyPaid ? (
              <View className="mt-4">
                <View className="rounded-2xl border border-[#F1E1C4] bg-[#FBF5E9] px-4 py-3.5">
                  <View className="flex-row items-start">
                    <View className="mt-0.5">
                      <Info size={16} color="#B7791F" />
                    </View>
                    <Text className="ml-2 flex-1 text-[0.8125rem] leading-5 text-[#614109]">
                      Du har allerede et aktivt betalt abonnement. Planbytte er ikke tilgjengelig i
                      appen ennå — avslutt det nåværende abonnementet først, så kan du velge en ny
                      plan.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/profile/settings/subscription')}
                  className="mt-3 flex-row items-center justify-center rounded-2xl border border-[#E6E7E1] px-5 py-3.5 active:bg-[#F4F6F0]"
                >
                  <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                    Administrer abonnement
                  </Text>
                  <ChevronRight size={17} color="#0B0B0B" />
                </Pressable>
              </View>
            ) : canCheckout && canPurchaseMembershipInApp ? (
              <Pressable
                onPress={handleCheckout}
                disabled={checkoutPending}
                className={[
                  'mt-4 flex-row items-center justify-center rounded-2xl px-5 py-3.5 shadow-sm',
                  checkoutPending ? 'opacity-70' : '',
                ].join(' ')}
                style={{ backgroundColor: '#2E6641' }}
              >
                {checkoutPending ? (
                  <>
                    <Loader2 size={17} color="#FFFFFF" />
                    <Text className="ml-2 text-[0.9375rem] font-semibold text-white">
                      Åpner betaling...
                    </Text>
                  </>
                ) : (
                  <>
                    <ExternalLink size={17} color="#FFFFFF" />
                    <Text className="ml-2 text-[0.9375rem] font-semibold text-white">
                      Start abonnement
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View className="mt-4 rounded-2xl bg-[#F4F6F0] px-4 py-3.5">
                <Text className="text-center text-[0.875rem] leading-5 text-[#63665F]">
                  Abonnementskjøp i Android-appen er ikke tilgjengelig akkurat nå.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Where to manage an existing subscription */}
        {!alreadyPaid ? (
          <Pressable
            onPress={() => router.push('/profile/settings/subscription')}
            className="mt-5 rounded-3xl border border-[#E6E7E1] bg-white p-5 active:bg-[#F4F6F0]"
          >
            <View className="flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1E9]">
                <BadgeCheck size={18} color="#2E6641" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-[#0B0B0B]">Administrer abonnement</Text>
                <Text className="mt-1 text-sm leading-5 text-[#63665F]">
                  Se status, fornyelse og avslutt abonnementet.
                </Text>
              </View>
              <ChevronRight size={18} color="#63665F" />
            </View>
          </Pressable>
        ) : null}

        {canPurchaseMembershipInApp ? <View className="mt-5 flex-row items-start px-1">
          <View className="mt-0.5">
            <Info size={14} color="#9B9E96" />
          </View>
          <Text className="ml-2 flex-1 text-[0.75rem] leading-5 text-[#9B9E96]">
            Betalingen skjer i Stripes sikre betalingsside i nettleseren. Medlemskapet aktiveres når
            Stripe har bekreftet betalingen — det kan ta noen sekunder etter at du kommer tilbake til
            appen.
          </Text>
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
