const User = require('../../models/User');
const Service = require('../../models/Service');
const Category = require('../../models/Category');
const List = require('../../models/List');
const { PUBLIC_USER_SELECT, sanitizeUserPublic } = require('../../utils/userProjections');

/** User search, top providers and the unified search (categories, people, jobs, public lists). */

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.query || req.query.q;
    if (!query || query.length < 2) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: req.userId }, // Exclude current user
      isDeleted: { $ne: true },
    })
      .select(PUBLIC_USER_SELECT)
      .limit(10);

    res.status(200).json(users.map(sanitizeUserPublic));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Top 10 Users by Rating and Reviews (only paid subscription users)
exports.getTopUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      _id: { $ne: req.userId },
      isDeleted: { $ne: true },
      // TODO: Uncomment below when paid users exist to restrict to paid only
      // subscription: { $ne: 'Standard' },
    };

    const baseSelect =
      'name lastName email avatarUrl averageRating reviewCount subscription skills hourlyRate locations postNumber postSted';
    const sort = { reviewCount: -1, averageRating: -1 };

    // Location-aware ordering:
    // 1. Same location — postSted matches viewer city, OR postSted/address
    //    contains a location token from the viewer (e.g. "Haroonabad" from
    //    "Dahranwala - Haroonabad Road"). Works for any country.
    // 2. Same postnr-region (first 2 digits) — nearby for Norwegian post codes.
    // 3. Broader region (first 1 digit).
    // 4. Everyone else (top rated).
    const prefix =
      typeof req.query.postNumber === 'string' ? req.query.postNumber.trim().slice(0, 2) : '';
    const isNumericPrefix = /^\d{2}$/.test(prefix);
    const city = typeof req.query.postSted === 'string' ? req.query.postSted.trim() : '';
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';

    if (isNumericPrefix || city || address) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match a string ignoring casing and spaces: "Haroon Abad" == "Haroonabad"
      const fuzzyRegex = (c, anchored) => {
        const normalized = c.toLowerCase().replace(/[^a-zæøå0-9]/g, '');
        if (!normalized) return null;
        const pattern = normalized
          .split('')
          .map((ch) => `${escapeRegex(ch)}\\s*`)
          .join('');
        return new RegExp(`${anchored ? '^' : ''}${pattern}${anchored ? '$' : ''}`, 'i');
      };

      const STOP_WORDS = new Set([
        'road',
        'street',
        'gate',
        'gata',
        'veg',
        'vei',
        'veien',
        'rd',
        'st',
        'no',
        'nr',
        'norge',
        'norway',
        'pakistan',
        'punjab',
        'highway',
        'motorway',
      ]);
      const extractTokens = (...strings) => {
        const set = new Set();
        for (const s of strings) {
          const normalized = (s || '')
            .toLowerCase()
            .replace(/[^a-zæøå0-9]+/g, ' ')
            .trim();
          for (const tok of normalized.split(' ')) {
            if (tok.length >= 4 && !STOP_WORDS.has(tok)) set.add(tok);
          }
        }
        return [...set];
      };

      const prefix1 = prefix.slice(0, 1);
      const cityReg = fuzzyRegex(city, true);
      const tokens = extractTokens(city, address);
      const tokenRegs = tokens.map((t) => fuzzyRegex(t, false));

      // Tier 1: same location
      const tier1Or = [];
      if (cityReg) tier1Or.push({ postSted: { $regex: cityReg } });
      for (const re of tokenRegs) {
        tier1Or.push({ postSted: { $regex: re } });
        tier1Or.push({ address: { $regex: re } });
      }

      const seen = new Set();
      let nearbyCount = 0;
      const mark = (u, nearby) => ({ ...u, nearby: !!nearby });
      const pushUnique = (arr, u, nearby) => {
        const key = String(u._id);
        if (seen.has(key)) return;
        seen.add(key);
        if (nearby) nearbyCount += 1;
        arr.push(mark(u, nearby));
      };

      const [nearby, samePrefix, region] = await Promise.all([
        tier1Or.length
          ? User.find({ ...filter, $or: tier1Or })
              .select(baseSelect)
              .sort(sort)
              .lean()
          : [],
        isNumericPrefix
          ? User.find({ ...filter, postNumber: { $regex: `^${prefix}` } })
              .select(baseSelect)
              .sort(sort)
              .lean()
          : [],
        isNumericPrefix
          ? User.find({ ...filter, postNumber: { $regex: `^${prefix1}` } })
              .select(baseSelect)
              .sort(sort)
              .lean()
          : [],
      ]);

      const ordered = [];
      nearby.forEach((u) => pushUnique(ordered, u, true));
      samePrefix.forEach((u) => pushUnique(ordered, u, true));
      region.forEach((u) => pushUnique(ordered, u, false));

      const othersFilter = { ...filter };
      if (tier1Or.length) {
        othersFilter.postSted = { $nin: [cityReg, ...tokenRegs].filter(Boolean) };
        othersFilter.address = { $nin: tokenRegs.length ? tokenRegs : [cityReg].filter(Boolean) };
      }
      if (isNumericPrefix) othersFilter.postNumber = { $nin: [new RegExp(`^${prefix1}`)] };

      const othersSkip = Math.max(0, skip - ordered.length);
      const othersLimit = Math.max(0, skip + limit - ordered.length);
      if (othersLimit > 0) {
        const others = await User.find(othersFilter)
          .select(baseSelect)
          .sort(sort)
          .skip(othersSkip)
          .limit(othersLimit)
          .lean();
        others.forEach((u) => pushUnique(ordered, u, false));
      }

      const paginated = ordered.slice(skip, skip + limit).map(sanitizeUserPublic);
      const [total] = await Promise.all([User.countDocuments(filter)]);

      return res.status(200).json({
        data: paginated,
        location: { nearbyCount },
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const [topUsers, total] = await Promise.all([
      User.find(filter).select(baseSelect).sort(sort).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      data: topUsers.map(sanitizeUserPublic),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Unified Search for Categories, People, Jobs, and Public Lists with Pagination
exports.searchAll = async (req, res) => {
  try {
    const { query, type, page = 1, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        categories: { results: [], total: 0 },
        people: { results: [], total: 0 },
        jobs: { results: [], total: 0 },
        lists: { results: [], total: 0 },
      });
    }

    const regex = new RegExp(query, 'i');
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const numericLimit = parseInt(limit);

    // If a specific type is requested, return only that type with pagination
    if (type) {
      let results = [];
      let total = 0;

      if (type === 'categories') {
        total = await Category.countDocuments({ name: regex, isActive: true });
        results = await Category.find({ name: regex, isActive: true })
          .skip(skip)
          .limit(numericLimit);
      } else if (type === 'people') {
        const queryObj = {
          $or: [{ name: regex }, { lastName: regex }, { email: regex }],
          _id: { $ne: req.userId },
          isDeleted: { $ne: true },
        };
        total = await User.countDocuments(queryObj);
        results = (
          await User.find(queryObj)
            .select('name lastName avatarUrl email averageRating reviewCount')
            .skip(skip)
            .limit(numericLimit)
        ).map(sanitizeUserPublic);
      } else if (type === 'jobs') {
        total = await Service.countDocuments({
          $or: [{ title: regex }, { description: regex }],
          status: { $nin: ['draft', 'cancelled', 'closed', 'expired'] },
        });
        results = await Service.find({
          $or: [{ title: regex }, { description: regex }],
          status: { $nin: ['draft', 'cancelled', 'closed', 'expired'] },
        })
          .skip(skip)
          .limit(numericLimit);
      } else if (type === 'lists') {
        total = await List.countDocuments({ name: regex, public: true });
        results = await List.find({ name: regex, public: true })
          .populate('services')
          .skip(skip)
          .limit(numericLimit);
      }

      return res.status(200).json({
        results,
        total,
        page: parseInt(page),
        limit: numericLimit,
        totalPages: Math.ceil(total / numericLimit),
      });
    }

    // Default: return top 3 for each category (for the initial search dropdown)
    // 1. Search Categories
    const categoriesCount = await Category.countDocuments({
      name: regex,
      isActive: true,
    });
    const categories = await Category.find({
      name: regex,
      isActive: true,
    }).limit(3);

    // 2. Search Jobs (Services)
    const jobsCount = await Service.countDocuments({
      $or: [{ title: regex }, { description: regex }],
      status: { $nin: ['draft', 'cancelled', 'closed', 'expired'] },
    });
    const jobs = await Service.find({
      $or: [{ title: regex }, { description: regex }],
      status: { $nin: ['draft', 'cancelled', 'closed', 'expired'] },
    }).limit(3);

    // 3. Search People (Users)
    const peopleCount = await User.countDocuments({
      $or: [{ name: regex }, { lastName: regex }, { email: regex }],
      _id: { $ne: req.userId },
      isDeleted: { $ne: true },
    });
    const people = (
      await User.find({
        $or: [{ name: regex }, { lastName: regex }, { email: regex }],
        _id: { $ne: req.userId },
        isDeleted: { $ne: true },
      })
        .select('name lastName avatarUrl email averageRating reviewCount')
        .limit(3)
    ).map(sanitizeUserPublic);

    // 4. Search Public Lists
    const listsCount = await List.countDocuments({
      name: regex,
      public: true,
    });
    const lists = await List.find({
      name: regex,
      public: true,
    })
      .populate('services')
      .limit(3);

    res.status(200).json({
      categories: { results: categories, total: categoriesCount },
      jobs: { results: jobs, total: jobsCount },
      people: { results: people, total: peopleCount },
      lists: { results: lists, total: listsCount },
    });
  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
