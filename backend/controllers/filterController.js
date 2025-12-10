const Service = require("../models/Service");

/**
 * @desc Hent tilgjengelige filtervalg
 * @route GET /api/filter/options
 * @access Public
 */
exports.getFilterOptions = async (req, res) => {
    try {
        // Distinct category names
        const categories = await Service.distinct("categories");

        // Price range calculation
        const priceStats = await Service.aggregate([
            {
                $group: {
                    _id: null,
                    min: { $min: "$price" },
                    max: { $max: "$price" }
                }
            }
        ]);

        const priceRange = priceStats.length
            ? { min: priceStats[0].min, max: priceStats[0].max }
            : { min: 0, max: 10000 };

        return res.status(200).json({
            success: true,
            filters: {
                categories,
                priceRange,
                sortOptions: [
                    "newest",
                    "price_low",
                    "price_high",
                    "rating_high",
                    "nearby"
                ],
                flags: ["urgentOnly"]
            }
        });
    } catch (error) {
        console.error("GET FILTER OPTIONS ERROR:", error);
        return res.status(500).json({
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
            verifiedProvidersOnly,
            searchKeyword,
            sortBy
        } = req.body;

        const query = {};

        // KATEGORIER
        if (Array.isArray(categories) && categories.length > 0) {
            query.categories = { $in: categories };
        }

        // PRIS
        if (priceRange && (priceRange.min != null || priceRange.max != null)) {
            query.price = {
                $gte: priceRange.min ?? 0,
                $lte: priceRange.max ?? 100000
            };
        }

        // URGENT FILTER
        if (urgentOnly === true) {
            query.urgent = true;
        }

        // VERIFIED PROVIDERS ONLY
        if (verifiedProvidersOnly === true) {
            query["userId.verified"] = true;
        }

        // SØKEORD
        if (searchKeyword && typeof searchKeyword === "string") {
            const regex = new RegExp(searchKeyword, "i");
            query.$or = [
                { title: regex },
                { description: regex },
                { categories: regex }
            ];
        }

        // GEO-FILTER (stronger validation)
        if (
            location &&
            typeof location.lat === "number" &&
            typeof location.lng === "number" &&
            typeof location.radius === "number"
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

        // SORT LOGIC
        let sortQuery = { createdAt: -1 }; // Default = newest

        if (sortBy === "price_low") sortQuery = { price: 1 };
        if (sortBy === "price_high") sortQuery = { price: -1 };
        if (sortBy === "rating_high") sortQuery = { rating: -1 };
        if (sortBy === "newest") sortQuery = { createdAt: -1 };

        // TODO: "nearby" sorting requires geo + distance calculation

        const services = await Service.find(query)
            .populate("userId", "name avatarUrl verified")
            .populate("categories", "name")
            .sort(sortQuery)
            .limit(200); // Prevent huge overload

        return res.status(200).json({
            success: true,
            count: services.length,
            results: services
        });

    } catch (error) {
        console.error("APPLY FILTER ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Kunne ikke hente filtrerte resultater",
            error: error.message
        });
    }
};
