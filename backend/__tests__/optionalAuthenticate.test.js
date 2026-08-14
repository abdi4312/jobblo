/**
 * Regression guard for the support-ticket auth gap.
 *
 * `POST /api/support/tickets` is open to logged-out visitors on purpose, so it
 * carried no auth middleware at all. But `createTicket` reads `req.userId` to
 * look up the account address, and the form hides the e-mail field for signed-in
 * users — so members submitted `{subject, message}` with no address, `req.userId`
 * was never set, and the ticket came back 400 "Oppgi en gyldig e-postadresse".
 * Support was broken for exactly the people we can already identify.
 *
 * `optionalAuthenticate` recognises a caller when it can and continues anonymously
 * when it cannot. The contract that matters: **`next()` runs exactly once on every
 * path**, and a bad token must never block the request.
 */

jest.mock('jsonwebtoken');
jest.mock('../models/User');
jest.mock('../models/Session');

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { optionalAuthenticate } = require('../middleware/auth');

function mockReq(overrides = {}) {
  return { cookies: {}, headers: {}, ...overrides };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('optionalAuthenticate', () => {
  it('continues anonymously when there is no token, without touching jwt', async () => {
    const req = mockReq();
    const next = jest.fn();

    await optionalAuthenticate(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('attaches the user when a valid bearer token is present', async () => {
    jwt.verify.mockReturnValue({ id: 'u1', sid: 's1' });
    Session.findOne.mockResolvedValue({ _id: 's1', userId: 'u1', save: jest.fn() });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: { toString: () => 'u1' }, email: 'a@b.no' }),
    });

    const req = mockReq({ headers: { authorization: 'Bearer good.token' } });
    const next = jest.fn();

    await optionalAuthenticate(req, mockRes(), next);

    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('u1');
  });

  it('degrades to anonymous — never 401 — when the token is malformed', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('jwt malformed');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const req = mockReq({ headers: { authorization: 'Bearer not.a.token' } });
    const res = mockRes();
    const next = jest.fn();

    await optionalAuthenticate(req, res, next);
    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('degrades to anonymous when the session has been revoked', async () => {
    jwt.verify.mockReturnValue({ id: 'u1', sid: 's1' });
    Session.findOne.mockResolvedValue(null);

    const req = mockReq({ cookies: { accessToken: 'revoked' } });
    const res = mockRes();
    const next = jest.fn();

    await optionalAuthenticate(req, res, next);
    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBeUndefined();
    // The real response is untouched: a revoked token must not clear the
    // visitor's cookies or fail a route that also serves logged-out users.
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
