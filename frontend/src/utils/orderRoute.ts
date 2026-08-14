/**
 * Resolves which order page a given user should be sent to.
 *
 * Every surface needs this and each one had its own copy. `Alert.tsx` had no copy
 * at all — it sent *everyone* to `/provider/orders/:id`, so a customer who
 * received "Din forespørsel er godkjent" landed on the provider's work page
 * instead of their own checkout. It also happily navigated to
 * `/provider/orders/null` when the referenced order had been deleted.
 */

export interface OrderRouteSubject {
  _id?: string;
  customerId?: unknown;
  providerId?: unknown;
  paymentStatus?: string;
  status?: string;
}

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return null;
};

/**
 * @param order  the order, populated if possible. A bare id string is accepted,
 *               but then the viewer's role is unknown and we cannot route.
 * @param userId the viewing user's id.
 * @returns a path, or null when there is nothing safe to navigate to.
 */
export function resolveOrderRoute(order: unknown, userId?: string | null): string | null {
  const orderId = idOf(order);
  if (!orderId) return null;

  const populated =
    order && typeof order === 'object' ? (order as OrderRouteSubject) : null;

  // Without a populated order we can't tell the customer from the provider.
  // Guessing "provider" is what produced the bug; send them to their order list
  // instead of the wrong party's page.
  if (!populated || !userId) return null;

  const isCustomer = idOf(populated.customerId) === String(userId);
  if (isCustomer) {
    const isPaid =
      populated.paymentStatus === 'paid' ||
      ['paid', 'in_progress', 'ready_for_review', 'waiting_for_approval', 'completed'].includes(
        populated.status || ''
      );
    return isPaid ? `/safepay/approval/${orderId}` : `/safepay/checkout/${orderId}`;
  }

  const isProvider = idOf(populated.providerId) === String(userId);
  if (isProvider) return `/provider/orders/${orderId}`;

  return null;
}
