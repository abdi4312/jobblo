const User = require('../../models/User');
const Session = require('../../models/Session');
const bcrypt = require('bcryptjs');
const { isBcryptHash } = require('../../utils/passwordUtils');
const { generateTokens, verifyToken, createSession } = require('../../utils/tokenUtils');
const { CURRENT_TERMS_VERSION, sanitizeUser, sendServerError, validateRegisterInput, setAuthCookies, clearAuthCookies } = require('./authHelpers');

/** Register, login, logout and refresh-token rotation. */

exports.register = async (req, res) => {
  let createdUserId = null;

  try {
    const {
      name,
      lastName,
      email,
      password,
      role = 'user',
      companyName,
      orgNumber,
      acceptedTerms,
    } = req.body;

    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    const validationError = validateRegisterInput({
      name,
      email: normalizedEmail,
      password,
      role,
      companyName,
      orgNumber,
      acceptedTerms,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id');

    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: role === 'company' ? String(companyName).trim() : String(name || '').trim(),
      lastName: role === 'user' ? String(lastName || '').trim() : undefined,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      companyName: role === 'company' ? String(companyName).trim() : undefined,
      orgNumber: role === 'company' ? String(orgNumber).trim() : undefined,
      acceptedTerms: true,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: new Date(),
      planType: role === 'company' ? 'business' : 'private',
    });

    createdUserId = user._id;

    const { accessToken, refreshToken } = await createSession(req, user._id);

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (error) {
    if (createdUserId) {
      await Promise.allSettled([
        User.deleteOne({ _id: createdUserId }),
        Session.deleteMany({ userId: createdUserId }),
      ]);
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }

    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    return sendServerError(res, error, 'Register failed');
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    /**
     * Refuse anything in `password` that is not actually a bcrypt hash.
     *
     * OAuth-created accounts used to carry a placeholder there -- the literal string
     * 'oauth-user' for Google and Idura, a random hex string for Vipps. Neither can be
     * used to log in today, because `bcrypt.compare` returns false when the stored
     * value will not parse as a hash (verified against bcryptjs 2.4.3), so this guard
     * changes no behaviour for any existing account.
     *
     * It is here so that stays true. 'oauth-user' was a constant shared by every Google
     * account on the platform, and the obvious "we should hash these" migration would
     * have handed all of them the working password `oauth-user`. New OAuth accounts get
     * a real hash of random bytes nobody kept (utils/passwordUtils.js); this line makes
     * the remaining legacy rows fail closed rather than depending on a library's
     * behaviour with malformed input.
     */
    const isPasswordValid =
      isBcryptHash(user.password) && (await bcrypt.compare(password, user.password));

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (
      user.isDeleted ||
      user.accountStatus === 'inactive' ||
      user.accountStatus === 'deactivated'
    ) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Kontoen din er deaktivert.',
        code: 'account_inactive',
      });
    }

    const { accessToken, refreshToken } = await createSession(req, user._id);

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (error) {
    return sendServerError(res, error, 'Login failed');
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await Session.deleteOne({
        $or: [{ refreshToken }, { oldRefreshToken: refreshToken }],
      });
    }
    // Clients that send a Bearer token (the mobile app) may not carry the refresh cookie;
    // the token's own session is ended too, so "Logg ut" always ends it server-side.
    if (req.sessionId && req.userId) {
      await Session.deleteOne({ _id: req.sessionId, userId: req.userId });
    }

    clearAuthCookies(res);

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return sendServerError(res, error, 'Logout failed');
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    let session = await Session.findOne({ refreshToken });

    if (!session) {
      session = await Session.findOne({ oldRefreshToken: refreshToken });

      const isWithinGracePeriod =
        session?.updatedAt && Date.now() - new Date(session.updatedAt).getTime() < 60 * 1000;

      if (!isWithinGracePeriod) {
        clearAuthCookies(res);

        return res.status(401).json({
          error: 'Invalid session or expired grace period',
          code: 'SESSION_REVOKED',
        });
      }
    }

    let decoded;

    try {
      // Purpose-checked: an access token in the refreshToken cookie is rejected. The
      // token must also belong to the session row it was found in.
      decoded = verifyToken(refreshToken, 'refresh');
      if (
        String(decoded.sid) !== String(session._id) ||
        String(decoded.id) !== String(session.userId)
      ) {
        throw new Error('session mismatch');
      }
    } catch (error) {
      await Session.deleteOne({
        $or: [{ refreshToken }, { oldRefreshToken: refreshToken }],
      });

      clearAuthCookies(res);

      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id).select('_id accountStatus isDeleted');

    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    if (
      user.accountStatus === 'inactive' ||
      user.accountStatus === 'deactivated' ||
      user.isDeleted
    ) {
      clearAuthCookies(res);
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Kontoen din er deaktivert.',
        code: 'account_inactive',
      });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, session._id);

    const updatedSession = await Session.findOneAndUpdate(
      {
        _id: session._id,
        $or: [{ refreshToken }, { oldRefreshToken: refreshToken }],
      },
      {
        oldRefreshToken: refreshToken,
        refreshToken: newRefreshToken,
        lastUsed: new Date(),
      },
      { new: true }
    );

    if (!updatedSession) {
      clearAuthCookies(res);

      return res.status(401).json({
        error: 'Session could not be refreshed',
        code: 'SESSION_REVOKED',
      });
    }

    setAuthCookies(res, accessToken, newRefreshToken);

    return res.json({ message: 'Token refreshed', accessToken });
  } catch (error) {
    return sendServerError(res, error, 'Refresh token failed');
  }
};
