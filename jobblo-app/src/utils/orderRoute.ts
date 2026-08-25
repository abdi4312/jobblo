/**
 * Mobile order routing — determines where a user should go based on their role and order state.
 *
 * Adapted from frontend/src/utils/orderRoute.ts and frontend/src/constants/statuses.ts.
 * Uses Expo Router's router.replace for navigation.
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

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return null;
};

/**
 * Resolves the Expo Router path for a given order and viewing user.
 *
 * @returns a path string or null when there's nothing safe to navigate to.
 */
export function resolveOrderRoute(order: unknown, userId?: string | null): string | null {
  const orderId = idOf(order);
  if (!orderId) return null;

  const populated = order && typeof order === 'object' ? (order as OrderRouteSubject) : null;

  if (!populated || !userId) return null;

  const isCustomer = idOf(populated.customerId) === String(userId);
  if (isCustomer) {
    if (populated.status && APPROVABLE_STATUSES.includes(populated.status)) {
      return `/(app)/safepay/approval/${orderId}`;
    }
    if (populated.status && PAID_STATUSES.includes(populated.status)) {
      return `/(app)/safepay/success/${orderId}`;
    }
    return `/(app)/safepay/checkout/${orderId}`;
  }

  const isProvider = idOf(populated.providerId) === String(userId);
  if (isProvider) return `/(app)/provider/orders/${orderId}`;

  return null;
}
