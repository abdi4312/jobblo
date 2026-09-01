const mongoose = require('mongoose');

/**
 * Exclusive ownership of one verified eID identity.
 *
 * The rule is that a single BankID identity belongs to at most one Jobblo account. The
 * obvious implementation — "check no other user has this subject, then write it" — is a
 * check-then-act race: two callbacks for the same identity can both pass the check and
 * both write, and the loser is not detected because nothing in the database says the
 * pair is exclusive.
 *
 * A unique index on `User.identityVerification.subject` would express it, but production
 * runs Azure Cosmos DB for MongoDB (RU-based, port 10255), which cannot add a unique
 * index to a collection that already holds data. `users` is very much not empty, so that
 * index cannot be created there — the same limitation already recorded for
 * `Payment.orderId` and `Subscription.userId`.
 *
 * This collection sidesteps it. The claim key IS the `_id`, and `_id` carries a unique
 * index on every MongoDB-compatible store, Cosmos included, from the moment the
 * collection exists — it is not something you add later. A second insert of the same key
 * fails with E11000 no matter how the two requests interleave, which makes "one identity,
 * one account" a property of the storage layer rather than a hope about timing.
 *
 * The claim is written BEFORE the user document is touched, so a crash between the two
 * leaves an orphaned claim (recoverable, and re-linking the same identity to the same
 * user succeeds) rather than two accounts believing they own the same identity.
 */
const identityClaimSchema = new mongoose.Schema(
  {
    /**
     * `<provider>:<scheme>:<subject>` — for example
     * `idura:no_bankid:0a3b…`.
     *
     * Namespaced rather than the bare subject: Idura's `sub` is a pseudonym scoped to
     * our tenant, so it is unique within Idura but carries no guarantee against a
     * different provider one day issuing the same string.
     */
    _id: { type: String, required: true },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    provider: { type: String, required: true },
    scheme: { type: String, required: true },
  },
  { timestamps: true, _id: false }
);

/** The canonical claim key. Keep every caller on this rather than building it inline. */
identityClaimSchema.statics.keyFor = function keyFor(provider, scheme, subject) {
  return `${provider}:${scheme}:${String(subject)}`;
};

module.exports = mongoose.model('IdentityClaim', identityClaimSchema);
