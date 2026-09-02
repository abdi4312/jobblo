class Expo {
  constructor() {}

  chunkPushNotifications(messages) {
    return [messages];
  }

  async sendPushNotificationsAsync(messages) {
    return messages.map(() => ({ status: 'ok' }));
  }

  static isExpoPushToken(token) {
    return typeof token === 'string' && token.length > 0;
  }
}

module.exports = { Expo };
