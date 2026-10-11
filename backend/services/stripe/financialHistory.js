const mongoose = require('mongoose');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const StripeBankPayoutRecord = require('../../models/StripeBankPayoutRecord');
const StripeFinancialSyncState = require('../../models/StripeFinancialSyncState');
const Payout = require('../../models/Payout');
const User = require('../../models/User');

const PAYOUT_STATUSES = new Set(['pending', 'in_transit', 'paid', 'failed', 'canceled']);
const PAGE_SIZE = 100;
const SYNC_LEASE_MS = 5 * 60 * 1000;
const modeField = (livemode) => (livemode ? 'stripeConnectAccountId' : 'stripeConnectAccountIdTest');
const idOf = (value) => (typeof value === 'string' ? value : value?.id || null);
const dateFromUnix = (value) => (Number.isFinite(value) ? new Date(value * 1000) : null);

function transferStatus(transfer) {
  const reversed = Number(transfer.amount_reversed || 0);
  if (reversed >= Number(transfer.amount || 0) && reversed > 0) return 'fully_reversed';
  if (reversed > 0) return 'partially_reversed';
  return 'transferred';
}

function safePayoutFailure(code) {
  if (!code) return null;
  return 'Stripe rapporterte at bankutbetalingen mislyktes. Kontroller Stripe-kontoen.';
}

async function providerForAccount(accountId, livemode) {
  if (!accountId) return null;
  const provider = await User.findOne({ [modeField(livemode)]: accountId }).select('_id').lean();
  return provider?._id || null;
}

async function upsertNewest(Model, key, fields, audit, eventCreatedAt) {
  const existing = await Model.findOne(key).select('_id lastEventCreatedAt').lean();
  if (existing && eventCreatedAt && existing.lastEventCreatedAt > eventCreatedAt) {
    return Model.findById(existing._id).lean();
  }

  const filter = existing
    ? {
        _id: existing._id,
        $or: [
          { lastEventCreatedAt: { $exists: false } },
          { lastEventCreatedAt: null },
          { lastEventCreatedAt: { $lte: eventCreatedAt || new Date() } },
        ],
      }
    : key;
  const update = {
    $set: fields,
    $setOnInsert: key,
  };
  if (audit) update.$addToSet = { audit };

  try {
    const result = await Model.findOneAndUpdate(filter, update, {
      upsert: !existing,
      new: true,
      runValidators: true,
    });
    if (result) return result.toObject ? result.toObject() : result;
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  return Model.findOne(key).lean();
}

async function recordStripeTransfer(transfer, { livemode, event, source = 'webhook' }) {
  const transferId = idOf(transfer);
  const destination = idOf(transfer.destination);
  if (!transferId || !destination || typeof livemode !== 'boolean') {
    throw new Error('Stripe transfer is missing required identity or mode fields');
  }

  let payout = await Payout.findOne({ stripeTransferId: transferId }).lean();
  if (!payout && mongoose.Types.ObjectId.isValid(transfer.metadata?.payoutId)) {
    payout = await Payout.findById(transfer.metadata.payoutId).lean();
  }
  if (payout && payout.stripeConnectAccountId !== destination) {
    throw new Error('Stripe transfer destination does not match the local payout account');
  }
  if (payout?.stripeLivemode !== null && payout?.stripeLivemode !== undefined &&
      payout.stripeLivemode !== livemode) {
    throw new Error('Stripe transfer mode does not match the local payout mode');
  }
  const providerId = payout?.providerId || await providerForAccount(destination, livemode);
  const orderId = payout?.orderId ||
    (mongoose.Types.ObjectId.isValid(transfer.metadata?.orderId)
      ? transfer.metadata.orderId
      : undefined);
  const eventCreatedAt = event ? dateFromUnix(event.created) : null;
  const normalizedStatus = transferStatus(transfer);
  const key = { stripeObjectId: transferId, stripeAccountId: destination, livemode };
  const fields = {
    payoutId: payout?._id,
    orderId,
    providerId,
    amount: Number(transfer.amount),
    amountReversed: Number(transfer.amount_reversed || 0),
    currency: String(transfer.currency || '').toUpperCase(),
    destinationPaymentId: idOf(transfer.destination_payment),
    sourceTransactionId: idOf(transfer.source_transaction),
    balanceTransactionId: idOf(transfer.balance_transaction),
    reversed: Boolean(transfer.reversed),
    normalizedStatus,
    stripeCreatedAt: dateFromUnix(transfer.created),
    lastVerifiedAt: new Date(),
    lastEventCreatedAt: eventCreatedAt || undefined,
    lastSyncError: null,
    source,
  };
  return upsertNewest(
    StripeTransferRecord,
    key,
    fields,
    event
      ? {
          eventId: event.id,
          eventType: event.type,
          eventCreatedAt,
          normalizedStatus,
          recordedAt: new Date(),
        }
      : undefined,
    eventCreatedAt
  );
}

async function recordStripeBankPayout(payout, { stripeAccountId, livemode, event, source = 'webhook' }) {
  const payoutId = idOf(payout);
  if (!payoutId || !stripeAccountId || typeof livemode !== 'boolean') {
    throw new Error('Stripe bank payout is missing account, identity, or mode fields');
  }
  if (!PAYOUT_STATUSES.has(payout.status)) {
    throw new Error('Stripe bank payout contains an unsupported status');
  }

  const providerId = await providerForAccount(stripeAccountId, livemode);
  const destination = typeof payout.destination === 'object' ? payout.destination : null;
  const eventCreatedAt = event ? dateFromUnix(event.created) : null;
  const key = { stripeObjectId: payoutId, stripeAccountId, livemode };
  const fields = {
    providerId,
    amount: Number(payout.amount),
    currency: String(payout.currency || '').toUpperCase(),
    status: payout.status,
    arrivalDate: dateFromUnix(payout.arrival_date),
    payoutType: payout.type === 'manual' ? 'manual' : payout.type === 'automatic' ? 'automatic' : undefined,
    destinationLast4: /^\d{4}$/.test(destination?.last4 || '') ? destination.last4 : undefined,
    destinationBankName: destination?.bank_name || undefined,
    failureCode: payout.failure_code || undefined,
    failureMessage: safePayoutFailure(payout.failure_code),
    stripeCreatedAt: dateFromUnix(payout.created),
    lastVerifiedAt: new Date(),
    lastEventCreatedAt: eventCreatedAt || undefined,
    lastSyncError: null,
    source,
  };
  return upsertNewest(
    StripeBankPayoutRecord,
    key,
    fields,
    event
      ? {
          eventId: event.id,
          eventType: event.type,
          eventCreatedAt,
          status: payout.status,
          recordedAt: new Date(),
        }
      : undefined,
    eventCreatedAt
  );
}

async function claimSyncState({ stripeAccountId, livemode, objectType, requestedBy }) {
  const key = `${livemode ? 'live' : 'test'}:${stripeAccountId}:${objectType}`;
  const now = new Date();
  try {
    const state = await StripeFinancialSyncState.findOneAndUpdate(
      {
        key,
        $or: [
          { status: { $ne: 'running' } },
          { leaseUntil: { $lte: now } },
          { leaseUntil: { $exists: false } },
        ],
      },
      {
        $set: {
          key,
          stripeAccountId,
          livemode,
          objectType,
          status: 'running',
          leaseUntil: new Date(now.getTime() + SYNC_LEASE_MS),
          lastStartedAt: now,
          requestedBy: requestedBy || null,
          lastError: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return state;
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

async function finishSyncState(state, { cursor, hasMore, error }) {
  const update = {
    status: error ? 'failed' : 'idle',
    leaseUntil: null,
    lastError: error || null,
  };
  if (cursor !== undefined) update.cursor = cursor;
  if (hasMore !== undefined) update.hasMore = hasMore;
  if (!error) update.lastSucceededAt = new Date();
  await StripeFinancialSyncState.updateOne({ _id: state._id }, { $set: update });
}

async function syncTransfersPage(stripe, account, livemode, requestedBy) {
  const state = await claimSyncState({
    stripeAccountId: account.id,
    livemode,
    objectType: 'transfers',
    requestedBy,
  });
  if (!state) return { skipped: true, reason: 'sync_in_progress' };
  try {
    const params = { destination: account.id, limit: PAGE_SIZE };
    if (state.cursor) params.starting_after = state.cursor;
    const page = await stripe.transfers.list(params);
    for (const transfer of page.data || []) {
      if (transfer.livemode !== livemode) throw new Error('Stripe transfer mode mismatch');
      await recordStripeTransfer(transfer, { livemode, source: 'reconciliation' });
    }
    const cursor = page.has_more ? page.data?.[page.data.length - 1]?.id || state.cursor : null;
    await finishSyncState(state, { cursor, hasMore: Boolean(page.has_more) });
    return { synchronized: page.data?.length || 0, hasMore: Boolean(page.has_more), cursor };
  } catch (err) {
    await finishSyncState(state, { error: err.code || err.type || 'stripe_sync_failed' });
    throw err;
  }
}

async function syncBankPayoutsPage(stripe, account, livemode, requestedBy) {
  const state = await claimSyncState({
    stripeAccountId: account.id,
    livemode,
    objectType: 'bank_payouts',
    requestedBy,
  });
  if (!state) return { skipped: true, reason: 'sync_in_progress' };
  try {
    const params = { limit: PAGE_SIZE, expand: ['data.destination'] };
    if (state.cursor) params.starting_after = state.cursor;
    const page = await stripe.payouts.list(params, { stripeAccount: account.id });
    for (const payout of page.data || []) {
      if (payout.livemode !== livemode) throw new Error('Stripe bank payout mode mismatch');
      await recordStripeBankPayout(payout, {
        stripeAccountId: account.id,
        livemode,
        source: 'reconciliation',
      });
    }
    const cursor = page.has_more ? page.data?.[page.data.length - 1]?.id || state.cursor : null;
    await finishSyncState(state, { cursor, hasMore: Boolean(page.has_more) });
    return { synchronized: page.data?.length || 0, hasMore: Boolean(page.has_more), cursor };
  } catch (err) {
    await finishSyncState(state, { error: err.code || err.type || 'stripe_sync_failed' });
    throw err;
  }
}

async function reconcileConnectedAccountsBatch(stripe, livemode, { limit = 10 } = {}) {
  const schedulerKey = `scheduler_accounts:${livemode ? 'live' : 'test'}`;
  let schedulerState = await StripeFinancialSyncState.findOne({ key: schedulerKey }).lean();
  let query = { [modeField(livemode)]: { $exists: true, $ne: null } };
  if (schedulerState?.cursor && mongoose.Types.ObjectId.isValid(schedulerState.cursor)) {
    query._id = { $gt: schedulerState.cursor };
  }
  let providers = await User.find(query)
    .select('_id stripeConnectAccountId stripeConnectAccountIdTest')
    .sort({ _id: 1 })
    .limit(limit)
    .lean();
  if (!providers.length && schedulerState?.cursor) {
    await StripeFinancialSyncState.updateOne(
      { key: schedulerKey },
      { $set: { cursor: null, status: 'idle', hasMore: true } }
    );
    providers = await User.find({ [modeField(livemode)]: { $exists: true, $ne: null } })
      .select('_id stripeConnectAccountId stripeConnectAccountIdTest')
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
  }

  const results = [];
  for (const provider of providers) {
    const accountId = provider[modeField(livemode)];
    try {
      const [transfers, bankPayouts] = await Promise.all([
        syncTransfersPage(stripe, { id: accountId }, livemode),
        syncBankPayoutsPage(stripe, { id: accountId }, livemode),
      ]);
      results.push({ providerId: String(provider._id), status: 'ok', transfers, bankPayouts });
    } catch (err) {
      results.push({
        providerId: String(provider._id),
        status: 'failed',
        errorCode: err.code || err.type || 'stripe_sync_failed',
      });
    }
  }

  const nextCursor = providers.length === limit
    ? String(providers[providers.length - 1]._id)
    : null;
  await StripeFinancialSyncState.findOneAndUpdate(
    { key: schedulerKey },
    {
      $set: {
        key: schedulerKey,
        stripeAccountId: '__scheduler__',
        livemode,
        objectType: 'transfers',
        cursor: nextCursor,
        hasMore: Boolean(nextCursor),
        status: results.some((result) => result.status === 'failed') ? 'failed' : 'idle',
        lastStartedAt: new Date(),
        lastSucceededAt: results.every((result) => result.status === 'ok') ? new Date() : undefined,
        lastError: results.find((result) => result.status === 'failed')?.errorCode || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return {
    synchronizedAccounts: results.filter((result) => result.status === 'ok').length,
    failedAccounts: results.filter((result) => result.status === 'failed').length,
    nextCursor,
  };
}

module.exports = {
  recordStripeTransfer,
  recordStripeBankPayout,
  syncTransfersPage,
  syncBankPayoutsPage,
  reconcileConnectedAccountsBatch,
  PAYOUT_STATUSES,
  modeField,
};
