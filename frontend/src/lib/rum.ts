import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { API_BASE_URL } from '../config/env';

/**
 * Real-user monitoring → POST /api/rum (developer console "Real Users" and "Sessions").
 * Records page views, Core Web Vitals (via Google's web-vitals), uncaught JS errors and
 * problems (broken screen, page not found, failed code chunk, failed API call, console
 * error). Each error/problem carries the last 30 steps of the visit — a masked breadcrumb
 * trail (pages, what was clicked by role/label, API calls) — so it can be replayed.
 * Anonymous by design: a random id that lives only in memory for this tab, no cookies,
 * no storage, no user id, no URL query strings, never input values, emails, phone numbers
 * or ids. Developer-console and admin pages are skipped. Sent with sendBeacon.
 */

type ProblemKind = 'render' | 'not_found' | 'chunk' | 'api' | 'console';
type Crumb = { at: string; type: 'view' | 'click' | 'api' | 'console' | 'error'; page: string; label?: string; status?: number; ms?: number };
type RumEvent =
  | { type: 'view'; at: string; page: string; loadMs?: number }
  | { type: 'vital'; at: string; page: string; metric: Metric['name']; value: number; rating: Metric['rating']; navigationType: string }
  | { type: 'error'; at: string; page: string; message: string; source?: string; trail: Crumb[] }
  | { type: 'problem'; at: string; page: string; kind: ProblemKind; message: string; status?: number; trail: Crumb[] };

const ENDPOINT = `${String(API_BASE_URL || '').replace(/\/$/, '')}/api/rum`;
const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
const queue: RumEvent[] = [];
const crumbs: Crumb[] = [];
let started = false;
let landingPage = '';
let lastViewAt = 0;
let problemsSent = 0;
const seenProblems = new Set<string>();

const page = () => window.location.pathname;
const internal = () => /^\/(developer|dashboard)(\/|$)/.test(page());
const device = () => (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop');
function browser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return /Mobile/.test(ua) ? 'Chrome Mobile' : 'Chrome';
  if (/Safari\//.test(ua)) return /Mobile/.test(ua) ? 'Safari iOS' : 'Safari';
  return 'Other';
}

/** Same masking as the server (which masks again): no emails, phone numbers or ids leave the browser. */
const mask = (s: string, max = 80) =>
  s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b[0-9a-f]{24}\b/gi, ':id')
    .replace(/\+?\d[\d\s-]{2,}\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const apiPath = (url: string) => {
  try {
    return new URL(url, API_BASE_URL || window.location.origin).pathname.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id');
  } catch {
    return '(unknown)';
  }
};

/** What was clicked, described by role and label only — never form values. */
function describe(el: Element | null): string | null {
  const target = el?.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], input, select, textarea, label, summary');
  if (!target) return null;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const type = (target as HTMLInputElement).type || tag;
    const name = target.getAttribute('aria-label') || target.getAttribute('name') || target.getAttribute('placeholder') || '';
    return mask(`${tag}[${type}] ${name}`);
  }
  const label = target.getAttribute('aria-label') || target.getAttribute('data-testid') || target.getAttribute('title') || (target as HTMLElement).innerText || '';
  return mask(`${target.getAttribute('role') || tag} "${mask(label, 40)}"`);
}

function crumb(c: Omit<Crumb, 'at' | 'page'>) {
  if (!started) return;
  crumbs.push({ at: new Date().toISOString(), page: page(), ...c });
  if (crumbs.length > 30) crumbs.shift();
}

function flush() {
  if (!queue.length) return;
  const body = JSON.stringify({
    sessionId,
    device: device(),
    browser: browser(),
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType,
    release: import.meta.env.VITE_APP_VERSION,
    events: queue.splice(0, 30),
  });
  try {
    // text/plain keeps sendBeacon a "simple" request (no CORS preflight).
    if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) {
      void fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* monitoring must never break the page */
  }
  if (queue.length) flush();
}

const push = (e: RumEvent) => {
  queue.push(e);
  if (queue.length >= 20) flush();
};

/** Send one problem with the trail so far. Max 20 per tab; the same problem once. */
function problem(e: Omit<Extract<RumEvent, { type: 'error' }>, 'at' | 'page' | 'trail'> | Omit<Extract<RumEvent, { type: 'problem' }>, 'at' | 'page' | 'trail'>) {
  if (!started || problemsSent >= 20) return;
  const key = `${e.type}|${'kind' in e ? e.kind : ''}|${e.message}`;
  if (seenProblems.has(key)) return;
  seenProblems.add(key);
  problemsSent += 1;
  push({ ...e, message: mask(e.message, 300), at: new Date().toISOString(), page: page(), trail: [...crumbs] } as RumEvent);
  flush(); // the tab may be about to close or reload
}

/** A screen failed: render crash, page not found, or a code chunk that would not load. */
export function reportProblem(kind: 'render' | 'not_found' | 'chunk', message: string) {
  problem({ type: 'problem', kind, message });
}

/** Called by the API client for every response (see api/mainURLs.ts). */
export function trackApi(method: string | undefined, url: string | undefined, status: number, ms: number) {
  if (!started) return;
  const label = `${String(method || 'get').toUpperCase()} ${apiPath(String(url || ''))}`;
  crumb({ type: 'api', label, status, ms });
  if (status === 0 || status >= 500) problem({ type: 'problem', kind: 'api', status, message: `${label} → ${status || 'network error'}` });
}

const CHUNK = /dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i;

/** Call on every route change (react-router). The first call is the landing page. */
export function trackView() {
  if (!started || internal()) return;
  const now = performance.now();
  const at = new Date().toISOString();
  crumb({ type: 'view' });
  if (!lastViewAt) {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    push({ type: 'view', at, page: page(), loadMs: nav ? Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd || now) : Math.round(now) });
  } else {
    push({ type: 'view', at, page: page() });
  }
  lastViewAt = now;
}

export function startRum() {
  if (started || typeof window === 'undefined' || !API_BASE_URL) return;
  if (internal()) return; // internal tools are not user experience
  started = true;
  landingPage = page();
  const report = (m: Metric) => push({ type: 'vital', at: new Date().toISOString(), page: landingPage, metric: m.name, value: m.name === 'CLS' ? Math.round(m.value * 1000) / 1000 : Math.round(m.value), rating: m.rating, navigationType: m.navigationType });
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);
  const error = (message: string, source?: string) => {
    crumb({ type: 'error', label: mask(message) });
    if (CHUNK.test(message)) return reportProblem('chunk', message);
    problem({ type: 'error', message: message.slice(0, 300), source: source?.split('?')[0].slice(0, 200) });
  };
  window.addEventListener('error', (e) => error(e.message || 'Script error', e.filename ? `${e.filename}:${e.lineno}` : undefined));
  window.addEventListener('unhandledrejection', (e) => error(`Unhandled rejection: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`));
  document.addEventListener(
    'click',
    (e) => {
      const label = describe(e.target as Element);
      if (label) crumb({ type: 'click', label });
    },
    { capture: true, passive: true }
  );
  // console.error: kept as a crumb, and reported (deduplicated, capped) as a problem.
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).filter(Boolean).join(' ');
      if (!text) return;
      crumb({ type: 'console', label: mask(text) });
      // React logs a crash before the error screen reports it: wait, and skip what is already reported.
      setTimeout(() => ![...seenProblems].some((k) => k.endsWith(`|${text}`)) && problem({ type: 'problem', kind: 'console', message: text }), 1000);
    } catch {
      /* never break logging */
    }
  };
  // The page may never be visited again: send on hide (covers tab close and mobile app switch).
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  setInterval(flush, 15_000);
}
