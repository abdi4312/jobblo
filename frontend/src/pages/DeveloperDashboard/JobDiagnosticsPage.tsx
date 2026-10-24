import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CloudCog, Search } from 'lucide-react';
import { ago, dateTime, money } from '@/lib/devFormat';
import { useDevJob, useDevJobs, useDevStripeState, useUrlFilters } from '../../features/developer/hooks';
import type { Doc, JobRow } from '../../api/developer';
import { EmptyState, ErrorState, IssueList, JsonView, KeyValue, Mono, PageHeader, Section, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const v = (d: Doc | null | undefined, k: string) => (d?.[k] as string | number | boolean | null | undefined) ?? null;

function DocCard({ title, doc, fields }: { title: string; doc: Doc | null; fields: [string, string, ((x: unknown) => ReactNode)?][] }) {
  return (
    <Section title={title} action={doc ? <StatusBadge status={String(v(doc, 'status') ?? 'n/a')} /> : <StatusBadge status="n/a" label="None" />}>
      {doc ? (
        <KeyValue items={fields.map(([label, key, fmt]) => [label, fmt ? fmt(doc[key]) : (doc[key] as ReactNode) ?? '—'])} />
      ) : (
        <p className="text-sm text-muted-foreground">No record.</p>
      )}
    </Section>
  );
}

function StripeCheck({ id }: { id: string }) {
  const [run, setRun] = useState(false);
  const { data, isFetching, error, refetch } = useDevStripeState(id, run);
  return (
    <Section
      title="Stripe vs database"
      description="Live, read-only PaymentIntent lookup. Each check is written to the audit log."
      action={
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => (run ? refetch() : setRun(true))}>
          <CloudCog /> {isFetching ? 'Checking…' : 'Check Stripe'}
        </Button>
      }
    >
      {error ? (
        <ErrorState error={error} />
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Not checked yet.</p>
      ) : !data.available ? (
        <p className="text-sm text-muted-foreground">Unavailable: {data.reason}</p>
      ) : (
        <div className="space-y-3">
          {data.matches ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> Stripe and the database agree.
            </div>
          ) : (
            <ul className="space-y-1 rounded-md border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
              {data.diffs?.map((d) => <li key={d}>• {d}</li>)}
            </ul>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Stripe</h4>
              <JsonView value={data.stripe} />
            </div>
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">Database</h4>
              <JsonView value={data.db} />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function JobDetailView({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useDevJob(id);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  const o = data.order;
  const minor = (x: unknown) => money(x as number, true);
  const nok = (x: unknown) => money(x as number);
  const when = (x: unknown) => (x ? dateTime(x as string) : '—');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={o.status} />
        <StatusBadge status={o.paymentStatus} label={`payment ${o.paymentStatus}`} />
        <Mono>{o._id}</Mono>
        <span className="text-xs text-muted-foreground">created {ago(o.createdAt)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Detected issues" description="Stuck and inconsistent-state rules" className="lg:col-span-2">
          <IssueList issues={data.issues} />
        </Section>
        <Section title="Parties & amount">
          <KeyValue
            items={[
              ['Job', o.service?.title || '—'],
              ['Customer', o.customer ? <Link key="c" className="text-primary hover:underline" to={`/developer/users?id=${o.customer._id}`}>{o.customer.name}</Link> : '—'],
              ['Provider', o.provider ? <Link key="p" className="text-primary hover:underline" to={`/developer/users?id=${o.provider._id}`}>{o.provider.name}</Link> : '—'],
              ['Provider payouts', o.provider ? (o.provider.payoutEnabled ? 'enabled' : o.provider.connectAccount ? 'connect not ready' : 'no connect account') : '—'],
              ['Agreed price', money(o.agreedPrice)],
              ['Checkout amount', money(o.checkoutAmountMinor, true)],
              ['Connect deadline', when(o.providerConnectDeadlineAt)],
              ['Cancellation', o.cancellationReason || '—'],
            ]}
          />
        </Section>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline ({data.timeline.length})</TabsTrigger>
          <TabsTrigger value="money">Money</TabsTrigger>
          <TabsTrigger value="stripe">Stripe check</TabsTrigger>
          <TabsTrigger value="disputes">Disputes ({data.disputes.length})</TabsTrigger>
          <TabsTrigger value="notifications">Notifications ({data.notifications.length})</TabsTrigger>
          <TabsTrigger value="errors">Errors ({data.errors.length})</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="pt-3">
          <Section title="Audit timeline" description="Order history, payments, refunds, payouts, disputes, audit entries and errors merged">
            <Timeline events={data.timeline} />
          </Section>
        </TabsContent>

        <TabsContent value="money" className="grid gap-4 pt-3 lg:grid-cols-3">
          <DocCard
            title="Payment"
            doc={data.payment}
            fields={[
              ['Amount', 'amount', nok],
              ['Captured', 'capturedAmountMinor', minor],
              ['Refund status', 'refundStatus'],
              ['Refunded', 'refundedAmountMinor', minor],
              ['PaymentIntent', 'stripePaymentIntentId', (x) => (x ? <Mono>{String(x)}</Mono> : '—')],
              ['Refund ID', 'stripeRefundId', (x) => (x ? <Mono>{String(x)}</Mono> : '—')],
              ['Mode', 'stripeLivemode', (x) => (x === null || x === undefined ? '—' : x ? 'live' : 'test')],
            ]}
          />
          <DocCard
            title="SafePay"
            doc={data.safePay}
            fields={[
              ['Customer paid', 'amounts', (x) => money((x as Doc)?.totalCustomer as number)],
              ['Provider net', 'amounts', (x) => money((x as Doc)?.netProvider as number)],
              ['Platform fee', 'amounts', (x) => money((x as Doc)?.fee as number)],
              ['Refund status', 'refundStatus'],
              ['Refund amount', 'refundAmountMinor', minor],
              ['Refund reason', 'refundReason'],
              ['Connect status', 'providerConnectStatus'],
            ]}
          />
          <DocCard
            title="Payout"
            doc={data.payout}
            fields={[
              ['Gross', 'grossAmount', nok],
              ['Platform fee', 'platformFee', nok],
              ['Net to provider', 'netProviderAmount', nok],
              ['Release source', 'releaseSource'],
              ['Transfer', 'stripeTransferId', (x) => (x ? <Mono>{String(x)}</Mono> : '—')],
              ['Retries', 'retryCount'],
              ['Failure', 'failureCode'],
            ]}
          />
          <Section title="Stripe financial operations" className="lg:col-span-3">
            {data.operations.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {data.operations.map((op) => (
                  <li key={op._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={op.status} />
                      <span className="font-medium">{op.type}</span>
                      <span className="text-muted-foreground">{money(op.amount, true)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mono>{op.operationKey}</Mono>
                      {op.lastErrorCode}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No refunds or reversals were attempted.</p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="stripe" className="pt-3">
          <StripeCheck id={o._id} />
        </TabsContent>

        <TabsContent value="disputes" className="pt-3">
          <Section title="Disputes">{data.disputes.length ? <JsonView value={data.disputes} className="max-h-[60vh]" /> : <p className="text-sm text-muted-foreground">No disputes.</p>}</Section>
        </TabsContent>

        <TabsContent value="notifications" className="pt-3">
          <Section title="Notifications sent for this job">
            {data.notifications.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {data.notifications.map((n) => (
                  <li key={n._id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusBadge status={n.type} tone="info" />
                      <span className="truncate">{n.content}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No notifications.</p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="errors" className="pt-3">
          <Section title="Errors referencing this job">
            {data.errors.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {data.errors.map((e) => (
                  <li key={e._id} className="px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs">{e.errorCode}</span>
                      <span className="text-xs text-muted-foreground">{ago(e.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No logged errors.</p>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="raw" className="grid gap-4 pt-3 lg:grid-cols-2">
          <Section title="Order">
            <JsonView value={o} className="max-h-[60vh]" />
          </Section>
          <Section title="Incidents & transfers">
            <JsonView value={{ incidents: data.incidents, transfers: data.transfers }} className="max-h-[60vh]" />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function JobDiagnosticsPage() {
  const [f, setF] = useUrlFilters({ id: '', q: '' });
  const [input, setInput] = useState(f.q);
  const { data, isLoading, error, refetch } = useDevJobs({ q: f.q || undefined });

  const columns: Column<JobRow>[] = [
    { key: 'id', header: 'Order', cell: (r) => <span className="font-mono text-xs">{r._id}</span> },
    { key: 'job', header: 'Job', cell: (r) => <span className="truncate">{r.serviceId?.title || '—'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'pay', header: 'Payment', cell: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: 'issues', header: 'Issues', cell: (r) => <span className="text-xs text-muted-foreground">{r.issues?.map((i) => i.code.replace(/_/g, ' ')).join(', ') || '—'}</span> },
    { key: 'updated', header: 'Updated', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job Diagnostics"
        description="Full technical lifecycle of a job: status history, SafePay, Stripe, payouts, disputes, notifications and errors."
        actions={
          f.id && (
            <Button variant="outline" size="sm" className="bg-card" onClick={() => setF({ id: '' })}>
              <ArrowLeft /> All jobs
            </Button>
          )
        }
      />
      {f.id ? (
        <JobDetailView id={f.id} />
      ) : (
        <>
          <form
            className="flex max-w-2xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setF({ q: input.trim() });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Order ID, job ID, user ID, pi_… or cs_…" className="bg-card pl-8 font-mono text-xs" aria-label="Search jobs" />
            </div>
            <Button type="submit">Search</Button>
          </form>
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {f.q ? (
            <Section title="Results">
              <DataTable columns={columns} rows={data?.orders} loading={isLoading} rowKey={(r) => r._id} onRowClick={(r) => setF({ id: r._id })} emptyTitle="No matching orders" />
            </Section>
          ) : (
            <Section title="Jobs needing attention" description="Orders that break a stuck or inconsistent-state rule">
              {data && !data.stuck.length ? (
                <EmptyState title="Nothing stuck" description="Every recent paid order passes the health rules." />
              ) : (
                <DataTable columns={columns} rows={data?.stuck} loading={isLoading} rowKey={(r) => r._id} onRowClick={(r) => setF({ id: r._id })} />
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
