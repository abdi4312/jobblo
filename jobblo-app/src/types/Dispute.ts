/**
 * Mirrors backend/models/Dispute.js. Every enum here is copied from that schema —
 * the values are sent to the API verbatim, so the Norwegian strings below are
 * display-only and must never be submitted.
 */
export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'waiting_for_customer'
  | 'waiting_for_provider'
  | 'evidence_submitted'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export type DisputeReasonCategory =
  | 'work_not_started'
  | 'work_not_completed'
  | 'poor_quality'
  | 'different_from_agreement'
  | 'customer_not_cooperating'
  | 'provider_not_cooperating'
  | 'payment_issue'
  | 'unauthorized_payment'
  | 'fraud_or_scam'
  | 'damaged_property'
  | 'missing_evidence'
  | 'other';

export type DisputeRole = 'customer' | 'provider' | 'admin' | 'system';

/** Statuses where the backend still accepts participant messages. */
export const ACTIVE_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'open',
  'under_review',
  'waiting_for_customer',
  'waiting_for_provider',
  'evidence_submitted',
];

/** Statuses where the backend rejects new messages with "Tvisten er avsluttet." */
export const TERMINAL_DISPUTE_STATUSES: readonly DisputeStatus[] = ['resolved', 'closed', 'cancelled'];

export function isDisputeActive(status?: DisputeStatus | string | null): boolean {
  return !!status && (ACTIVE_DISPUTE_STATUSES as readonly string[]).includes(status);
}

/** Order statuses the backend allows a dispute to be opened for. Server stays authoritative. */
export const DISPUTE_ELIGIBLE_ORDER_STATUSES: readonly string[] = [
  'paid',
  'in_progress',
  'ready_for_review',
  'completed',
];

export function isDisputeEligibleOrderStatus(status?: string | null): boolean {
  return !!status && DISPUTE_ELIGIBLE_ORDER_STATUSES.includes(status);
}

export const DISPUTE_TITLE_MAX_LENGTH = 200;
export const DISPUTE_DESCRIPTION_MAX_LENGTH = 2000;
export const DISPUTE_MESSAGE_MAX_LENGTH = 2000;

export interface DisputeMessage {
  _id: string;
  senderId?: string;
  senderRole: DisputeRole;
  message: string;
  /** Admin-only notes. The API filters these out; the client filters again defensively. */
  isInternal?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Participant-visible resolution only. Admin/Stripe bookkeeping on the server document
 * (resolvedBy, stripeRefundId, stripeTransferId, moneyState, moneyError, platformFee)
 * is deliberately left untyped so it can never be rendered by accident.
 */
export type DisputeOutcome =
  | 'release_to_provider'
  | 'full_refund_to_customer'
  | 'partial_refund'
  | 'split_payment'
  | 'cancel_without_payment'
  | 'no_action';

export interface DisputeResolution {
  outcome?: DisputeOutcome | string;
  reason?: string;
  customerAmount?: number;
  providerAmount?: number;
  resolvedAt?: string;
}

export interface Dispute {
  _id: string;
  orderId: string | { _id: string; customerId?: string; providerId?: string };
  reasonCategory: DisputeReasonCategory;
  title: string;
  description: string;
  status: DisputeStatus;
  openedByRole?: 'customer' | 'provider';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  messages?: DisputeMessage[];
  resolution?: DisputeResolution | null;
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OpenDisputeInput {
  reasonCategory: DisputeReasonCategory;
  title: string;
  description: string;
}

export interface OpenDisputeResponse {
  success?: boolean;
  message?: string;
  disputeId?: string;
}

export const DISPUTE_REASON_LABELS: Record<DisputeReasonCategory, string> = {
  work_not_started: 'Arbeidet er ikke startet',
  work_not_completed: 'Arbeidet er ikke fullført',
  poor_quality: 'Dårlig kvalitet på arbeidet',
  different_from_agreement: 'Annerledes enn avtalt',
  customer_not_cooperating: 'Oppdragsgiver samarbeider ikke',
  provider_not_cooperating: 'Utfører samarbeider ikke',
  payment_issue: 'Problem med betaling',
  unauthorized_payment: 'Uautorisert betaling',
  fraud_or_scam: 'Svindel eller bedrageri',
  damaged_property: 'Skade på eiendom',
  missing_evidence: 'Manglende dokumentasjon',
  other: 'Annet',
};

/** Picker order. Derived from the label map so it can never drift from the enum. */
export const DISPUTE_REASON_CATEGORIES = Object.keys(DISPUTE_REASON_LABELS) as DisputeReasonCategory[];

export function isDisputeReasonCategory(value: unknown): value is DisputeReasonCategory {
  return typeof value === 'string' && value in DISPUTE_REASON_LABELS;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Åpen',
  under_review: 'Under behandling',
  waiting_for_customer: 'Venter på oppdragsgiver',
  waiting_for_provider: 'Venter på utfører',
  evidence_submitted: 'Dokumentasjon sendt inn',
  resolved: 'Avgjort',
  closed: 'Lukket',
  cancelled: 'Kansellert',
};

export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  release_to_provider: 'Beløpet utbetales til utfører',
  full_refund_to_customer: 'Full refusjon til oppdragsgiver',
  partial_refund: 'Delvis refusjon',
  split_payment: 'Beløpet deles mellom partene',
  cancel_without_payment: 'Avbrutt uten betaling',
  no_action: 'Ingen endring',
};

export const DISPUTE_ROLE_LABELS: Record<DisputeRole, string> = {
  customer: 'Oppdragsgiver',
  provider: 'Utfører',
  admin: 'Jobblo / Support',
  system: 'System',
};
