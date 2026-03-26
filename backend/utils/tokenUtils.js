const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const User = require("../models/User");
const requestIp = require("request-ip");

const generateTokens = (userId, sessionId) => {
  const accessToken = jwt.sign(
    { id: userId, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }, // Access token extended to 1 hour
  );

  const refreshToken = jwt.sign(
    { id: userId, sid: sessionId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" }, // Longer lived refresh token
  );

  return { accessToken, refreshToken };
};

const axios = require("axios");

const getGeoLocation = async (ip) => {
  try {
    if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.includes("127.0.0.1")) {
      return "Localhost";
    }
    const cleanIp = ip.replace(/^.*:/, "");
    const response = await axios.get(`http://ip-api.com/json/${cleanIp}`);
    if (response.data && response.data.status === "success") {
      return `${response.data.city}, ${response.data.country}`;
    }
    return "Unknown";
  } catch (error) {
    return "Unknown";
  }
};

const createSession = async (req, userId) => {
  try {
    const clientIp = requestIp.getClientIp(req);
    const agent = req.useragent || {};
    const location = await getGeoLocation(clientIp);

    const device = agent.isMobile
      ? "Mobile"
      : agent.isTablet
        ? "Tablet"
        : "Desktop";
    const browser = agent.browser || "Unknown";
    const os = agent.os || "Unknown";

    // Create a temporary session to get an ID, or use a placeholder
    // We'll update the refreshToken later
    const session = new Session({
      userId,
      refreshToken: "pending_" + Date.now(), // Temporary
      ip: clientIp,
      location,
      userAgent: req.headers["user-agent"] || "Unknown",
      device: `${os} ${device}`,
      browser: browser || "Unknown",
      os: os || "Unknown",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Generate tokens WITH the session ID
    const { accessToken, refreshToken } = generateTokens(userId, session._id);
    
    // Update session with real refresh token
    session.refreshToken = refreshToken;
    await session.save();

    // Update lastLogin for the user
    await User.findByIdAndUpdate(userId, { lastLogin: new Date() });

    return { session, accessToken, refreshToken };
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

module.exports = { generateTokens, createSession };
