const NorwayCounty = require('../models/NorwayCounty');
const NorwayMunicipality = require('../models/NorwayMunicipality');
const NorwayArea = require('../models/NorwayArea');
const Service = require('../models/Service');

/**
 * GET /api/location-filter/tree
 * Returns the complete location tree with counties, municipalities, and areas
 */
/**
 * Pure: county → municipality → area tree, each level in the input order. One pass to group
 * by parent code (the old version re-filtered every list for every parent: O(n·m)).
 */
function buildLocationTree(counties, municipalities, areas) {
  const group = (rows, key) => rows.reduce((m, r) => m.set(r[key], [...(m.get(r[key]) || []), r]), new Map());
  const areasBy = group(areas, 'municipalityCode');
  const municipalitiesBy = group(municipalities, 'countyCode');
  return counties.map((county) => ({
    type: 'county',
    code: county.code,
    name: county.name,
    children: (municipalitiesBy.get(county.code) || []).map((m) => ({
      type: 'municipality',
      code: m.code,
      name: m.name,
      children: (areasBy.get(m.code) || []).map((a) => ({ type: 'area', code: a.code, name: a.name })),
    })),
  }));
}
exports.buildLocationTree = buildLocationTree;

exports.getLocationTree = async (req, res) => {
  try {
    const fields = 'code name countyCode municipalityCode';
    const [counties, municipalities, areas] = await Promise.all([
      NorwayCounty.find().sort({ name: 1 }).select(fields).lean(),
      NorwayMunicipality.find().sort({ name: 1 }).select(fields).lean(),
      NorwayArea.find().sort({ name: 1 }).select(fields).lean(),
    ]);
    res.json(buildLocationTree(counties, municipalities, areas));
  } catch (err) {
    console.error('Location Tree Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/location-filter/stats
 * Returns job count per location
 */
exports.getLocationStats = async (req, res) => {
  try {
    // Get count per county
    const countyStats = await Service.aggregate([
      { $match: { status: { $in: ['open', 'active'] }, countyCode: { $ne: null } } },
      { $group: { _id: '$countyCode', count: { $sum: 1 } } },
    ]);

    // Get count per municipality
    const municipalityStats = await Service.aggregate([
      { $match: { status: { $in: ['open', 'active'] }, municipalityCode: { $ne: null } } },
      { $group: { _id: '$municipalityCode', count: { $sum: 1 } } },
    ]);

    // Get count per area
    const areaStats = await Service.aggregate([
      { $match: { status: { $in: ['open', 'active'] }, areaCode: { $ne: null } } },
      { $group: { _id: '$areaCode', count: { $sum: 1 } } },
    ]);

    // Format the stats into a single object for easier lookup
    const stats = {
      counties: {},
      municipalities: {},
      areas: {},
    };

    countyStats.forEach((s) => {
      stats.counties[s._id] = s.count;
    });

    municipalityStats.forEach((s) => {
      stats.municipalities[s._id] = s.count;
    });

    areaStats.forEach((s) => {
      stats.areas[s._id] = s.count;
    });

    res.json(stats);
  } catch (err) {
    console.error('Location Stats Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
