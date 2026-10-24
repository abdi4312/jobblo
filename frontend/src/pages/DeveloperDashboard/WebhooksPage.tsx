import { useState } from 'react';
import { CheckCircle2, Clock, Hourglass, Repeat, Search, Webhook, XCircle } from 'lucide-react';
import { ago, dateTime, ms, num } from '@/lib/devFormat';
import { useDevWebhooks, useUrlFilters } from '../../features/developer/hooks';
import type { WebhookEvent } from '../../api/developer';
import { ErrorState, KeyValue, Mono, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'processed', label: 'Processed' },
  { value: 'processing', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export default function WebhooksPage() {
  const [f, setF] = useUrlFilters({ range: '7d', status: 'all', type: '', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const [event, setEvent] = useState<WebhookEvent | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevWebhooks({
    range: f.range as '7d',
    status: f.status === 'all' ? undefined : f.status,
    type: f.type || undefined,
    q: f.q || undefined,
    page: f.page,
  });
  const s = data?.summary;
  const r = data?.readiness;

  const columns: Column<WebhookEvent>[] = [
    { key: 'type', header: 'Event type', cell: (e) => <span className="font-mono text-xs">{e.type}</span> },
    { key: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.derivedStatus} /> },
    { key: 'id', header: 'Event ID', cell: (e) => <span className="font-mono text-[11px] text-muted-foreground">{e.eventId}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (e) => <span className={`tabular-nums ${e.attempts > 1 ? 'text-amber-600' : ''}`}>{e.attempts}</span> },
    { key: 'dur', header: 'Processing', align: 'right', cell: (e) => <span className="tabular-nums text-muted-foreground">{ms(e.durationMs)}</span> },
    { key: 'at', header: 'Received', align: 'right', cell: (e) => <span className="text-xs text-muted-foreground">{ago(e.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stripe Webhooks"
        description="Every Stripe event accepted by the ledger: processing state, retries and endpoint readiness."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Received" icon={<Webhook />} loading={isLoading} value={num(s?.total)} />
        <StatCard label="Processed" icon={<CheckCircle2 />} tone="success" loading={isLoading} value={num(s?.processed)} />
        <StatCard label="Pending" icon={<Hourglass />} tone={s?.processing ? 'info' : 'neutral'} loading={isLoading} value={num(s ? s.processing - s.failed : undefined)} />
        <StatCard label="Failed" icon={<XCircle />} tone={s?.failed ? 'danger' : 'success'} loading={isLoading} value={num(s?.failed)} hint="awaiting Stripe retry" />
        <StatCard label="Retried" icon={<Repeat />} tone={s?.retried ? 'warning' : 'neutral'} loading={isLoading} value={num(s?.retried)} hint="attempts > 1" />
        <StatCard label="Avg processing" icon={<Clock />} loading={isLoading} value={ms(s?.avgMs)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Endpoint readiness" description="Signing secret, mode and last verified delivery">
          {r ? (
            <KeyValue
              items={[
                ['Status', <StatusBadge key="s" status={r.status} />],
                ['Mode', r.mode ? <StatusBadge key="m" status={r.mode} tone={r.mode === 'live' ? 'danger' : 'info'} /> : '—'],
                ['Last verified', ago(r.lastVerifiedAt)],
                ['Last delivery', ago(r.lastDeliveryAt)],
                ['Last failure', r.lastFailureAt ? `${ago(r.lastFailureAt)} (${r.lastFailureCode || 'unknown'})` : '—'],
                ['Reason', r.reason ? <Mono key="r">{r.reason}</Mono> : '—'],
              ]}
            />
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </Section>
        <Section title="Deliveries over time" className="lg:col-span-2">
          <TimeSeriesChart
            data={data?.series}
            bucketMs={data?.range.bucketMs}
            variant="bar"
            height={180}
            series={[
              { key: 'received', label: 'Received', color: 'var(--chart-1)' },
              { key: 'failed', label: 'Failed', color: 'var(--chart-5)' },
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Section title="Top event types" className="lg:col-span-1">
          <ul className="space-y-1.5 text-xs">
            {(data?.types || []).map((t) => (
              <li key={t.type}>
                <button type="button" onClick={() => setF({ type: f.type === t.type ? '' : t.type })} className={`flex w-full items-center justify-between gap-2 rounded-sm px-1.5 py-1 text-left hover:bg-muted ${f.type === t.type ? 'bg-accent text-accent-foreground' : ''}`}>
                  <span className="truncate font-mono">{t.type}</span>
                  <span className="tabular-nums text-muted-foreground">{num(t.count)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        <Section
          title="Events"
          className="lg:col-span-3"
          action={
            <div className="flex flex-wrap gap-2">
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  setF({ q: search.trim() });
                }}
              >
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="evt_… or object ID" className="h-7 w-48 pl-7 text-xs" aria-label="Search event ID" />
              </form>
              <Select value={f.status} onValueChange={(status) => setF({ status })}>
                <SelectTrigger size="sm" className="w-32" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <DataTable columns={columns} rows={data?.events} loading={isLoading} rowKey={(e) => e._id} onRowClick={setEvent} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} emptyTitle="No webhook events in range" />
        </Section>
      </div>

      <Sheet open={Boolean(event)} onOpenChange={(o) => !o && setEvent(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {event && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="font-mono text-sm">{event.type}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <StatusBadge status={event.derivedStatus} /> {event.eventId}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto p-4">
                {event.lastError && <div className="rounded-md border border-red-200/70 bg-red-50 p-3 text-sm text-red-700">{event.lastError}</div>}
                <KeyValue
                  items={[
                    ['Event ID', <Mono key="e">{event.eventId}</Mono>],
                    ['Stripe object', event.objectId ? <Mono key="o">{event.objectId}</Mono> : '—'],
                    ['Ledger status', event.status],
                    ['Attempts', event.attempts],
                    ['Received', dateTime(event.createdAt)],
                    ['Processed', dateTime(event.processedAt)],
                    ['Processing time', ms(event.durationMs)],
                    ['Idempotency', event.attempts > 1 ? 'Replayed — claim re-taken after failure' : 'First delivery'],
                  ]}
                />
                <p className="text-xs text-muted-foreground">Payloads are never stored. Failed events are retried by Stripe automatically; recovery actions are not exposed here.</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
