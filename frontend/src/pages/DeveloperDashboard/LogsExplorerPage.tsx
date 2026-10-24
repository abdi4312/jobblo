import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileJson, Filter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateTime, downloadCsv } from '@/lib/devFormat';
import { useDevLogs, useUrlFilters } from '../../features/developer/hooks';
import type { LogLevel, LogRow } from '../../api/developer';
import { EmptyState, ErrorState, JsonView, Mono, PageHeader, RangeSelect, RefreshButton, Section } from '../../components/developer/kit';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Checkbox } from '../../components/developer/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/developer/ui/popover';

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'text-muted-foreground bg-muted',
  info: 'text-sky-700 bg-sky-50',
  warn: 'text-amber-700 bg-amber-50',
  error: 'text-red-700 bg-red-50',
  fatal: 'text-white bg-red-600',
};
const ALL_SERVICES = ['api', 'audit', 'auth', 'scheduler', 'webhook', 'subscription', 'delivery'];
const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
const ENTITY_FILTERS = [
  { key: 'traceId', label: 'Trace / request ID' },
  { key: 'userId', label: 'User ID' },
  { key: 'orderId', label: 'Job (order) ID' },
  { key: 'paymentId', label: 'Payment ID (pi_…)' },
] as const;

function MultiToggle({ label, all, value, onChange }: { label: string; all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <Filter /> {label}
          {value.length > 0 && <span className="rounded-sm bg-primary/10 px-1 text-[10px] text-primary">{value.length}</span>}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <div className="space-y-1">
          {all.map((item) => (
            <Label key={item} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-normal capitalize hover:bg-muted">
              <Checkbox checked={value.includes(item)} onCheckedChange={(c) => onChange(c ? [...value, item] : value.filter((v) => v !== item))} />
              {item}
            </Label>
          ))}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LogLine({ row, open, onToggle, onTrace }: { row: LogRow; open: boolean; onToggle: () => void; onTrace: (id: string) => void }) {
  return (
    <li className={cn('border-b last:border-b-0', open && 'bg-muted/30')}>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[1rem_10.5rem_3.5rem_6rem_1fr] items-start gap-3 px-3 py-1.5 text-left font-mono text-xs hover:bg-muted/40">
        {open ? <ChevronDown className="mt-0.5 size-3.5 text-muted-foreground" /> : <ChevronRight className="mt-0.5 size-3.5 text-muted-foreground" />}
        <span className="whitespace-nowrap text-muted-foreground">{dateTime(row.at)}</span>
        <span className={cn('rounded-sm px-1 text-center text-[10px] font-semibold uppercase', LEVEL_STYLE[row.level])}>{row.level}</span>
        <span className="truncate text-muted-foreground">{row.service}</span>
        <span className={cn('truncate text-foreground', open && 'whitespace-normal break-all')}>{row.message}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 pl-10">
          <div className="flex flex-wrap gap-2 text-xs">
            {row.traceId && (
              <button type="button" onClick={() => onTrace(row.traceId!)} className="rounded-sm border bg-card px-1.5 py-0.5 font-mono text-primary hover:bg-accent" title="Show correlated events">
                trace {row.traceId}
              </button>
            )}
            {row.userId && <Mono>user {row.userId}</Mono>}
            <Mono>{row.id}</Mono>
          </div>
          <JsonView value={row.data} />
        </div>
      )}
    </li>
  );
}

export default function LogsExplorerPage() {
  const [f, setF] = useUrlFilters({ range: '24h', q: '', services: '', levels: '', traceId: '', userId: '', orderId: '', paymentId: '' });
  const [search, setSearch] = useState(f.q);
  const [before, setBefore] = useState<string | undefined>();
  const [pages, setPages] = useState<LogRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const services = f.services ? f.services.split(',') : [];
  const levels = f.levels ? f.levels.split(',') : [];
  const query = { range: f.range as '24h', q: f.q || undefined, services: f.services || undefined, levels: f.levels || undefined, traceId: f.traceId || undefined, userId: f.userId || undefined, orderId: f.orderId || undefined, paymentId: f.paymentId || undefined, limit: 150, before };
  const { data, isLoading, isFetching, error, refetch } = useDevLogs(query);

  // "Load older" appends; any filter change starts over.
  const filterKey = JSON.stringify({ ...query, before: undefined });
  useEffect(() => {
    setBefore(undefined);
    setPages([]);
  }, [filterKey]);
  useEffect(() => {
    if (!data) return;
    setPages((prev) => (before ? [...prev.filter((p) => !data.logs.some((l) => l.id === p.id)), ...data.logs] : data.logs));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeEntities = ENTITY_FILTERS.filter((e) => f[e.key]);
  const download = (kind: 'csv' | 'json') => {
    if (kind === 'csv') return downloadCsv(`logs-${f.range}.csv`, pages.map((l) => ({ at: l.at, level: l.level, service: l.service, message: l.message, traceId: l.traceId, userId: l.userId, data: l.data })));
    const url = URL.createObjectURL(new Blob([JSON.stringify(pages, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `logs-${f.range}.json` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Logs Explorer"
        description="One searchable, redacted stream over API errors, audit, auth, scheduler, webhook, subscription and delivery logs."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button variant="outline" size="sm" className="bg-card" disabled={!pages.length} onClick={() => download('csv')}>
              <Download /> CSV
            </Button>
            <Button variant="outline" size="sm" className="bg-card" disabled={!pages.length} onClick={() => download('json')}>
              <FileJson /> JSON
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-64 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setF({ q: search.trim() });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages, codes, routes, IPs…" className="bg-card pl-8" aria-label="Search logs" />
        </form>
        <MultiToggle label="Service" all={ALL_SERVICES} value={services} onChange={(v) => setF({ services: v.join(',') })} />
        <MultiToggle label="Level" all={ALL_LEVELS} value={levels} onChange={(v) => setF({ levels: v.join(',') })} />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="bg-card">
              <Filter /> IDs {activeEntities.length > 0 && <span className="rounded-sm bg-primary/10 px-1 text-[10px] text-primary">{activeEntities.length}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setF(Object.fromEntries(ENTITY_FILTERS.map((x) => [x.key, String(fd.get(x.key) || '').trim()])));
              }}
            >
              {ENTITY_FILTERS.map((x) => (
                <div key={x.key} className="space-y-1">
                  <Label htmlFor={`f-${x.key}`} className="text-xs text-muted-foreground">
                    {x.label}
                  </Label>
                  <Input id={`f-${x.key}`} name={x.key} defaultValue={f[x.key]} className="h-8 font-mono text-xs" />
                </div>
              ))}
              <Button type="submit" size="sm" className="w-full">
                Apply
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      {activeEntities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeEntities.map((e) => (
            <span key={e.key} className="inline-flex items-center gap-1 rounded-sm border bg-card px-2 py-0.5 text-xs">
              {e.label}: <span className="font-mono">{f[e.key]}</span>
              <button type="button" onClick={() => setF({ [e.key]: '' })} aria-label={`Clear ${e.label}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Section
        title={f.traceId ? `Correlated timeline for ${f.traceId}` : 'Events'}
        description={`${pages.length} loaded · newest first · secrets and personal data are redacted`}
        contentClassName="px-0"
      >
        {isLoading && !pages.length ? (
          <div className="space-y-1 px-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : pages.length ? (
          <>
            <ul className="border-y">
              {pages.map((row) => (
                <LogLine key={row.id} row={row} open={open === row.id} onToggle={() => setOpen(open === row.id ? null : row.id)} onTrace={(traceId) => setF({ traceId })} />
              ))}
            </ul>
            <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground">
              <span>Not collected: {data?.unavailable.join(', ')}</span>
              {data?.nextBefore && (
                <Button variant="outline" size="sm" disabled={isFetching} onClick={() => setBefore(data.nextBefore!)}>
                  Load older
                </Button>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="No log events match" description="Widen the time range or clear filters." />
        )}
      </Section>
    </div>
  );
}
