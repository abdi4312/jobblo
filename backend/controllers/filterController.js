const Service = require("../models/Service");
const Category = require("../models/Category");

/**
 * @desc Hent tilgjengelige filtervalg
 * @route GET /api/filter/options
 * @access Public
 */
exports.getFilterOptions = async (req, res) => {
  try {
    // 1. Get Job counts per category (only for 'open' services)
    const categoryCounts = await Service.aggregate([
      { $match: { status: "open" } },
      { $unwind: "$categories" },
      {
        $group: {
          _id: { $trim: { input: "$categories" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map with normalized keys (lowercase and trimmed)
    const catCountMap = {};
    categoryCounts.forEach((c) => {
      if (c._id) {
        catCountMap[c._id.toLowerCase()] = c.count;
      }
    });

    // 2. Get Job counts per location (city)
    const locationCounts = await Service.aggregate([
      { $match: { status: "open", "location.city": { $ne: null } } },
      {
        $group: {
          _id: { $trim: { input: "$location.city" } },
          count: { $sum: 1 },
        },
      },
    ]);
    const locCountMap = locationCounts.map((l) => ({
      name: l._id,
      count: l.count,
    }));

    // 3. Get Job counts for Urgent (Fiks ferdig)
    const urgentCount = await Service.countDocuments({
      status: "open",
      urgent: true,
    });

    // Fetch all top-level categories and their subcategories
    let allCategories = await Category.find({ isActive: true }).lean();

    let categoryTree = [];
    if (allCategories.length > 0) {
      // Organize categories hierarchically
      categoryTree = allCategories
        .filter((cat) => !cat.parentId)
        .map((parent) => ({
          ...parent,
          count: catCountMap[parent.name.trim().toLowerCase()] || 0,
          subcategories: allCategories
            .filter(
              (sub) =>
                sub.parentId &&
                sub.parentId.toString() === parent._id.toString(),
            )
            .map((sub) => ({
              ...sub,
              count: catCountMap[sub.name.trim().toLowerCase()] || 0,
            })),
        }));
    } else {
      // Fallback: Get distinct categories from Services if Category collection is empty
      const distinctCats = await Service.distinct("categories");
      categoryTree = distinctCats.map((name) => {
        const trimmedName = name.trim();
        return {
          _id: trimmedName,
          name: trimmedName,
          count: catCountMap[trimmedName.toLowerCase()] || 0,
          subcategories: [],
        };
      });
    }

    return res.status(200).json({
      success: true,
      filters: {
        categories: categoryTree,
        locations: locCountMap.sort((a, b) => a.name.localeCompare(b.name)),
        urgentCount,
        priceRange: { min: 0, max: 100000 },
        sortOptions: [
          { label: "Newest first", value: "newest" },
          { label: "Price: low to high", value: "price_low" },
          { label: "Price: high to low", value: "price_high" },
          { label: "Most relevant", value: "relevant" },
        ],
        types: [
          { label: "Buy", value: "sale", count: 0 },
          { label: "Free", value: "free", count: 0 },
          { label: "Wanted", value: "wanted", count: 0 },
        ],
      },
    });
  } catch (error) {
    console.error("GET FILTER OPTIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch filter options",
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
      locations,
      priceRange,
      urgentOnly,
      verifiedProvidersOnly,
      searchKeyword,
      sortBy,
      type,
      page = 1,
      limit = 20,
    } = req.body;

    const query = {};

    // KATEGORIER (handles both category names and subcategories)
    if (Array.isArray(categories) && categories.length > 0) {
      query.categories = { $in: categories };
    }

    // LOCATIONS (Cities)
    if (Array.isArray(locations) && locations.length > 0) {
      query["location.city"] = { $in: locations };
    }

    // PRIS
    if (priceRange && (priceRange.min != null || priceRange.max != null)) {
      query.price = {};
      if (priceRange.min != null) query.price.$gte = priceRange.min;
      if (priceRange.max != null) query.price.$lte = priceRange.max;
    }

    // URGENT FILTER
    if (urgentOnly === true) {
      query.urgent = true;
    }

    // SØKEORD (Search within category or globally)
    if (searchKeyword && typeof searchKeyword === "string") {
      const regex = new RegExp(searchKeyword, "i");
      query.$or = [
        { title: regex },
        { description: regex },
        { categories: regex },
        { tags: regex },
      ];
    }

    // TYPE ANNONSE (If your model supports this, otherwise we can add it or ignore)
    if (type) {
      // query.type = type;
    }

    // SORT LOGIC
    let sortQuery = { createdAt: -1 };

    if (sortBy === "price_low") sortQuery = { price: 1 };
    if (sortBy === "price_high") sortQuery = { price: -1 };
    if (sortBy === "newest") sortQuery = { createdAt: -1 };
    // "relevant" uses default sort or text search score if searchKeyword is present

    const skip = (page - 1) * limit;

    const services = await Service.find(query)
      .populate("userId", "name avatarUrl verified")
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const total = await Service.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: services.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      results: services,
    });
  } catch (error) {
    console.error("APPLY FILTER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Kunne ikke hente filtrerte resultater",
      error: error.message,
    });
  }
};
