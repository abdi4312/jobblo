const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    phone: {
      type: String,
      trim: true,
      set: (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    bannerUrl: { type: String },
    bannerPublicId: { type: String },
    bio: { type: String },
    role: {
      type: String,
      enum: ['user', 'superAdmin', 'provider', 'company'],
      default: 'user',
    },
    companyName: { type: String, trim: true },
    orgNumber: { type: String, trim: true },
    orgType: { type: String, trim: true },
    locations: [{ type: String }],
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    postNumber: { type: String, trim: true },
    postSted: { type: String, trim: true },
    birthDate: { type: String },
    gender: { type: String },
    address: { type: String },
    postNumber: { type: String },
    postSted: { type: String },
    country: { type: String },
    subscription: {
      type: String,
      enum: ['Standard', 'Plus', 'Pro', 'Start', 'Premium', 'Fleksibel', 'Jobblo Pluss'],
      default: 'Standard',
    },
    planType: {
      type: String,
      enum: ['business', 'private'],
      default: 'private',
      required: true,
    },
    experience: [
      {
        title: { type: String },
        company: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        description: { type: String },
      },
    ],
    verified: { type: Boolean, default: false },
    isTrusted: { type: Boolean, default: false },
    acceptedTerms: { type: Boolean, default: false },
    termsVersion: { type: String, default: null },
    termsAcceptedAt: { type: Date, default: null },
    lastLogin: { type: Date },
    availability: [{ start: Date, end: Date }],
    availabilityText: { type: String },
    skills: [{ type: String }],
    portfolio: [
      {
        title: { type: String },
        description: { type: String },
        imageUrl: { type: String },
        link: { type: String },
      },
    ],
    previousProjects: [
      {
        title: { type: String },
        description: { type: String },
        imageUrl: { type: String },
        category: { type: String },
        date: { type: Date },
        link: { type: String },
      },
    ],
    certifications: [
      {
        title: { type: String },
        url: { type: String },
        publicId: { type: String },
        issuedBy: { type: String },
        date: { type: Date },
        description: { type: String },
      },
    ],
    earnings: { type: Number, default: 0 },
    spending: { type: Number, default: 0 },
    oauthProviders: [
      {
        provider: { type: String },
        providerId: { type: String },
      },
    ],

    /**
     * Verified real-world identity, from an eID scheme.
     *
     * Present means the person completed a full OpenID Connect flow against Idura
     * Verify and the returned `id_token` passed signature, issuer, audience, expiry
     * and nonce validation. Absent means unverified. This is the single source of
     * truth for "is this a verified human" — `verified` and `accountStatus` below are
     * derived from it (see controllers/iduraAuthController.js), not set independently.
     *
     * Deliberately minimal. Idura's Norwegian BankID returns considerably more than
     * this — `certissuer`, `certsubject`, `nameidentifier`, and, if the `ssn` scope is
     * requested, `socialno`. Jobblo asks for no `ssn` scope and stores no national
     * identity number: there is no product or legal requirement for one, and holding
     * fødselsnummer would put the platform under obligations it has not taken on.
     * `birthdate` is reduced to a year for the same reason — enough to show an adult
     * verified, not enough to be an identity document.
     */
    identityVerification: {
      /** Always 'idura' today; named so a second provider does not need a migration. */
      provider: { type: String, enum: ['idura'] },

      /** Which eID was used. 'no_bankid' is Idura's `identityscheme: nobankid-oidc`. */
      scheme: { type: String, enum: ['no_bankid'] },

      /**
       * The OIDC `sub`. Idura documents this as a persistent pseudonym that uniquely
       * identifies the user *within our tenant* — stable across logins, and not a
       * national identifier. This is what identifies a returning BankID user.
       *
       * Exclusivity is enforced by models/IdentityClaim.js, not by an index here:
       * Cosmos cannot add a unique index to the non-empty `users` collection.
       */
      subject: { type: String },

      /**
       * Idura's `uniqueuserid`, documented as identifying the legal person and
       * explicitly "not considered sensitive". Kept because `sub` is tenant-scoped,
       * so this is the only value that would survive a tenant migration.
       */
      uniqueUserId: { type: String },

      /** The name BankID asserts. Not editable by the user. */
      verifiedName: { type: String },

      /** Year only — never the full date of birth. */
      birthYear: { type: Number },

      /** The `acr` actually returned, e.g. urn:grn:authn:no:bankid:substantial. */
      acr: { type: String },

      /** 'high' | 'substantial', derived from the acr above. */
      assuranceLevel: { type: String, enum: ['high', 'substantial'] },

      verifiedAt: { type: Date },
    },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive', 'verified'],
      default: 'active',
    },

    averageRating: {
      type: Number,
      default: 0,
    },

    reviewCount: {
      type: Number,
      default: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },

    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    pointsBalance: {
      type: Number,
      default: 0,
    },
    pointsHistory: [
      {
        points: Number,
        reason: String,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        shopItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobbloShop' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // 📊 CONTACT LIMIT TRACKING
    monthlyContactUsage: {
      type: Number,
      default: 0,
    },
    lastContactReset: {
      type: Date,
      default: Date.now,
    },
    // Live-mode Stripe customer. `cus_…` ids are NOT portable between Stripe's test
    // and live modes, so a single field meant that flipping mode handed every stored
    // id to the wrong account and Stripe answered resource_missing on the next
    // purchase. The test-mode id lives in its own field below; nothing needs
    // backfilling, because existing live ids stay exactly where they were.
    stripeCustomerId: {
      type: String,
    },
    stripeCustomerIdTest: {
      type: String,
    },

    // Stripe Connect (payout destination for workers/providers)
    stripeConnectAccountId: {
      type: String,
      trim: true,
    },
    payoutOnboardingStatus: {
      type: String,
      enum: ['none', 'started', 'restricted', 'enabled', 'pending_verification'],
      default: 'none',
    },
    payoutEnabled: {
      type: Boolean,
      default: false,
    },
    chargesEnabled: {
      type: Boolean,
      default: false,
    },
    detailsSubmitted: {
      type: Boolean,
      default: false,
    },
    connectAccountCreatedAt: {
      type: Date,
    },
    payoutOnboardingLastRefreshedAt: {
      type: Date,
    },

    // Payout / bank account details (DEPRECATED — raw fields, replaced by Stripe Connect)
    // Kept as write-tolerant only; never returned outside owner's own profile.
    payoutMethod: {
      type: String,
      enum: ['bank', 'vipps', 'iban', null],
      default: null,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
      select: false,
    },
    iban: {
      type: String,
      trim: true,
      select: false,
    },
    bicSwift: {
      type: String,
      trim: true,
      select: false,
    },
    vippsHandle: {
      type: String,
      trim: true,
      select: false,
    },
    payoutVerified: {
      type: Boolean,
      default: false,
    },

    // Soft delete — admin action only. Never hard-delete users with financial history.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // Password Reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Add index to prevent duplicate OAuth providers
// Virtual field for totalEarned (maps to earnings)
userSchema.virtual('totalEarned').get(function () {
  return this.earnings || 0;
});

// Ensure virtuals are included when converting to JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.index({
  'oauthProviders.provider': 1,
  'oauthProviders.providerId': 1,
});

// Admin query indexes
userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ accountStatus: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

module.exports = mongoose.model('User', userSchema);
