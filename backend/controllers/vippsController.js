const Subscription = require("../models/Subscription");

const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");

exports.redirectToVipps = (req, res) => {
  try {
    // 1️⃣ Generate strong random state (CSRF protection)
    const state = crypto.randomBytes(16).toString("hex");
    req.session.vippsState = state; // save in session

    // 2️⃣ Build Vipps OAuth query params
    const params = new URLSearchParams({
      client_id: process.env.VIPPS_CLIENT_ID?.trim(),
      response_type: "code",
      scope: "openid name phoneNumber email",
      state,
      redirect_uri: process.env.VIPPS_REDIRECT_URI?.trim(),
    });

    const vippsAuthUrl = `https://apitest.vipps.no/access-management-1.0/access/oauth2/auth?${params.toString()}`;

    // 3️⃣ Redirect user to Vipps login
    return res.redirect(vippsAuthUrl);
  } catch (err) {
    console.error("Error building Vipps login URL:", err);
    return res.status(500).send("Failed to redirect to Vipps login.");
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
    const tokenResponse = await axios.post(
      "https://apitest.vipps.no/access-management-1.0/access/oauth2/token",
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

    const accessToken = tokenResponse.data.access_token;

    // 4️⃣ Fetch Vipps profile
    const userResponse = await axios.get(
      "https://apitest.vipps.no/vipps-userinfo-api/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
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
      }    
    })      
    // 6️⃣ Clear session state
    if (req.session) delete req.session.vippsState;

    // 7️⃣ Issue JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 8️⃣ Redirect to frontend success page
    const frontendBase = process.env.FRONTEND_URL.endsWith("/")
      ? process.env.FRONTEND_URL
      : `${process.env.FRONTEND_URL}/`;

    return res.redirect(`${frontendBase}oauth-success?token=${token}`);
  } catch (err) {
    console.error("Vipps API Error:", err.response?.data || err.message);
    // On error, redirect to login page again
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=vipps_failed`);
  }
};
