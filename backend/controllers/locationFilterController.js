const NorwayCounty = require("../models/NorwayCounty");
const NorwayMunicipality = require("../models/NorwayMunicipality");
const NorwayArea = require("../models/NorwayArea");
const Service = require("../models/Service");

/**
 * GET /api/location-filter/tree
 * Returns the complete location tree with counties, municipalities, and areas
 */
exports.getLocationTree = async (req, res) => {
  try {
    const counties = await NorwayCounty.find().sort({ name: 1 });
    const municipalities = await NorwayMunicipality.find().sort({ name: 1 });
    const areas = await NorwayArea.find().sort({ name: 1 });

    // Build tree structure
    const tree = counties.map((county) => {
      const countyMunicipalities = municipalities.filter(
        (m) => m.countyCode === county.code
      );

      const municipalityChildren = countyMunicipalities.map((municipality) => {
        const municipalityAreas = areas.filter(
          (a) => a.municipalityCode === municipality.code
        );

        return {
          type: "municipality",
          code: municipality.code,
          name: municipality.name,
          children: municipalityAreas.map((area) => ({
            type: "area",
            code: area.code,
            name: area.name,
          })),
        };
      });

      return {
        type: "county",
        code: county.code,
        name: county.name,
        children: municipalityChildren,
      };
    });

    res.json(tree);
  } catch (err) {
    console.error("Location Tree Error:", err);
    res.status(500).json({ error: "Internal server error" });
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
      { $match: { status: { $in: ["open", "active"] }, countyCode: { $ne: null } } },
      { $group: { _id: "$countyCode", count: { $sum: 1 } } },
    ]);

    // Get count per municipality
    const municipalityStats = await Service.aggregate([
      { $match: { status: { $in: ["open", "active"] }, municipalityCode: { $ne: null } } },
      { $group: { _id: "$municipalityCode", count: { $sum: 1 } } },
    ]);

    // Get count per area
    const areaStats = await Service.aggregate([
      { $match: { status: { $in: ["open", "active"] }, areaCode: { $ne: null } } },
      { $group: { _id: "$areaCode", count: { $sum: 1 } } },
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
    console.error("Location Stats Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
