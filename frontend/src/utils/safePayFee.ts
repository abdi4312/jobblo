/**
 * SafePay fee arithmetic, mirroring the backend exactly.
 *
 * The backend computes `fee = Math.round(price * 0.03)` and then
 * `netToProvider = price - fee` (SafePayCheckoutController, providerWorkController,
 * safepayController — all identical). The applicants page instead did
 * `Math.round(price * 0.97)`, which rounds independently and disagrees:
 * at 350 kr it printed fee 11 and payout 340, so the sidebar showed
 * 350 / 11 / 340 — three numbers that do not add up — while the provider
 * actually received 339.
 *
 * Prefer the backend's `calculation.*` when a page already has it (the SafePay
 * screens do). This exists for the pages that only have a raw price.
 */

export const SAFEPAY_FEE_RATE = 0.03;

export const safePayFee = (price: number): number =>
  Math.round((Number(price) || 0) * SAFEPAY_FEE_RATE);

export const safePayNetToProvider = (price: number): number => {
  const gross = Number(price) || 0;
  return gross - safePayFee(gross);
};
