import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlarmClock, ArrowUpCircle, Inbox, LifeBuoy, MessageSquarePlus, Search } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { devApi, type Doc, type Priority, type TicketRow, type TicketStatus } from '../../api/developer';
import { useDevAction, useDevDevelopers, useDevMe, useDevTicket, useDevTickets, useUrlFilters } from '../../features/developer/hooks';
import { CountBars, ErrorState, KeyValue, Mono, PageHeader, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
const NONE = '__none__';

function TicketSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useDevTicket(id || undefined);
  const { data: devs } = useDevDevelopers();
  const { data: me } = useDevMe();
  const update = useDevAction((body: Doc) => devApi.updateTicket(id!, body), ['tickets', 'ticket']);
  const [note, setNote] = useState('');
  const [errorRef, setErrorRef] = useState('');
  const t = data?.ticket;
  const canEdit = Boolean(me?.can.triage);
  const save = (body: Doc, msg: string) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(msg);
        setNote('');
        setErrorRef('');
      },
      onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed'),
    });

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="pr-6">{t?.subject || 'Loading…'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {t && (
              <>
                <StatusBadge status={t.status} />
                <StatusBadge status={t.priority} />
                {t.escalated && <StatusBadge status="escalated" tone="danger" />}
                {t.sla.breached && <StatusBadge status="sla" tone="danger" label="SLA breached" />}
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        {isLoading || !t ? (
          <Skeleton className="m-4 h-60" />
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
              {[
                ['Status', t.status, STATUSES, (v: string) => save({ status: v }, 'Status updated')],
                ['Priority', t.priority, PRIORITIES, (v: string) => save({ priority: v }, 'Priority updated')],
              ].map(([label, value, options, onChange]) => (
                <div key={label as string} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label as string}</Label>
                  <Select value={value as string} disabled={!canEdit} onValueChange={onChange as (v: string) => void}>
                    <SelectTrigger size="sm" className="w-full bg-card capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(options as string[]).map((o) => (
                        <SelectItem key={o} value={o} className="capitalize">
                          {o.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assigned developer</Label>
                <Select value={t.assignee?._id || NONE} disabled={!canEdit} onValueChange={(v) => save({ assignee: v === NONE ? null : v }, 'Assignee updated')}>
                  <SelectTrigger size="sm" className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {devs?.developers.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Section title="Customer message">
              <p className="text-sm whitespace-pre-wrap">{t.message}</p>
            </Section>

            <KeyValue
              items={[
                ['From', t.userId ? <Link key="u" className="text-primary hover:underline" to={`/developer/users?id=${t.userId._id}`}>{t.userId.name}</Link> : `${t.email} (visitor)`],
                ['Created', dateTime(t.createdAt)],
                ['SLA due', `${dateTime(t.sla.dueAt)}${t.sla.metAt ? ` · met ${ago(t.sla.metAt)}` : ''}`],
                ['Related job', data.order ? <Link key="o" className="font-mono text-xs text-primary hover:underline" to={`/developer/jobs?id=${data.order._id}`}>{data.order._id} ({data.order.status})</Link> : '—'],
                ['Related error', data.error ? <Link key="e" className="text-primary hover:underline" to={`/developer/tools?trace=${data.error.referenceId}`}>{data.error.errorCode} · {data.error.referenceId}</Link> : '—'],
                ['Incident', data.incident ? <Link key="i" className="text-primary hover:underline" to={`/developer/incidents?id=${data.incident._id}`}>{data.incident.title}</Link> : '—'],
              ]}
            />

            {canEdit && (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input value={errorRef} onChange={(e) => setErrorRef(e.target.value)} placeholder="Link error reference (ERR-…)" className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!errorRef.trim() || update.isPending} onClick={() => save({ relatedErrorRef: errorRef.trim() }, 'Error linked')}>
                    Link error
                  </Button>
                  {!t.escalated && (
                    <Button variant="destructive" size="sm" disabled={update.isPending} onClick={() => save({ escalated: true, priority: t.priority === 'critical' ? undefined : 'high' }, 'Escalated')}>
                      <ArrowUpCircle /> Escalate
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Section title="Investigation history" description="Internal — never shown to the customer">
              {canEdit && (
                <div className="mb-4 space-y-2">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal comment…" rows={3} maxLength={2000} />
                  <Button size="sm" disabled={!note.trim() || update.isPending} onClick={() => save({ note }, 'Comment added')}>
                    <MessageSquarePlus /> Add comment
                  </Button>
                </div>
              )}
              <Timeline reverse events={t.history.map((h) => ({ at: h.at, source: h.kind, title: h.text, by: h.by?.name, tone: h.kind === 'escalate' ? 'danger' : h.kind === 'note' ? 'neutral' : 'info' }))} />
            </Section>
            <p className="text-xs text-muted-foreground">Attachments are not supported by the support form yet.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function TicketsPage() {
  const [f, setF] = useUrlFilters({ status: '', priority: '', assignee: '', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevTickets({ status: f.status || undefined, priority: f.priority || undefined, assignee: f.assignee || undefined, q: f.q || undefined, page: f.page });
  const s = data?.summary;

  const columns: Column<TicketRow>[] = [
    { key: 'subject', header: 'Ticket', className: 'max-w-[360px]', cell: (t) => <div className="min-w-0"><div className="truncate font-medium">{t.subject}</div><div className="truncate text-xs text-muted-foreground">{t.email}</div></div> },
    { key: 'priority', header: 'Priority', cell: (t) => <StatusBadge status={t.priority} /> },
    { key: 'status', header: 'Status', cell: (t) => <div className="flex gap-1"><StatusBadge status={t.status} />{t.escalated && <StatusBadge status="escalated" tone="danger" />}</div> },
    { key: 'assignee', header: 'Assignee', cell: (t) => <span className="text-xs">{t.assignee?.name || '—'}</span> },
    { key: 'links', header: 'Links', cell: (t) => <span className="flex gap-1">{t.orderId && <Mono>job</Mono>}{t.relatedErrorRef && <Mono>error</Mono>}{t.incidentId && <Mono>incident</Mono>}</span> },
    { key: 'sla', header: 'SLA', cell: (t) => (t.sla.metAt ? <StatusBadge status="ok" label="met" /> : <StatusBadge status={t.sla.breached ? 'failing' : 'pending'} label={t.sla.breached ? 'breached' : `due ${ago(t.sla.dueAt)}`} />) },
    { key: 'at', header: 'Created', align: 'right', cell: (t) => <span className="text-xs text-muted-foreground">{ago(t.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support & Technical Tickets"
        description="Customer support requests with technical triage: priority, assignment, SLA, escalation and links to jobs, errors and incidents."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open" icon={<Inbox />} tone="info" loading={isLoading} value={num((s?.byStatus.open || 0) + (s?.byStatus.in_progress || 0))} hint={`${num(s?.byStatus.in_progress || 0)} in progress`} />
        <StatCard label="SLA breached" icon={<AlarmClock />} tone={s?.breached ? 'danger' : 'success'} loading={isLoading} value={num(s?.breached)} hint={data ? `critical ${data.slaHours.critical}h · high ${data.slaHours.high}h` : ''} />
        <StatCard label="Escalated" icon={<ArrowUpCircle />} tone={s?.escalated ? 'warning' : 'neutral'} loading={isLoading} value={num(s?.escalated)} />
        <StatCard label="Resolved" icon={<LifeBuoy />} tone="success" loading={isLoading} value={num((s?.byStatus.resolved || 0) + (s?.byStatus.closed || 0))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Section title="Status" description="Click to filter">
          <CountBars counts={s?.byStatus || {}} selected={f.status} onSelect={(status) => setF({ status })} />
        </Section>
        <Section title="Open by priority" description="Click to filter">
          <CountBars counts={s?.byPriority || {}} selected={f.priority} onSelect={(priority) => setF({ priority })} />
        </Section>
        <Section
          title="Tickets"
          className="lg:col-span-2"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant={f.assignee === 'me' ? 'secondary' : 'outline'} onClick={() => setF({ assignee: f.assignee === 'me' ? '' : 'me' })}>
                Mine
              </Button>
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  setF({ q: search.trim() });
                }}
              >
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject, message, user/job ID" className="h-7 w-56 pl-7 text-xs" aria-label="Search tickets" />
              </form>
            </div>
          }
        >
          <p className="text-xs text-muted-foreground">Click a ticket to triage it. Customer emails are masked.</p>
        </Section>
      </div>

      <DataTable columns={columns} rows={data?.tickets} loading={isLoading} rowKey={(t) => t._id} onRowClick={(t) => setSelected(t._id)} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} emptyTitle="No tickets" emptyDescription="Support requests from the Kundesenter form appear here." />
      <TicketSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
