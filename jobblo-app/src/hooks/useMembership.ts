import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getPlans, type SubscriptionPlan } from '../services/plans.service';
import {
  createSubscriptionCheckoutSession,
  validateCoupon,
} from '../services/membership.service';

/**
 * Plan catalogue for the Membership screen.
 *
 * `GET /api/plans` also returns inactive plans because the same endpoint backs
 * the admin UI, so we filter them out here — a customer must never be offered a
 * plan that has been retired. Sorted cheapest-first so the free/entry tier reads
 * first in the list.
 *
 * The catalogue changes rarely, so it is treated as fresh for five minutes
 * rather than refetched on every mount.
 */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: getPlans,
    staleTime: 5 * 60 * 1000,
    select: (plans: SubscriptionPlan[]) =>
      plans.filter((plan) => plan.isActive).sort((a, b) => a.price - b.price),
  });
}

/**
 * Coupon validation for display purposes.
 *
 * Intentionally NOT cached: a coupon's validity depends on usage limits and
 * expiry, so a stale "valid" answer would be misleading. The authoritative
 * re-validation happens server-side at checkout.
 */
export function useValidateCouponMutation() {
  return useMutation({ mutationFn: validateCoupon });
}

/**
 * Creates a Stripe Checkout session for a paid plan.
 *
 * Deliberately does NOT invalidate the subscription cache on success: a created
 * session means the user is about to be shown a payment page, not that they have
 * paid. Provisioning is driven by the Stripe webhook, and the screen refetches
 * server state when the app returns to the foreground.
 */
export function useCreateCheckoutSessionMutation() {
  return useMutation({ mutationFn: createSubscriptionCheckoutSession });
}
