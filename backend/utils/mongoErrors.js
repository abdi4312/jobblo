/**
 * Turns a Mongoose/MongoDB driver error into something a Norwegian customer can
 * read, without leaking schema internals.
 *
 * Controllers used to answer `res.status(400).json({ error: err.message })`, so
 * changing your e-mail to one already in use surfaced the raw driver string:
 *
 *   E11000 duplicate key error collection: jobblo.users index: email_1
 *   dup key: { email: "x@y.no" }
 *
 * That exposes collection and index names and confirms which addresses are
 * registered — a user-enumeration oracle on top of an unreadable message.
 */

const FIELD_LABELS = {
  email: 'E-postadressen',
  phone: 'Telefonnummeret',
  orgNumber: 'Organisasjonsnummeret',
  name: 'Navnet',
};

/** Extracts the offending path from a duplicate-key error, whatever driver shape it has. */
function duplicateField(err) {
  if (err.keyPattern) return Object.keys(err.keyPattern)[0];
  if (err.keyValue) return Object.keys(err.keyValue)[0];
  const match = /index:\s*(\w+?)_\d/.exec(err.message || '');
  return match ? match[1] : null;
}

/**
 * @returns {{ status: number, message: string } | null}
 *   null when this is not an error we recognise — let the caller decide.
 */
function translateMongoError(err) {
  if (!err) return null;

  if (err.code === 11000 || err.code === 11001) {
    const field = duplicateField(err);
    const label = (field && FIELD_LABELS[field]) || 'Verdien';
    return { status: 409, message: `${label} er allerede i bruk.` };
  }

  if (err.name === 'ValidationError') {
    // Mongoose validator messages are authored in the schema, so they are safe to
    // show — but only the first, and never the full stringified error.
    const first = Object.values(err.errors || {})[0];
    return {
      status: 400,
      message: first?.message || 'Noen av opplysningene er ugyldige.',
    };
  }

  if (err.name === 'CastError') {
    return { status: 400, message: 'Ugyldig verdi oppgitt.' };
  }

  return null;
}

/** Convenience wrapper for controller catch blocks. */
function sendMongoError(res, err, fallback = 'Noe gikk galt hos oss. Prøv igjen om litt.') {
  const translated = translateMongoError(err);
  if (translated) return res.status(translated.status).json({ error: translated.message });
  return res.status(500).json({ error: fallback });
}

module.exports = { translateMongoError, sendMongoError };
