const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');
const Dispute = require('../../models/Dispute');
const User = require('../../models/User');
const Service = require('../../models/Service');
const Chat = require('../../models/ChatMessage');
const JobRequest = require('../../models/JobRequest');
const SafePayHistory = require('../../models/SafePayHistory');
const { getStripeForMode } = require('../../config/stripe');
const { executeRefund } = require('../stripe/financialOperations');
const { notify } = require('../notifications');
const { logApplicationError } = require('../../utils/errorLogger');

const CANCEL_REASON = 'provider_stripe_connect_timeout';
const RETRY_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const ACTIVE_DISPUTE_STATUSES = [
  'open',
  'under_review',
  'waiting_for_customer',
  'waiting_for_provider',
  'evidence_submitted',
];

function idOf(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function reviewRequired(message, code = 'SAFE_PAY_TIMEOUT_MANUAL_REVIEW') {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function verifyCapturedPayment(stripe, order, payment) {
  const testMode = payment.stripeLivemode === false;
  if (
    typeof payment.stripeLivemode !== 'boolean' ||
    order.checkoutMode !== (testMode ? 'test' : 'live') ||
    !order.checkoutSessionId ||
    payment.stripeSessionId !== order.checkoutSessionId ||
    !order.checkoutCustomerId ||
    !order.paymentIntentId ||
    payment.stripePaymentIntentId !== order.paymentIntentId ||
    !Number.isSafeInteger(order.checkoutAmountMinor) ||
    order.checkoutAmountMinor <= 0
  ) {
    throw reviewRequired('Payment references or Stripe mode do not match the order.');
  }

  const session = await stripe.checkout.sessions.retrieve(order.checkoutSessionId);
  const intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
  const chargeId = idOf(intent.latest_charge);
  if (!chargeId) throw reviewRequired('The captured payment has no verifiable charge.');
  const charge = await stripe.charges.retrieve(chargeId);
  const expectedLivemode = !testMode;
  if (
    session.id !== order.checkoutSessionId ||
    session.mode !== 'payment' ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid' ||
    session.livemode !== expectedLivemode ||
    idOf(session.payment_intent) !== order.paymentIntentId ||
    idOf(session.customer) !== order.checkoutCustomerId ||
    String(session.metadata?.orderId) !== String(order._id) ||
    String(session.metadata?.userId) !== String(order.customerId) ||
    session.amount_total !== order.checkoutAmountMinor ||
    String(session.currency || '').toLowerCase() !== String(order.checkoutCurrency || 'nok').toLowerCase() ||
    intent.id !== order.paymentIntentId ||
    intent.livemode !== expectedLivemode ||
    intent.status !== 'succeeded' ||
    intent.amount !== order.checkoutAmountMinor ||
    intent.amount_received !== order.checkoutAmountMinor ||
    idOf(intent.customer) !== order.checkoutCustomerId ||
    intent.currency !== session.currency ||
    charge.id !== chargeId ||
    charge.livemode !== expectedLivemode ||
    charge.paid !== true ||
    charge.captured !== true ||
    charge.amount !== order.checkoutAmountMinor ||
    idOf(charge.payment_intent) !== order.paymentIntentId ||
    idOf(charge.customer) !== order.checkoutCustomerId ||
    charge.currency !== session.currency ||
    charge.disputed === true
  ) {
    throw reviewRequired('Stripe payment could not be verified against the captured SafePay order.');
  }
  return { session, intent, charge, chargeId, stripeMode: testMode ? 'test' : 'live' };
}

async function providerIsPayoutReady(stripe, providerId, testMode) {
  const provider = await User.findById(providerId).select(
    'stripeConnectAccountId stripeConnectAccountIdTest'
  );
  if (!provider) throw reviewRequired('Assigned provider account was not found.');
  const accountId = testMode
    ? provider.stripeConnectAccountIdTest
    : provider.stripeConnectAccountId;
  if (!accountId) return false;

  const account = await stripe.accounts.retrieve(accountId);
  if (
    account.id !== accountId ||
    (account.metadata?.jobbloUserId &&
      account.metadata.jobbloUserId !== String(providerId))
  ) {
    throw reviewRequired('Connected Stripe account does not match the assigned provider.');
  }
  return (
    account.payouts_enabled === true &&
    account.details_submitted === true &&
    account.capabilities?.transfers === 'active'
  );
}

async function setTimeoutState(orderId, operationKey, status, fields = {}) {
  const activeStates = ['processing', 'pending', 'reconciliation_required'];
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      'providerConnectTimeout.operationKey': operationKey,
      'providerConnectTimeout.status': {
        $in: activeStates,
      },
    },
    {
      $set: {
        'providerConnectTimeout.status': status,
        'providerConnectTimeout.lockUntil': null,
        ...fields,
      },
    },
    { new: true }
  );
}

async function updateRefundRecords(order, payment, operation, refund, status) {
  const amountMinor = operation.amount;
  const shared = {
    refundAmountMinor: amountMinor,
    refundedAmountMinor: status === 'succeeded' ? amountMinor : 0,
    stripeRefundId: refund?.id || operation.stripeObjectId || undefined,
    refundStatus: status,
  };
  await Payment.updateOne(
    { _id: payment._id, stripePaymentIntentId: payment.stripePaymentIntentId },
    {
      $set: {
        ...shared,
        ...(status === 'succeeded' ? { status: 'refunded', refundCompletedAt: new Date() } : {}),
        ...(status === 'pending' ? { refundStartedAt: operation.attemptedAt || new Date() } : {}),
        ...(status === 'failed' ? { refundFailedAt: new Date() } : {}),
      },
    }
  );

  const historyStatus =
    status === 'succeeded'
      ? 'automatically_cancelled'
      : status === 'failed'
        ? 'refund_failed'
        : 'refund_pending';
  await SafePayHistory.updateOne(
    { orderId: order._id },
    {
      $set: {
        ...shared,
        status: historyStatus,
        refundReason: CANCEL_REASON,
        cancellationReason: CANCEL_REASON,
        ...(status === 'succeeded' ? { refundCompletedAt: new Date() } : {}),
        ...(status === 'failed' ? { refundFailedAt: new Date() } : {}),
      },
    }
  );
}

async function cancelTimeoutOrder(order, operationKey) {
  const now = new Date();
  const cancelled = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: 'paid',
      paymentStatus: 'paid',
      'providerConnectTimeout.operationKey': operationKey,
      'providerConnectTimeout.status': {
        $in: ['processing', 'pending', 'reconciliation_required', 'failed'],
      },
    },
    {
      $set: {
        status: 'cancelled',
        cancellationReason: CANCEL_REASON,
        'providerConnectTimeout.autoCancelledAt': now,
      },
      $push: {
        history: {
          action: 'provider_connect_timeout_refund_started',
          userId: null,
          timestamp: now,
          data: { reason: CANCEL_REASON },
        },
      },
    },
    { new: true }
  );
  if (!cancelled) return false;

  await Service.findByIdAndUpdate(order.serviceId, { status: 'cancelled' });
  if (order.chatId) {
    await Chat.findByIdAndUpdate(order.chatId, {
      status: 'cancelled',
      $push: {
        messages: {
          type: 'system_status',
          systemData: { event: 'provider_connect_timeout_refund_started', orderId: order._id },
          text: 'Oppdraget er automatisk kansellert fordi det ikke ble startet innen fristen. Se SafePay-historikken for refusjonsstatus.',
          createdAt: now,
        },
      },
    });
  }
  await JobRequest.updateMany(
    {
      serviceId: order.serviceId,
      status: { $in: ['pending', 'accepted'] },
    },
    { $set: { status: 'declined' } }
  );
  return true;
}

async function completeTimeoutRefund(order, payment, operation, refund) {
  const now = new Date();
  const finalized = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $in: ['paid', 'cancelled'] },
      $and: [
        {
          $or: [
            { status: 'paid' },
            { status: 'cancelled', cancellationReason: CANCEL_REASON },
          ],
        },
      ],
      paymentStatus: 'paid',
      paymentIntentId: payment.stripePaymentIntentId,
      'providerConnectTimeout.operationKey': operation.operationKey,
      'providerConnectTimeout.status': {
        $in: ['processing', 'pending', 'reconciliation_required', 'failed'],
      },
    },
    {
      $set: {
        status: 'cancelled',
        paymentStatus: 'refunded',
        cancellationReason: CANCEL_REASON,
        'providerConnectTimeout.status': 'succeeded',
        'providerConnectTimeout.stripeRefundId': refund.id,
        'providerConnectTimeout.refundAmountMinor': operation.amount,
        'providerConnectTimeout.refundedAmountMinor': operation.amount,
        'providerConnectTimeout.refundCompletedAt': now,
        ...(order.status === 'paid'
          ? { 'providerConnectTimeout.autoCancelledAt': now }
          : {}),
        'providerConnectTimeout.lockUntil': null,
      },
      $push: {
        history: {
          action: 'provider_connect_timeout_refunded',
          userId: null,
          timestamp: now,
          data: {
            reason: CANCEL_REASON,
            originalPaymentAmountMinor: order.checkoutAmountMinor,
            refundedAmountMinor: operation.amount,
            paymentIntentId: payment.stripePaymentIntentId,
            refundId: refund.id,
          },
        },
      },
    },
    { new: true }
  );
  if (!finalized) {
    // The scheduler and the refund webhook both finalize; the second one finds it done.
    const current = await Order.findById(order._id).select('providerConnectTimeout').lean();
    if (
      current?.providerConnectTimeout?.status === 'succeeded' &&
      current.providerConnectTimeout.stripeRefundId === refund.id
    ) {
      return false;
    }
    const reason = 'Stripe confirmed the refund, but the order changed state before the refund could be finalized.';
    await setTimeoutState(order._id, operation.operationKey, 'manual_review', {
      'providerConnectTimeout.manualReviewReason': reason,
      'providerConnectTimeout.stripeRefundId': refund.id,
      'providerConnectTimeout.refundAmountMinor': operation.amount,
    });
    await logApplicationError({
      error: new Error(reason),
      requestPath: 'scheduler/providerConnectTimeout',
      httpMethod: 'POST',
      httpStatus: 409,
      errorCode: 'SAFEPAY_CONNECT_TIMEOUT_FINALIZATION_CONFLICT',
      source: 'scheduler',
      metadata: { orderId: String(order._id), operationKey: operation.operationKey },
    });
    return false;
  }

  await updateRefundRecords(order, payment, operation, refund, 'succeeded');
  await Service.findByIdAndUpdate(order.serviceId, { status: 'cancelled' });
  if (order.chatId) {
    await Chat.findByIdAndUpdate(order.chatId, {
      status: 'cancelled',
      $push: {
        messages: {
          type: 'system_status',
          systemData: { event: 'provider_connect_timeout_refunded', orderId: order._id },
          text: 'Oppdraget ble automatisk kansellert fordi det ikke ble startet innen fristen. Full refusjon er registrert.',
          createdAt: now,
        },
      },
    });
  }
  await JobRequest.updateMany(
    {
      serviceId: order.serviceId,
      status: { $in: ['pending', 'accepted'] },
    },
    { $set: { status: 'declined' } }
  );
  await Promise.all([
    notify({
      userId: order.customerId,
      type: 'payment',
      content: 'Oppdraget ble kansellert fordi utføreren ikke startet oppdraget innen fristen. Full refusjon er bekreftet hos Stripe. Det kan ta noen virkedager før pengene vises på kontoen din.',
      orderId: order._id,
      event: 'provider_connect_timeout_refunded',
      payload: { orderId: String(order._id), refundId: refund.id },
    }),
    notify({
      userId: order.providerId,
      type: 'order',
      content: 'Oppdraget ble automatisk kansellert fordi det ikke ble startet innen fristen. Kundens full refusjon er bekreftet hos Stripe.',
      orderId: order._id,
      event: 'provider_connect_timeout_refunded',
      payload: { orderId: String(order._id), refundId: refund.id },
    }),
  ]);
  return true;
}

async function markManualReview(order, operationKey, reason) {
  const updated = await setTimeoutState(order._id, operationKey, 'manual_review', {
    'providerConnectTimeout.manualReviewReason': reason,
    'providerConnectTimeout.reason': CANCEL_REASON,
  });
  if (updated) {
    await logApplicationError({
      error: new Error(reason),
      requestPath: 'scheduler/providerConnectTimeout',
      httpMethod: 'POST',
      httpStatus: 409,
      errorCode: 'SAFEPAY_CONNECT_TIMEOUT_MANUAL_REVIEW',
      source: 'scheduler',
      metadata: { orderId: String(order._id), operationKey },
    });
  }
}

async function processOrder(candidate, now) {
  const payment = await Payment.findOne({ orderId: candidate._id });
  const operationKey = `safepay-connect-timeout:${candidate._id}:${candidate.paymentIntentId || 'missing'}`;
  const claim = await Order.findOneAndUpdate(
    {
      _id: candidate._id,
      status: { $in: ['paid', 'cancelled'] },
      paymentStatus: 'paid',
      startedAt: null,
      providerConnectDeadlineAt: { $lte: now },
      $and: [
        {
          $or: [
            { status: 'paid' },
            { status: 'cancelled', cancellationReason: CANCEL_REASON },
          ],
        },
      ],
      $or: [
        { 'providerConnectTimeout.status': { $in: [null, 'provider_ready'] } },
        {
          'providerConnectTimeout.status': {
            $in: ['processing', 'pending', 'reconciliation_required'],
          },
          'providerConnectTimeout.lockUntil': { $lte: now },
        },
      ],
    },
    {
      $set: {
        'providerConnectTimeout.status': 'processing',
        'providerConnectTimeout.operationKey': operationKey,
        'providerConnectTimeout.originalPaymentAmountMinor': candidate.checkoutAmountMinor,
        'providerConnectTimeout.lastAttemptAt': now,
        'providerConnectTimeout.lockUntil': new Date(now.getTime() + LOCK_MS),
      },
    },
    { new: true }
  );
  if (!claim) return 'skipped';

  try {
    if (!payment || payment.status !== 'completed') {
      throw reviewRequired('Captured SafePay Payment record is missing or not completed.');
    }
    const activeDispute = await Dispute.findOne({
      orderId: candidate._id,
      status: { $in: ACTIVE_DISPUTE_STATUSES },
    });
    if (activeDispute) throw reviewRequired('An active dispute requires manual review.');

    const stripeMode = payment.stripeLivemode === true ? 'live' : 'test';
    const stripe = await getStripeForMode(payment.stripeLivemode === false);
    const verified = await verifyCapturedPayment(stripe, candidate, payment);
    if (verified.stripeMode !== stripeMode) {
      throw reviewRequired('Payment environment could not be verified.');
    }

    const [payout, transfer, otherOperation, service] = await Promise.all([
      Payout.findOne({ orderId: candidate._id }),
      StripeTransferRecord.findOne({
        orderId: candidate._id,
        livemode: payment.stripeLivemode,
      }),
      StripeFinancialOperation.findOne({
        orderId: candidate._id,
        operationKey: { $ne: operationKey },
      }),
      Service.findById(candidate.serviceId).select('status'),
    ]);
    if (payout || transfer || otherOperation) {
      throw reviewRequired('A payout, transfer, or other financial operation already exists.');
    }
    if (!service || ['in_progress', 'completed'].includes(service.status)) {
      throw reviewRequired('Work may have started or the service is no longer eligible for automatic cancellation.');
    }

    // The refund depends only on whether the job was started by the deadline, not on the
    // provider's Stripe Connect status: a connected provider who never starts is refunded too.
    const paymentIntentId = payment.stripePaymentIntentId;
    const { operation, refund, status } = await executeRefund(stripe, {
      operationKey,
      orderId: candidate._id,
      paymentId: payment._id,
      stripeMode,
      paymentIntentId,
      chargeId: verified.chargeId,
      amount: verified.session.amount_total,
      currency: verified.session.currency,
    });

    if (status === 'succeeded') {
      const completed = await completeTimeoutRefund(candidate, payment, operation, refund);
      return completed ? 'refunded' : 'manual_review';
    }

    if (status === 'failed') {
      const updated = await setTimeoutState(candidate._id, operationKey, 'failed', {
        'providerConnectTimeout.lastErrorCode': 'stripe_refund_failed',
        'providerConnectTimeout.refundAmountMinor': operation.amount,
        'providerConnectTimeout.refundFailedAt': new Date(),
      });
      if (!updated) return 'skipped';
      await updateRefundRecords(candidate, payment, operation, refund, 'failed');
      const cancelled = await cancelTimeoutOrder(candidate, operationKey);
      if (cancelled) {
        await Promise.all([
          notify({
            userId: candidate.customerId,
            type: 'payment',
            content: 'Oppdraget er kansellert, men refusjonen kunne ikke fullføres automatisk. Saken er sendt til manuell behandling; betalingen er ikke markert som refundert.',
            orderId: candidate._id,
            event: 'provider_connect_refund_failed',
            payload: { orderId: String(candidate._id) },
          }),
          notify({
            userId: candidate.providerId,
            type: 'order',
            content: 'Oppdraget er automatisk kansellert fordi det ikke ble startet innen fristen. Refusjonen krever manuell behandling.',
            orderId: candidate._id,
            event: 'provider_connect_refund_failed',
            payload: { orderId: String(candidate._id) },
          }),
        ]);
      }
      return 'failed';
    }

    const updated = await setTimeoutState(candidate._id, operationKey, status, {
      'providerConnectTimeout.lastErrorCode': null,
      'providerConnectTimeout.refundAmountMinor': operation.amount,
      'providerConnectTimeout.lockUntil': new Date(Date.now() + RETRY_MS),
    });
    if (!updated) return 'skipped';
    await updateRefundRecords(candidate, payment, operation, refund, 'pending');
    const cancelled = await cancelTimeoutOrder(candidate, operationKey);
    if (cancelled) {
      await Promise.all([
        notify({
          userId: candidate.customerId,
          type: 'payment',
          content: 'Oppdraget er kansellert, og refusjonen behandles av Stripe. Det kan ta noen virkedager før pengene vises på kontoen din.',
          orderId: candidate._id,
          event: 'provider_connect_refund_pending',
          payload: { orderId: String(candidate._id) },
        }),
        notify({
          userId: candidate.providerId,
          type: 'order',
          content: 'Oppdraget er kansellert fordi det ikke ble startet innen fristen, og venter på at Stripe bekrefter refusjonen.',
          orderId: candidate._id,
          event: 'provider_connect_refund_pending',
          payload: { orderId: String(candidate._id) },
        }),
      ]);
    }
    return 'pending';
  } catch (error) {
    if (
      error.code === 'SAFE_PAY_TIMEOUT_MANUAL_REVIEW' ||
      error.code?.includes('MISMATCH') ||
      ['STRIPE_REFUND_EXCEEDS_REMAINING', 'STRIPE_FINANCIAL_OPERATION_CONFLICT'].includes(error.code)
    ) {
      await markManualReview(candidate, operationKey, error.message);
      return 'manual_review';
    }

    const operation = await StripeFinancialOperation.findOne({ operationKey });
    const failed = error.code === 'STRIPE_REFUND_FAILED';
    const uncertain = error.code === 'STRIPE_REFUND_RECONCILIATION_REQUIRED' ||
      operation?.status === 'reconciliation_required';
    const nextStatus = failed ? 'failed' : uncertain ? 'reconciliation_required' : 'pending';
    const updated = await setTimeoutState(candidate._id, operationKey, nextStatus, {
      'providerConnectTimeout.lastErrorCode': error.code || error.type || 'stripe_unavailable',
      ...(operation ? { 'providerConnectTimeout.refundAmountMinor': operation.amount } : {}),
      'providerConnectTimeout.lockUntil': new Date(Date.now() + RETRY_MS),
      ...(failed ? { 'providerConnectTimeout.refundFailedAt': new Date() } : {}),
    });
    if (!updated) return 'skipped';
    let cancelled = false;
    if (operation && failed) {
      await updateRefundRecords(candidate, payment, operation, null, 'failed');
      cancelled = await cancelTimeoutOrder(candidate, operationKey);
    } else if (operation && uncertain) {
      await updateRefundRecords(candidate, payment, operation, null, 'reconciliation_required');
      cancelled = await cancelTimeoutOrder(candidate, operationKey);
    } else if (!operation) {
      await SafePayHistory.updateOne(
        { orderId: candidate._id, status: 'payment_received' },
        { $set: { providerConnectStatus: 'verification_retry' } }
      );
    }
    await logApplicationError({
      error,
      requestPath: 'scheduler/providerConnectTimeout',
      httpMethod: 'POST',
      httpStatus: failed ? 500 : 503,
      errorCode: error.code || 'SAFEPAY_CONNECT_TIMEOUT_RETRY',
      source: 'scheduler',
      metadata: { orderId: String(candidate._id), operationKey },
    });
    if (cancelled && failed) {
      await Promise.all([
        notify({
          userId: candidate.customerId,
          type: 'payment',
          content: 'Oppdraget er kansellert, men refusjonen kunne ikke fullføres automatisk. Saken er sendt til manuell behandling; betalingen er ikke markert som refundert.',
          orderId: candidate._id,
          event: 'provider_connect_refund_failed',
          payload: { orderId: String(candidate._id) },
        }),
        notify({
          userId: candidate.providerId,
          type: 'order',
          content: 'Oppdraget er automatisk kansellert fordi det ikke ble startet innen fristen. Refusjonen krever manuell behandling.',
          orderId: candidate._id,
          event: 'provider_connect_refund_failed',
          payload: { orderId: String(candidate._id) },
        }),
      ]);
    }
    if (cancelled && uncertain) {
      await Promise.all([
        notify({
          userId: candidate.customerId,
          type: 'payment',
          content: 'Oppdraget er kansellert, men Stripe-svaret er uklart. Refusjonen må avstemmes før den kan bekreftes; betalingen vises ikke som refundert ennå.',
          orderId: candidate._id,
          event: 'provider_connect_refund_reconciliation',
          payload: { orderId: String(candidate._id) },
        }),
        notify({
          userId: candidate.providerId,
          type: 'order',
          content: 'Oppdraget er kansellert mens Stripe-refusjonen avstemmes.',
          orderId: candidate._id,
          event: 'provider_connect_refund_reconciliation',
          payload: { orderId: String(candidate._id) },
        }),
      ]);
    }
    return nextStatus;
  }
}

async function cancelUnconnectedPaidOrders(now = new Date()) {
  const candidates = await Order.find({
    paymentStatus: 'paid',
    startedAt: null,
    providerConnectDeadlineAt: { $lte: now },
    $and: [
      { $or: [
        { status: 'paid' },
        { status: 'cancelled', cancellationReason: CANCEL_REASON },
      ] },
      { $or: [
        { 'providerConnectTimeout.status': { $in: [null, 'provider_ready'] } },
        {
          'providerConnectTimeout.status': {
            $in: ['processing', 'pending', 'reconciliation_required'],
          },
          'providerConnectTimeout.lockUntil': { $lte: now },
        },
      ] },
    ],
  })
    .select(
      '_id status paymentStatus startedAt serviceId customerId providerId chatId agreedPrice checkoutMode checkoutSessionId checkoutAmountMinor checkoutCurrency checkoutCustomerId paymentIntentId providerConnectDeadlineAt providerConnectDeadlineDays'
    )
    .limit(50)
    .lean();

  const counts = {
    scanned: candidates.length,
    refunded: 0,
    pending: 0,
    providerReady: 0,
    failed: 0,
    manualReview: 0,
    skipped: 0,
  };
  for (const candidate of candidates) {
    const result = await processOrder(candidate, now);
    if (result === 'refunded') counts.refunded += 1;
    else if (result === 'pending' || result === 'reconciliation_required') counts.pending += 1;
    else if (result === 'provider_ready') counts.providerReady += 1;
    else if (result === 'failed') counts.failed += 1;
    else if (result === 'manual_review') counts.manualReview += 1;
    else counts.skipped += 1;
  }
  return counts;
}

async function recordReadyProvidersBeforeDeadline(now = new Date()) {
  const candidates = await Order.find({
    status: 'paid',
    paymentStatus: 'paid',
    startedAt: null,
    providerConnectDeadlineAt: { $gt: now },
    'providerConnectTimeout.status': { $ne: 'provider_ready' },
  })
    .select('_id providerId providerConnectDeadlineAt')
    .limit(50)
    .lean();
  const counts = { scanned: candidates.length, ready: 0, retry: 0 };

  for (const candidate of candidates) {
    const payment = await Payment.findOne({ orderId: candidate._id });
    if (
      !payment ||
      payment.status !== 'completed' ||
      typeof payment.stripeLivemode !== 'boolean'
    ) {
      continue;
    }

    let ready;
    try {
      const stripe = await getStripeForMode(payment.stripeLivemode === false);
      ready = await providerIsPayoutReady(
        stripe,
        candidate.providerId,
        payment.stripeLivemode === false
      );
    } catch (error) {
      try {
        await SafePayHistory.updateOne(
          { orderId: candidate._id, status: 'payment_received' },
          { $set: { providerConnectStatus: 'verification_retry' } }
        );
      } catch (historyError) {
        await logApplicationError({
          error: historyError,
          requestPath: 'scheduler/providerConnectReadinessHistory',
          httpMethod: 'POST',
          httpStatus: 500,
          errorCode: 'SAFEPAY_CONNECT_HISTORY_UPDATE_FAILED',
          source: 'scheduler',
          metadata: { orderId: String(candidate._id) },
        });
      }
      await logApplicationError({
        error,
        requestPath: 'scheduler/providerConnectReadiness',
        httpMethod: 'POST',
        httpStatus: 503,
        errorCode: error.code || error.type || 'SAFEPAY_CONNECT_STATUS_UNAVAILABLE',
        source: 'scheduler',
        metadata: { orderId: String(candidate._id) },
      });
      counts.retry += 1;
      continue;
    }
    if (!ready) continue;

    const updated = await Order.findOneAndUpdate(
      {
        _id: candidate._id,
        status: 'paid',
        paymentStatus: 'paid',
        providerConnectDeadlineAt: { $gt: now },
        'providerConnectTimeout.status': { $ne: 'provider_ready' },
      },
      {
        $set: {
          'providerConnectTimeout.status': 'provider_ready',
          'providerConnectTimeout.providerVerificationAt': now,
        },
      },
      { new: true }
    );
    if (!updated) continue;
    counts.ready += 1;
    try {
      await SafePayHistory.updateOne(
        { orderId: candidate._id },
        { $set: { providerConnectStatus: 'ready' } }
      );
    } catch (error) {
      await logApplicationError({
        error,
        requestPath: 'scheduler/providerConnectReadinessHistory',
        httpMethod: 'POST',
        httpStatus: 500,
        errorCode: 'SAFEPAY_CONNECT_HISTORY_UPDATE_FAILED',
        source: 'scheduler',
        metadata: { orderId: String(candidate._id) },
      });
    }
  }
  return counts;
}

async function applyTimeoutRefundResult(order, payment, operation, refund, status) {
  if (
    !operation?.operationKey?.startsWith('safepay-connect-timeout:') ||
    String(operation.orderId) !== String(order?._id) ||
    String(operation.paymentIntentId) !== String(payment?.stripePaymentIntentId) ||
    refund?.metadata?.jobbloOperationKey !== operation.operationKey
  ) {
    return false;
  }
  if (status === 'succeeded') {
    return completeTimeoutRefund(order, payment, operation, refund);
  }

  const state = status === 'failed' ? 'failed' : 'pending';
  const updated = await setTimeoutState(order._id, operation.operationKey, state, {
    'providerConnectTimeout.stripeRefundId': refund.id,
    'providerConnectTimeout.refundAmountMinor': operation.amount,
    'providerConnectTimeout.refundedAmountMinor': 0,
    'providerConnectTimeout.lockUntil':
      state === 'pending' ? new Date(Date.now() + RETRY_MS) : null,
    ...(state === 'failed'
      ? {
          'providerConnectTimeout.lastErrorCode': 'stripe_refund_failed',
          'providerConnectTimeout.refundFailedAt': new Date(),
        }
      : {}),
  });
  if (!updated) return false;
  await updateRefundRecords(order, payment, operation, refund, state);
  const cancelled = await cancelTimeoutOrder(order, operation.operationKey);
  if (cancelled && state === 'pending') {
    await Promise.all([
      notify({
        userId: order.customerId,
        type: 'payment',
        content: 'Oppdraget er kansellert, og refusjonen behandles av Stripe. Det kan ta noen virkedager før pengene vises på kontoen din.',
        orderId: order._id,
        event: 'provider_connect_refund_pending',
        payload: { orderId: String(order._id) },
      }),
      notify({
        userId: order.providerId,
        type: 'order',
        content: 'Oppdraget er kansellert fordi det ikke ble startet innen fristen, og venter på at Stripe bekrefter refusjonen.',
        orderId: order._id,
        event: 'provider_connect_refund_pending',
        payload: { orderId: String(order._id) },
      }),
    ]);
  }
  if (state === 'failed') {
    await Promise.all([
      notify({
        userId: order.customerId,
        type: 'payment',
        content: 'Oppdraget er kansellert, men refusjonen kunne ikke fullføres automatisk. Saken er sendt til manuell behandling; betalingen er ikke markert som refundert.',
        orderId: order._id,
        event: 'provider_connect_refund_failed',
        payload: { orderId: String(order._id) },
      }),
      notify({
        userId: order.providerId,
        type: 'order',
        content: 'Oppdraget er automatisk kansellert fordi det ikke ble startet innen fristen. Refusjonen krever manuell behandling.',
        orderId: order._id,
        event: 'provider_connect_refund_failed',
        payload: { orderId: String(order._id) },
      }),
    ]);
  }
  return Boolean(updated);
}

module.exports = {
  CANCEL_REASON,
  verifyCapturedPayment,
  providerIsPayoutReady,
  completeTimeoutRefund,
  processOrder,
  cancelUnconnectedPaidOrders,
  recordReadyProvidersBeforeDeadline,
  applyTimeoutRefundResult,
};
