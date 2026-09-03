import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePlans } from '../../features/plans/hooks';
import { useUserStore } from '../../stores/userStore';
import mainLink from '../../api/mainURLs';
import type { Plan } from '../../features/plans/types';
import { CARD, MICRO_LABEL } from '../../theme/brand';
import { BackLink } from '../../components/Ui/BackLink';

type MySubscription = {
  plan: string;
  planType: 'private' | 'business';
  status: string;
  autoRenew: boolean;
  renewalDate?: string;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string;
  stripeStatus?: string;
};

/**
 * Jobblo medlemskap — pick a plan, apply a code, pay.
 *
 * Three things were wrong beyond the styling. Nothing was selected on arrival, so the
 * summary column opened empty and the page had no answer to "what am I on now". Every free
 * plan was labelled "Gjeldende plan" whether or not it was the user's — the badge was
 * hard-coded to `price === 0` rather than read from the account. And a failed plans request
 * left the page in its loading state forever, with no error and no way to retry.
 *
 * The current plan now comes from `user.subscription`, which is the plan *name* the
 * subscription webhook writes back, and it is what the page preselects.
 */

const fullDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('nb-NO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'neste periode';

/** What a plan gets you, drawn from whichever of the two shapes the API returned. */
function planFeatures(plan: Plan): string[] {
  if (plan.featuresText?.length) return plan.featuresText;
  if (plan.features?.length) return plan.features;

  // Older plan rows carry only the numeric entitlements. Rather than render an empty card,
  // say what those numbers actually buy.
  const derived: string[] = [];
  const contacts = plan.entitlements?.freeContact ?? plan.freeViews;
  if (contacts) derived.push(`${contacts} kontakter inkludert hver måned`);
  if (plan.pricePerExtraView) derived.push(`${plan.pricePerExtraView} kr per ekstra kontakt`);
  return derived;
}

export default function MembershipPage() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const { data: plans, isLoading, isError, refetch } = usePlans();

  // The live subscription, joined with what Stripe currently believes. This is what makes
  // "si opp når som helst" true rather than a claim — until now the only way to stop a
  // renewal was to ask support to do it from the Stripe dashboard.
  const { data: mySub } = useQuery<MySubscription | null>({
    queryKey: ['my-subscription'],
    queryFn: async () => (await mainLink.get('/api/stripe/subscription')).data.subscription,
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => (await mainLink.post('/api/stripe/subscription/cancel')).data,
    onSuccess: (data) => {
      toast.success(data?.message || 'Abonnementet avsluttes ved periodens slutt');
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Kunne ikke si opp abonnementet'),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => (await mainLink.post('/api/stripe/subscription/resume')).data,
    onSuccess: (data) => {
      toast.success(data?.message || 'Abonnementet fortsetter');
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Kunne ikke gjenoppta abonnementet'),
  });

  const allowedPlanType: 'private' | 'business' = user?.role === 'company' ? 'business' : 'private';
  const [userType, setUserType] = useState<'private' | 'business'>(allowedPlanType);

  useEffect(() => {
    setUserType(allowedPlanType);
    setSelectedId(null);
  }, [allowedPlanType]);

  const typePlans = useMemo(
    () => (plans || []).filter((p) => p.type === userType).sort((a, b) => a.price - b.price),
    [plans, userType]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  /** The plan the account is actually on, matched by name — what the backend stores. */
  const currentPlanId = useMemo(
    () => typePlans.find((p) => p.name === user?.subscription)?._id ?? null,
    [typePlans, user?.subscription]
  );

  // Open on something rather than nothing: the plan they are on, else the cheapest paid
  // one, else whatever exists. Only fires while nothing is selected, so it never fights
  // a choice the user has made.
  useEffect(() => {
    if (selectedId || typePlans.length === 0) return;
    const paid = typePlans.find((p) => p.price > 0);
    setSelectedId(currentPlanId ?? paid?._id ?? typePlans[0]._id);
  }, [typePlans, currentPlanId, selectedId]);

  const selectedPlan: Plan | null = typePlans.find((p) => p._id === selectedId) ?? null;
  const isAllowedForAccount = selectedPlan?.type === allowedPlanType;
  const isFree = selectedPlan?.price === 0;
  const isCurrent = !!selectedPlan && selectedPlan._id === currentPlanId;
  /**
   * Whether the account already holds a Stripe subscription that can bill it.
   *
   * `currentPlanId` cannot answer this. It is matched off `user.subscription` — the plan
   * *name* — and every account carries a free default plan name from signup, so the
   * page used to offer "Bytt til denne planen" to free users and paying users alike.
   * The stored `stripeSubscriptionId` is what separates a real paid subscription from
   * that default.
   *
   * This is a display gate only. The rule lives on the server, in
   * `services/stripe/subscriptionState.js`, which refuses a second paid checkout with
   * HTTP 409 `active_subscription_exists` regardless of what this page shows. The
   * settled list below mirrors the statuses that server treats as non-blocking, so the
   * page stops inviting a purchase the server will reject. `cancelAtPeriodEnd`
   * deliberately does not clear it: a subscription set to cancel is still active, and
   * still billing, until the period actually ends.
   */
  const hasPaidSubscription = useMemo(() => {
    if (!mySub?.stripeSubscriptionId) return false;
    const settled = ['canceled', 'cancelled', 'incomplete_expired', 'expired'];
    const live = mySub.stripeStatus?.toLowerCase();
    const local = mySub.status?.toLowerCase();
    // `getMySubscription` reports 'unknown' when its own live Stripe lookup throws, so
    // that value is not a signal — fall back to the stored status, and when neither is
    // conclusive assume paid, which blocks rather than risking a duplicate charge.
    if (live && live !== 'unknown') return !settled.includes(live);
    if (local) return !settled.includes(local);
    return true;
  }, [mySub]);

  /** Paid checkout is offered only where the server would actually accept it. */
  const canCheckout =
    !!selectedPlan && isAllowedForAccount && !isFree && !isCurrent && !hasPaidSubscription;

  const selectPlan = (id: string) => {
    setSelectedId(id);
  };

  const handleCheckout = async () => {
    // Re-assert the preconditions here rather than relying on the button being hidden.
    // `selectedPlan` is repeated because `canCheckout` does not narrow it for TypeScript.
    if (!selectedPlan || !canCheckout) return;
    setIsRedirecting(true);
    try {
      const res = await mainLink.post('/api/stripe/create-checkout-session', {
        planId: selectedPlan._id,
      });
      if (!res.data?.url) throw new Error('Ingen betalingslenke i svaret');
      window.location.href = res.data.url;
    } catch (err: any) {
      // The endpoint returns a Norwegian `message` for the cases the user can act on —
      // an expired coupon, a plan that costs nothing. Swallowing it and always saying
      // "prøv igjen" sent people back into the same failure.
      toast.error(
        err?.response?.data?.message || 'Kunne ikke starte betalingen. Prøv igjen.'
      );
      // 409 `active_subscription_exists` means the server found a subscription this page
      // did not know about — bought in another tab, or provisioned since the 30-second
      // cache was filled. Refetch so the CTA corrects itself instead of inviting a
      // second attempt that cannot succeed.
      if (err?.response?.data?.code === 'active_subscription_exists') {
        queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      }
      // A plan retired since the catalogue was cached. `usePlans` holds it forever
      // (`staleTime: Infinity`), so it has to be asked again explicitly.
      if (err?.response?.data?.code === 'plan_inactive') {
        void refetch();
      }
      if (err?.response?.data?.code === 'plan_type_not_allowed') {
        setSelectedId(null);
        void refetch();
      }
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <BackLink fallback="/home" />

        <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          {/* ══ LEFT — plan selector ═══════════════════════════════════════ */}
          <div className="space-y-6">
            <div>
              <p className={MICRO_LABEL}>Abonnement</p>
              <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
                Velg planen som passer deg
              </h1>
              <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-[#63665F]">
                Bytt plan når du vil, og si opp når som helst. Ingen bindingstid.
              </p>

              <div
                role="tablist"
                aria-label="Kontotype"
                className="mt-6 inline-flex gap-1 rounded-full border border-[#E6E7E1] bg-white p-1"
              >
                {(['private', 'business'] as const).map((type) => (
                  <button
                    key={type}
                    role="tab"
                    aria-selected={userType === type}
                    type="button"
                    onClick={() => {
                      setUserType(type);
                      setSelectedId(null);
                    }}
                    className={`h-10 rounded-full px-5 text-[0.875rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                      userType === type ? 'bg-[#2E6641] text-white' : 'text-[#63665F] hover:text-[#0B0B0B]'
                    }`}
                  >
                    {type === 'private' ? 'Privatperson' : 'Bedrift'}
                  </button>
                ))}
              </div>

            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`${CARD} p-5`}>
                    <div className="flex items-start gap-4">
                      <div className="jb-skeleton size-5 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="jb-skeleton h-4 w-28 rounded" />
                        <div className="jb-skeleton h-3 w-3/4 rounded" />
                      </div>
                      <div className="jb-skeleton h-5 w-16 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className={`${CARD} p-10 text-center`}>
                <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
                  <AlertCircle size={20} strokeWidth={2} />
                </span>
                <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
                  Kunne ikke hente planene
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
                  Sjekk internettforbindelsen din og prøv igjen.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
                >
                  Prøv igjen
                </button>
              </div>
            ) : typePlans.length === 0 ? (
              <div className={`${CARD} p-10 text-center`}>
                <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
                  Ingen planer tilgjengelig
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
                  Det finnes ingen aktive planer for{' '}
                  {userType === 'private' ? 'privatpersoner' : 'bedrifter'} akkurat nå.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {typePlans.map((plan) => {
                  const selected = selectedId === plan._id;
                  const free = plan.price === 0;
                  const current = plan._id === currentPlanId;
                  const features = planFeatures(plan);

                  return (
                    <label
                      key={plan._id}
                      className={`block cursor-pointer rounded-3xl border bg-white p-5 transition-colors ${
                        selected
                          ? 'border-[#2E6641] ring-4 ring-[#2E6641]/10'
                          : 'border-[#E6E7E1] hover:border-[#2E6641]/45'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected ? 'border-[#2E6641] bg-[#2E6641]' : 'border-[#D4D6CD] bg-white'
                          }`}
                        >
                          {selected && <span className="size-1.5 rounded-full bg-white" />}
                        </span>
                        <input
                          type="radio"
                          name="plan"
                          value={plan._id}
                          checked={selected}
                          onChange={() => selectPlan(plan._id)}
                          className="sr-only"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-[1rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                              {plan.name}
                            </span>
                            {current && (
                              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#EAF1E9] px-2.5 text-[0.6875rem] font-semibold text-[#2E6641]">
                                <Check size={11} strokeWidth={3} />
                                Din plan
                              </span>
                            )}
                          </div>

                          {/* Features are always visible. Hiding them until a card was
                              selected meant comparing two plans took two clicks and a
                              memory of what the first one said. */}
                          {features.length > 0 && (
                            <ul className="mt-2 space-y-1.5">
                              {features.slice(0, 5).map((f, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-[#63665F]"
                                >
                                  <Check
                                    size={13}
                                    strokeWidth={2.6}
                                    className="mt-0.5 shrink-0 text-[#2E6641]"
                                  />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[1.125rem] font-bold tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                            {free ? '0' : plan.price.toLocaleString('nb-NO')} kr
                          </p>
                          <p className="text-[0.75rem] text-[#9B9E96]">
                            {free ? 'Alltid gratis' : 'per måned'}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

          </div>

          {/* ══ RIGHT — subscription state + summary ═══════════════════════ */}
          <div className="space-y-4 lg:sticky lg:top-24">
            {/* Only shown once there is a real, paid subscription to act on. */}
            {mySub?.stripeSubscriptionId && (
              <div
                className={`${CARD} p-5 ${mySub.cancelAtPeriodEnd ? 'border-[#2E6641]/45' : ''}`}
              >
                <p className={MICRO_LABEL}>Ditt abonnement</p>
                <p className="mt-2 text-[1rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                  {mySub.plan}
                </p>

                {mySub.cancelAtPeriodEnd ? (
                  <>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#63665F]">
                      Sagt opp. Du har full tilgang til{' '}
                      <span className="font-semibold text-[#0B0B0B]">
                        {fullDate(mySub.currentPeriodEnd)}
                      </span>
                      , og blir ikke belastet igjen.
                    </p>
                    <button
                      type="button"
                      onClick={() => resumeMutation.mutate()}
                      disabled={resumeMutation.isPending}
                      className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#E6E7E1] bg-white text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-60"
                    >
                      {resumeMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} strokeWidth={2.2} />
                      )}
                      Gjenoppta abonnementet
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-[#63665F]">
                      Fornyes automatisk{' '}
                      <span className="font-semibold text-[#0B0B0B]">
                        {fullDate(mySub.currentPeriodEnd || mySub.renewalDate)}
                      </span>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Si opp abonnementet? Du beholder tilgangen ut perioden du allerede har betalt for.'
                          )
                        )
                          return;
                        cancelMutation.mutate();
                      }}
                      disabled={cancelMutation.isPending}
                      className="mt-4 h-10 w-full rounded-full text-[0.875rem] font-semibold text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-60"
                    >
                      {cancelMutation.isPending ? 'Sier opp…' : 'Si opp abonnementet'}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className={`${CARD} p-6`}>
              <h2 className={MICRO_LABEL}>Sammendrag</h2>

              {!selectedPlan ? (
                <p className="py-8 text-center text-[0.875rem] text-[#63665F]">
                  Velg en plan for å se sammendraget.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                    {selectedPlan.name}
                  </p>

                  <div className="mt-5 space-y-3 text-[0.875rem]">
                    <div className="flex items-center justify-between gap-3 text-[#63665F]">
                      <span>Pris per måned</span>
                      <span className="font-semibold tabular-nums text-[#0B0B0B]">
                        {isFree ? '0' : selectedPlan.price.toLocaleString('nb-NO')} kr
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-[#E6E7E1] pt-3">
                      <span className="font-semibold text-[#0B0B0B]">
                        {isFree ? 'Totalt' : 'Trekkes i dag'}
                      </span>
                      <span className="text-[1.25rem] font-bold tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                        {isFree ? '0' : selectedPlan.price.toLocaleString('nb-NO')} kr
                      </span>
                    </div>
                  </div>

                  {!isAllowedForAccount ? (
                    <div className="mt-6 rounded-xl bg-[#F4F6F0] px-4 py-3.5 text-center">
                      <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                        {selectedPlan.type === 'business'
                          ? 'Denne planen er kun tilgjengelig for bedriftskontoer.'
                          : 'Denne planen er kun tilgjengelig for privatkontoer.'}
                      </p>
                    </div>
                  ) : isCurrent ? (
                    <div className="mt-6 rounded-xl bg-[#F4F6F0] px-4 py-3.5 text-center">
                      <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                        Dette er planen du har nå
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                        {hasPaidSubscription
                          ? 'Si opp abonnementet fra abonnementskortet på denne siden hvis du vil avslutte.'
                          : 'Velg en annen plan for å bytte.'}
                      </p>
                    </div>
                  ) : !isFree && hasPaidSubscription ? (
                    /*
                     * The account already has a Stripe subscription that can bill it, so
                     * this button used to say "Bytt til denne planen" and quietly start a
                     * SECOND one — the old subscription kept billing and its id was
                     * overwritten in Mongo, leaving it uncancellable from Jobblo. The
                     * server now refuses with 409 `active_subscription_exists`, so
                     * offering the button would only lead into a failure. Plan switching
                     * is not supported: there is no proration or change-plan flow behind
                     * it, and inventing one is out of scope.
                     */
                    <div className="mt-6 rounded-xl border border-[#E6E7E1] bg-[#F4F6F0] px-4 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle
                          size={15}
                          strokeWidth={2.2}
                          className="mt-0.5 shrink-0 text-[#63665F]"
                        />
                        <div>
                          <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                            Du har allerede et aktivt abonnement
                          </p>
                          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                            Du er på {mySub?.plan || 'en betalt plan'}. Å kjøpe en ny plan nå
                            ville gitt deg to abonnement som begge trekkes hver måned, så det
                            er ikke mulig. Si opp det eksisterende abonnementet fra
                            abonnementskortet på denne siden først.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={isFree ? () => navigate('/home') : handleCheckout}
                      disabled={isRedirecting}
                      className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-[0.995] disabled:opacity-60"
                    >
                      {isRedirecting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Sender deg til betaling…
                        </>
                      ) : isFree ? (
                        <>
                          <Sparkles size={15} strokeWidth={2.2} /> Kom i gang gratis
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={15} strokeWidth={2.2} />
                          {/*
                           * Always "Start abonnement" now. The old label branched on
                           * `currentPlanId`, which is only the plan *name* — so a user on
                           * the free default plan was told they were "switching", and a
                           * paying user was offered a switch that does not exist.
                           */}
                          Start abonnement
                        </>
                      )}
                    </button>
                  )}

                  <p className="mt-3 text-center text-[0.75rem] leading-relaxed text-[#9B9E96]">
                    {isFree
                      ? 'Ingen betalingskort nødvendig.'
                      : 'Fornyes automatisk hver måned. Du kan si opp når som helst herfra.'}
                  </p>

                  <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-[#E6E7E1] pt-4 text-[0.75rem] text-[#63665F]">
                    <ShieldCheck size={13} strokeWidth={2.2} className="text-[#2E6641]" />
                    Trygg betaling med Stripe
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
