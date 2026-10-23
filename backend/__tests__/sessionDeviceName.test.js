/**
 * The mobile app reports its model in X-Device-Name for the "Aktive økter" list.
 * It is client-supplied, so it is reduced to a short, plain label.
 */
const { deviceNameFrom } = require('../utils/tokenUtils');

const from = (value) => deviceNameFrom({ headers: value === undefined ? {} : { 'x-device-name': value } });

it('keeps a normal model name', () => {
  expect(from('iPhone 15 Pro')).toBe('iPhone 15 Pro');
  expect(from('Samsung SM-S911B')).toBe('Samsung SM-S911B');
  expect(from('Google Pixel 8 (5G)')).toBe('Google Pixel 8 (5G)');
});

it('strips markup and control characters, collapses spaces, caps the length', () => {
  expect(from('  Samsung\u0000 SM-S911B\n<script>alert(1)</script>')).toBe('Samsung SM-S911Bscriptalert(1)/script');
  expect(from('x'.repeat(100))).toHaveLength(60);
});

it('returns null when missing, not a string, or empty after cleaning', () => {
  expect(from(undefined)).toBeNull();
  expect(from(['iPhone'])).toBeNull();
  expect(from('<<>>')).toBeNull();
});
