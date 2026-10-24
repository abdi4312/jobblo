const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { isBcryptHash } = require('../../utils/passwordUtils');
const User = require('../../models/User');
const Service = require('../../models/Service');
const JobRequest = require('../../models/JobRequest');
const Order = require('../../models/Order');
const List = require('../../models/List');
const { sendMongoError } = require('../../utils/mongoErrors');
const { PUBLIC_USER_SELECT, OWN_USER_SELECT, sanitizeUserPublic, sanitizeUserOwner } = require('../../utils/userProjections');
const { isValidId, authorizeUser } = require('./userHelpers');

/** User profiles: create, read (public vs owner view), update, delete (anonymise), their jobs, admin list. */

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      lastName,
      email,
      phone,
      avatarUrl,
      bio,
      role,
      birthDate,
      gender,
      address,
      postNumber,
      postSted,
      country,
      subscription,
      verified,
      lastLogin,
      availability,
      earnings,
      spending,
      oauthProviders,
    } = req.body;

    const user = new User({
      name,
      lastName,
      email,
      phone: phone?.trim() || undefined,
      avatarUrl,
      bio,
      role,
      birthDate,
      gender,
      address,
      postNumber,
      postSted,
      country,
      subscription,
      verified,
      lastLogin,
      availability,
      earnings,
      spending,
      oauthProviders,
    });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ error: 'Email or phone already exists' });
    }
    res.status(400).json({ error: err.message });
  }
};


exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const isSelf = String(req.userId) === String(id);

    const user = isSelf
      ? await User.findById(id).select(OWN_USER_SELECT)
      : await User.findOne({ _id: id, isDeleted: { $ne: true } }).select(PUBLIC_USER_SELECT);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const sanitized = isSelf ? sanitizeUserOwner(user) : sanitizeUserPublic(user);

    // Calculate posted jobs count (as poster)
    const postedJobsCount = await Service.countDocuments({ userId: id });

    // Calculate completed jobs (as provider: jobs user completed for others)
    const completedOrdersAsProvider = await Order.countDocuments({
      providerId: id,
      status: 'completed',
    });
    // Use either the incremented count from model OR recalculate to be safe
    const completedJobs = user.completedJobs || completedOrdersAsProvider;

    // Calculate response rate
    const totalJobRequests = await JobRequest.countDocuments({
      providerId: id,
    });
    const respondedJobRequests = await JobRequest.countDocuments({
      providerId: id,
      status: { $in: ['accepted', 'declined'] },
    });
    const responseRate =
      totalJobRequests > 0 ? Math.round((respondedJobRequests / totalJobRequests) * 100) : 100;

    // Calculate average response time
    const jobRequestsWithResponse = await JobRequest.find({
      providerId: id,
      status: { $in: ['accepted', 'declined'] },
    });
    let totalResponseTimeMs = 0;
    jobRequestsWithResponse.forEach((jr) => {
      if (jr.updatedAt && jr.createdAt) {
        totalResponseTimeMs += jr.updatedAt - jr.createdAt;
      }
    });
    const averageResponseTimeMinutes =
      jobRequestsWithResponse.length > 0
        ? Math.round(totalResponseTimeMs / (1000 * 60 * jobRequestsWithResponse.length))
        : 0;

    // Calculate repeat customers (customers who ordered more than once)
    const orders = await Order.find({
      providerId: id,
      status: { $in: ['completed', 'paid'] },
    });
    const customerCounts = {};
    orders.forEach((order) => {
      const customerId = order.customerId.toString();
      customerCounts[customerId] = (customerCounts[customerId] || 0) + 1;
    });
    const repeatCustomersCount = Object.values(customerCounts).filter((count) => count > 1).length;

    // Calculate hire rate (accepted job requests / total job requests)
    const acceptedJobRequests = await JobRequest.countDocuments({
      providerId: id,
      status: 'accepted',
    });
    const hireRate =
      totalJobRequests > 0 ? Math.round((acceptedJobRequests / totalJobRequests) * 100) : 0;

    // Calculate completion rate (completed orders / total accepted orders as provider)
    const totalAcceptedOrdersAsProvider = await Order.countDocuments({
      providerId: id,
      status: {
        $in: ['accepted', 'in_progress', 'completed', 'awaiting_payment', 'paid'],
      },
    });
    const completionRate =
      totalAcceptedOrdersAsProvider > 0
        ? Math.round((completedJobs / totalAcceptedOrdersAsProvider) * 100)
        : 0;

    // Calculate jobs this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const jobsThisMonth = await Service.countDocuments({
      userId: id,
      createdAt: { $gte: startOfMonth },
    });

    // Calculate total applications received (as a provider or as a poster?)
    // Let's calculate both: as a provider (received job requests) and as a poster (received on their services)
    const servicesByUser = await Service.find({ userId: id }, '_id');
    const serviceIds = servicesByUser.map((s) => s._id);
    const totalApplicationsReceived = await JobRequest.countDocuments({
      serviceId: { $in: serviceIds },
    });

    // Get user's reviews (as reviewee)
    const Review = require('../../models/Review');
    const reviews = await Review.find({ revieweeId: id })
      .populate('reviewerId', 'name lastName avatarUrl')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 });

    // Convert user to object and add the stats (merge sanitized doc + computed keys)
    const userObj = { ...sanitized };
    userObj.postedJobsCount = postedJobsCount;
    userObj.completedJobs = completedJobs;
    // `responseRate` is 100 when there are no requests to respond to, which is the right
    // default for sorting but reads as a boast on a profile — a brand-new account claimed
    // "Svarprosent 100 %" before anyone had ever contacted it. The client needs the
    // denominator to tell "answers everyone" apart from "has never been asked".
    userObj.totalJobRequests = totalJobRequests;
    userObj.responseRate = responseRate;
    userObj.averageResponseTimeMinutes = averageResponseTimeMinutes;
    userObj.repeatCustomersCount = repeatCustomersCount;
    userObj.hireRate = hireRate;
    userObj.completionRate = completionRate;
    userObj.jobsThisMonth = jobsThisMonth;
    userObj.totalApplicationsReceived = totalApplicationsReceived;
    userObj.reviews = reviews;

    res.json(userObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Authorization check
    if (!authorizeUser(req, id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Allowed fields for normal user
    const allowedUpdates = [
      'name',
      'email',
      'phone',
      'lastName',
      'bio',
      'experience',
      'birthDate',
      'gender',
      'address',
      'postNumber',
      'postSted',
      'country',
      'availabilityText',
      'skills',
      'portfolio',
      'previousProjects',
      'companyName',
      'orgNumber',
      'orgType',
      'locations',
      'website',
    ];

    if (req.user.role === 'superAdmin') {
      allowedUpdates.push('role');
      allowedUpdates.push('verified');
      allowedUpdates.push('isTrusted');
    }

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Normalize Norwegian post numbers on the server side.
    //
    // Postnummer is kept as a STRING throughout because Norwegian codes like
    // "0150" have a meaningful leading zero that `Number` / Mongo number types
    // would destroy. Clients are asked to submit digits only (max 4), and the
    // schema defines `trim: true`, but no previous code actually enforced
    // digits. This normalization is deliberately minimal:
    //   - strip everything that is not a digit
    //   - cap at 4 characters
    //   - accept empty / undefined as "no postcode set" — field is optional
    //
    // It avoids breaking any existing profile data because already-stored
    // values are not re-written on an UPDATE that does not include
    // `postNumber`.
    if (updates.postNumber !== undefined && updates.postNumber !== null) {
      const raw = String(updates.postNumber);
      const digits = raw.replace(/\D/g, '').slice(0, 4);
      updates.postNumber = digits;
    }

    // ⭐ HANDLE AVATAR UPLOAD
    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        updates.avatarUrl = req.files.avatar[0].path;
        updates.avatarPublicId = req.files.avatar[0].filename;
      }
      if (req.files.banner && req.files.banner[0]) {
        updates.bannerUrl = req.files.banner[0].path;
        updates.bannerPublicId = req.files.banner[0].filename;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const user = await User.findById(id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // The login e-mail is where reset codes go, so changing it takes the current
    // password: a stolen session alone must not be able to redirect account recovery.
    // A superAdmin editing someone else's account is exempt.
    if (updates.email !== undefined) {
      if (String(updates.email).trim().toLowerCase() === user.email) {
        delete updates.email;
      } else if (String(req.userId) === String(id)) {
        const { currentPassword } = req.body;
        const passwordOk =
          typeof currentPassword === 'string' &&
          isBcryptHash(user.password) &&
          (await bcrypt.compare(currentPassword, user.password));
        if (!passwordOk) {
          return res.status(403).json({
            code: 'CURRENT_PASSWORD_REQUIRED',
            error: isBcryptHash(user.password)
              ? 'Skriv inn nåværende passord for å endre e-postadressen.'
              : 'Opprett et passord under «Endre passord» før du endrer e-postadressen.',
          });
        }
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.json(sanitizeUserOwner(await User.findById(id).select(OWN_USER_SELECT)));
    }

    // Delete old avatar/banner from Azure when a new one is uploaded
    // (avatarPublicId / bannerPublicId now hold the Azure blob name).
    const { deleteFromAzure } = require('../../utils/azureUpload');
    if (req.files && req.files.avatar && user.avatarPublicId) {
      await deleteFromAzure(user.avatarPublicId);
    }
    if (req.files && req.files.banner && user.bannerPublicId) {
      await deleteFromAzure(user.bannerPublicId);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
      select: OWN_USER_SELECT,
    });
    res.json(sanitizeUserOwner(updatedUser));
  } catch (err) {
    // Was `res.status(400).json({ error: err.message })`, which forwarded the raw
    // driver string (E11000 duplicate key ... index: email_1 ...) to a toast.
    console.error('updateUser Error:', err);
    sendMongoError(res, err, 'Kunne ikke lagre endringene. Prøv igjen.');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (!authorizeUser(req, id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const user = await User.findById(id).select(
      'isDeleted email avatarPublicId bannerPublicId certifications'
    );
    if (!user || user.isDeleted) return res.status(404).json({ error: 'Fant ikke brukeren.' });

    const blockingOrders = await Order.countDocuments({
      $or: [{ customerId: id }, { providerId: id }],
      status: {
        $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed'],
      },
    });

    if (blockingOrders > 0) {
      return res.status(409).json({
        error:
          'Du har pågående oppdrag eller betalinger. Fullfør eller avslutt disse først, ' +
          'eller kontakt kundeservice, så hjelper vi deg med slettingen.',
        code: 'active_orders_exist',
      });
    }

    const { findBillingCapableSubscription } = require('../../services/stripe/subscriptionState');
    let stripe;
    try {
      stripe = require('../../config/stripe');
    } catch {
      stripe = null;
    }
    if (stripe) {
      try {
        const capable = await findBillingCapableSubscription(stripe, id);
        if (capable.blocking) {
          return res.status(409).json({
            error:
              'Du har et aktivt abonnement. Si opp abonnementet og vent til abonnementsperioden er avsluttet før du sletter profilen.',
            code: 'active_subscription_exists',
          });
        }
      } catch (subErr) {
        if (subErr?.code === 'subscription_check_unavailable') {
          return res.status(503).json({
            error: 'Kunne ikke verifisere abonnementsstatus akkurat nå. Prøv igjen litt senere.',
            code: 'subscription_check_unavailable',
          });
        }
        throw subErr;
      }
    }

    // Asset ids now hold Azure blob names. deleteFromAzure is already best-effort.
    const { deleteFromAzure: destroyPublicId } = require('../../utils/azureUpload');

    const assetCleanup = [];
    if (user.avatarPublicId) assetCleanup.push(destroyPublicId(user.avatarPublicId));
    if (user.bannerPublicId) assetCleanup.push(destroyPublicId(user.bannerPublicId));
    for (const cert of user.certifications || []) {
      if (cert?.publicId) assetCleanup.push(destroyPublicId(cert.publicId));
    }
    await Promise.allSettled(assetCleanup);

    const anonymised = {
      isDeleted: true,
      deletedAt: new Date(),
      accountStatus: 'deactivated',
      name: 'Slettet bruker',
      lastName: '',
      email: `slettet+${id}@jobblo.invalid`,
      phone: null,
      avatarUrl: null,
      avatarPublicId: null,
      bannerUrl: null,
      bannerPublicId: null,
      bio: null,
      about: null,
      address: null,
      postNumber: null,
      postSted: null,
      country: null,
      birthDate: null,
      gender: null,
      website: null,
      companyName: null,
      orgNumber: null,
      orgType: null,
      skills: [],
      locations: [],
      portfolio: [],
      previousProjects: [],
      certifications: [],
      experience: [],
      blockedUsers: [],
      favorites: [],
      pointsBalance: 0,
      pointsHistory: [],
      password: crypto.randomBytes(32).toString('hex'),
      refreshTokens: [],
      passwordResetToken: null,
      passwordResetExpires: null,
      oauthProviders: [],
      identityVerification: undefined,
      availability: [],
      availabilityText: null,
    };

    await User.findByIdAndUpdate(id, anonymised, { runValidators: false });

    try {
      await require('../../models/Session').deleteMany({ userId: id });
    } catch (sessionErr) {
      console.error('Session cleanup on delete failed:', sessionErr.message);
    }

    try {
      await require('../../models/PushToken').deleteMany({ userId: id });
    } catch (pushErr) {
      console.error('PushToken cleanup on delete failed:', pushErr.message);
    }

    try {
      const IdentityClaim = require('../../models/IdentityClaim');
      await IdentityClaim.deleteMany({ userId: id });
    } catch (claimErr) {
      console.error('IdentityClaim cleanup on delete failed:', claimErr.message);
    }

    // Cascade delete Services owned by this user. This must happen before Orders
    // cascade via Service deletion, so we don't try to delete Orders twice.
    try {
      const deletedServices = await Service.deleteMany({ userId: id });
      if (deletedServices.deletedCount > 0) {
        console.log(`deleteUser: deleted ${deletedServices.deletedCount} services for user ${id}`);
      }
    } catch (serviceErr) {
      console.error('Service cascade delete on user delete failed:', serviceErr.message);
    }

    // Delete Favorite records created by this user (not favorites OF this user).
    try {
      const deletedFavorites = await List.deleteMany({ userId: id });
      if (deletedFavorites.deletedCount > 0) {
        console.log(
          `deleteUser: deleted ${deletedFavorites.deletedCount} favorite lists for user ${id}`
        );
      }
    } catch (favoriteErr) {
      console.error('Favorite cascade delete on user delete failed:', favoriteErr.message);
    }

    // Cancel (don't delete) Orders involving this user to preserve audit trail.
    // Delete only completed/cancelled/disputed orders that no longer need audit context.
    try {
      const cancelledOrders = await Order.updateMany(
        {
          $or: [{ customerId: id }, { providerId: id }],
          status: { $in: ['pending', 'accepted'] },
        },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        }
      );
      if (cancelledOrders.modifiedCount > 0) {
        console.log(
          `deleteUser: cancelled ${cancelledOrders.modifiedCount} pending orders for user ${id}`
        );
      }
    } catch (orderErr) {
      console.error('Order cascade cancel on user delete failed:', orderErr.message);
    }

    try {
      const { getIO } = require('../../sockets/io');
      const io = getIO();
      if (io && io.sockets && io.sockets.sockets) {
        for (const [, sock] of io.sockets.sockets) {
          if (sock.userId && String(sock.userId) === String(id)) {
            sock.disconnect(true);
          }
        }
      }
    } catch (socketErr) {
      console.error('Socket disconnect on delete failed:', socketErr.message);
    }

    res.json({ message: 'Profilen din er slettet.' });
  } catch (err) {
    console.error('deleteUser Error:', err);
    res.status(500).json({ error: 'Kunne ikke slette profilen. Prøv igjen.' });
  }
};

exports.getUserServices = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const services = await Service.find({ userId: id });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};


// List all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
