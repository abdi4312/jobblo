// Check for paths.ts (what the mobile reporter sends as an API path).
// Run: node src/monitoring/paths.check.mjs
import assert from 'node:assert/strict';
import { templatePath } from './paths.ts';

assert.equal(templatePath('/services/6ad90a9e94221dfd9681ff17/apply?token=secret'), '/services/:id/apply');
assert.equal(templatePath('https://api.jobblo.no/api/orders/6AD90A9E94221DFD9681FF17'), '/orders/:id');
assert.equal(templatePath('/notifications/42/read'), '/notifications/:id/read');
assert.equal(templatePath('/auth/profile'), '/auth/profile');
assert.equal(templatePath('/apiary/list'), '/apiary/list'); // only a leading /api/ segment is stripped
assert.equal(templatePath(undefined), '');
console.log('paths.check: ok');
