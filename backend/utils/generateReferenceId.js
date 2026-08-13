const crypto = require('crypto');

function shortId(len = 6) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len).toUpperCase();
}

function generateReference({ prefix = 'ERR' } = {}) {
  const date = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  return `${prefix}-${date}-${shortId(6)}`;
}

module.exports = { generateReference };
