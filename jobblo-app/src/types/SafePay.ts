export interface SafePayParty {
  _id: string;
  name?: string;
  lastName?: string;
  avatarUrl?: string;
  averageRating?: number;
}

export interface SafePayDuration {
  value?: number;
  unit?: string;
}

export interface SafePayLocation {
  city?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface SafePayChecklistItem {
  id: string;
  text: string;
  checked?: boolean;
  checkedBy?: SafePayParty | null;
}

export interface SafePayService {
  _id: string;
  title: string;
  location?: SafePayLocation;
  price?: number;
  equipment?: string;
  userId?: string;
  checklist?: SafePayChecklistItem[];
  fromDate?: string;
  toDate?: string;
  duration?: SafePayDuration | null;
}

export interface SafePayOrder {
  _id: string;
  status: string;
  paymentStatus?: string;
  agreedPrice?: number;
  /**
   * Stripe Checkout Session id. `create-session` only returns the Checkout URL, so this —
   * written to the order before that endpoint responds — is how the app gets an id to
   * verify the payment with at `GET /safepay-checkout/status/:sessionId`.
   */
  checkoutSessionId?: string;
  checkoutSessionStatus?: string;
  /** `provider_stripe_connect_timeout` when the provider did not start in time. */
  cancellationReason?: string;
  providerConnectDeadlineAt?: string | null;
  providerConnectTimeout?: { status?: string } | null;
  serviceId: SafePayService | null;
  customerId: SafePayParty | null;
  providerId: SafePayParty | null;
  checklist?: SafePayChecklistItem[];
  beforeImages?: string[];
  afterImages?: string[];
  completionNote?: string;
  review?: {
    overall?: number;
    punctuality?: number;
    quality?: number;
    communication?: number;
    tidiness?: number;
    comment?: string;
    photos?: string[];
    recommendWorker?: boolean;
  };
}

export interface SafePayCalculation {
  basePrice: number;
  fee: number;
  total: number;
  providerNet: number;
}

/** Start deadline promised at checkout: not started in time means a full refund. */
export interface SafePayStartDeadline {
  days: number;
  /** Set only on test backends (minutes instead of days). */
  testMinutes?: number | null;
}

export interface SafePayCheckoutResponse {
  order: SafePayOrder;
  calculation: SafePayCalculation;
  startDeadline?: SafePayStartDeadline | null;
}

export interface SafePaySessionResponse {
  url?: string;
  reused?: boolean;
}

export interface SafePaySessionStatusResponse {
  payment_status?: string;
  orderId?: string;
  chatId?: string;
  alreadyConfirmed?: boolean;
}

export interface SafePayApprovalResponse {
  message: string;
  orderId: string;
  payoutWarning?: string;
  payoutErrorCode?: string;
}