const fs = require('fs');
const path = require('path');
const {
  evaluateListingCapabilities,
  findBlockingOrder,
  BLOCKING_ORDER_STATUSES,
} = require('../utils/listingCapabilities');
const { stripComments } = require('../test-utils/stripComments');

/**
 * What a listing's owner may do with it.
 *
 * `deleteService` hard-deletes the Service and its images and checked only ownership.
 * An owner could therefore delete a listing carrying a paid SafePay escrow, work in
 * progress, or an open dispute — leaving the Order and every Review pointing at a
 * `serviceId` that no longer resolves while the money is still held.
 */

const openService = { _id: 'svc_1', status: 'open' };

describe('a listing with nothing attached', () => {
  it('can be edited and deleted', () => {
    const caps = evaluateListingCapabilities({ service: openService, orders: [] });
    expect(caps).toMatchObject({ canEdit: true, canDelete: true, blockedReason: null });
  });

  it('is unaffected by applications nobody acted on', () => {
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'pending' }, { status: 'pending' }],
    });
    expect(caps.canDelete).toBe(true);
  });

  it('is unaffected by declined or cancelled orders', () => {
    // Turning someone down must not freeze the listing forever.
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'declined' }, { status: 'cancelled' }],
    });
    expect(caps.canDelete).toBe(true);
    expect(caps.canEdit).toBe(true);
  });
});

describe('a listing tied to a live commitment', () => {
  it.each(BLOCKING_ORDER_STATUSES)('cannot be deleted while an order is %s', (status) => {
    const caps = evaluateListingCapabilities({ service: openService, orders: [{ status }] });

    expect(caps.canDelete).toBe(false);
    expect(caps.blockedReason).toEqual(expect.any(String));
    expect(caps.blockedReason.length).toBeGreaterThan(20);
    expect(caps.blockingStatus).toBe(status);
  });

  /**
   * Editing deliberately stays open. Deleting removes the row every Order and Review
   * points at; editing changes copy on a listing whose commercial terms were already
   * snapshotted onto the Order (`agreedPrice`), and `updateService`'s field whitelist
   * refuses status, userId, promoted, urgent and views regardless. Owners legitimately
   * fix a typo while a job runs, and __tests__/serviceUpdateWhitelist.test.js has
   * always asserted that.
   */
  it.each(BLOCKING_ORDER_STATUSES.filter((s) => s !== 'disputed'))(
    'can still be edited while an order is %s',
    (status) => {
      const caps = evaluateListingCapabilities({ service: openService, orders: [{ status }] });
      expect(caps.canEdit).toBe(true);
    }
  );

  it('cannot be edited while a dispute is open', () => {
    // The listing's description is evidence in the dispute. It must not move under
    // the admin reviewing it.
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'disputed' }],
    });
    expect(caps.canEdit).toBe(false);
    expect(caps.canDelete).toBe(false);
  });

  it('explains a paid escrow specifically', () => {
    const caps = evaluateListingCapabilities({ service: openService, orders: [{ status: 'paid' }] });
    expect(caps.blockedCode).toBe('LISTING_PAID');
    expect(caps.blockedReason).toMatch(/SafePay/);
  });

  it('explains work in progress specifically', () => {
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'in_progress' }],
    });
    expect(caps.blockedCode).toBe('LISTING_WORK_IN_PROGRESS');
  });

  it('explains a completed job as history rather than a failure', () => {
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'completed' }],
    });
    expect(caps.blockedCode).toBe('LISTING_COMPLETED');
    expect(caps.blockedReason).toMatch(/historikk/);
  });

  it('a dispute outranks every other blocking order', () => {
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'completed' }, { status: 'paid' }, { status: 'disputed' }],
    });
    expect(caps.blockedCode).toBe('LISTING_DISPUTED');
  });

  it('a live order outranks a historical completed one', () => {
    const caps = evaluateListingCapabilities({
      service: openService,
      orders: [{ status: 'completed' }, { status: 'in_progress' }],
    });
    expect(caps.blockingStatus).toBe('in_progress');
  });

  it('every blocking status has Norwegian copy, never a raw code', () => {
    for (const status of BLOCKING_ORDER_STATUSES) {
      const { blockedReason } = evaluateListingCapabilities({
        service: openService,
        orders: [{ status }],
      });
      expect(blockedReason).not.toMatch(/[a-z]+_[a-z]+/); // no snake_case leaking through
      expect(blockedReason).toMatch(/[æøåÆØÅ]|annonse|oppdrag|kontrakt|Betaling/i);
    }
  });
});

describe('the service status is a fallback signal', () => {
  it('blocks deletion of a listing whose own status says money moved, with no order rows', () => {
    // Service.status and Order.status are written by different code paths and have
    // drifted before. The safer reading wins.
    const caps = evaluateListingCapabilities({
      service: { _id: 'svc', status: 'paid' },
      orders: [],
    });
    expect(caps.canDelete).toBe(false);
    expect(caps.blockedCode).toBe('LISTING_PAID');
  });

  it('does not lock ordinary open, draft or expired listings', () => {
    for (const status of ['open', 'draft', 'pending', 'expired', 'closed', 'cancelled']) {
      const caps = evaluateListingCapabilities({ service: { _id: 'x', status }, orders: [] });
      expect(caps.canDelete).toBe(true);
    }
  });
});

describe('findBlockingOrder', () => {
  it('returns null when nothing blocks', () => {
    expect(findBlockingOrder([{ status: 'pending' }])).toBeNull();
    expect(findBlockingOrder([])).toBeNull();
    expect(findBlockingOrder()).toBeNull();
  });

  it('tolerates malformed rows', () => {
    expect(findBlockingOrder([null, undefined, {}, { status: 'paid' }])).toEqual({ status: 'paid' });
  });
});

describe('the endpoints enforce it, not just the interface', () => {
  const source = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'controllers', 'serviceController.js'), 'utf8')
  );

  const sliceOf = (name) => {
    const start = source.indexOf(`exports.${name} =`);
    const rest = source.slice(start + 10);
    const nextExport = rest.indexOf('\nexports.');
    return rest.slice(0, nextExport === -1 ? undefined : nextExport);
  };

  it('deleteService refuses a blocked listing before touching Cloudinary', () => {
    const body = sliceOf('deleteService');
    expect(body).toMatch(/canDelete/);

    // The guard must run BEFORE the destructive image cleanup, or a refused delete
    // still destroys the photos.
    expect(body.indexOf('canDelete')).toBeLessThan(body.indexOf('cloudinary'));
  });

  it('updateService refuses a blocked listing', () => {
    expect(sliceOf('updateService')).toMatch(/canEdit/);
  });

  it('both answer 409 with the reason, not a bare 400', () => {
    for (const name of ['deleteService', 'updateService']) {
      const body = sliceOf(name);
      expect(body).toMatch(/status\(409\)/);
      expect(body).toMatch(/blockedReason/);
      expect(body).toMatch(/blockedCode/);
    }
  });

  it('getMyPostedServices attaches capabilities to every listing', () => {
    const body = sliceOf('getMyPostedServices');
    expect(body).toMatch(/capabilities:\s*evaluateListingCapabilities/);
  });

  it('loads the orders for the whole page in one query, not one per listing', () => {
    const body = sliceOf('getMyPostedServices');
    expect(body).toMatch(/serviceId:\s*\{\s*\$in:/);
  });
});
