const { createSession } = require("../utils/tokenUtils");
const axios = require("axios");
const User = require("../models/User");

exports.iduraCallback = async (req, res) => {
  try {
    console.log("IDURA CODE:", req.query.code);

    const { code } = req.query;

    const tokenRes = await axios.post(
      `${process.env.IDURA_BASE_URL}/auth/token`,
      {
        code,
        redirectUri: process.env.IDURA_CALLBACK_URL,
      },
      {
        auth: {
          username: process.env.IDURA_CLIENT_ID,
          password: process.env.IDURA_CLIENT_SECRET,
        },
      },
    );

    if (tokenRes.data.status !== "success") {
      return res.redirect(`${process.env.FRONTEND_URL}/auth-failed`);
    }

    const profile = tokenRes.data.user; // 👈 same as Google profile

    // 🔍 STEP 1: Provider check
    let user = await User.findOne({
      "oauthProviders.provider": "idura",
      "oauthProviders.providerId": profile.id,
    });

    if (user) {
      return redirectWithToken(req, res, user);
    }

    // 🔍 STEP 2: Email check (same as Google logic)
    user = await User.findOne({ email: profile.email });

    if (user) {
      const alreadyLinked = user.oauthProviders.some(
        (p) => p.provider === "idura",
      );

      if (!alreadyLinked) {
        user.oauthProviders.push({
          provider: "idura",
          providerId: profile.id,
        });
      }

      user.verified = true;
      user.accountStatus = "verified";
      user.lastLogin = new Date();

      await user.save();
      return redirectWithToken(req, res, user);
    }

    // 🆕 STEP 3: Create new user (same pattern)
    user = await User.create({
      name: profile.firstName || "Verified User",
      lastName: profile.lastName,
      email: profile.email,
      password: "oauth-user",
      verified: true,
      accountStatus: "verified",
      role: "user",
      subscription: "free",
      oauthProviders: [
        {
          provider: "idura",
          providerId: profile.id,
        },
      ],
    });

    return redirectWithToken(req, res, user);
  } catch (err) {
    console.error("Idura auth error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/auth-error`);
  }
};

async function redirectWithToken(req, res, user) {
  // createSession now handles token generation internally
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

  return res.redirect(
    `${process.env.FRONTEND_URL}/oauth-success?token=${accessToken}`,
  );
}
