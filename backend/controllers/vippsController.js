const { createSession } = require("../utils/tokenUtils");
const Subscription = require("../models/Subscription");
const axios = require("axios");
const User = require("../models/User");
const crypto = require("crypto");

exports.redirectToVipps = (req, res) => {
  try {
    console.log("Vipps Redirect triggered");

    // 1️⃣ Generate strong random state (CSRF protection)
    const state = crypto.randomBytes(16).toString("hex");
    if (req.session) {
      req.session.vippsState = state;
      console.log("State saved in session:", state);
    } else {
      console.error(
        "CRITICAL: Session not found in request. Check session middleware.",
      );
    }

    // 2️⃣ Build Vipps OAuth query params
    const clientId = (process.env.VIPPS_CLIENT_ID || "").trim();
    const redirectUri = (process.env.VIPPS_REDIRECT_URI || "").trim();

    if (!clientId || !redirectUri) {
      console.error(
        "CRITICAL: VIPPS_CLIENT_ID or VIPPS_REDIRECT_URI is missing in .env",
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      scope: "openid name phoneNumber email",
      state: state,
      redirect_uri: redirectUri,
    });

    const vippsBaseUrl = (
      process.env.VIPPS_BASE_URL || "https://apitest.vipps.no"
    ).replace(/\/$/, "");
    const vippsAuthUrl = `${vippsBaseUrl}/access-management-1.0/access/oauth2/auth?${params.toString()}`;

    console.log("Full Redirecting URL:", vippsAuthUrl);

    // 3️⃣ Redirect user to Vipps login
    return res.redirect(vippsAuthUrl);
  } catch (err) {
    console.error("Error in redirectToVipps:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

exports.vippsCallback = async (req, res) => {
  const { code, state, error } = req.query;

  // 1️⃣ User cancelled login on Vipps
  if (error) {
    console.log("Vipps login cancelled by user");
    return res.redirect(`${process.env.FRONTEND_URL}login`);
  }

  if (!code) {
    console.log("No code provided");
    return res.redirect(`${process.env.FRONTEND_URL}login`);
  }

  // 2️⃣ State check (optional in dev)
  if (process.env.NODE_ENV === "production") {
    if (!req.session.vippsState || state !== req.session.vippsState) {
      console.log("State mismatch");
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=invalid_state`,
      );
    }
  }

  try {
    // 3️⃣ Exchange code for token
    const vippsBaseUrl =
      process.env.VIPPS_BASE_URL || "https://apitest.vipps.no";
    const tokenResponse = await axios.post(
      `${vippsBaseUrl}/access-management-1.0/access/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.VIPPS_REDIRECT_URI?.trim(),
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.VIPPS_CLIENT_ID?.trim()}:${process.env.VIPPS_CLIENT_SECRET?.trim()}`,
            ).toString("base64"),
          "Ocp-Apim-Subscription-Key": process.env.VIPPS_SUB_KEY?.trim(),
        },
      },
    );

    const vippsAccessToken = tokenResponse.data.access_token;

    // 4️⃣ Fetch Vipps profile
    const userResponse = await axios.get(
      `${vippsBaseUrl}/vipps-userinfo-api/userinfo`,
      { headers: { Authorization: `Bearer ${vippsAccessToken}` } },
    );

    const profile = userResponse.data;

    // 5️⃣ Find or create user (handle duplicate email)
    let user = await User.findOne({
      "oauthProviders.provider": "vipps",
      "oauthProviders.providerId": profile.sub,
    });

    if (!user) {
      let existingEmailUser = profile.email
        ? await User.findOne({ email: profile.email })
        : null;

      if (existingEmailUser) {
        existingEmailUser.oauthProviders.push({
          provider: "vipps",
          providerId: profile.sub,
        });
        user = await existingEmailUser.save();
      } else {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        user = await User.create({
          name: profile.name || "Vipps User",
          email: profile.email || undefined,
          phone: profile.phone_number || undefined,
          password: randomPassword,
          oauthProviders: [{ provider: "vipps", providerId: profile.sub }],
        });
      }
    }

    await Subscription.create({
      userId: user._id,

      currentPlan: {
        plan: "Standard",
        planType: "private",
        startDate: new Date(),
        status: "active",
      },
    });
    // 6️⃣ Clear session state
    if (req.session) delete req.session.vippsState;

    // 7️⃣ Issue Tokens & Create Session (createSession handles token generation)
    const { accessToken, refreshToken } = await createSession(req, user._id);

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour (matches token expiry)
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 8️⃣ Redirect to frontend success page
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectUrl = frontendBase.endsWith("/")
      ? `${frontendBase}oauth-success`
      : `${frontendBase}/oauth-success`;

    return res.redirect(`${redirectUrl}?token=${accessToken}`);
  } catch (err) {
    console.error("Vipps API Error:", err.response?.data || err.message);
    // On error, redirect to login page again
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=vipps_failed`);
  }
};
