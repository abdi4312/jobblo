const SENSITIVE_KEYS = [
  'password',
  'passwordconfirmation',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'stripesecret',
  'cardnumber',
  'cvv',
  'iban',
  'accountnumber',
];

function redactValue(v) {
  if (typeof v === 'string') return '[REDACTED]';
  if (typeof v === 'object') return '[REDACTED]';
  return null;
}

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = redactValue(v);
      continue;
    }
    if (v && typeof v === 'object') {
      out[k] = redactSensitive(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}

module.exports = { redactSensitive };
