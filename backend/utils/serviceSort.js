/**
 * The one place the service-listing sort contract is defined.
 *
 * Sorting was silently broken. `GET /api/filter/options` advertised the values
 * `newest`, `price_low`, `price_high` and `relevant`, while `GET /api/services`
 * whitelisted raw Mongo field names (`createdAt`, `price`, `views`, `updatedAt`).
 * Nothing the picker offered matched anything the list endpoint accepted, so every
 * choice fell through to the default `{ createdAt: -1 }` — the dropdown moved, the
 * results did not, and no error was raised anywhere.
 *
 * The whitelist itself was correct and deliberate: it exists so an arbitrary query
 * string cannot force an in-memory sort on an unindexed field. So the fix is not to
 * loosen it. It is to give the advertised vocabulary and the accepted vocabulary a
 * single definition, which is this file.
 *
 * Both the options endpoint and the list endpoint import from here, so the two can
 * no longer drift.
 */

/**
 * Canonical sort options, in the order they should appear in a picker.
 *
 * `value` is the stable, language-independent API key — it is what the client sends
 * and what tests assert on. `label` is display text and may be translated freely;
 * it must never be used as a query key.
 *
 * Every price sort carries `createdAt` as a tiebreaker. Without it, listings sharing
 * a price come back in whatever order the index happens to yield, which makes
 * pagination unstable: the same document can appear on two pages, and another on
 * neither.
 */
const SORT_OPTIONS = [
  {
    value: 'newest',
    label: 'Nyeste først',
    sort: { createdAt: -1 },
  },
  {
    value: 'price_low',
    label: 'Pris – lavest først',
    sort: { price: 1, createdAt: -1 },
  },
  {
    value: 'price_high',
    label: 'Pris – høyest først',
    sort: { price: -1, createdAt: -1 },
  },
  {
    /**
     * Deliberately identical to `newest` for now.
     *
     * There is no relevance signal to rank on: the search path builds regex `$or`
     * conditions rather than a `$text` query, so there is no `textScore` to sort by,
     * and no popularity or match-quality score is stored on the document. Inventing
     * one here — "urgent first", "most viewed" — would be a ranking decision dressed
     * up as a bug fix, and it would change which listings get seen.
     *
     * It stays in the contract because it is already advertised and clients send it;
     * it resolves safely instead of falling through an unknown-value path. Give it
     * real behaviour when there is a real signal to rank on.
     */
    value: 'relevant',
    label: 'Mest relevant',
    sort: { createdAt: -1 },
  },
];

/** The default when nothing is supplied, or when the supplied value is not recognised. */
const DEFAULT_SORT_VALUE = 'newest';

const SORT_BY_VALUE = new Map(SORT_OPTIONS.map((option) => [option.value, option]));

/**
 * Raw Mongo fields the endpoint accepted before the canonical vocabulary existed.
 *
 * Kept so an older client, a bookmarked URL or an integration sending `?sort=-price`
 * keeps working rather than silently reverting to newest — the exact failure this
 * change exists to remove. Still a whitelist: the security property is unchanged.
 */
const LEGACY_SORTABLE_FIELDS = ['createdAt', 'price', 'views', 'updatedAt'];

/**
 * Resolve a client-supplied sort value to a Mongo sort object.
 *
 * Never throws and never returns undefined — an unrecognised value resolves to the
 * default, because a bad sort parameter is not a reason to fail a public listing
 * request.
 *
 * @param {unknown} value  Raw `sort` from the query string.
 * @returns {{ value: string, sort: Record<string, 1 | -1>, matched: boolean }}
 *          `value` is the canonical key that was applied (or the legacy field
 *          expression), and `matched` is false when the input was unrecognised.
 */
function resolveSort(value) {
  const fallback = SORT_BY_VALUE.get(DEFAULT_SORT_VALUE);

  if (typeof value !== 'string' || !value.trim()) {
    return { value: DEFAULT_SORT_VALUE, sort: { ...fallback.sort }, matched: false };
  }

  const raw = value.trim();

  const canonical = SORT_BY_VALUE.get(raw);
  if (canonical) {
    return { value: canonical.value, sort: { ...canonical.sort }, matched: true };
  }

  // Legacy `field` / `-field` form.
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  if (LEGACY_SORTABLE_FIELDS.includes(field)) {
    return { value: raw, sort: { [field]: desc ? -1 : 1 }, matched: true };
  }

  return { value: DEFAULT_SORT_VALUE, sort: { ...fallback.sort }, matched: false };
}

/** The picker payload: `{ value, label }` only — the Mongo shape stays server-side. */
function getSortOptionsForClient() {
  return SORT_OPTIONS.map(({ value, label }) => ({ value, label }));
}

module.exports = {
  SORT_OPTIONS,
  DEFAULT_SORT_VALUE,
  LEGACY_SORTABLE_FIELDS,
  resolveSort,
  getSortOptionsForClient,
};
