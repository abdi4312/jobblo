/**
 * What the owner of a listing is actually allowed to do with it.
 *
 * `deleteService` hard-deletes the Service document and its Cloudinary images, and it
 * checked exactly one thing: that the caller owns the row. Nothing stopped an owner
 * deleting a listing that had a signed contract, a paid SafePay escrow, work in
 * progress, or an open dispute attached to it. Doing so leaves the Order pointing at a
 * `serviceId` that no longer resolves — the provider's order page, the customer's
 * approval page and every Review carrying that `serviceId` lose the job they describe,
 * while the money is still held.
 *
 * So the rule is not a UI nicety. The server refuses, and it says why in a sentence a
 * person can act on. The same evaluation is attached to each listing in
 * `getMyPostedServices`, so the interface can explain the situation up front instead of
 * offering a button that returns an opaque error.
 *
 * Note the vocabulary: this really is deletion, not cancellation — the document is
 * removed. The copy in the UI has to say so.
 */

/**
 * Order states that tie a listing to a live commitment.
 *
 * `accepted` is in here even though no money has moved: the provider has been chosen
 * and both sides believe there is an agreement. `completed` is in here because the
 * order and its reviews are a financial record — the job is over, but the row still has
 * to resolve.
 *
 * `pending`, `declined` and `cancelled` are deliberately absent. An application nobody
 * acted on, or one that was turned down or called off, is not a reason to freeze
 * someone's listing forever.
 */
const BLOCKING_ORDER_STATUSES = [
  'accepted',
  'awaiting_payment',
  'paid',
  'in_progress',
  'ready_for_review',
  'completed',
  'disputed',
];

/**
 * Why a listing is locked, in the order these are checked.
 *
 * `code` is for the client to branch on; `message` is shown to the user. Norwegian,
 * because every other owner-facing string in the product is.
 */
const BLOCK_REASONS = {
  disputed: {
    code: 'LISTING_DISPUTED',
    message:
      'Denne annonsen har en aktiv tvist. Den kan ikke endres eller slettes før tvisten er løst.',
  },
  completed: {
    code: 'LISTING_COMPLETED',
    message:
      'Oppdraget er fullført. Annonsen beholdes som en del av historikken din og kan ikke slettes.',
  },
  in_progress: {
    code: 'LISTING_WORK_IN_PROGRESS',
    message: 'Arbeidet er i gang. Annonsen kan ikke slettes mens oppdraget pågår.',
  },
  ready_for_review: {
    code: 'LISTING_WORK_IN_PROGRESS',
    message:
      'Utføreren har meldt jobben som ferdig. Annonsen kan ikke slettes før du har godkjent arbeidet.',
  },
  paid: {
    code: 'LISTING_PAID',
    message:
      'Betalingen ligger i SafePay på dette oppdraget. Annonsen kan ikke slettes så lenge pengene holdes.',
  },
  awaiting_payment: {
    code: 'LISTING_HAS_CONTRACT',
    message:
      'Det finnes en aktiv kontrakt på denne annonsen som venter på betaling. Avbryt kontrakten først hvis du vil fjerne annonsen.',
  },
  accepted: {
    code: 'LISTING_HAS_CONTRACT',
    message:
      'Du har allerede valgt en utfører for dette oppdraget. Avbryt kontrakten først hvis du vil fjerne annonsen.',
  },
};

/** Fallback for an order state that blocks but has no bespoke sentence. */
const GENERIC_BLOCK = {
  code: 'LISTING_HAS_CONTRACT',
  message: 'Denne annonsen er knyttet til et aktivt oppdrag og kan ikke slettes.',
};

/**
 * Pick the single most important blocking order.
 *
 * A listing can carry more than one order over its life — an application that was
 * declined, then a real contract. Only blocking ones are considered, and a dispute
 * outranks everything else because it is the state a person most needs explained.
 */
function findBlockingOrder(orders = []) {
  const blocking = orders.filter((o) => BLOCKING_ORDER_STATUSES.includes(o?.status));
  if (blocking.length === 0) return null;

  return (
    blocking.find((o) => o.status === 'disputed') ||
    blocking.find((o) => o.status !== 'completed') ||
    blocking[0]
  );
}

/**
 * Evaluate one listing.
 *
 * @param {Object} args
 * @param {Object} args.service the Service document (plain or lean)
 * @param {Array}  [args.orders] orders whose `serviceId` is this listing
 * @returns {{canEdit: boolean, canDelete: boolean, blockedCode: string|null,
 *            blockedReason: string|null, blockingStatus: string|null}}
 */
function evaluateListingCapabilities({ service, orders = [] } = {}) {
  const unlocked = {
    canEdit: true,
    canDelete: true,
    blockedCode: null,
    blockedReason: null,
    blockingStatus: null,
  };

  if (!service) return unlocked;

  const blocker = findBlockingOrder(orders);

  if (blocker) {
    const reason = BLOCK_REASONS[blocker.status] || GENERIC_BLOCK;
    return {
      /**
       * Editing stays open, deletion does not.
       *
       * Deleting removes the row every Order and Review points at; editing changes
       * copy on a listing whose commercial terms were snapshotted onto the Order when
       * it was created (`agreedPrice`), so a later edit cannot alter what anyone is
       * charged. Owners legitimately fix a typo or add detail while a job is running,
       * and `updateService` already refuses the fields that would be dangerous --
       * status, userId, promoted, urgent and views are all off the whitelist.
       *
       * The exception is a dispute. That order is frozen pending an admin decision,
       * and the listing is evidence in it: its description is what both sides agreed
       * the job was. It must not move underneath the review.
       */
      canEdit: blocker.status !== 'disputed',
      canDelete: false,
      blockedCode: reason.code,
      blockedReason: reason.message,
      blockingStatus: blocker.status,
    };
  }

  /**
   * No order says otherwise, but the listing's own status can still mean money has
   * moved — the two are written by different code paths and can disagree, and the
   * safer reading wins. The service status is a fallback, not the primary signal,
   * because it is the one that has historically drifted.
   */
  const serviceBlock = BLOCK_REASONS[service.status];
  if (serviceBlock && BLOCKING_ORDER_STATUSES.includes(service.status)) {
    return {
      canEdit: service.status !== 'disputed',
      canDelete: false,
      blockedCode: serviceBlock.code,
      blockedReason: serviceBlock.message,
      blockingStatus: service.status,
    };
  }

  return unlocked;
}

module.exports = {
  evaluateListingCapabilities,
  findBlockingOrder,
  BLOCKING_ORDER_STATUSES,
  BLOCK_REASONS,
  GENERIC_BLOCK,
};
