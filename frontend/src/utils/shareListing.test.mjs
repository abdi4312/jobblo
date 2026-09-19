import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharePayload } from './shareListing.ts';

test('buildSharePayload includes the listing title and URL in the share text', () => {
  const payload = buildSharePayload('abc123', 'Maler jobb');

  assert.equal(payload.title, 'Maler jobb');
  assert.equal(payload.url, 'https://jobblo.no/job-listing/abc123');
  assert.equal(payload.text, 'Maler jobb\n\nhttps://jobblo.no/job-listing/abc123');
});
