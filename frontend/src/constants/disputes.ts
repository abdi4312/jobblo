/**
 * Dispute reason options and status labels.
 *
 * Both sides previously offered the *same* full list, so the customer could pick
 * "Kunde samarbeider ikke" and the provider could pick "Tilbyder samarbeider
 * ikke" — each party able to file a dispute accusing themselves. The list is now
 * chosen by the viewer's role.
 *
 * Values must stay inside the enum on backend/models/Dispute.js.
 */

export type DisputeViewerRole = 'customer' | 'provider';

interface ReasonOption {
  value: string;
  label: string;
}

const SHARED_REASONS: ReasonOption[] = [
  { value: 'different_from_agreement', label: 'Avviker fra avtalen' },
  { value: 'payment_issue', label: 'Betalingsproblem' },
  { value: 'fraud_or_scam', label: 'Svindel eller bedrageri' },
  { value: 'other', label: 'Annet' },
];

const CUSTOMER_REASONS: ReasonOption[] = [
  { value: 'work_not_started', label: 'Arbeidet er ikke påbegynt' },
  { value: 'work_not_completed', label: 'Jobben er ikke fullført' },
  { value: 'poor_quality', label: 'Dårlig kvalitet på arbeidet' },
  { value: 'provider_not_cooperating', label: 'Oppdragstaker samarbeider ikke' },
  { value: 'damaged_property', label: 'Skade på eiendom' },
  { value: 'unauthorized_payment', label: 'Uautorisert betaling' },
];

const PROVIDER_REASONS: ReasonOption[] = [
  { value: 'customer_not_cooperating', label: 'Oppdragsgiver samarbeider ikke' },
  { value: 'missing_evidence', label: 'Manglende dokumentasjon fra oppdragsgiver' },
];

export const disputeReasonOptions = (role: DisputeViewerRole): ReasonOption[] => [
  ...(role === 'customer' ? CUSTOMER_REASONS : PROVIDER_REASONS),
  ...SHARED_REASONS,
];

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: 'Åpen',
  under_review: 'Under behandling',
  waiting_for_customer: 'Venter på deg som oppdragsgiver',
  waiting_for_provider: 'Venter på oppdragstaker',
  evidence_submitted: 'Dokumentasjon mottatt',
  resolved: 'Løst',
  closed: 'Avsluttet',
  rejected: 'Avvist',
  cancelled: 'Kansellert',
};

/** Statuses where either party can still add a message (mirrors disputeController). */
export const ACTIVE_DISPUTE_STATUSES = [
  'open',
  'under_review',
  'waiting_for_customer',
  'waiting_for_provider',
  'evidence_submitted',
];

export const disputeStatusLabel = (status?: string | null): string =>
  (status && DISPUTE_STATUS_LABELS[status]) || 'Ukjent status';

export const isDisputeActive = (status?: string | null): boolean =>
  !!status && ACTIVE_DISPUTE_STATUSES.includes(status);

export const disputeReasonLabel = (value?: string | null): string => {
  if (!value) return '';
  const all = [...CUSTOMER_REASONS, ...PROVIDER_REASONS, ...SHARED_REASONS];
  return all.find((o) => o.value === value)?.label || value;
};
