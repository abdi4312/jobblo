/** Norwegian labels for Order.status (backend/models/Order.js). Never show the raw value. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Venter',
  accepted: 'Godtatt',
  declined: 'Avslått',
  awaiting_payment: 'Venter på betaling',
  paid: 'Betalt',
  in_progress: 'Under arbeid',
  ready_for_review: 'Til godkjenning',
  waiting_for_approval: 'Til godkjenning',
  completed: 'Fullført',
  disputed: 'Tvist',
  refunded: 'Refundert',
  cancelled: 'Kansellert',
};

export function orderStatusLabel(status?: string | null): string {
  return (status && ORDER_STATUS_LABELS[status]) || 'Under behandling';
}
