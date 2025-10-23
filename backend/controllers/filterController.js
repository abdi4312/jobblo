// controllers/FilterController.js

const Filter = require("../models/Filter");
const Service = require("../models/Service");

/**
 * @desc Hent tilgjengelige filtervalg
 * @route GET /api/filter/options
 * @access Public
 */
exports.getFilterOptions = async (req, res) => {
    try {
        // Hent unike kategorier fra eksisterende jobber
        const categories = await Service.distinct("category");

        // Beregn prisintervall (min og maks pris i databasen)
        const priceStats = await Service.aggregate([
            {
                $group: {
                    _id: null,
                    min: { $min: "$price" },
                    max: { $max: "$price" },
                },
            },
        ]);

        // Sett standardverdier hvis ingen data finnes
        const priceRange = priceStats[0] || { min: 0, max: 10000 };

        res.status(200).json({
            success: true,
            filters: {
                categories,
                priceRange,
                sortOptions: [
                    "newest",
                    "price_low",
                    "price_high",
                    "rating_high",
                    "nearby",
                ],
                flags: ["urgentOnly", "verifiedProvidersOnly"],
            },
        });
    } catch (error) {
        console.error("Error fetching filter options:", error);
        res.status(500).json({
            success: false,
            message: "Kunne ikke hente filtervalg",
            error: error.message,
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
            sortBy,
        } = req.body;

        const query = {};

        // Kategori-filter
        if (categories && categories.length > 0) {
            query.category = { $in: categories };
        }

        // Prisintervall
        if (priceRange && (priceRange.min || priceRange.max)) {
            query.price = {
                $gte: priceRange.min || 0,
                $lte: priceRange.max || 100000,
            };
        }

        // Urgent
        if (urgentOnly) query.urgent = true;

        // Søkeord
        if (searchKeyword && searchKeyword.trim() !== "") {
            query.$or = [
                { title: { $regex: searchKeyword, $options: "i" } },
                { description: { $regex: searchKeyword, $options: "i" } },
                { category: { $regex: searchKeyword, $options: "i" } },
            ];
        }

        // Geo-lokasjon (radius)
        if (
            location &&
            location.coordinates &&
            location.coordinates.lat &&
            location.coordinates.lng
        ) {
            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [
                            location.coordinates.lng,
                            location.coordinates.lat,
                        ],
                    },
                    $maxDistance: (location.radius || 10) * 1000, // km → meter
                },
            };
        }

        // Sortering
        let sortQuery = { createdAt: -1 };
        switch (sortBy) {
            case "price_low":
                sortQuery = { price: 1 };
                break;
            case "price_high":
                sortQuery = { price: -1 };
                break;
            case "rating_high":
                sortQuery = { rating: -1 };
                break;
            case "nearby":
                sortQuery = { distance: 1 };
                break;
        }

        // Hent resultater
        const services = await Service.find(query)
            .sort(sortQuery)
            .limit(100)
            .populate("userId", "name avatarUrl rating");

        // Lagre filteret for brukeren (valgfritt)
        if (req.user?._id) {
            const filter = new Filter({
                userId: req.user._id,
                categories,
                priceRange,
                location,
                urgentOnly,
                verifiedProvidersOnly,
                searchKeyword,
                sortBy,
            });
            await filter.save();
        }

        res.status(200).json({
            success: true,
            count: services.length,
            results: services,
        });
    } catch (error) {
        console.error("Error applying filters:", error);
        res.status(500).json({
            success: false,
            message: "Kunne ikke hente filtrerte resultater",
            error: error.message,
        });
    }
};
