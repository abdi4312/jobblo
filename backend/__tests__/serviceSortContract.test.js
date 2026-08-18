const {
  SORT_OPTIONS,
  DEFAULT_SORT_VALUE,
  resolveSort,
  getSortOptionsForClient,
} = require('../utils/serviceSort');

/**
 * Sorting was silently broken and nothing caught it.
 *
 * `GET /api/filter/options` advertised `newest` / `price_low` / `price_high` /
 * `relevant`. `GET /api/services` whitelisted raw Mongo field names — `createdAt`,
 * `price`, `views`, `updatedAt`. The two sets did not intersect, so every value the
 * picker offered fell through the whitelist to the default `{ createdAt: -1 }`. The
 * dropdown moved, the results did not, and no error was raised anywhere.
 *
 * That is the shape of bug this file exists to prevent: it pins the advertised
 * vocabulary and the accepted vocabulary to each other, so they cannot drift apart
 * again without a red test.
 */
describe('service sort contract', () => {
  describe('every advertised value is also an accepted value', () => {
    it.each(getSortOptionsForClient().map((o) => o.value))('%s resolves to a real sort', (value) => {
      const result = resolveSort(value);
      expect(result.matched).toBe(true);
      expect(Object.keys(result.sort).length).toBeGreaterThan(0);
    });

    it('advertises exactly the four canonical options', () => {
      expect(getSortOptionsForClient().map((o) => o.value)).toEqual([
        'newest',
        'price_low',
        'price_high',
        'relevant',
      ]);
    });
  });

  describe('each option produces the expected Mongo sort', () => {
    it('newest → newest first', () => {
      expect(resolveSort('newest').sort).toEqual({ createdAt: -1 });
    });

    it('price_low → cheapest first', () => {
      expect(resolveSort('price_low').sort).toEqual({ price: 1, createdAt: -1 });
    });

    it('price_high → most expensive first', () => {
      expect(resolveSort('price_high').sort).toEqual({ price: -1, createdAt: -1 });
    });

    it('relevant → the documented default, until a real relevance signal exists', () => {
      expect(resolveSort('relevant').sort).toEqual({ createdAt: -1 });
    });

    it('gives every price sort a createdAt tiebreaker so pagination is stable', () => {
      // Without a tiebreaker, equal-priced listings come back in whatever order the
      // index yields — the same document can appear on two pages and another on none.
      for (const value of ['price_low', 'price_high']) {
        expect(Object.keys(resolveSort(value).sort)).toContain('createdAt');
      }
    });
  });

  describe('unknown input falls back safely', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['whitespace', '   '],
      ['an unknown token', 'most_popular'],
      ['a non-whitelisted field', 'password'],
      ['a nested field probe', 'userId.password'],
      ['a number', 42],
      ['an object (query-string injection)', { $ne: null }],
      ['an array', ['price']],
    ])('%s → default, marked unmatched', (_label, input) => {
      const result = resolveSort(input);
      expect(result.sort).toEqual({ createdAt: -1 });
      expect(result.matched).toBe(false);
      expect(result.value).toBe(DEFAULT_SORT_VALUE);
    });

    it('never throws, whatever it is handed', () => {
      const nasty = [Symbol('x'), () => {}, NaN, Infinity, new Date(), Buffer.from('x')];
      for (const input of nasty) {
        expect(() => resolveSort(input)).not.toThrow();
      }
    });
  });

  describe('the security property survives', () => {
    it('only ever sorts on whitelisted fields', () => {
      const allowed = new Set(['createdAt', 'price', 'views', 'updatedAt']);
      const probes = [
        'newest',
        'price_low',
        'price_high',
        'relevant',
        'createdAt',
        '-createdAt',
        'price',
        '-price',
        'views',
        '-views',
        'updatedAt',
        'description',
        'contactPhone',
        'userId',
        '__proto__',
        'constructor',
      ];

      for (const probe of probes) {
        for (const field of Object.keys(resolveSort(probe).sort)) {
          expect(allowed.has(field)).toBe(true);
        }
      }
    });

    it('does not let a crafted value reach the sort as an operator', () => {
      const result = resolveSort('$where');
      expect(result.matched).toBe(false);
      expect(JSON.stringify(result.sort)).not.toContain('$where');
    });
  });

  describe('legacy raw-field callers keep working', () => {
    it.each([
      ['createdAt', { createdAt: 1 }],
      ['-createdAt', { createdAt: -1 }],
      ['price', { price: 1 }],
      ['-price', { price: -1 }],
      ['views', { views: 1 }],
      ['-updatedAt', { updatedAt: -1 }],
    ])('%s still resolves', (input, expected) => {
      const result = resolveSort(input);
      expect(result.sort).toEqual(expected);
      expect(result.matched).toBe(true);
    });
  });

  describe('labels are display-only', () => {
    it('keeps values language-independent', () => {
      for (const option of SORT_OPTIONS) {
        // A value must never be prose: no spaces, no Norwegian characters.
        expect(option.value).toMatch(/^[a-z_]+$/);
      }
    });

    it('ships Norwegian labels, not English ones', () => {
      const labels = getSortOptionsForClient().map((o) => o.label);
      expect(labels).toEqual([
        'Nyeste først',
        'Pris – lavest først',
        'Pris – høyest først',
        'Mest relevant',
      ]);
      for (const label of labels) {
        expect(label).not.toMatch(/\b(Newest|Price|Most relevant|first|low|high)\b/i);
      }
    });
  });
});
