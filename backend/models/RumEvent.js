const mongoose = require('mongoose');

/**
 * Real-user monitoring from the web app (frontend/src/lib/rum.ts): page views, Core Web
 * Vitals, browser JS errors and problems (broken screen, page not found, failed chunk,
 * failed API call, console error) with a masked breadcrumb trail of the steps before it.
 * Anonymous — a random per-tab id, no user, no cookies. Kept 30 days.
 */
const rumEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['view', 'vital', 'error', 'problem'], required: true },
    at: { type: Date, required: true },
    sessionId: { type: String, required: true },
    page: { type: String, required: true }, // route template, ids replaced
    device: { type: String, enum: ['mobile', 'tablet', 'desktop'], default: 'desktop' },
    browser: { type: String, default: null },
    connection: { type: String, default: null }, // 4g / 3g / …
    release: { type: String, default: null },
    // vital
    metric: { type: String, enum: ['LCP', 'INP', 'CLS', 'FCP', 'TTFB', null], default: null },
    value: { type: Number, default: null },
    rating: { type: String, enum: ['good', 'needs-improvement', 'poor', null], default: null },
    navigationType: { type: String, default: null },
    // view
    loadMs: { type: Number, default: null }, // full page load for the landing view; soft-nav render time otherwise
    // error
    message: { type: String, default: null },
    source: { type: String, default: null },
    fingerprint: { type: String, default: null },
    // problem: render | not_found | chunk | api | console (JS errors stay type 'error')
    kind: { type: String, enum: ['render', 'not_found', 'chunk', 'api', 'console', null], default: null },
    status: { type: Number, default: null }, // api: HTTP status, 0 = network error
    // Last steps before an error/problem — masked on the client and again on intake.
    trail: {
      type: [{ _id: false, at: Date, type: { type: String }, page: String, label: String, status: Number, ms: Number }],
      default: undefined,
    },
  },
  { versionKey: false }
);

rumEventSchema.index({ type: 1, at: -1 });
rumEventSchema.index({ sessionId: 1, at: 1 });
rumEventSchema.index({ metric: 1, at: -1 });
rumEventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('RumEvent', rumEventSchema);
