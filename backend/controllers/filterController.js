const Filter = require("../models/Filter");
const Service = require("../models/Service");

/**
 * @desc Hent tilgjengelige filtervalg
 * @route GET /api/filter/options
 * @access Public
 */
exports.getFilterOptions = async (req, res) => {
    try {
        // Alle kategorier (array)
        const categories = await Service.distinct("categories");

        // Prisintervall
        const priceStats = await Service.aggregate([
            {
                $group: {
                    _id: null,
                    min: { $min: "$price" },
                    max: { $max: "$price" }
                }
            }
        ]);

        const priceRange =
            priceStats.length > 0
                ? priceStats[0]
                : { min: 0, max: 10000 };

        res.status(200).json({
            success: true,
            filters: {
                categories,
                priceRange,
                sortOptions: [
                    "newest",
                    "price_low",
                    "price_high",
                    "nearby"
                ],
                flags: ["urgentOnly"]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Kunne ikke hente filtervalg",
            error: error.message
        });
    }
};

/**
 * @desc Bruk valgte filter og hent resultater
 * @route POST /api/filter/apply
 * @access Public
 */
exports.applyFilters = async (req, res) => {
    try {
        const {
            categories,
            priceRange,
            location,
            urgentOnly,
            searchKeyword,
            sortBy
        } = req.body;

        const query = {};

        // KATEGORIER
        if (categories?.length > 0) {
            query.categories = { $in: categories };
        }

        // PRIS
        if (priceRange) {
            query.price = {
                $gte: priceRange.min ?? 0,
                $lte: priceRange.max ?? 100000
            };
        }

        // URGENT
        if (urgentOnly) {
            query.urgent = true;
        }

        // SØKEORD
        if (searchKeyword) {
            const regex = { $regex: searchKeyword, $options: "i" };
            query.$or = [
                { title: regex },
                { description: regex },
                { categories: regex }
            ];
        }

        // GEO-FILTER
        if (
            location &&
            location.lat &&
            location.lng &&
            location.radius
        ) {
            query.location = {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [location.lng, location.lat]
                    },
                    $maxDistance: location.radius * 1000
                }
            };
        }

        // SORTERING
        let sortQuery = { createdAt: -1 };

        if (sortBy === "price_low") sortQuery = { price: 1 };
        if (sortBy === "price_high") sortQuery = { price: -1 };
        if (sortBy === "newest") sortQuery = { createdAt: -1 };

        // HENT RESULTATER
        const services = await Service.find(query)
            .populate("userId", "name avatarUrl verified")
            .limit(200)
            .sort(sortQuery);

        res.status(200).json({
            success: true,
            count: services.length,
            results: services
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Kunne ikke hente filtrerte resultater",
            error: error.message
        });
    }
};
