const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payout = require('../models/Payout');
const User = require('../models/User');
const StripeTransferRecord = require('../models/StripeTransferRecord');
const StripeBankPayoutRecord = require('../models/StripeBankPayoutRecord');
const StripeFinancialSyncState = require('../models/StripeFinancialSyncState');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { syncTransfersPage, syncBankPayoutsPage, modeField } = require('../services/stripe/financialHistory');
const { logActivity } = require('../services/admin/activityService');

const MAX_LIMIT = 100;
const MAX_PAGE = 1000;
const TRANSFER_STATUSES = new Set([
  'transferred',
  'partially_reversed',
  'fully_reversed',
  'awaiting_customer_approval',
  'release_scheduled',
  'transfer_processing',
  'transfer_failed',
  'reconciliation_required',
]);
const PAYOUT_STATUSES = new Set(['pending', 'in_transit', 'paid', 'failed', 'canceled']);

function parseListOptions(req, { admin }) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return { error: 'Ugyldig side. Velg en side mellom 1 og 1000.' };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `Ugyldig sidestørrelse. Velg mellom 1 og ${MAX_LIMIT}.` };
  }
  const mode = admin ? req.query.mode || 'all' : 'current';
  if (admin && !['all', 'test', 'live'].includes(mode)) {
    return { error: 'Ugyldig Stripe-modus.' };
  }
  if (!admin && req.query.mode) return { error: 'Bare administratorer kan filtrere Stripe-modus.' };
  if (admin && req.query.providerId && !mongoose.Types.ObjectId.isValid(req.query.providerId)) {
    return { error: 'Ugyldig providerId.' };
  }
  if (req.query.orderId && !mongoose.Types.ObjectId.isValid(req.query.orderId)) {
    return { error: 'Ugyldig orderId.' };
  }
  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? false : date;
  };
  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom === false || dateTo === false || (dateFrom && dateTo && dateFrom > dateTo)) {
    return { error: 'Ugyldig datoperiode.' };
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    mode,
    providerId: admin ? req.query.providerId : req.userId,
    orderId: req.query.orderId,
    search,
    dateFrom,
    dateTo,
  };
}

function modeFilter(mode) {
  if (mode === 'test') return { livemode: false };
  if (mode === 'live') return { livemode: true };
  return {};
}

function dateFilter(field, from, to) {
  if (!from && !to) return {};
  const result = {};
  if (from) result.$gte = from;
  if (to) result.$lte = to;
  return { [field]: result };
}

function transferDate(item) {
  return item.stripeCreatedAt || item.transferCompletedAt || item.updatedAt || item.createdAt || new Date(0);
}

function safeAccountDashboardUrl(accountId, livemode) {
  const modePath = livemode ? '' : '/test';
  return `https://dashboard.stripe.com${modePath}/connect/accounts/${encodeURIComponent(accountId)}`;
}

function mapTransferRecord(record, admin) {
  const localPayout = record.payoutId && typeof record.payoutId === 'object'
    ? record.payoutId
    : null;
  return {
    id: String(record._id),
    type: 'stripe_transfer',
    stripeTransferId: record.stripeObjectId,
    orderId: record.orderId ? String(record.orderId) : null,
    payoutId: record.payoutId ? String(record.payoutId._id || record.payoutId) : null,
    jobbloFee: Number.isFinite(localPayout?.platformFee)
      ? Math.round(localPayout.platformFee * 100)
      : null,
    provider: record.providerId
      ? { id: String(record.providerId._id || record.providerId), name: record.providerId.name || null }
      : null,
    customer: admin && localPayout?.customerId
      ? { id: String(localPayout.customerId._id || localPayout.customerId), name: localPayout.customerId.name || null }
      : undefined,
    stripeAccountId: record.stripeAccountId,
    amount: record.amount,
    amountReversed: record.amountReversed || 0,
    currency: record.currency,
    destinationPaymentId: record.destinationPaymentId || null,
    sourceTransactionId: record.sourceTransactionId || null,
    balanceTransactionId: record.balanceTransactionId || null,
    reversed: Boolean(record.reversed),
    status: record.normalizedStatus,
    stripeStatus: null,
    mode: record.livemode === true ? 'live' : 'test',
    stripeCreatedAt: record.stripeCreatedAt || null,
    lastSyncedAt: record.lastVerifiedAt || null,
    audit: (record.audit || []).map((entry) => ({
      eventType: entry.eventType,
      status: entry.normalizedStatus,
      at: entry.eventCreatedAt || entry.recordedAt,
    })),
    stripeDashboardUrl: admin ? `${safeAccountDashboardUrl(record.stripeAccountId, record.livemode)}/transfers/${encodeURIComponent(record.stripeObjectId)}` : undefined,
  };
}

function mapLocalTransferAttempt(payout, admin) {
  const status = {
    pending: 'awaiting_customer_approval',
    released_internal: 'release_scheduled',
    processing: 'transfer_processing',
    failed: 'transfer_failed',
    transferred: 'reconciliation_required',
    cancelled: 'reconciliation_required',
  }[payout.status] || 'unknown';
  return {
    id: String(payout._id),
    type: 'jobblo_transfer_attempt',
    stripeTransferId: payout.stripeTransferId || null,
    orderId: String(payout.orderId),
    payoutId: String(payout._id),
    provider: payout.providerId
      ? { id: String(payout.providerId._id || payout.providerId), name: payout.providerId.name || null }
      : null,
    customer: admin && payout.customerId
      ? { id: String(payout.customerId._id || payout.customerId), name: payout.customerId.name || null }
      : undefined,
    stripeAccountId: payout.stripeConnectAccountId || null,
    amount: Math.round(Number(payout.netProviderAmount) * 100),
    amountReversed: null,
    currency: payout.currency || null,
    status,
    stripeStatus: null,
    mode: payout.stripeLivemode === true ? 'live' : payout.stripeLivemode === false ? 'test' : 'unknown',
    stripeCreatedAt: payout.transferInitiatedAt || payout.createdAt,
    lastSyncedAt: payout.updatedAt || null,
    failureCode: payout.failureCode || null,
    failureMessage: payout.status === 'failed'
      ? 'Overføringen ble ikke opprettet. Administrator må kontrollere forsøket.'
      : null,
  };
}

function mapBankPayout(record, admin) {
  return {
    id: String(record._id),
    type: 'stripe_bank_payout',
    stripePayoutId: record.stripeObjectId,
    provider: record.providerId
      ? { id: String(record.providerId._id || record.providerId), name: record.providerId.name || null }
      : null,
    stripeAccountId: record.stripeAccountId,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    stripeStatus: record.status,
    mode: record.livemode ? 'live' : 'test',
    arrivalDate: record.arrivalDate || null,
    payoutType: record.payoutType || null,
    destination: record.destinationLast4
      ? { last4: record.destinationLast4, bankName: record.destinationBankName || null }
      : null,
    failureCode: record.failureCode || null,
    failureMessage: record.failureMessage || null,
    stripeCreatedAt: record.stripeCreatedAt || null,
    lastSyncedAt: record.lastVerifiedAt || null,
    stripeDashboardUrl: admin
      ? `${safeAccountDashboardUrl(record.stripeAccountId, record.livemode)}/payouts/${encodeURIComponent(record.stripeObjectId)}`
      : undefined,
  };
}

async function paginated(req, res, { admin, kind }) {
  const options = parseListOptions(req, { admin });
  if (options.error) return res.status(400).json({ error: options.error });
  const config = await getStripeConfiguration();
  const mode = options.mode === 'current' ? config.mode : options.mode;
  const livemode = mode === 'all' ? null : mode === 'live';
  const baseQuery = {
    ...(options.providerId ? { providerId: options.providerId } : {}),
    ...(options.orderId ? { orderId: options.orderId } : {}),
    ...(livemode === null ? {} : { livemode }),
  };
  const searchQuery = options.search
    ? {
        $or: [
          { stripeObjectId: options.search },
          ...(mongoose.Types.ObjectId.isValid(options.search)
            ? [{ orderId: options.search }]
            : []),
        ],
      }
    : {};
  const recordModel = kind === 'transfers' ? StripeTransferRecord : StripeBankPayoutRecord;
  const statusFilter = req.query.status
    ? kind === 'transfers' ? TRANSFER_STATUSES : PAYOUT_STATUSES
    : null;
  if (req.query.status && !statusFilter.has(req.query.status)) {
    return res.status(400).json({ error: 'Ugyldig transaksjonsstatus.' });
  }
  const recordQuery = {
    ...baseQuery,
    ...searchQuery,
    ...dateFilter('stripeCreatedAt', options.dateFrom, options.dateTo),
    ...(req.query.status
      ? { [kind === 'transfers' ? 'normalizedStatus' : 'status']: req.query.status }
      : {}),
  };

  const recordCount = await recordModel.countDocuments(recordQuery);
  const records = await recordModel.find(recordQuery)
    .sort({ stripeCreatedAt: -1, _id: -1 })
    .skip(options.skip)
    .limit(options.limit)
    .populate('providerId', 'name')
    .populate(kind === 'transfers'
      ? { path: 'payoutId', select: 'platformFee customerId', populate: { path: 'customerId', select: 'name' } }
      : { path: 'providerId', select: 'name' })
    .lean();
  let items = kind === 'transfers'
    ? records.map((row) => mapTransferRecord(row, admin))
    : records.map((row) => mapBankPayout(row, admin));
  let total = recordCount;

  if (kind === 'transfers') {
    const statuses = {
      awaiting_customer_approval: 'pending',
      release_scheduled: 'released_internal',
      transfer_processing: 'processing',
      transfer_failed: 'failed',
      reconciliation_required: 'transferred',
    };
    let localStatus;
    if (req.query.status) localStatus = statuses[req.query.status];
    const attemptQuery = {
      ...(options.providerId ? { providerId: options.providerId } : {}),
      ...(options.orderId ? { orderId: options.orderId } : {}),
      ...(livemode === null ? {} : { stripeLivemode: livemode }),
      ...(localStatus ? { status: localStatus } : { status: { $in: ['pending', 'released_internal', 'processing', 'failed', 'transferred'] } }),
      ...dateFilter('createdAt', options.dateFrom, options.dateTo),
      ...(options.search
        ? { $or: [
            { stripeTransferId: options.search },
            ...(mongoose.Types.ObjectId.isValid(options.search)
              ? [{ orderId: options.search }]
              : []),
          ] }
        : {}),
    };
    const attempts = await Payout.find(attemptQuery)
      .sort({ createdAt: -1, _id: -1 })
      .skip(options.skip)
      .limit(options.limit)
      .populate('providerId', 'name')
      .populate(admin ? { path: 'customerId', select: 'name' } : { path: 'customerId', select: '_id' })
      .lean();
    const recordPayoutIds = new Set(records.map((row) => String(row.payoutId || '')));
    const localAttempts = attempts
      .filter((row) => !recordPayoutIds.has(String(row._id)))
      .map((row) => mapLocalTransferAttempt(row, admin));
    total += await Payout.countDocuments(attemptQuery) -
      await Payout.countDocuments({ ...attemptQuery, _id: { $in: records.map((row) => row.payoutId).filter(Boolean) } });
    items = [...items, ...localAttempts]
      .sort((a, b) => new Date(b.stripeCreatedAt || 0) - new Date(a.stripeCreatedAt || 0))
      .slice(0, options.limit);
  }

  const latestSync = await StripeFinancialSyncState.find({
    ...(options.providerId
      ? { stripeAccountId: await User.findById(options.providerId).select(
          modeField(config.testMode)
        ).then((user) => user?.[modeField(config.testMode)] || '__unconfigured__') }
      : {}),
    objectType: kind === 'transfers' ? 'transfers' : 'bank_payouts',
    ...(livemode === null ? {} : { livemode }),
  }).sort({ lastSucceededAt: -1 }).select('lastSucceededAt').limit(1).lean();

  return res.json({
    items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
      hasNextPage: options.page * options.limit < total,
      hasPreviousPage: options.page > 1,
    },
    mode,
    ...(admin ? { activeMode: config.mode } : {}),
    testDataNotice: mode === 'test' || (mode === 'all' && items.some((item) => item.mode === 'test'))
      ? 'Testdata er ikke ekte bankbevegelser.'
      : null,
    lastSyncedAt: latestSync[0]?.lastSucceededAt || null,
  });
}

exports.getTransfers = (req, res) => paginated(req, res, { admin: false, kind: 'transfers' });
exports.getAdminTransfers = (req, res) => paginated(req, res, { admin: true, kind: 'transfers' });
exports.getBankPayouts = (req, res) => paginated(req, res, { admin: false, kind: 'bank_payouts' });
exports.getAdminBankPayouts = (req, res) => paginated(req, res, { admin: true, kind: 'bank_payouts' });

async function getOne(req, res, { admin, kind }) {
  try {
    const Model = kind === 'transfers' ? StripeTransferRecord : StripeBankPayoutRecord;
    const query = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { $or: [{ _id: req.params.id }, { stripeObjectId: req.params.id }] }
      : { stripeObjectId: req.params.id };
    if (!admin) query.providerId = req.userId;
    let record = await Model.findOne(query)
      .populate('providerId', 'name')
      .populate(kind === 'transfers'
        ? { path: 'payoutId', select: 'customerId orderId', populate: { path: 'customerId', select: 'name' } }
        : { path: 'providerId', select: 'name' })
      .lean();
    if (!record && kind === 'transfers') {
      const payoutQuery = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { stripeTransferId: req.params.id };
      if (!admin) payoutQuery.providerId = req.userId;
      record = await Payout.findOne(payoutQuery)
        .populate('providerId', 'name')
        .populate(admin ? { path: 'customerId', select: 'name' } : { path: 'customerId', select: '_id' })
        .lean();
      if (record) return res.json(mapLocalTransferAttempt(record, admin));
    }
    if (!record) return res.status(404).json({ error: 'Transaksjonen ble ikke funnet.' });
    return res.json(kind === 'transfers'
      ? mapTransferRecord(record, admin)
      : mapBankPayout(record, admin));
  } catch (err) {
    console.error('SafePay finance detail failed:', err.code || err.name || 'Error');
    return res.status(503).json({ error: 'Kunne ikke hente transaksjonsdetaljene.' });
  }
}

exports.getTransfer = (req, res) => getOne(req, res, { admin: false, kind: 'transfers' });
exports.getAdminTransfer = (req, res) => getOne(req, res, { admin: true, kind: 'transfers' });
exports.getBankPayout = (req, res) => getOne(req, res, { admin: false, kind: 'bank_payouts' });
exports.getAdminBankPayout = (req, res) => getOne(req, res, { admin: true, kind: 'bank_payouts' });

exports.getSummary = async (req, res) => {
  try {
    const config = await getStripeConfiguration();
    const providerId = req.userId;
    const [transfers, bankPayouts] = await Promise.all([
      StripeTransferRecord.aggregate([
        { $match: { providerId: new mongoose.Types.ObjectId(providerId), livemode: !config.testMode } },
        { $group: { _id: { currency: '$currency', status: '$normalizedStatus' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      StripeBankPayoutRecord.aggregate([
        { $match: { providerId: new mongoose.Types.ObjectId(providerId), livemode: !config.testMode } },
        { $group: { _id: { currency: '$currency', status: '$status' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);
    res.json({ mode: config.mode, transfers, bankPayouts });
  } catch (err) {
    console.error('SafePay finance summary failed:', err.code || err.name || 'Error');
    res.status(503).json({ error: 'Kunne ikke hente økonomioversikten.' });
  }
};

exports.getAdminSummary = async (req, res) => {
  try {
    const mode = req.query.mode || 'all';
    if (!['all', 'test', 'live'].includes(mode)) {
      return res.status(400).json({ error: 'Ugyldig Stripe-modus.' });
    }
    const match = mode === 'all' ? {} : { livemode: mode === 'live' };
    const [transfers, bankPayouts] = await Promise.all([
      StripeTransferRecord.aggregate([
        { $match: match },
        { $group: { _id: { mode: '$livemode', currency: '$currency', status: '$normalizedStatus' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      StripeBankPayoutRecord.aggregate([
        { $match: match },
        { $group: { _id: { mode: '$livemode', currency: '$currency', status: '$status' }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);
    res.json({ mode, transfers, bankPayouts });
  } catch (err) {
    console.error('Admin SafePay finance summary failed:', err.code || err.name || 'Error');
    res.status(503).json({ error: 'Kunne ikke hente økonomioversikten.' });
  }
};

exports.reconcile = async (req, res) => {
  try {
    const mode = req.body.mode;
    if (!['test', 'live'].includes(mode)) {
      return res.status(400).json({ error: 'Velg test eller live-modus for avstemming.' });
    }
    if (req.body.providerId && !mongoose.Types.ObjectId.isValid(req.body.providerId)) {
      return res.status(400).json({ error: 'Ugyldig providerId.' });
    }
    const limit = Number(req.body.limit || 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return res.status(400).json({ error: 'Avstemming kan omfatte 1 til 20 kontoer per forespørsel.' });
    }
    if (req.body.cursorProviderId && !mongoose.Types.ObjectId.isValid(req.body.cursorProviderId)) {
      return res.status(400).json({ error: 'Ugyldig avstemmingsmarkør.' });
    }
    if (req.body.providerId && req.body.cursorProviderId) {
      return res.status(400).json({ error: 'Velg enten én provider eller en avstemmingsmarkør.' });
    }
    const testMode = mode === 'test';
    const stripe = await getStripeForMode(testMode);
    const field = modeField(!testMode);
    const query = {
      [field]: { $exists: true, $ne: null },
      ...(req.body.providerId ? { _id: req.body.providerId } : {}),
      ...(req.body.cursorProviderId
        ? { _id: { $gt: req.body.cursorProviderId } }
        : {}),
    };
    const providers = await User.find(query)
      .select('_id name stripeConnectAccountId stripeConnectAccountIdTest')
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
    await logActivity({
      adminId: req.userId,
      action: 'other',
      description: `Requested read-only Stripe financial history reconciliation (${mode})`,
      metadata: {
        mode,
        providerId: req.body.providerId || null,
        providerBatchLimit: limit,
        cursorProviderId: req.body.cursorProviderId || null,
      },
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    const results = [];
    for (const provider of providers) {
      const accountId = provider[field];
      try {
        const account = await stripe.accounts.retrieve(accountId);
        const ownerId = account.metadata?.jobbloUserId;
        if (ownerId && ownerId !== String(provider._id)) {
          throw new Error('connected_account_owner_mismatch');
        }
        const [transferSync, payoutSync] = await Promise.all([
          syncTransfersPage(stripe, { id: accountId }, !testMode, req.userId),
          syncBankPayoutsPage(stripe, { id: accountId }, !testMode, req.userId),
        ]);
        results.push({ providerId: String(provider._id), status: 'ok', transferSync, payoutSync });
      } catch (err) {
        results.push({
          providerId: String(provider._id),
          status: 'failed',
          errorCode: err.code || err.type || 'stripe_sync_failed',
        });
      }
    }
    res.json({
      mode,
      requestedBy: String(req.userId),
      synchronizedAccounts: results.length,
      nextCursorProviderId: providers.length === limit ? String(providers[providers.length - 1]._id) : null,
      results,
    });
  } catch (err) {
    console.error('SafePay finance reconciliation failed:', err.code || err.name || 'Error');
    res.status(503).json({ error: 'Avstemming er midlertidig utilgjengelig.' });
  }
};

exports.getReconciliationIssues = async (_req, res) => {
  try {
    const [failedSyncs, failedTransfers, staleTransfers] = await Promise.all([
      StripeFinancialSyncState.find({ status: 'failed' })
        .select('stripeAccountId livemode objectType lastError lastStartedAt')
        .sort({ lastStartedAt: -1 })
        .limit(100)
        .lean(),
      Payout.find({ status: 'failed' })
        .select('orderId providerId stripeConnectAccountId stripeTransferId stripeLivemode failureCode createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
      StripeTransferRecord.find({ normalizedStatus: { $in: ['partially_reversed', 'fully_reversed'] } })
        .select('stripeObjectId stripeAccountId orderId providerId livemode amount amountReversed normalizedStatus lastVerifiedAt')
        .sort({ lastVerifiedAt: -1 })
        .limit(100)
        .lean(),
    ]);
    res.json({
      failedSyncs,
      failedTransfers: failedTransfers.map((row) => ({
        orderId: row.orderId,
        providerId: row.providerId,
        stripeTransferId: row.stripeTransferId || null,
        mode: row.stripeLivemode === true ? 'live' : row.stripeLivemode === false ? 'test' : 'unknown',
        failureCode: row.failureCode || null,
        updatedAt: row.updatedAt,
      })),
      transferReversals: staleTransfers,
    });
  } catch (err) {
    console.error('SafePay reconciliation issues lookup failed:', err.code || err.name || 'Error');
    res.status(503).json({ error: 'Kunne ikke hente avstemmingsavvik.' });
  }
};
