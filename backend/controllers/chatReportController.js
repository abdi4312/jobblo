const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const ChatReport = require('../models/ChatReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

const VALID_REPORT_TYPES = ChatReport.schema.path('reportType').enumValues;
const ALLOWED_EVIDENCE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/chats/:chatId/reports
 * Authenticated user submits a report for a chat or specific message.
 */
exports.submitReport = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: 'Ugyldig Chat ID.' });
    }

    const { scope, messageId, reportType, title, description, evidence } = req.body;

    if (!scope || !['chat', 'message'].includes(scope)) {
      return res.status(400).json({ success: false, message: '"scope" må være "chat" eller "message".' });
    }
    if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({ success: false, message: 'Ugyldig rapporttype.' });
    }
    if (!title?.trim() || title.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'Tittel er påkrevd (maks 200 tegn).' });
    }
    if (!description?.trim() || description.trim().length > 2000) {
      return res.status(400).json({ success: false, message: 'Beskrivelse er påkrevd (maks 2000 tegn).' });
    }

    // Validate evidence if provided
    let validatedEvidence = [];
    if (evidence && Array.isArray(evidence)) {
      for (const item of evidence) {
        if (!item.fileUrl || typeof item.fileUrl !== 'string') {
          return res.status(400).json({ success: false, message: 'Hvert bevis må ha en fileUrl.' });
        }
        validatedEvidence.push({
          fileUrl: item.fileUrl,
          fileType: item.fileType || 'unknown',
          description: item.description || '',
          uploadedAt: new Date(),
        });
      }
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat ikke funnet.' });

    const isParticipant =
      String(chat.clientId) === String(userId) ||
      String(chat.providerId) === String(userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Ikke autorisert.' });
    }

    // The reported user is the other participant
    const reportedUserId =
      String(chat.clientId) === String(userId) ? chat.providerId : chat.clientId;

    // Validate message ID when scope = 'message'
    let validatedMessageId = null;
    if (scope === 'message') {
      if (!messageId) {
        return res.status(400).json({ success: false, message: 'messageId er påkrevd for meldingsrapporter.' });
      }
      const msgExists = chat.messages.some((m) => String(m._id) === String(messageId));
      if (!msgExists) {
        return res.status(400).json({ success: false, message: 'Meldingen ble ikke funnet i denne chatten.' });
      }
      validatedMessageId = messageId;
    }

    // Duplicate prevention: same user, same chat, same type within 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await ChatReport.findOne({
      chatId,
      reportedBy: userId,
      reportType,
      createdAt: { $gte: oneDayAgo },
    });
    if (duplicate) {
      return res.status(429).json({
        success: false,
        message: 'Du har allerede sendt en lignende rapport for denne chatten nylig.',
      });
    }

    const report = await ChatReport.create({
      chatId,
      orderId: chat.orderId ?? null,
      serviceId: chat.serviceId ?? null,
      safePayOrderId: chat.orderId ?? null,
      messageId: validatedMessageId,
      scope,
      reportedBy: userId,
      reportedUser: reportedUserId,
      reportType,
      title: title.trim(),
      description: description.trim(),
      evidence: validatedEvidence,
      timeline: [{ action: 'report_opened', actorId: userId, description: `Rapport åpnet: ${reportType}` }],
    });

    // Notify Super Admins
    const admins = await User.find({ role: 'superAdmin', isDeleted: { $ne: true } }, { _id: 1 }).lean();
    await Promise.all(
      admins.map((admin) =>
        Notification.create({
          userId: admin._id,
          type: 'system',
          content: `Ny chatrapport: ${title.trim()} (${reportType})`,
          senderId: userId,
        }).catch(() => {})
      )
    );

    return res.status(201).json({
      success: true,
      message: 'Rapport sendt inn. Admin vil gjennomgå den snart.',
      reportId: report._id,
    });
  } catch (err) {
    console.error('[ChatReport] submitReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Serverfeil.' });
  }
};

/**
 * POST /api/chats/:chatId/reports/evidence
 * Upload evidence files for a report (user-facing).
 */
exports.uploadEvidence = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Ingen filer lastet opp.' });
    }

    const urls = [];
    for (const file of req.files) {
      if (!ALLOWED_EVIDENCE_MIMES.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: `Ugyldig filtype: ${file.mimetype}.` });
      }
      if (file.size > MAX_EVIDENCE_SIZE) {
        return res.status(400).json({ success: false, message: `Fil ${file.originalname} er for stor (maks 5MB).` });
      }
      const fileUrl = await uploadToCloudinary(file, 'report-evidence');
      urls.push({ fileUrl, fileType: file.mimetype, originalName: file.originalname });
    }

    return res.status(200).json({ success: true, files: urls });
  } catch (err) {
    console.error('[ChatReport] uploadEvidence error:', err.message);
    return res.status(500).json({ success: false, message: 'Serverfeil ved opplasting.' });
  }
};

/**
 * GET /api/chats/:chatId/reports/me
 * Authenticated user views their own reports for a chat.
 */
exports.getMyReports = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: 'Ugyldig Chat ID.' });
    }

    const chat = await Chat.findById(chatId).select('clientId providerId').lean();
    if (!chat) return res.status(404).json({ success: false, message: 'Chat ikke funnet.' });

    const isParticipant =
      String(chat.clientId) === String(userId) || String(chat.providerId) === String(userId);
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Ikke autorisert.' });

    const reports = await ChatReport.find({ chatId, reportedBy: userId })
      .select('reportType title status scope createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, reports });
  } catch {
    return res.status(500).json({ success: false, message: 'Serverfeil.' });
  }
};
