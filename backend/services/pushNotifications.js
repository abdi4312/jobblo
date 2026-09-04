const PushToken = require('../models/PushToken');
const { getFirebaseMessaging } = require('./firebaseAdmin');

function stringData(data) {
  return Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, String(value)]));
}

async function sendPushToUser(userId, message) {
  const tokens = await PushToken.find({ userId, provider: 'fcm', active: true })
    .select('token')
    .lean();
  if (!tokens.length) return;

  try {
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

    if (response.failureCount) {
      console.error(
        'FCM push delivery had %d failures (%d accepted)',
        response.failureCount,
        response.successCount
      );
    }
  } catch (error) {
    console.error('FCM push delivery failed:', error.message);
  }
}

module.exports = { sendPushToUser };
