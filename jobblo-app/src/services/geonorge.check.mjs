// Live check for geonorge.service.ts (Kartverket address API). Needs internet.
// Run: node src/services/geonorge.check.mjs
import assert from 'node:assert/strict';
import { searchAddresses, addressAt } from './geonorge.service.ts';

// 1. Search returns real addresses with postal code, sted, kommune and coordinates.
const borggata = await searchAddresses('Borggata 8');
assert.ok(borggata.length > 0, 'Borggata 8 gives suggestions');
for (const hit of borggata) {
  assert.match(hit.postalCode, /^\d{4}$/, 'postal code is 4 digits');
  assert.match(hit.municipalityCode, /^\d{4}$/, 'kommunenummer is 4 digits (matches our location tree)');
  assert.ok(hit.lat > 57 && hit.lat < 72 && hit.lng > 4 && hit.lng < 32, 'point is in Norway');
}

// 2. Sted and kommune are title-cased, Norwegian letters included.
const tromso = await searchAddresses('storgata 1 tromsø');
assert.equal(tromso[0].city, 'Tromsø');
assert.equal(tromso[0].municipalityCode, '5501');
const slottsgate = await searchAddresses('Øvre Slottsgate 1');
assert.equal(slottsgate[0].address, 'Øvre Slottsgate 1');
assert.equal(slottsgate[0].municipalityCode, '0301');

// 3. Map tap / GPS: nearest address to a point.
const stortorvet = await addressAt(59.9127, 10.7461);
assert.ok(stortorvet, 'Oslo sentrum has an address');
assert.equal(stortorvet.city, 'Oslo');
assert.equal(stortorvet.municipalityCode, '0301');

// 4. A point with no address (open sea, outside Norway) is "no address", not an error.
assert.equal(await addressAt(64.0, 2.0), null);

// 5. Nonsense gives an empty list, not a crash.
assert.deepEqual(await searchAddresses('qqqqzzzz'), []);

console.log('geonorge: all checks passed');
