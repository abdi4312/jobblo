const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Session = require("../models/Session");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateTokens, createSession } = require("../utils/tokenUtils");

const isProduction = process.env.NODE_ENV === "production";

const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 60 * 60 * 1000, // 1 hour
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

const allowedRoles = ["user", "company"];

const sanitizeUser = (user) => {
  if (!user) return null;

  const userObject =
    typeof user.toObject === "function" ? user.toObject() : user;

  delete userObject.password;
  delete userObject.__v;

  return userObject;
};

const sanitizeSession = (session, currentSessionId) => {
  const sessionObject =
    typeof session.toObject === "function" ? session.toObject() : session;

  delete sessionObject.refreshToken;
  delete sessionObject.oldRefreshToken;
  delete sessionObject.__v;

  return {
    ...sessionObject,
    isCurrent: sessionObject._id?.toString() === currentSessionId?.toString(),
  };
};

const sendServerError = (res, error, context = "Server error") => {
  console.error(context, error);

  return res.status(500).json({
    error: isProduction ? "Something went wrong" : error.message,
  });
};

const validateRegisterInput = ({
  name,
  email,
  password,
  role,
  companyName,
  orgNumber,
}) => {
  // If role is company, we use companyName as the primary name
  const effectiveName = role === "company" ? companyName : name;

  if (!effectiveName || !email || !password) {
    return "Name, email and password are required";
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Valid email is required";
  }

  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (role && !allowedRoles.includes(role)) {
    return "Invalid role";
  }

  if (role === "company") {
    if (!companyName) {
      return "Company name is required";
    }

    if (!orgNumber || !/^\d{9}$/.test(String(orgNumber))) {
      return "Organization number must be exactly 9 digits";
    }
  }

  return null;
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
};

exports.register = async (req, res) => {
  let createdUserId = null;

  try {
    const {
      name,
      lastName,
      email,
      password,
      role = "user",
      companyName,
      orgNumber,
    } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const validationError = validateRegisterInput({
      name,
      email: normalizedEmail,
      password,
      role,
      companyName,
      orgNumber,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select(
      "_id",
    );

    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name:
        role === "company"
          ? String(companyName).trim()
          : String(name || "").trim(),
      lastName: role === "user" ? String(lastName || "").trim() : undefined,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      companyName: role === "company" ? String(companyName).trim() : undefined,
      orgNumber: role === "company" ? String(orgNumber).trim() : undefined,
      planType: role === "company" ? "business" : "private",
    });

    createdUserId = user._id;

    const { accessToken, refreshToken } = await createSession(req, user._id);

    await Subscription.create({
      userId: user._id,
      currentPlan: {
        plan: "Standard",
        planType: role === "company" ? "business" : "private",
        startDate: new Date(),
        status: "active",
        autoRenew: false,
      },
    });

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
        Subscription.deleteMany({ userId: createdUserId }),
      ]);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }

    return sendServerError(res, error, "Register failed");
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = await createSession(req, user._id);

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (error) {
    return sendServerError(res, error, "Login failed");
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

    clearAuthCookies(res);

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    return sendServerError(res, error, "Logout failed");
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }

    let session = await Session.findOne({ refreshToken });

    if (!session) {
      session = await Session.findOne({ oldRefreshToken: refreshToken });

      const isWithinGracePeriod =
        session?.updatedAt &&
        Date.now() - new Date(session.updatedAt).getTime() < 60 * 1000;

      if (!isWithinGracePeriod) {
        clearAuthCookies(res);

        return res.status(401).json({
          error: "Invalid session or expired grace period",
          code: "SESSION_REVOKED",
        });
      }
    }

    let decoded;

    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      );
    } catch (error) {
      await Session.deleteOne({
        $or: [{ refreshToken }, { oldRefreshToken: refreshToken }],
      });

      clearAuthCookies(res);

      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id).select("_id");

    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id,
      session._id,
    );

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
      { new: true },
    );

    if (!updatedSession) {
      clearAuthCookies(res);

      return res.status(401).json({
        error: "Session could not be refreshed",
        code: "SESSION_REVOKED",
      });
    }

    setAuthCookies(res, accessToken, newRefreshToken);

    return res.json({ message: "Token refreshed", accessToken });
  } catch (error) {
    return sendServerError(res, error, "Refresh token failed");
  }
};

exports.getSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessions = await Session.find({ userId })
      .select("-refreshToken -oldRefreshToken -__v")
      .sort({ lastUsed: -1 });

    return res.json(
      sessions.map((session) => sanitizeSession(session, currentSessionId)),
    );
  } catch (error) {
    return sendServerError(res, error, "Get sessions failed");
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await Session.deleteOne({
      _id: sessionId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: "Session not found or unauthorized",
      });
    }

    return res.json({ message: "Session revoked" });
  } catch (error) {
    return sendServerError(res, error, "Revoke session failed");
  }
};

exports.revokeAllOtherSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await Session.deleteMany({
      userId,
      _id: { $ne: currentSessionId },
    });

    return res.json({
      message: `Revoked ${result.deletedCount} other sessions`,
      count: result.deletedCount,
    });
  } catch (error) {
    return sendServerError(res, error, "Revoke all other sessions failed");
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId).select("-password -__v");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return sendServerError(res, error, "Get profile failed");
  }
};
