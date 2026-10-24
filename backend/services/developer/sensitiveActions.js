const mongoose = require('mongoose');
const ipBlocks = require('../monitoring/ipBlocks');
const { DEFAULT_THRESHOLDS, CONFIG_KEY } = require('../monitoring/alerts');

/**
 * Every sensitive developer-dashboard action, defined once. Both paths use it:
 * a Super Admin executing directly (after step-up), and an approved ChangeRequest.
 *
 *   prepare(input, ctx)  → validated, storable payload (secrets already encrypted)
 *   summary(payload)     → human-readable line, never containing a secret
 *   execute(payload, ctx) → performs it; ctx = { actor, actorIp, requesterIp, approvedVia }
 */

const MINUTE = 60 * 1000;
const MAX_BLOCK_HOURS = 24 * 90;
const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const family = (ip) => (String(ip).includes(':') ? 'ipv6' : 'ipv4');
const FLAG_KEY = /^(feature_|flag_)/i;

const ACTIONS = {
  ip_block: {
    label: 'Block IP',
    // Operations developers run IP blocks themselves (still with step-up); no approval needed.
    selfService: true,
    prepare: async ({ ip, expiresInHours }) => {
      const t = ipBlocks.parseTarget(ip);
      if (t.error) throw bad(t.error);
      const hours = expiresInHours === null ? null : Number(expiresInHours ?? 24);
      if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > MAX_BLOCK_HOURS)) throw bad(`Duration must be 1–${MAX_BLOCK_HOURS} hours, or always.`);
      if (await require('../../models/IpBlock').exists({ target: t.target })) throw bad('This IP is already blocked.', 409);
      return { target: t.target, hours };
    },
    summary: (p) => `Block ${p.target} ${p.hours === null ? 'always' : `for ${p.hours}h`}`,
    execute: async (p, ctx) => {
      // Never lock out the person requesting or the person approving.
      const list = ipBlocks.build([{ target: p.target }]);
      for (const ip of [ctx.actorIp, ctx.requesterIp].filter(Boolean)) {
        if (list.check(ip, family(ip))) throw bad(`That would block ${ip === ctx.actorIp ? 'your own' : "the requester's"} IP address.`);
      }
      await require('../../models/IpBlock').create({ target: p.target, reason: ctx.reason, createdBy: ctx.actor, expiresAt: p.hours === null ? null : new Date(Date.now() + p.hours * 60 * MINUTE) });
      await ipBlocks.refresh();
    },
  },

  ip_unblock: {
    label: 'Unblock IP',
    selfService: true,
    prepare: async ({ id }) => {
      if (!isId(id)) throw bad('Invalid block id.');
      const block = await require('../../models/IpBlock').findById(id).lean();
      if (!block) throw bad('Block not found.', 404);
      return { id, target: block.target };
    },
    summary: (p) => `Unblock ${p.target}`,
    execute: async (p) => {
      await require('../../models/IpBlock').findByIdAndDelete(p.id);
      await ipBlocks.refresh();
    },
  },

  // Unblock one client from one rate limiter (a household locked out of login, say).
  // With Redis it clears the shared counter for every instance; without, this instance only.
  rate_limit_reset: {
    label: 'Reset rate limit',
    selfService: true,
    prepare: async ({ limiter, client }) => {
      const { LIMITERS } = require('../../middleware/rateLimiter');
      if (!LIMITERS.has(limiter)) throw bad('Unknown rate limiter.');
      if (typeof client !== 'string' || !client.trim() || client.length > 200) throw bad('Client key (IP or u:<id>) is required.');
      return { limiter, client: client.trim(), target: `${limiter} / ${client.trim()}` };
    },
    summary: (p) => `Reset rate limit ${p.limiter} for ${p.client}`,
    execute: async (p) => {
      await require('../../middleware/rateLimiter').LIMITERS.get(p.limiter).limiter.resetKey(p.client);
      require('../monitoring/redisInsights').clearMemo(); // the page shows the reset at once
    },
  },

  flag_set: {
    label: 'Change feature flag',
    prepare: async ({ key, enabled }) => {
      if (!FLAG_KEY.test(String(key || ''))) throw bad('Not a feature flag.');
      if (typeof enabled !== 'boolean') throw bad('enabled must be true or false.');
      if (!(await require('../../models/GlobalConfig').exists({ key }))) throw bad('Feature flag not found.', 404);
      return { key, enabled };
    },
    summary: (p) => `Turn ${p.enabled ? 'ON' : 'OFF'} feature flag ${p.key}`,
    execute: async (p) => {
      await require('../../models/GlobalConfig').updateOne({ key: p.key }, { $set: { value: p.enabled } });
    },
  },

  thresholds_set: {
    label: 'Change alert thresholds',
    prepare: async ({ thresholds }) => {
      const clean = {};
      for (const [k, def] of Object.entries(DEFAULT_THRESHOLDS)) {
        if (thresholds?.[k] === undefined) continue;
        const n = Number(thresholds[k]);
        if (!Number.isFinite(n) || n <= 0 || n > def * 1000) throw bad(`Invalid value for ${k}.`);
        clean[k] = n;
      }
      if (!Object.keys(clean).length) throw bad('Nothing to change.');
      return { thresholds: clean };
    },
    summary: (p) => `Set alert thresholds: ${Object.entries(p.thresholds).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    execute: async (p) => {
      await require('../../models/GlobalConfig').updateOne(
        { key: CONFIG_KEY },
        { $set: Object.fromEntries(Object.entries(p.thresholds).map(([k, v]) => [`value.${k}`, v])), $setOnInsert: { description: 'Developer dashboard alert thresholds' } },
        { upsert: true }
      );
    },
  },

  slo_targets_set: {
    label: 'Change SLO targets',
    prepare: async ({ targets }) => {
      const { SLOS } = require('../monitoring/slo');
      const clean = {};
      for (const s of SLOS) {
        if (targets?.[s.key] === undefined) continue;
        const n = Number(targets[s.key]);
        // Below 90 % an "objective" stops meaning anything; 100 % leaves no budget at all.
        if (!Number.isFinite(n) || n < 90 || n >= 100) throw bad(`Target for ${s.name} must be between 90 and 99.999.`);
        clean[s.key] = Math.round(n * 1000) / 1000;
      }
      if (!Object.keys(clean).length) throw bad('Nothing to change.');
      return { targets: clean };
    },
    summary: (p) => `Set SLO targets: ${Object.entries(p.targets).map(([k, v]) => `${k}=${v}%`).join(', ')}`,
    execute: async (p) => {
      const { CONFIG_KEY } = require('../monitoring/slo');
      await require('../../models/GlobalConfig').updateOne(
        { key: CONFIG_KEY },
        { $set: Object.fromEntries(Object.entries(p.targets).map(([k, v]) => [`value.${k}`, v])), $setOnInsert: { description: 'Developer dashboard SLO targets' } },
        { upsert: true }
      );
    },
  },

  developer_access: {
    label: 'Change developer access',
    prepare: async ({ userId, access }) => {
      if (!['readonly', 'operations'].includes(access)) throw bad('Access must be readonly or operations.');
      if (!isId(userId)) throw bad('Invalid user.');
      const u = await require('../../models/User').findOne({ _id: userId, role: 'developer' }).select('name').lean();
      if (!u) throw bad('Developer not found.', 404);
      return { userId, access, name: u.name };
    },
    summary: (p) => `Set ${p.name}'s developer access to ${p.access}`,
    execute: async (p) => {
      await require('../../models/User').updateOne({ _id: p.userId, role: 'developer' }, { $set: { developerAccess: p.access } });
    },
  },
};

module.exports = { ACTIONS };
