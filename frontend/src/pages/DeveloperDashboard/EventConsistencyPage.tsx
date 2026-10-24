import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, CheckCircle2, CircleSlash, Copy, ListChecks } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import type { EventCheck } from '../../api/developer';
import { useDevEventConsistency, useUrlFilters } from '../../features/developer/hooks';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const KIND = { missing: 'Missing', duplicate: 'Duplicate', out_of_order: 'Out of order' } as const;
const AREA = { webhook: 'Webhook', job: 'Job', payment: 'Payment', notification: 'Notification' } as const;

function Ref({ s }: { s: EventCheck['samples'][number] }) {
  const to = s.link === 'job' ? `/developer/transactions?id=${s.ref}` : s.link === 'user' ? `/developer/users?id=${s.ref}` : `/developer/investigate?q=${encodeURIComponent(s.ref)}`;
  return (
    <Link to={to} className="font-mono text-xs text-primary hover:underline">
      {s.ref}
    </Link>
  );
}

export default function EventConsistencyPage() {
  const [f, setF] = useUrlFilters({ days: '30', area: 'all' });
  const { data, isLoading, error, refetch } = useDevEventConsistency(Number(f.days));
  const [open, setOpen] = useState<EventCheck | null>(null);
  const checks = data?.checks || [];
  const failing = (kind: EventCheck['kind']) => checks.filter((c) => c.kind === kind).reduce((a, c) => a + c.count, 0);
  const rows = checks.filter((c) => f.area === 'all' || c.area === f.area).sort((a, b) => Number(b.count > 0) - Number(a.count > 0));

  const columns: Column<EventCheck>[] = [
    { key: 's', header: '', cell: (c) => (c.error ? <StatusBadge status="error" tone="danger" /> : c.skipped ? <CircleSlash className="size-4 text-muted-foreground" /> : c.count === 0 ? <CheckCircle2 className="size-4 text-emerald-600" /> : <StatusBadge status={c.severity} />) },
    { key: 't', header: 'Check', className: 'max-w-[520px]', cell: (c) => <div className="min-w-0"><div className="truncate font-medium">{c.title}</div><div className="truncate text-xs text-muted-foreground">{c.error || c.skipped || c.why}</div></div> },
    { key: 'a', header: 'Area', cell: (c) => <span className="text-xs">{AREA[c.area]}</span> },
    { key: 'k', header: 'Problem', cell: (c) => <Badge variant="outline">{KIND[c.kind]}</Badge> },
    { key: 'n', header: 'Found', align: 'right', cell: (c) => <span className={c.count ? 'font-medium tabular-nums text-red-600' : 'tabular-nums text-muted-foreground'}>{c.skipped ? '—' : num(c.count)}{c.checked ? <span className="text-xs font-normal text-muted-foreground"> / {c.checked}</span> : null}</span> },
    { key: 'ms', header: 'Took', align: 'right', cell: (c) => <span className="text-xs text-muted-foreground tabular-nums">{c.ms} ms</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Event Consistency"
        description="Job, payment, webhook and notification events that never happened, happened twice, or happened in an order the flow does not allow. Duplicate records (two Payments for one order …) are on Data Integrity; this page checks the events and their sequence."
        actions={
          <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
            <TabsList>
              <TabsTrigger value="7">7 d</TabsTrigger>
              <TabsTrigger value="30">30 d</TabsTrigger>
              <TabsTrigger value="90">90 d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Missing" icon={<CircleSlash />} loading={isLoading} tone={failing('missing') ? 'danger' : 'success'} value={num(data ? failing('missing') : undefined)} hint="never received or never processed" />
        <StatCard label="Duplicate" icon={<Copy />} loading={isLoading} tone={failing('duplicate') ? 'warning' : 'success'} value={num(data ? failing('duplicate') : undefined)} hint="processed or sent twice" />
        <StatCard label="Out of order" icon={<ArrowDownUp />} loading={isLoading} tone={failing('out_of_order') ? 'warning' : 'success'} value={num(data ? failing('out_of_order') : undefined)} hint="against the lifecycle" />
        <StatCard label="Checks passing" icon={<ListChecks />} loading={isLoading} value={data ? `${checks.filter((c) => !c.count && !c.error).length} / ${checks.length}` : '—'} hint={data ? `ran ${ago(data.at)}` : undefined} />
      </div>
      <Section
        title="Checks"
        description="Click a check for the affected events. Stripe is compared over the last 3 days; the rest over the selected period."
        action={
          <Tabs value={f.area} onValueChange={(area) => setF({ area })}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {Object.entries(AREA).map(([k, v]) => (
                <TabsTrigger key={k} value={k}>
                  {v}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      >
        <DataTable columns={columns} rows={rows} loading={isLoading} rowKey={(c) => c.key} onRowClick={setOpen} emptyTitle="No checks" />
      </Section>

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{open.why}</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 px-4 pb-6">
                {open.skipped && <p className="text-sm text-muted-foreground">{open.skipped}</p>}
                {!open.skipped && !open.samples.length && <p className="text-sm text-muted-foreground">Nothing found.</p>}
                {open.samples.map((s, i) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Ref s={s} />
                      <span className="text-xs text-muted-foreground">{dateTime(s.at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{s.detail}</p>
                  </div>
                ))}
                {open.count > open.samples.length && <p className="text-xs text-muted-foreground">Showing {open.samples.length} of {num(open.count)}.</p>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
