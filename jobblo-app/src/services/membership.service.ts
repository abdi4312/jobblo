import apiClient from '../api/client';

/**
 * Result of POST /api/coupons/validate.
 *
 * IMPORTANT — these prices are for DISPLAY ONLY.
 *
 * The mobile client never sends a price, a discount or a final amount to the
 * checkout endpoint; it sends `planId` and `couponCode` and nothing else. The
 * server re-reads the plan, re-validates the coupon against the authenticated
 * user and recomputes the charged amount inside
 * `createCheckoutSession`. If a coupon expires or hits its usage limit between
 * validation and checkout, checkout is the call that fails — which is correct.
 */
export type CouponValidation = {
  code: string;
  type: 'percentage' | 'fixed';
  amount: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  couponId: string;
};

type CouponValidateResponse = {
  success: boolean;
  message?: string;
  data: CouponValidation;
};

/**
 * POST /api/coupons/validate — requires authentication.
 *
 * The owning user is taken from the auth token server-side (`req.user._id`);
 * we must never send a userId. Errors come back as `{ error: <message> }`.
 */
export async function validateCoupon(params: { code: string; planId: string }): Promise<CouponValidation> {
  const response = await apiClient.post<CouponValidateResponse>('/coupons/validate', {
    code: params.code,
    planId: params.planId,
  });
  return response.data.data;
}

/**
 * POST /api/stripe/create-checkout-session — requires authentication.
 *
 * Deliberately minimal request body. The server owns, and mobile must never
 * send: price, finalPrice, discountAmount, userId, the Stripe customer id, the
 * Stripe subscription id, the success/cancel URLs, and all session metadata.
 *
 * Returns a Stripe-hosted Checkout URL. We open that URL as-is and never build
 * a Stripe URL ourselves.
 */
export async function createSubscriptionCheckoutSession(params: {
  planId: string;
  couponCode?: string;
}): Promise<{ url: string }> {
  const body: { planId: string; couponCode?: string } = { planId: params.planId };
  if (params.couponCode) body.couponCode = params.couponCode;
  const response = await apiClient.post<{ url: string }>('/stripe/create-checkout-session', body);
  return response.data;
}
