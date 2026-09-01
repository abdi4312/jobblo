/**
 * Fails the production build when required env vars are missing.
 *
 * Vite inlines these at build time, so a missing value is not a runtime problem
 * you can fix by restarting — it is baked into the bundle and ships. This is the
 * only place it can be caught before users see it.
 *
 * Vite loads .env files itself, so read them here too rather than relying on the
 * shell environment alone.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED = [
  ['VITE_MAIN_URL', 'Base URL of the Jobblo API, e.g. https://api.jobblo.no'],
  ['VITE_GOOGLE_MAPS_API_KEY', 'Google Maps key — without it no one can post a job at all'],
];

const mode = process.env.NODE_ENV || 'production';
const files = ['.env', '.env.production', '.env.local', `.env.${mode}`, `.env.${mode}.local`];

const fromFiles = {};
for (const file of files) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match) fromFiles[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
}

const missing = REQUIRED.filter(([key]) => {
  const value = process.env[key] ?? fromFiles[key];
  return !value || !value.trim();
});

if (missing.length > 0) {
  console.error('\n  Build stopped: required environment variables are missing.\n');
  for (const [key, why] of missing) console.error(`    ${key}  — ${why}`);
  console.error('\n  Set them in .env.production (or the CI environment) and build again.\n');
  process.exit(1);
}
