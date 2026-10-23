// Self-check for chatGrouping.ts. Run: node src/utils/chatGrouping.check.mjs
import assert from 'node:assert/strict';
import { groupSystemMessages, isStatusGroup } from './chatGrouping.ts';

const sys = (id, text) => ({ _id: id, type: 'system_status', text });
const msg = (id, text) => ({ _id: id, type: 'text', text });

const out = groupSystemMessages([
  msg('1', 'Hei'),
  sys('2', 'Kontrakt opprettet'),
  sys('3', 'Utfører lastet opp 1 etter-arbeid bilde(r)'),
  sys('4', 'Utfører lastet opp 1 etter-arbeid bilde(r)'),
  sys('5', 'Jobb godkjent'),
  msg('6', 'Takk!'),
  sys('7', 'Betaling bekreftet'),
]);

assert.equal(out.length, 4);
assert.equal(out[0]._id, '1');
assert.ok(isStatusGroup(out[1]));
// The duplicate upload line is kept once (the latest copy), order otherwise preserved.
assert.deepEqual(out[1].items.map((m) => m._id), ['2', '4', '5']);
assert.equal(out[2]._id, '6');
assert.ok(isStatusGroup(out[3]));
assert.equal(out[3].items.length, 1);
assert.deepEqual(groupSystemMessages([]), []);

console.log('chatGrouping: all checks passed');
