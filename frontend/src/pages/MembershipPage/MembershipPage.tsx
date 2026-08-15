import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ShieldCheck,
  Loader2,
  Tag,
  X,
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

  const defaultType: 'private' | 'business' = user?.role === 'company' ? 'business' : 'private';
  const [userType, setUserType] = useState<'private' | 'business'>(defaultType);

  const typePlans = useMemo(
    () => (plans || []).filter((p) => p.type === userType).sort((a, b) => a.price - b.price),
    [plans, userType]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [discount, setDiscount] = useState<{
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    code: string;
    type: 'percentage' | 'fixed';
    amount: number;
  } | null>(null);
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
  const isFree = selectedPlan?.price === 0;
  const isCurrent = !!selectedPlan && selectedPlan._id === currentPlanId;
  const finalPrice = discount ? discount.finalPrice : (selectedPlan?.price ?? 0);

  const resetPromo = () => {
    setDiscount(null);
    setPromoCode('');
  };

  const selectPlan = (id: string) => {
    setSelectedId(id);
    resetPromo();
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setIsApplyingPromo(true);
    try {
      const res = await mainLink.post('/api/coupons/validate', {
        planId: selectedPlan._id,
        code: promoCode.trim(),
      });
      setDiscount({ ...res.data.data, code: promoCode.trim() });
      toast.success('Rabattkoden er aktivert');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ugyldig kode');
      setDiscount(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPlan || isFree) return;
    setIsRedirecting(true);
    try {
      const payload: { planId: string; couponCode?: string } = { planId: selectedPlan._id };
      if (discount) payload.couponCode = discount.code;
      const res = await mainLink.post('/api/stripe/create-checkout-session', payload);
      if (!res.data?.url) throw new Error('Ingen betalingslenke i svaret');
      window.location.href = res.data.url;
    } catch (err: any) {
      // The endpoint returns a Norwegian `message` for the cases the user can act on —
      // an expired coupon, a plan that costs nothing. Swallowing it and always saying
      // "prøv igjen" sent people back into the same failure.
      toast.error(
        err?.response?.data?.message || 'Kunne ikke starte betalingen. Prøv igjen.'
      );
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

              {/* Type switcher */}
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
                      resetPromo();
                    }}
                    className={`h-10 rounded-full px-5 text-[0.875rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${
                      userType === type
                        ? 'bg-[#2E6641] text-white'
                        : 'text-[#63665F] hover:text-[#0B0B0B]'
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

            {/* ── Promo code ─────────────────────────────────────────────── */}
            {selectedPlan && !isFree && (
              <div className={`${CARD} p-5`}>
                <p className="mb-3 flex items-center gap-1.5 text-[0.875rem] font-semibold text-[#0B0B0B]">
                  <Tag size={14} strokeWidth={2} className="text-[#2E6641]" />
                  Har du en rabattkode?
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyPromo();
                      }
                    }}
                    aria-label="Rabattkode"
                    placeholder="SKRIV INN KODE"
                    disabled={!!discount}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-[#E6E7E1] bg-white px-3.5 text-[0.875rem] font-medium uppercase tracking-[0.06em] text-[#0B0B0B] outline-none transition-colors placeholder:tracking-normal placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 disabled:bg-[#F4F6F0] disabled:text-[#9B9E96]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || !!discount || isApplyingPromo}
                    className="flex h-11 w-24 shrink-0 items-center justify-center rounded-xl bg-[#2E6641] text-[0.875rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 disabled:opacity-45"
                  >
                    {isApplyingPromo ? <Loader2 size={15} className="animate-spin" /> : 'Bruk'}
                  </button>
                </div>
                {discount && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-[#EAF1E9] px-3.5 py-2.5">
                    <span className="text-[0.8125rem] text-[#2E6641]">
                      <strong className="font-semibold">{discount.code}</strong> aktivert — du sparer{' '}
                      {discount.discountAmount.toLocaleString('nb-NO')} kr
                    </span>
                    <button
                      type="button"
                      onClick={resetPromo}
                      aria-label="Fjern rabattkoden"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[#2E6641] transition-colors hover:bg-white"
                    >
                      <X size={13} strokeWidth={2.6} />
                    </button>
                  </div>
                )}
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
                    {discount && (
                      <div className="flex items-center justify-between gap-3 text-[#2E6641]">
                        <span>Rabatt ({discount.code})</span>
                        <span className="font-semibold tabular-nums">
                          −{discount.discountAmount.toLocaleString('nb-NO')} kr
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3 border-t border-[#E6E7E1] pt-3">
                      <span className="font-semibold text-[#0B0B0B]">
                        {isFree ? 'Totalt' : 'Trekkes i dag'}
                      </span>
                      <span className="text-[1.25rem] font-bold tabular-nums tracking-[-0.03em] text-[#0B0B0B]">
                        {isFree ? '0' : finalPrice.toLocaleString('nb-NO')} kr
                      </span>
                    </div>
                  </div>

                  {isCurrent ? (
                    <div className="mt-6 rounded-xl bg-[#F4F6F0] px-4 py-3.5 text-center">
                      <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">
                        Dette er planen du har nå
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                        Velg en annen plan for å bytte.
                      </p>
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
                          {currentPlanId ? 'Bytt til denne planen' : 'Start abonnement'}
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
