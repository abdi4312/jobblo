const ChatReport = require('../../models/ChatReport');
const { uploadToCloudinary } = require('../../utils/cloudinaryUpload');
const { parseObjectId } = require('../../utils/pagination');
const { asyncHandler, sendSuccess, sendError } = require('../../utils/apiResponse');

/**
 * POST /api/admin/chat-reports/:reportId/evidence
 * Upload evidence files for a chat report.
 */
exports.uploadEvidence = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.reportId);
  if (!id) return sendError(res, 'Ugyldig rapport-ID.', 400);

  const report = await ChatReport.findById(id);
  if (!report) return sendError(res, 'Rapport ikke funnet.', 404);

  if (!req.files || req.files.length === 0) {
    return sendError(res, 'Ingen filer lastet opp.', 400);
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  const evidenceItems = [];

  for (const file of req.files) {
    if (!allowedMimes.includes(file.mimetype)) {
      return sendError(res, `Ugyldig filtype: ${file.mimetype}. Tillatte: JPEG, PNG, GIF, WebP, PDF.`, 400);
    }
    if (file.size > maxSize) {
      return sendError(res, `Fil ${file.originalname} er for stor (maks 5MB).`, 400);
    }

    const fileUrl = await uploadToCloudinary(file, 'report-evidence');

    evidenceItems.push({
      fileUrl,
      fileType: file.mimetype,
      description: req.body.description || '',
      uploadedAt: new Date(),
    });
  }

  report.evidence.push(...evidenceItems);
  report.timeline.push({
    action: 'evidence_added',
    actorId: req.user._id,
    description: `${evidenceItems.length} vedlegg lastet opp`,
  });
  await report.save();

  return sendSuccess(res, { evidence: evidenceItems }, 'Vedlegg lastet opp.');
});
