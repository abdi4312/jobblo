import apiClient from '../api/client';

/**
 * Entitlements exactly as declared by backend/models/SubscriptionPlan.js.
 *
 * `freeContact` and `radius` are the only required fields; everything else has a
 * schema default, so it is present on documents created through Mongoose but is
 * typed optional here to stay safe against older rows written before a field
 * existed.
 */
export type PlanEntitlements = {
  freeContact: number;
  radius: number;
  numberOfCustomers?: number;
  maxJobsValue?: number;
  perContactPrice?: number;
  ContactUnlock?: number;
  maxContact?: number;
  visibilityLevel?: number;
  locationPrecision?: 'exact' | 'approximate';
  hasBadge?: boolean;
  hasAnalytics?: boolean;
};

/**
 * A subscription plan as the backend actually stores it.
 *
 * NOTE: the web client's `Plan` type (frontend/src/features/plans/types.ts) also
 * declares `features`, `freeViews` and `pricePerExtraView`. Those fields do NOT
 * exist on backend/models/SubscriptionPlan.js and are always undefined at
 * runtime, so they are deliberately omitted here. `featuresText` is the real
 * feature list.
 */
export type SubscriptionPlan = {
  _id: string;
  name: string;
  price: number;
  type: 'private' | 'business';
  entitlements: PlanEntitlements;
  featuresText: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * GET /api/plans — public endpoint (no authentication).
 *
 * Two shape quirks that callers must not forget:
 *  1. The controller responds with a BARE ARRAY, not `{ plans: [...] }`.
 *  2. It returns inactive plans too (`SubscriptionPlan.find()` with no filter),
 *     because the same endpoint serves the admin UI. Filtering `isActive`
 *     is the client's job — see `usePlans`.
 */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiClient.get<SubscriptionPlan[]>('/plans');
  return Array.isArray(response.data) ? response.data : [];
}
