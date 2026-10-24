import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, PlugZap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { RANGE_OPTIONS } from '../../features/developer/hooks';
import type { Issue, RangeKey, TimelineEvent } from '../../api/developer';
import { ago, dateTime } from '@/lib/devFormat';

/* Small building blocks every developer page is assembled from. All are thin
 * wrappers over the shadcn primitives in ./ui so the whole dashboard reads as one. */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </div>
  );
}

export function RangeSelect({ value, onChange }: { value: string; onChange: (v: RangeKey) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangeKey)}>
      <SelectTrigger size="sm" className="w-40 bg-card" aria-label="Time range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {RANGE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RefreshButton({ onClick, spinning }: { onClick: () => void; spinning?: boolean }) {
  return (
    <Button variant="outline" size="sm" className="bg-card" onClick={onClick} aria-label="Refresh">
      <RefreshCw className={cn(spinning && 'animate-spin')} />
      Refresh
    </Button>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  info: 'text-sky-600',
};
const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/70',
  danger: 'bg-red-50 text-red-700 border-red-200/70',
  info: 'bg-sky-50 text-sky-700 border-sky-200/70',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardDescription className="text-xs font-medium tracking-wide uppercase">{label}</CardDescription>
        {icon && <span className={cn('[&_svg]:size-4', TONE_TEXT[tone])}>{icon}</span>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</div>
        )}
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  healthy: 'success',
  completed: 'success',
  released: 'success',
  succeeded: 'success',
  transferred: 'success',
  active: 'success',
  recovered: 'success',
  reconciled: 'success',
  payment_received: 'success',
  paid: 'success',
  live: 'danger',
  test: 'info',
  in_progress: 'info',
  accepted: 'info',
  ready_for_review: 'info',
  released_internal: 'info',
  retrying: 'warning',
  canceling: 'warning',
  past_due: 'warning',
  waiting_connect: 'warning',
  refund_pending: 'warning',
  partially_refunded: 'warning',
  awaiting_payment: 'warning',
  medium: 'warning',
  high: 'danger',
  low: 'neutral',
  none: 'neutral',
  unpaid: 'neutral',
  canceled: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
  declined: 'neutral',
  refunded: 'neutral',
  automatically_cancelled: 'neutral',
  disputed: 'danger',
  refund_failed: 'danger',
  reconciliation_required: 'danger',
  manual_review: 'danger',
  exhausted: 'danger',
  ok: 'success',
  processed: 'success',
  resolved: 'success',
  connected: 'success',
  pass: 'success',
  investigating: 'info',
  pending: 'info',
  processing: 'info',
  idle: 'neutral',
  disabled: 'neutral',
  unknown: 'neutral',
  'n/a': 'neutral',
  open: 'warning',
  missed: 'warning',
  warning: 'warning',
  endpoint_unverified: 'warning',
  reopened: 'danger',
  failing: 'danger',
  failed: 'danger',
  error: 'danger',
  critical: 'danger',
  fail: 'danger',
  disconnected: 'danger',
  delivery_problem: 'danger',
  secret_missing: 'danger',
  invalid_configuration: 'danger',
  configuration_unavailable: 'danger',
};
const STATUS_LABEL: Record<string, string> = { open: 'New' };

export function StatusBadge({ status: raw, label, tone }: { status: string | null | undefined; label?: string; tone?: Tone }) {
  // Records from older code paths can miss a status field; never crash a page over it.
  const status = raw == null || raw === '' ? 'unknown' : String(raw);
  const t = tone || STATUS_TONE[status] || 'neutral';
  return (
    <Badge variant="outline" className={cn('font-medium capitalize', TONE_SOFT[t])}>
      <span className={cn('size-1.5 rounded-full bg-current opacity-80')} />
      {label || STATUS_LABEL[status] || status.replace(/_/g, ' ')}
    </Badge>
  );
}

const METHOD_TONE: Record<string, string> = {
  GET: 'text-sky-700 bg-sky-50 border-sky-200/70',
  POST: 'text-emerald-700 bg-emerald-50 border-emerald-200/70',
  PUT: 'text-amber-700 bg-amber-50 border-amber-200/70',
  PATCH: 'text-violet-700 bg-violet-50 border-violet-200/70',
  DELETE: 'text-red-700 bg-red-50 border-red-200/70',
};
export function MethodBadge({ method }: { method?: string | null }) {
  const m = (method || 'other').toUpperCase();
  return (
    <Badge variant="outline" className={cn('w-14 justify-center font-mono text-[10px]', METHOD_TONE[m] || TONE_SOFT.neutral)}>
      {m}
    </Badge>
  );
}

export function Meter({ value, label, detail }: { value: number | null | undefined; label: string; detail?: ReactNode }) {
  const v = value ?? 0;
  const color = v >= 90 ? '[&>div]:bg-red-500' : v >= 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-primary';
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value === null || value === undefined ? 'n/a' : `${v}%`}</span>
      </div>
      <Progress value={v} className={cn('h-1.5 bg-muted', color)} />
      {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-foreground">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn('rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground', className)}>{children}</code>;
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn('max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground', className)}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex size-9 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground [&_svg]:size-4">
        {icon || <Inbox />}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function NotConfigured({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={<PlugZap />} title={title} description={description} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as Error)?.message ||
    'Something went wrong.';
  return (
    <Card className="border-red-200/70 bg-red-50/40">
      <CardContent className="flex items-center gap-3 text-sm text-red-700">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function LiveDot({ on = true }: { on?: boolean }) {
  return (
    <span className="relative flex size-2">
      {on && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
      <span className={cn('relative inline-flex size-2 rounded-full', on ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
    </span>
  );
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

/** Detected problems (stuck / inconsistent state), most severe first. */
export function IssueList({ issues, empty = 'No issues detected.' }: { issues: Issue[]; empty?: string }) {
  if (!issues.length)
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" /> {empty}
      </div>
    );
  return (
    <ul className="divide-y rounded-md border">
      {issues.map((i) => (
        <li key={i.code} className="flex items-start gap-3 px-3 py-2.5 text-sm">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[i.severity])} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">{i.code.replace(/_/g, ' ')}</div>
            <div className="text-xs text-muted-foreground">{i.detail}</div>
          </div>
          <StatusBadge status={i.severity} />
        </li>
      ))}
    </ul>
  );
}

const TL_DOT: Record<string, string> = {
  success: 'bg-emerald-500 ring-emerald-100',
  warning: 'bg-amber-500 ring-amber-100',
  danger: 'bg-red-500 ring-red-100',
  info: 'bg-sky-500 ring-sky-100',
  neutral: 'bg-muted-foreground/50 ring-muted',
};

/** Vertical event timeline (oldest → newest unless `reverse`). */
export function Timeline({ events, reverse }: { events: TimelineEvent[]; reverse?: boolean }) {
  const list = reverse ? [...events].reverse() : events;
  if (!list.length) return <EmptyState title="No events" />;
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {list.map((e, i) => (
        <li key={i} className="relative">
          <span className={cn('absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4', TL_DOT[e.tone || 'neutral'])} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-medium text-foreground first-letter:uppercase">{e.title}</span>
            <span className="text-xs text-muted-foreground" title={dateTime(e.at)}>
              {ago(e.at)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="rounded-sm bg-muted px-1 font-mono text-[10px] uppercase">{e.source}</span>
            {e.by && <span>by {e.by}</span>}
            {e.detail && <span className="min-w-0 break-all">{e.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A {key: count} map as labelled horizontal bars. */
export function CountBars({ counts, onSelect, selected }: { counts: Record<string, number>; onSelect?: (k: string) => void; selected?: string }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (!entries.length) return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <ul className="space-y-1.5">
      {entries.map(([k, n]) => (
        <li key={k}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(selected === k ? '' : k)}
            className={cn('grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-sm px-1 py-0.5 text-left text-xs', onSelect && 'hover:bg-muted', selected === k && 'bg-accent')}
          >
            <span className="truncate text-foreground">{k.replace(/_/g, ' ')}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="tabular-nums text-muted-foreground">{n.toLocaleString()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
