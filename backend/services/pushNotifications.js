const PushToken = require('../models/PushToken');
const { getFirebaseMessaging } = require('./firebaseAdmin');
const { logDelivery } = require('./monitoring/deliveryLog');

function stringData(data) {
  return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, String(value)]));
}

/** Deliver now (queue handler). Throws only when the whole call failed, so the queue retries it. */
async function deliverPush(userId, message) {
  const tokens = await PushToken.find({ userId, provider: 'fcm', active: true })
    .select('token')
    .lean();
  const started = Date.now();
  const log = (fields) =>
    logDelivery({ channel: 'push', template: String(message?.title || '').slice(0, 200), userId, latencyMs: Date.now() - started, ...fields });
  if (!tokens.length) {
    log({ status: 'skipped', error: 'no active push tokens' });
    return;
  }

  try {
    require('./monitoring/faults').assertNoFault('push'); // staging failure simulator only
    const response = await getFirebaseMessaging().sendEachForMulticast({
      tokens: tokens.map(({ token }) => token),
      notification: {
        title: String(message.title || ''),
        body: String(message.body || ''),
      },
      data: stringData(message.data),
      android: {
        priority: message.priority === 'normal' ? 'normal' : 'high',
        notification: {
          sound: 'default',
          channelId: message.channelId || 'messages',
        },
      },
    });

    const invalidTokens = response.responses
      .map((result, index) => {
        const code = result.error?.code;
        return code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
          ? tokens[index].token
          : null;
      })
      .filter(Boolean);
    if (invalidTokens.length) {
      await PushToken.updateMany({ token: { $in: invalidTokens } }, { $set: { active: false } });
    }

    log({
      status: !response.failureCount ? 'sent' : response.successCount ? 'partial' : 'failed',
      accepted: response.successCount,
      rejected: response.failureCount,
      errorCode: response.responses.find((r) => r.error)?.error?.code || null,
    });

    if (response.failureCount) {
      console.error(
        'FCM push delivery had %d failures (%d accepted)',
        response.failureCount,
        response.successCount
      );
    }
  } catch (error) {
    log({ status: 'failed', error: String(error.message).slice(0, 300), errorCode: error.code || null });
    console.error('FCM push delivery failed:', error.message);
    throw error;
  }
}

/**
 * Push to every active device of a user, through the push queue (services/queue): returns
 * once queued; a failed FCM call is retried with backoff instead of being dropped.
 */
async function sendPushToUser(userId, message) {
  return require('./queue').enqueue('push', 'send', { userId: String(userId), message });
}

module.exports = { sendPushToUser, deliverPush };
