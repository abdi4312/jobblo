import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { authStorage } from '../utils/authStorage';
import { initSentry, sentryCapture } from './sentry';
import { templatePath } from './paths';

/**
 * Lightweight crash & API reporter → POST /api/mobile/telemetry (developer dashboard →
 * Mobile App). No third-party service: session starts, JS errors (fatal or not), render
 * errors and failed/slow API calls, batched and sent every 30 s, on background, and right
 * away for crashes. A fatal crash is also written to storage first and re-sent on the next
 * launch, because the JS runtime may not survive long enough to send it.
 *
 * Never sends request bodies, headers, tokens or query strings; API paths have ids
 * replaced with :id. Reporting failures are swallowed — monitoring must never crash the app.
 */

type Event =
  | { type: 'session'; at: string; screen?: string }
  | { type: 'error'; at: string; name: string; message: string; stack?: string; fatal: boolean; kind: 'js' | 'render' | 'promise'; screen?: string }
  | { type: 'api'; at: string; method?: string; path: string; status: number; ms: number; screen?: string };

const INSTALL_KEY = 'jobblo.monitoring.installId';
const PENDING_KEY = 'jobblo.monitoring.pendingCrash';
const FLUSH_MS = 30_000;
const MAX_QUEUE = 200;
const SLOW_MS = 3000;

let endpoint: string | null = null;
let installId: string | null = null;
let screen: string | undefined;
let queue: Event[] = [];
let flushing = false;
let started = false;
const sessionId = randomId();

const appVersion = Constants.expoConfig?.version ?? null;
const build = (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode?.toString()) ?? null;

function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function push(event: Event) {
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
}

/** POST one batch. true = delivered (or rejected as invalid, which retrying cannot fix). */
async function send(forSession: string, events: Event[]) {
  if (!endpoint || !installId) return false;
  try {
    const token = await authStorage.getItem('token').catch(() => null);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        installId,
        sessionId: forSession,
        platform: Platform.OS,
        osVersion: String(Platform.Version ?? ''),
        appVersion,
        build,
        device: Device.modelName ?? null,
        events,
      }),
    });
    return !(res.status >= 500 || res.status === 429);
  } catch {
    return false; // offline
  }
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue.splice(0, 50);
  try {
    if (!(await send(sessionId, batch))) queue.unshift(...batch);
    else if (batch.some((e) => e.type === 'error' && e.fatal)) await authStorage.removeItem(PENDING_KEY).catch(() => undefined);
  } finally {
    flushing = false;
  }
}

export function captureError(error: unknown, { fatal = false, kind = 'js' }: { fatal?: boolean; kind?: 'js' | 'render' | 'promise' } = {}) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const event: Event = { type: 'error', at: new Date().toISOString(), name: e.name || 'Error', message: e.message || '(no message)', stack: e.stack?.slice(0, 4000), fatal, kind, screen };
    push(event);
    sentryCapture(error, { fatal, kind, screen });
    // Fatal: persist first, so a successful send can clear it (no duplicate next launch).
    if (fatal) void authStorage.setItem(PENDING_KEY, JSON.stringify({ sessionId, event })).catch(() => undefined).finally(() => void flush());
    else void flush();
  } catch {
    /* never throw from the reporter */
  }
}

/** Current route, so errors and slow calls say where they happened. */
export function setScreen(name: string) {
  screen = name.slice(0, 120);
}

/** Record failed (5xx / network) and slow API calls made through this axios instance. */
export function monitorAxios(client: AxiosInstance) {
  type Timed = InternalAxiosRequestConfig & { _startedAt?: number };
  client.interceptors.request.use((config: Timed) => {
    config._startedAt = Date.now();
    return config;
  });
  const record = (config: Timed | undefined, status: number) => {
    if (!config?._startedAt) return;
    const ms = Date.now() - config._startedAt;
    if (status === 0 || status >= 500 || ms >= SLOW_MS) {
      push({ type: 'api', at: new Date().toISOString(), method: config.method?.toUpperCase(), path: templatePath(config.url), status, ms, screen });
    }
  };
  client.interceptors.response.use(
    (res) => {
      record(res.config as Timed, res.status);
      return res;
    },
    (error) => {
      record(error?.config as Timed | undefined, error?.response?.status ?? 0);
      return Promise.reject(error);
    }
  );
}

/** Call once at startup (root layout). Safe to call again. */
export async function startMonitoring(apiBaseUrl: string) {
  if (started) return;
  started = true;
  endpoint = `${apiBaseUrl.replace(/\/$/, '')}/mobile/telemetry`;
  initSentry(appVersion ? `${appVersion}${build ? `+${build}` : ''}` : undefined);

  // Uncaught JS errors. Keep the previous handler: it shows the red box in dev and
  // terminates the app in release, which is the correct crash behaviour.
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const previous = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((error, isFatal) => {
    captureError(error, { fatal: Boolean(isFatal), kind: 'js' });
    previous?.(error, isFatal);
  });

  // Unhandled promise rejections (Hermes).
  const hermes = (globalThis as unknown as { HermesInternal?: { enablePromiseRejectionTracker?: (o: object) => void } }).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({ allRejections: true, onUnhandled: (_id: number, error: unknown) => captureError(error, { kind: 'promise' }) });

  try {
    installId = (await authStorage.getItem(INSTALL_KEY)) || null;
    if (!installId) {
      installId = randomId();
      await authStorage.setItem(INSTALL_KEY, installId);
    }
    // A crash the previous launch could not deliver; counted against that session.
    const pending = await authStorage.getItem(PENDING_KEY);
    if (pending) {
      const { sessionId: crashed, event } = JSON.parse(pending) as { sessionId: string; event: Event };
      if (await send(crashed, [event])) await authStorage.removeItem(PENDING_KEY);
    }
  } catch {
    installId ||= randomId();
  }

  push({ type: 'session', at: new Date().toISOString(), screen });
  void flush();
  setInterval(() => void flush(), FLUSH_MS);
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flush();
  });
}
