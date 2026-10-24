/**
 * Norwegian input formats, in one place.
 *
 * Every field that holds a Norwegian number was doing its own thing. The job form's phone
 * field was `type="number"` — which gives a number spinner on a phone number, changes the
 * value when the wheel scrolls over it, accepts `e`, `+` and `-` because those are legal in
 * a JavaScript number literal, and drops leading zeros. The settings field stripped
 * everything but digits and `+` and showed the result unformatted, so `+4741234567` came
 * back as one unreadable run. Nothing anywhere grouped the digits the way a Norwegian
 * writes them.
 *
 * These are display formatters, not validators-in-disguise: they format whatever they are
 * given, however incomplete, so a field can be formatted on every keystroke without
 * fighting the person typing. Validation is separate and explicit.
 *
 * The pattern for a controlled input is always the same — state holds digits, the input
 * shows the formatted view:
 *
 *     value={formatPhone(phone)}
 *     onChange={(e) => setPhone(digitsOnly(e.target.value, 8))}
 */

/** Strip to digits, optionally capped. The basis of every mask below. */
const digitsOnly = (value: string, max?: number): string => {
  const digits = (value || '').replace(/\D/g, '');
  return typeof max === 'number' ? digits.slice(0, max) : digits;
};

// ── Phone ────────────────────────────────────────────────────────────────────

/** Norwegian subscriber numbers are always eight digits. */
const PHONE_DIGITS = 8;

/**
 * Keep the digits of a phone number, tolerating a `+47` / `0047` prefix.
 *
 * Returns at most eight digits — the national number — because that is what we store.
 * The country code is implied: this is a Norwegian marketplace, and a stored mix of
 * `41234567`, `+4741234567` and `004741234567` is three spellings of one number that no
 * lookup can match across.
 */
export const phoneDigits = (value: string): string => {
  let digits = digitsOnly(value);
  if (digits.startsWith('0047')) digits = digits.slice(4);
  else if (digits.startsWith('47') && digits.length > PHONE_DIGITS) digits = digits.slice(2);
  return digits.slice(0, PHONE_DIGITS);
};

/**
 * Group a Norwegian number the way it is written here.
 *
 * Mobile numbers start with 4 or 9 and are grouped in threes and twos — `412 34 567`.
 * Everything else is landline or special, grouped in pairs — `22 12 34 56`. Norwegians
 * read their own numbers in those shapes; a flat run of eight digits is legible to nobody.
 *
 * Formats partial input as it arrives, so this can run on every keystroke.
 */
export const formatPhone = (value: string): string => {
  const d = phoneDigits(value);
  if (!d) return '';

  const isMobile = d[0] === '4' || d[0] === '9';
  const groups = isMobile ? [3, 2, 3] : [2, 2, 2, 2];

  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= d.length) break;
    parts.push(d.slice(index, index + size));
    index += size;
  }
  return parts.join(' ');
};

/**
 * Eight digits, and a first digit that Nkom actually assigns.
 *
 * 0 and 1 are reserved for special/short numbers, so an eight-digit number cannot begin
 * with either. This deliberately does not go further: number ranges change, and a form
 * that rejects a real number is worse than one that accepts an unusable one.
 */
export const isValidPhone = (value: string): boolean => {
  const d = phoneDigits(value);
  return d.length === PHONE_DIGITS && /^[2-9]/.test(d);
};

// ── Postal code ──────────────────────────────────────────────────────────────

/** Four digits, no grouping. Kept here so the cap lives with the other rules. */
export const formatPostalCode = (value: string): string => digitsOnly(value, 4);
