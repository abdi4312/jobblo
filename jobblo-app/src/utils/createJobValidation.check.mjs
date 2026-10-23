// Self-check for createJobValidation.ts. Run: node src/utils/createJobValidation.check.mjs
// (Node 22.18+/24 strips the TypeScript types on import.)
import assert from 'node:assert/strict';
import { validateCreateJobStep } from './createJobValidation.ts';

const base = {
  title: 'Male stue og gang', description: 'Male to vegger og taket i stua, ca. 25 m².', categories: ['Maling'],
  tags: [], equipment: 'utstyrfri', maxApplicants: '0', urgent: false,
  address: 'Storgata 1', city: 'Oslo', countyCode: '03', municipalityCode: '0301', areaCode: '',
  coordinates: [59.91, 10.75], fromDate: '2026-11-01', toDate: '2026-11-03',
  durationValue: '2', durationUnit: 'hours', paymentType: 'Fastpris', price: '3000', hourlyRate: '',
  contactPhone: '', contactEmail: '', checklist: [],
};
const run = (target, values = {}, extra = {}) =>
  validateCreateJobStep(target, { values: { ...base, ...values }, imageCount: 1, phone: '', displayedPrice: 3000, today: '2026-10-01', ...extra });

// A complete form passes every step.
for (const target of [2, 3, 5]) assert.deepEqual(run(target), {}, `step target ${target}`);

// Step 1
assert.equal(run(2, {}, { imageCount: 0 }).images, undefined); // images are optional
assert.equal(run(2, { title: '  ' }).title, 'Vennligst skriv inn en tittel.');
assert.equal(run(2, { title: 'Male' }).title, 'Tittelen må være minst 5 tegn.');
assert.equal(run(2, { title: 'x'.repeat(71) }).title, 'Tittelen kan være maks 70 tegn.');
assert.equal(run(2, { categories: [] }).categories, 'Vennligst velg en kategori.');
assert.equal(run(2, { description: 'For kort' }).description, 'Beskrivelsen må være minst 20 tegn.');

// Step 2
assert.ok(run(3, { coordinates: [0, 0] }).coordinates);
assert.ok(run(3, { address: '' }).address);
// Fylke/kommune/sted come from the address search; a kommune Kartverket knows but our tree lacks must not block.
assert.deepEqual(run(3, { countyCode: '', municipalityCode: '', city: '' }), {});
assert.equal(run(3, { toDate: '2026-10-30' }).toDate, 'Sluttdato kan ikke være før startdato.');
assert.equal(run(3, { toDate: '' }).toDate, undefined); // Til dato is optional
assert.equal(run(3, {}, { today: '2026-11-02' }).fromDate, 'Startdato kan ikke være i fortiden.');
assert.equal(run(3, { fromDate: '2026-02-30' }).fromDate, 'Ugyldig fra-dato.');
assert.equal(run(3, { durationValue: '' }).durationValue, 'Vennligst oppgi forventet varighet.');
assert.equal(run(3, { durationValue: '1001' }).durationValue, 'Varigheten kan ikke overstige 1000.');
assert.equal(run(3, { price: '' }, { displayedPrice: 0 }).price, 'Vennligst oppgi en fastpris større enn 0 kr.');
assert.equal(run(3, { paymentType: 'Anbud', price: '' }, { displayedPrice: 0 }).price, 'Vennligst oppgi et antatt budsjett større enn 0 kr for anbudet.');
assert.equal(run(3, { paymentType: 'Timepris', hourlyRate: '' }, { displayedPrice: 0 }).price, 'Vennligst oppgi en timepris større enn 0 kr.');
assert.equal(run(3, { price: '1000001' }).price, 'Beløpet kan ikke overstige 1000000 kr.');
assert.equal(run(3, { durationValue: '1.5' }).durationValue, undefined);

// Step 4 (optional fields, checked only when filled in)
assert.equal(run(5, {}, { phone: '1234' }).phone, 'Et norsk nummer har åtte siffer.');
assert.equal(run(5, { contactEmail: 'ola@' }).email, 'Vennligst skriv inn en gyldig e-post.');
assert.equal(run(5, { contactEmail: 'ola@example.no' }, { phone: '41234567' }).email, undefined);

console.log('createJobValidation: all checks passed');
