const PushToken = require('../models/PushToken');

function validToken(token) {
  if (typeof token !== 'string') return false;
  const value = token.trim();
  // FCM registration tokens are opaque strings. Keep a bounded, printable format check
  // without assuming the ExpoPushToken/ExponentPushToken prefix.
  return value.length >= 20 && value.length <= 4096 && /^[A-Za-z0-9:_-]+$/.test(value);
}

exports.register = async (req, res) => {
  const { token, platform, deviceId } = req.body || {};
  if (!validToken(token) || !['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: 'Ugyldig push-token eller plattform' });
  }

  try {
    const pushToken = await PushToken.findOneAndUpdate(
      { token: token.trim() },
      {
        provider: 'fcm',
        userId: req.userId,
        platform,
        deviceId: typeof deviceId === 'string' ? deviceId : undefined,
        active: true,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ registered: Boolean(pushToken) });
  } catch (error) {
    console.error('Push token registration failed:', error.message);
    return res.status(500).json({ error: 'Kunne ikke registrere push-varsler' });
  }
};

exports.deactivateCurrent = async (req, res) => {
  const token = req.body?.token;
  if (!validToken(token)) return res.status(400).json({ error: 'Ugyldig push-token' });

  try {
    await PushToken.updateOne(
      { token: token.trim(), userId: req.userId },
      { $set: { active: false } }
    );
    return res.json({ deactivated: true });
  } catch (error) {
    console.error('Push token deactivation failed:', error.message);
    return res.status(500).json({ error: 'Kunne ikke deaktivere push-varsler' });
  }
};
