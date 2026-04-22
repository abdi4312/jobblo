const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Session = require("../models/Session");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateTokens, createSession } = require("../utils/tokenUtils");

exports.register = async (req, res) => {
  try {
    const { name, lastName, email, password } = req.body;
    console.log("Registration attempt for:", email);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Email already exists:", email);
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, lastName, email, password: hashed });
    console.log("User created successfully:", email);

    // This now returns { session, accessToken, refreshToken }
    const { session, accessToken, refreshToken } = await createSession(
      req,
      user._id,
    );

    await Subscription.create({
      userId: user._id,
      currentPlan: {
        plan: "Standard",
        planType: "private",
        startDate: new Date(),
        status: "active",
        autoRenew: false,
      },
    });

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

    res.status(201).json({ user, accessToken });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt for:", email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("Password mismatch for:", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("Login successful for:", email);

    // This now returns { session, accessToken, refreshToken }
    const { session, accessToken, refreshToken } = await createSession(
      req,
      user._id,
    );

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

    res.json({ user, accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await Session.deleteOne({ refreshToken });
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken)
      return res.status(401).json({ error: "Refresh token missing" });

    let session = await Session.findOne({ refreshToken });

    // GRACE PERIOD LOGIC: If not found, check if it was recently rotated
    if (!session) {
      session = await Session.findOne({ oldRefreshToken: refreshToken });

      // If found as old token, check if rotation was recent (within 60 seconds)
      if (
        session &&
        session.updatedAt &&
        new Date().getTime() - new Date(session.updatedAt).getTime() < 60000
      ) {
        console.log("Accepted old refresh token within grace period.");
        // Use this session
      } else {
        return res
          .status(401)
          .json({
            error: "Invalid session or expired grace period",
            code: "SESSION_REVOKED",
          });
      }
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      );
    } catch (err) {
      await Session.deleteOne({ refreshToken });
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    // Generate new tokens using the same session ID
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id,
      session._id,
    );

    // Update session with new refresh token and move current one to old
    session.oldRefreshToken = refreshToken;
    session.refreshToken = newRefreshToken;
    session.lastUsed = new Date();
    await session.save();

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour (matches token expiry)
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user._id;

    console.log("Fetching sessions for user ID:", userId);

    // Find sessions for this user
    const sessions = await Session.find({ userId: userId }).sort({
      lastUsed: -1,
    });

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session.toObject(),
      isCurrent: session._id.toString() === currentSessionId,
    }));

    res.json(sessionsWithCurrent);
  } catch (error) {
    console.error("Error in getSessions:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await Session.deleteOne({
      _id: sessionId,
      userId: req.user._id,
    });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: "Session not found or unauthorized" });
    }
    res.json({ message: "Session revoked" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.revokeAllOtherSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user._id;

    const result = await Session.deleteMany({
      userId: userId,
      _id: { $ne: currentSessionId },
    });

    res.json({
      message: `Revoked ${result.deletedCount} other sessions`,
      count: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
