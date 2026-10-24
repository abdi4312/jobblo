import * as Sentry from '@sentry/react-native';

/**
 * Sentry is installed but OFF. Our own reporter (./reporter.ts → developer dashboard
 * "Mobile App") is the monitoring in use. To switch Sentry on later:
 *   1. EXPO_PUBLIC_SENTRY_DSN=<dsn> and EXPO_PUBLIC_SENTRY_ENABLED=true in the EAS env
 *   2. add the "@sentry/react-native" config plugin (with org/project) to app.config.js so
 *      release builds upload source maps, then rebuild.
 * Until both env vars are set nothing is initialised and no data leaves the device.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
export const SENTRY_ENABLED = Boolean(DSN) && process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true';

let started = false;

export function initSentry(release?: string) {
  if (!SENTRY_ENABLED || started) return;
  started = true;
  Sentry.init({
    dsn: DSN,
    release,
    environment: process.env.EAS_BUILD_PROFILE || (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export function sentryCapture(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_ENABLED) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
