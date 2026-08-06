const JobReport = require('../models/JobReport');
const Service = require('../models/Service');

// POST /api/services/:serviceId/reports
exports.submitJobReport = async (req, res) => {
  try {
    const { id: serviceId } = req.params;
    const { reportType, description } = req.body;

    if (!reportType || !JobReport.VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({ error: 'Ugyldig rapporttype.' });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'Beskrivelse er påkrevd.' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Annonse ikke funnet.' });
    }

    if (String(service.userId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Du kan ikke rapportere din egen annonse.' });
    }

    // Duplicate prevention: one open/under-review report per user per listing
    const existing = await JobReport.findOne({
      serviceId,
      reportedBy: req.user._id,
      status: { $in: ['open', 'under_review'] },
    });

    if (existing) {
      return res.status(409).json({ error: 'Du har allerede rapportert denne annonsen.' });
    }

    const report = await JobReport.create({
      serviceId,
      reportedBy: req.user._id,
      reportedUser: service.userId,
      reportType,
      description: String(description).trim(),
    });

    return res.status(201).json({
      success: true,
      data: {
        reportId: report._id,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
