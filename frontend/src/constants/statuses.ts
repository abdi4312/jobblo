/**
 * Shared status vocabulary for services and orders.
 *
 * These lists were previously re-typed inline at every call site, and each copy
 * had drifted differently. The visible symptoms were:
 *   - a job in `awaiting_payment` still showed an enabled "Send forespørsel",
 *     with the raw string `awaiting_payment` printed as its status chip;
 *   - `SafePayCheckout` offered "Bekreft og betal" for an order already paid,
 *     because its paid-list omitted `ready_for_review`;
 *   - `ChatWindow` compared against `'canceled'` (one l) so the guard never matched.
 *
 * This is deliberately not an attempt to unify the whole status model before
 * launch — it is one file that the checks which leak to users can share.
 */

/** Service statuses that mean nobody can apply any more. */
export const CLOSED_SERVICE_STATUSES = [
  'completed',
  'in_progress',
  'closed',
  'cancelled',
  'expired',
  // Below: all three are written by the backend and were missing from the guard,
  // which is why raw snake_case leaked into the UI.
  'awaiting_payment',
  'paid',
  'waiting_for_approval',
] as const;

/** Order statuses that mean the customer's money has already been taken. */
export const PAID_ORDER_STATUSES = [
  'paid',
  'in_progress',
  'ready_for_review',
  'waiting_for_approval',
  'completed',
] as const;

/**
 * Order statuses that mean this job already has a live contract, so the poster
 * must not be offered "Velg og start SafePay" again. `ready_for_review` and
 * `disputed` were missing, so the moment a provider marked work ready the
 * applicants page re-armed the button and clicking it returned
 * "Kontrakt finnes allerede" with no way forward.
 */
export const ACTIVE_ORDER_STATUSES = [
  'awaiting_payment',
  'paid',
  'in_progress',
  'ready_for_review',
  'waiting_for_approval',
  'completed',
  'disputed',
] as const;

/**
 * Order statuses at which the customer's approval screen is the right place to be.
 *
 * The backend refuses `POST /api/safepay-checkout/approve` from anything but
 * `ready_for_review`, but every surface that linked to `/safepay/approval/:id`
 * tested `paymentStatus === 'paid'` instead. A customer who had merely paid was
 * therefore routed to a page that announced "<utfører> melder jobben som ferdig"
 * — before the provider had started, let alone pressed "Meld jobb som ferdig" —
 * and handed an approve button the server would reject.
 */
export const APPROVABLE_ORDER_STATUSES = ['ready_for_review', 'completed'] as const;

/** True once the provider has actually reported the work finished. */
export const isApprovable = (status?: string | null): boolean =>
  !!status && (APPROVABLE_ORDER_STATUSES as readonly string[]).includes(status);

/**
 * Where a paying customer belongs for a given order status.
 *
 * `null` means "no opinion" — the caller should fall back to its own default
 * (usually the checkout page, since an unpaid order has nowhere else to go).
 */
export const customerOrderPath = (orderId: string, status?: string | null): string | null => {
  if (isApprovable(status)) return `/safepay/approval/${orderId}`;
  if (isPaidOrder(status)) return `/safepay/success?orderId=${orderId}`;
  return null;
};

/** Norwegian labels. Anything missing here would otherwise be shown raw. */
export const STATUS_LABELS: Record<string, string> = {
  open: 'Åpent',
  active: 'Aktivt',
  pending: 'Venter',
  draft: 'Utkast',
  awaiting_payment: 'Venter på betaling',
  paid: 'Betalt',
  in_progress: 'Pågår',
  ready_for_review: 'Klar til godkjenning',
  waiting_for_approval: 'Venter på godkjenning',
  completed: 'Fullført',
  cancelled: 'Kansellert',
  closed: 'Lukket',
  expired: 'Utløpt',
  disputed: 'Tvist',
  accepted: 'Godkjent',
  declined: 'Avslått',
};

/** Never returns a raw snake_case string to the UI. */
export const statusLabel = (status?: string | null): string =>
  (status && STATUS_LABELS[status]) || 'Ukjent status';

export const isClosedService = (status?: string | null): boolean =>
  !!status && (CLOSED_SERVICE_STATUSES as readonly string[]).includes(status);

export const isPaidOrder = (status?: string | null): boolean =>
  !!status && (PAID_ORDER_STATUSES as readonly string[]).includes(status);
