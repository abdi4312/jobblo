const { createSession } = require('../utils/tokenUtils');
const Subscription = require('../models/Subscription');
const axios = require('axios');
const User = require('../models/User');
const crypto = require('crypto');

exports.redirectToVipps = (req, res) => {
  try {
    console.log('Vipps Redirect triggered');

    // 1️⃣ Generate strong random state (CSRF protection)
    const state = crypto.randomBytes(16).toString('hex');
    if (req.session) {
      req.session.vippsState = state;
      console.log('State saved in session:', state);
    } else {
      console.error('CRITICAL: Session not found in request. Check session middleware.');
    }

    // 2️⃣ Build Vipps OAuth query params
    const clientId = (process.env.VIPPS_CLIENT_ID || '').trim();
    const redirectUri = (process.env.VIPPS_REDIRECT_URI || '').trim();

    if (!clientId || !redirectUri) {
      console.error('CRITICAL: VIPPS_CLIENT_ID or VIPPS_REDIRECT_URI is missing in .env');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid name phoneNumber email',
      state: state,
      redirect_uri: redirectUri,
    });

    const vippsBaseUrl = (process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no').replace(
      /\/$/,
      ''
    );
    const vippsAuthUrl = `${vippsBaseUrl}/access-management-1.0/access/oauth2/auth?${params.toString()}`;

    console.log('Full Redirecting URL:', vippsAuthUrl);

    // 3️⃣ Redirect user to Vipps login
    return res.redirect(vippsAuthUrl);
  } catch (err) {
    console.error('Error in redirectToVipps:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

exports.vippsCallback = async (req, res) => {
  const { code, state, error } = req.query;

  // 1️⃣ User cancelled login on Vipps
  if (error) {
    console.log('Vipps login cancelled by user');
    return res.redirect(`${process.env.FRONTEND_URL}login`);
  }

  if (!code) {
    console.log('No code provided');
    return res.redirect(`${process.env.FRONTEND_URL}login`);
  }

  // 2️⃣ State check (optional in dev)
  if (process.env.NODE_ENV === 'production') {
    if (!req.session.vippsState || state !== req.session.vippsState) {
      console.log('State mismatch');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
    }
  }

  try {
    // 3️⃣ Exchange code for token
    const vippsBaseUrl = process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no';
    const tokenResponse = await axios.post(
      `${vippsBaseUrl}/access-management-1.0/access/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.VIPPS_REDIRECT_URI?.trim(),
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.VIPPS_CLIENT_ID?.trim()}:${process.env.VIPPS_CLIENT_SECRET?.trim()}`
            ).toString('base64'),
          'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUB_KEY?.trim(),
        },
      }
    );

    const vippsAccessToken = tokenResponse.data.access_token;

    // 4️⃣ Fetch Vipps profile
    const userResponse = await axios.get(`${vippsBaseUrl}/vipps-userinfo-api/userinfo`, {
      headers: { Authorization: `Bearer ${vippsAccessToken}` },
    });

    const profile = userResponse.data;

    // 5️⃣ Find or create user (handle duplicate email)
    let user = await User.findOne({
      'oauthProviders.provider': 'vipps',
      'oauthProviders.providerId': profile.sub,
    });

    let isNewUser = false;

    if (!user) {
      // Only consider an e-mail match when Vipps has not explicitly told us the
      // address is unverified. Vipps does not always send `email_verified`; when the
      // claim is absent this behaves exactly as before, so this is a guard rather
      // than a change of flow. The wider question — whether matching on e-mail alone
      // should ever silently attach a Vipps identity to a pre-existing password
      // account — is deliberately left alone here; it needs an account-linking
      // design, not a patch. See the Stage A report.
      const emailIsUsable = profile.email && profile.email_verified !== false;
      const existingEmailUser = emailIsUsable ? await User.findOne({ email: profile.email }) : null;

      if (existingEmailUser) {
        existingEmailUser.oauthProviders.push({
          provider: 'vipps',
          providerId: profile.sub,
        });
        user = await existingEmailUser.save();
      } else {
        const randomPassword = crypto.randomBytes(16).toString('hex');
        user = await User.create({
          name: profile.name || 'Vipps User',
          email: profile.email || undefined,
          phone: profile.phone_number || undefined,
          password: randomPassword,
          oauthProviders: [{ provider: 'vipps', providerId: profile.sub }],
        });
        isNewUser = true;
      }
    }

    /**
     * Give the account a default subscription, but only if it does not already have
     * one.
     *
     * This used to be an unconditional `Subscription.create(...)` sitting outside the
     * `if (!user)` block, so it ran on EVERY Vipps login — not just at signup. A user
     * who signed in ten times had ten Subscription rows. Every reader in the codebase
     * (`checkSubscription`, `stripeController`, `services/stripe/provisioning`) looks
     * the subscription up with `findOne({ userId })`, so which of those rows won was
     * down to natural document order: a user who had upgraded could be served a stale
     * free row and silently lose their paid entitlement and contact quota.
     *
     * `$setOnInsert` + `upsert` makes this idempotent in a single atomic operation:
     * it writes only when no subscription exists, and touches nothing — plan, status,
     * Stripe ids, history — when one already does. That is what protects a real paid
     * subscription from being reset to the free default on the next login.
     *
     * The plan defaults mirror authController.register so a Vipps signup and an
     * e-mail signup start on the same footing.
     */
    const isCompany = user.role === 'company';
    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          currentPlan: {
            plan: isCompany ? 'Start' : 'Standard',
            planType: isCompany ? 'business' : 'private',
            startDate: new Date(),
            status: 'active',
            autoRenew: false,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (isNewUser) {
      console.log('Vipps signup created user %s', user._id);
    }
    // 6️⃣ Clear session state
    if (req.session) delete req.session.vippsState;

    // 7️⃣ Issue Tokens & Create Session (createSession handles token generation)
    const { accessToken, refreshToken } = await createSession(req, user._id);

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour (matches token expiry)
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 8️⃣ Redirect to frontend success page
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = frontendBase.endsWith('/')
      ? `${frontendBase}oauth-success`
      : `${frontendBase}/oauth-success`;

    return res.redirect(`${redirectUrl}?token=${accessToken}`);
  } catch (err) {
    console.error('Vipps API Error:', err.response?.data || err.message);
    // On error, redirect to login page again
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=vipps_failed`);
  }
};
