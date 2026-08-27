/**
 * Mobile order routing — the single source of truth for where an order opens.
 *
 * Adapted from frontend/src/utils/orderRoute.ts and frontend/src/constants/statuses.ts.
 *
 * Every SafePay entry point (alerts, my-jobs, job-applicants, chat, the success screen)
 * routes through here so the customer/provider split and the paid/approvable thresholds
 * can only be defined once. Returned values are Expo Router object hrefs, which keeps the
 * dynamic segments type-checked instead of hand-built template strings.
 *
 * Providers are never routed to `/safepay/checkout` or `/safepay/approval`: both screens
 * are customer-only and would render an access wall.
 */

interface OrderRouteSubject {
  _id?: string;
  customerId?: unknown;
  providerId?: unknown;
  paymentStatus?: string;
  status?: string;
}

const APPROVABLE_STATUSES = ['ready_for_review', 'completed'];
const PAID_STATUSES = ['paid', 'in_progress', 'ready_for_review', 'waiting_for_approval', 'completed'];

/** Object hrefs, so `router.push(...)` needs no cast at the call site. */
export type OrderRoute =
  | { pathname: '/(app)/safepay/checkout/[orderId]'; params: { orderId: string } }
  | { pathname: '/(app)/safepay/approval/[orderId]'; params: { orderId: string } }
  | { pathname: '/(app)/safepay/success'; params: { orderId: string } }
  | { pathname: '/(app)/provider/orders/[orderId]'; params: { orderId: string } };

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === 'string') return id.trim() || null;
  }
  return null;
};

/**
 * The customer's destination for an order.
 *
 * `waiting_for_approval` is treated as paid rather than approvable: the customer has not
 * been asked to act yet, so they land on the status screen, not the approval form.
 */
export function customerOrderRoute(
  orderId: string,
  status?: string,
  paymentStatus?: string
): OrderRoute {
  const id = orderId.trim();

  if (status && APPROVABLE_STATUSES.includes(status)) {
    return { pathname: '/(app)/safepay/approval/[orderId]', params: { orderId: id } };
  }
  if (paymentStatus === 'paid' || (status && PAID_STATUSES.includes(status))) {
    // `/(app)/safepay/success` reads `orderId` from the query string. The
    // `/safepay/success/[orderId]` path exists only as a deep-link alias that redirects here.
    return { pathname: '/(app)/safepay/success', params: { orderId: id } };
  }
  return { pathname: '/(app)/safepay/checkout/[orderId]', params: { orderId: id } };
}

/** The provider's destination for an order — always their own order workspace. */
export function providerOrderRoute(orderId: string): OrderRoute {
  return { pathname: '/(app)/provider/orders/[orderId]', params: { orderId: orderId.trim() } };
}

/** Role-aware destination when the caller already knows which side of the order it is on. */
export function orderRouteForRole(
  orderId: string,
  isCustomer: boolean,
  status?: string,
  paymentStatus?: string
): OrderRoute {
  return isCustomer
    ? customerOrderRoute(orderId, status, paymentStatus)
    : providerOrderRoute(orderId);
}

/**
 * Resolves the destination for an order object of unknown shape — used where the order
 * arrives embedded in another payload (notifications) and the viewer's role has to be
 * derived from the populated party ids.
 *
 * @returns an href, or null when there is nothing safe to navigate to (missing id, an
 *   unpopulated order, or a viewer who is neither party).
 */
export function resolveOrderRoute(order: unknown, userId?: string | null): OrderRoute | null {
  const orderId = idOf(order);
  if (!orderId) return null;

  const populated = order && typeof order === 'object' ? (order as OrderRouteSubject) : null;

  if (!populated || !userId) return null;

  if (idOf(populated.customerId) === String(userId)) {
    return customerOrderRoute(orderId, populated.status, populated.paymentStatus);
  }

  if (idOf(populated.providerId) === String(userId)) {
    return providerOrderRoute(orderId);
  }

  return null;
}
