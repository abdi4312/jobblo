const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../models/Transaction', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const transactionController = require('../controllers/transactionController');

/**
 * Regression guard for H1.
 *
 * GET /api/transactions/:id did findById(id).populate('userId serviceId') with no owner
 * check, so any logged-in user could read any transaction — and the unprojected
 * populate returned the owner's bcrypt hash, email, phone and Stripe ids.
 */

const OWNER = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();
const TX = new mongoose.Types.ObjectId();
const TX_DOC = { _id: TX, userId: { _id: OWNER, name: 'Owner' }, amount: 100 };

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function req(userId, role = 'user', id = String(TX)) {
  return { params: { id }, userId: String(userId), user: { _id: userId, role } };
}

/** findOne(filter).populate().populate() resolving to the doc the filter would match. */
function mockFindOne() {
  const populate = jest.fn();
  Transaction.findOne.mockImplementation((filter) => {
    const matches =
      String(filter._id) === String(TX) &&
      (filter.userId === undefined || String(filter.userId) === String(OWNER));
    const chain = {
      populate: populate.mockImplementation(() => chain),
      then: (resolve, reject) => Promise.resolve(matches ? TX_DOC : null).then(resolve, reject),
    };
    return chain;
  });
  return populate;
}

describe('getTransactionById ownership (H1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the transaction to its owner', async () => {
    mockFindOne();
    const res = mockRes();
    await transactionController.getTransactionById(req(OWNER), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, transaction: TX_DOC });
  });

  it("answers 404 (not 403) for another user's transaction, so ids cannot be probed", async () => {
    mockFindOne();
    const res = mockRes();
    await transactionController.getTransactionById(req(OTHER), res);
    expect(Transaction.findOne).toHaveBeenCalledWith({ _id: String(TX), userId: String(OTHER) });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets superAdmin read any transaction (same policy as requireAdmin)', async () => {
    mockFindOne();
    const res = mockRes();
    await transactionController.getTransactionById(req(OTHER, 'superAdmin'), res);
    expect(Transaction.findOne).toHaveBeenCalledWith({ _id: String(TX) });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each(['provider', 'company'])('gives role %s no admin bypass', async (role) => {
    mockFindOne();
    const res = mockRes();
    await transactionController.getTransactionById(req(OTHER, role), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects an invalid id with 400 before querying', async () => {
    const res = mockRes();
    await transactionController.getTransactionById(req(OWNER, 'user', 'not-an-id'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.findOne).not.toHaveBeenCalled();
  });

  it('populates the user and service with allow-listed fields only', async () => {
    const populate = mockFindOne();
    await transactionController.getTransactionById(req(OWNER), mockRes());
    expect(populate).toHaveBeenCalledWith('userId', 'name lastName email');
    expect(populate).toHaveBeenCalledWith('serviceId', 'title');
    for (const [, fields] of populate.mock.calls) {
      expect(fields).toBeDefined();
      expect(fields).not.toMatch(/password|stripe|reset|otp|iban|bank/i);
    }
  });

  it('does not leak internal error messages on a 500', async () => {
    Transaction.findOne.mockImplementation(() => {
      throw new Error('mongo exploded at 10.0.0.5');
    });
    const res = mockRes();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await transactionController.getTransactionById(req(OWNER), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('mongo exploded');
  });
});

describe('transaction history keeps working', () => {
  it('scopes /user history to the caller', async () => {
    const chain = { sort: () => chain, skip: () => chain, limit: () => Promise.resolve([TX_DOC]) };
    Transaction.find.mockReturnValue(chain);
    Transaction.countDocuments.mockResolvedValue(1);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = mockRes();
    await transactionController.getUserTransactions(
      { query: {}, user: { id: String(OWNER) } },
      res
    );
    expect(Transaction.find).toHaveBeenCalledWith({ userId: String(OWNER) });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('transaction routes', () => {
  const app = express();
  app.use(cookieParser());
  app.use('/api/transactions', require('../routes/transaction'));
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/transactions/${TX}`);
    expect(res.status).toBe(401);
    expect(Transaction.findOne).not.toHaveBeenCalled();
  });
});

describe('User.password is never selected by default', () => {
  it('has select:false on the schema', () => {
    expect(User.schema.path('password').options.select).toBe(false);
  });

  it('still lets password-verifying flows opt in explicitly', () => {
    const src = fs.readdirSync(path.join(__dirname, '..', 'controllers', 'auth')).map((f) => fs.readFileSync(path.join(__dirname, '..', 'controllers', 'auth', f), 'utf8')).join('\n'); // the controller is split into controllers/auth
    // login
    expect(src).toMatch(/User\.findOne\(\{ email: normalizedEmail \}\)\.select\('\+password'\)/);
    // change-password (verifies currentPassword)
    expect(src).toMatch(/User\.findById\(userId\)\.select\('\+password'\)/);
  });

  it('a user loaded without the password still validates for save()', async () => {
    // Every findById(...).save() now loads users without the hash; `required` must not
    // reject them, or profile updates across the app would start failing.
    const user = User.hydrate(
      { _id: OWNER, name: 'A', email: 'a@example.test', planType: 'private' },
      { password: 0 }
    );
    user.name = 'B';
    await expect(user.validate()).resolves.toBeUndefined();
  });
});
