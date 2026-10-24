import { format, formatDistanceToNowStrict } from 'date-fns';

const nf = new Intl.NumberFormat('en-US');
const cf = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const num = (v?: number | null) => (v === null || v === undefined ? '—' : nf.format(v));
export const compact = (v?: number | null) => (v === null || v === undefined ? '—' : cf.format(v));
export const pct = (v?: number | null, digits = 1) => (v === null || v === undefined ? '—' : `${v.toFixed(digits)}%`);
/** Requests per second; tiny averages read as "<0.01" instead of a misleading 0. */
export const rate = (v?: number | null) =>
  v === null || v === undefined ? '—' : v > 0 && v < 0.01 ? '<0.01/s' : `${Number(v.toFixed(2))}/s`;
const nok = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 2 });
/** NOK amounts; pass `minor` for øre fields (*Minor, Stripe operations/incidents). */
export const money = (v?: number | null, minor = false) => (v === null || v === undefined ? '—' : nok.format(minor ? v / 100 : v));
export const ms = (v?: number | null) => {
  if (v === null || v === undefined) return '—';
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(v < 10_000 ? 2 : 1)} s`;
};

export const bytes = (v?: number | null) => {
  if (v === null || v === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = v;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

/** Seconds → "3d 4h", "12m 5s". */
export const duration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

export const every = (msValue: number) => duration(msValue / 1000).replace(/ 0[smh]$/, '');

export const ago = (d?: string | Date | null) =>
  d ? formatDistanceToNowStrict(new Date(d), { addSuffix: true }) : '—';
export const until = (d?: string | Date | null) =>
  d ? (new Date(d).getTime() <= Date.now() ? 'due now' : `in ${formatDistanceToNowStrict(new Date(d))}`) : '—';
export const dateTime = (d?: string | Date | null) => (d ? format(new Date(d), 'dd MMM yyyy, HH:mm:ss') : '—');

/** X-axis tick label that fits the bucket size of the series. */
export const tick = (bucketMs: number) => (d: string | number) =>
  format(new Date(d), bucketMs < 3_600_000 ? 'HH:mm' : bucketMs < 86_400_000 ? 'dd MMM HH:mm' : 'dd MMM');

/** Download rows as a CSV file (client-side, from data already on screen). */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Block spreadsheet formula injection from logged values.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
