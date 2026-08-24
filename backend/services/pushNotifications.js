const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/PushToken');

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

async function sendPushToUser(userId, message) {
  const tokens = await PushToken.find({ userId, active: true }).select('token').lean();
  const valid = tokens.filter(({ token }) => Expo.isExpoPushToken(token));
  if (!valid.length) return;

  const messages = valid.map(({ token }) => ({ to: token, sound: 'default', ...message }));
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const invalidTokens = tickets
        .map((ticket, index) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? chunk[index].to : null)
        .filter(Boolean);
      if (invalidTokens.length) await PushToken.updateMany({ token: { $in: invalidTokens } }, { $set: { active: false } });
    } catch (error) {
      console.error('Push delivery failed:', error.message);
    }
  }
}

module.exports = { sendPushToUser };