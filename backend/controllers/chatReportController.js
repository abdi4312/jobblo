const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Chat = require('../models/ChatMessage');
const { ChatReport, VALID_REPORT_TYPES } = require('../models/ChatReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { parseObjectId } = require('../utils/pagination');

// Per-user report submission rate limiter — max 5 per hour
const reportSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'You have already submitted a report for this chat recently. Please wait before reporting again.',
  },
});

// ── POST /api/chats/:chatId/reports ──────────────────────────────────────────
const submitChatReport = async (req, res) => {
  try {
    const chatId = parseObjectId(req.params.chatId);
    if (!chatId) {
      return res.status(400).json({ success: false, message: 'Ugyldig Chat ID.' });
    }

    const { scope, messageId, reportType, title, description } = req.body;

    // Validate scope
    if (!scope || !['chat', 'message'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'Ugyldig scope. Tillatte: chat, message.' });
    }

    // Validate reportType
    if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Ugyldig rapporttype. Tillatte: ${VALID_REPORT_TYPES.join(', ')}.`,
      });
    }

    // Validate title
    if (!title || title.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Tittel er påkrevd (min. 5 tegn).',
      });
    }

    // Validate description
    if (!description || description.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Beskrivelse er påkrevd (min. 20 tegn).',
      });
    }
    if (description.trim().length > 3000) {
      return res.status(400).json({ success: false, message: 'Beskrivelse er for lang (maks 3000 tegn).' });
    }

    // Fetch chat
    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat ikke funnet.' });
    }

    const reporterId = req.user._id.toString();
    const clientId = chat.clientId?.toString();
    const providerId = chat.providerId?.toString();

    // Verify reporter is a participant
    if (reporterId !== clientId && reporterId !== providerId) {
      return res.status(403).json({
        success: false,
        message: 'Du er ikke en deltaker i denne chatten.',
      });
    }

    // Determine reported user (the other participant)
    const reportedUserId = reporterId === clientId ? chat.providerId : chat.clientId;
    if (!reportedUserId) {
      return res.status(400).json({ success: false, message: 'Motparten i chatten ble ikke funnet.' });
    }

    // Validate messageId when scope is message
    if (scope === 'message') {
      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: 'messageId er påkrevd når scope er "message".',
        });
      }
      const msgExists = chat.messages?.some((m) => String(m._id) === String(messageId));
      if (!msgExists) {
        return res.status(404).json({ success: false, message: 'Melding ikke funnet i denne chatten.' });
      }
    }

    // Duplicate report check — same user, same chat, within last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await ChatReport.findOne({
      chatId,
      reportedBy: req.user._id,
      createdAt: { $gte: oneDayAgo },
    }).lean();

    if (duplicate) {
      return res.status(429).json({
        success: false,
        message:
          'You have already submitted a report for this chat recently. Please wait before reporting again.',
      });
    }

    // Process evidence files (uploaded via multer, available on req.files)
    const evidence = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files.slice(0, 5)) {
        evidence.push({
          fileUrl: file.path || file.location || file.filename,
          fileType: file.mimetype,
          description: '',
          uploadedAt: new Date(),
        });
      }
    }

    // Create the report
    const report = await ChatReport.create({
      chatId,
      orderId: chat.orderId || null,
      serviceId: chat.serviceId || null,
      safePayOrderId: chat.orderId || null, // same order is the safePayOrder in this model
      messageId: scope === 'message' ? String(messageId) : undefined,
      scope,
      reportedBy: req.user._id,
      reportedUser: reportedUserId,
      reportType,
      title: title.trim(),
      description: description.trim(),
      evidence,
      timeline: [
        {
          action: 'report_submitted',
          actorId: req.user._id,
          description: `Rapport innlevert av bruker. Type: ${reportType}`,
          createdAt: new Date(),
        },
      ],
    });

    // Notify Super Admin(s)
    try {
      const admins = await User.find({ role: 'superAdmin', isDeleted: false }).select('_id').lean();
      if (admins.length > 0) {
        await Notification.insertMany(
          admins.map((a) => ({
            userId: a._id,
            type: 'alert',
            content: `Ny chatrapport mottatt: "${title.trim()}" (${reportType})`,
            orderId: chat.orderId || null,
          }))
        );
      }
    } catch {
      // notification failure is non-critical
    }

    return res.status(201).json({
      success: true,
      message: 'Rapport innlevert.',
      data: {
        reportId: report._id,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error('[chatReportController] submitChatReport:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ── GET /api/chats/:chatId/reports/me ────────────────────────────────────────
const getMyChatReports = async (req, res) => {
  try {
    const chatId = parseObjectId(req.params.chatId);
    if (!chatId) {
      return res.status(400).json({ success: false, message: 'Ugyldig Chat ID.' });
    }

    const reports = await ChatReport.find({
      chatId,
      reportedBy: req.user._id,
    })
      .select('scope reportType title status priority createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { reports } });
  } catch (err) {
    console.error('[chatReportController] getMyChatReports:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { submitChatReport, getMyChatReports, reportSubmitLimiter };
