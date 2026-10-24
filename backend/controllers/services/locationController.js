const Service = require('../../models/Service');
const JobRequest = require('../../models/JobRequest');
const { PUBLIC_SERVICE_STATUSES } = require('../../constants/serviceVisibility');
const { recordSearch } = require('../../services/monitoring/searchHealth');
const { withDefaults } = require('../../utils/lean');
const { isValidId } = require('./serviceHelpers');

/** Listing location: set coordinates and the nearby search. */

// ------------------- GeoJSON Endpoints -------------------

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, address, city } = req.body;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid service ID' });

    // Authenticated but NOT authorized: this wrote straight to findByIdAndUpdate, so
    // any logged-in user could relocate someone else's job — and because the whole
    // `location` object is replaced, omitting address/city wiped them too.
    const existing = await Service.findById(id).select('userId');
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (String(existing.userId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Ikke autorisert. Du eier ikke dette oppdraget.' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude og longitude må være tall' });
    }

    const service = await Service.findByIdAndUpdate(
      id,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          address,
          city,
        },
      },
      { new: true }
    );

    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Fetch applicant count if maxApplicants is set
    let applicantCount = 0;
    if (service.maxApplicants > 0) {
      applicantCount = await JobRequest.countDocuments({
        serviceId: service._id,
        status: { $in: ['pending', 'accepted'] },
      });
    }

    const serviceData = service.toObject();
    serviceData.currentApplicants = applicantCount;
    serviceData.isLimitReached =
      service.maxApplicants > 0 && applicantCount >= service.maxApplicants;

    res.json(serviceData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getNearbyServices = async (req, res) => {
  const startedAt = Date.now();
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius)
      return res.status(400).json({ error: 'Missing lat, lng or radius' });
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radius);
    if (!(Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180 && radiusNum > 0))
      return res.status(400).json({ error: 'Invalid lat, lng or radius' });

    // Public route: like getAllServices, only public listings (it returned drafts,
    // cancelled and completed jobs), with a capped radius and result count.
    const services = await Service.find({
      status: { $in: PUBLIC_SERVICE_STATUSES },
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lngNum, latNum] },
          $maxDistance: Math.min(radiusNum, 200_000),
        },
      },
    })
      .limit(50)
      .lean();

    recordSearch({ kind: 'nearby', radiusKm: Math.round(Math.min(radiusNum, 200_000) / 1000), results: services.length, ms: Date.now() - startedAt });
    res.json(withDefaults(Service, services));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
