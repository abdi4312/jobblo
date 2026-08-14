const { translateMongoError, sendMongoError } = require('../utils/mongoErrors');

/**
 * Regression guard for F-14.
 *
 * Controllers answered with `err.message` straight from the driver, so a user who
 * changed their e-mail to one already taken saw:
 *
 *   E11000 duplicate key error collection: jobblo.users index: email_1
 *   dup key: { email: "x@y.no" }
 *
 * rendered in a toast. That leaks collection and index names and confirms which
 * addresses are registered.
 */

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('translateMongoError', () => {
  it('turns a duplicate e-mail into a Norwegian 409 with no schema details', () => {
    const err = Object.assign(
      new Error(
        'E11000 duplicate key error collection: jobblo.users index: email_1 dup key: { email: "x@y.no" }'
      ),
      { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'x@y.no' } }
    );

    const out = translateMongoError(err);

    expect(out).toEqual({ status: 409, message: 'E-postadressen er allerede i bruk.' });
    expect(out.message).not.toMatch(/E11000|index|collection|x@y\.no/);
  });

  it('still identifies the field when only the driver message is available', () => {
    const err = Object.assign(
      new Error('E11000 duplicate key error collection: jobblo.users index: orgNumber_1 dup key: {}'),
      { code: 11000 }
    );

    expect(translateMongoError(err).message).toBe('Organisasjonsnummeret er allerede i bruk.');
  });

  it('surfaces the first schema validation message', () => {
    const err = Object.assign(new Error('Validation failed'), {
      name: 'ValidationError',
      errors: { price: { message: 'Prisen må være større enn 0' } },
    });

    expect(translateMongoError(err)).toEqual({
      status: 400,
      message: 'Prisen må være større enn 0',
    });
  });

  it('does not leak the path from a CastError', () => {
    const err = Object.assign(new Error('Cast to ObjectId failed for value "abc" at path "_id"'), {
      name: 'CastError',
    });

    expect(translateMongoError(err)).toEqual({ status: 400, message: 'Ugyldig verdi oppgitt.' });
  });

  it('returns null for errors it does not recognise', () => {
    expect(translateMongoError(new Error('something else'))).toBeNull();
    expect(translateMongoError(null)).toBeNull();
  });
});

describe('sendMongoError', () => {
  it('uses the translation when there is one', () => {
    const res = mockRes();
    sendMongoError(res, Object.assign(new Error('dup'), { code: 11000, keyPattern: { email: 1 } }));

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'E-postadressen er allerede i bruk.' });
  });

  it('falls back to a generic 500 rather than echoing the raw error', () => {
    const res = mockRes();
    sendMongoError(res, new Error('ECONNREFUSED mongodb://secret-host:27017'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).not.toMatch(/secret-host/);
  });
});
