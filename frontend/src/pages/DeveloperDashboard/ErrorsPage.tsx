import { useState } from 'react';
import { toast } from 'sonner';
import { Download, FileCode2, MessageSquarePlus, Search, Users } from 'lucide-react';
import { ago, dateTime, downloadCsv, num } from '@/lib/devFormat';
import { useDevDevelopers, useDevErrorDetail, useDevErrors, useDevMe, useDevUpdateError, useUrlFilters } from '../../features/developer/hooks';
import type { ErrorGroup, ErrorStatus } from '../../api/developer';
import { EmptyState, ErrorState, JsonView, KeyValue, MethodBadge, Mono, PageHeader, RangeSelect, RefreshButton, Section, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Separator } from '../../components/developer/ui/separator';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'New' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'reopened', label: 'Reopened' },
  { value: 'resolved', label: 'Resolved' },
];
const STATUS_OPTIONS: { value: ErrorStatus; label: string }[] = [
  { value: 'open', label: 'New' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'reopened', label: 'Reopened' },
];
const SEVERITIES = ['all', 'critical', 'error', 'warning', 'info'];
const UNASSIGNED = '__none__';

function ErrorSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useDevErrorDetail(id || undefined);
  const { data: devs } = useDevDevelopers();
  const update = useDevUpdateError();
  const { data: me } = useDevMe();
  const canTriage = Boolean(me?.can.triage);
  const [note, setNote] = useState('');
  const e = data?.error;

  const save = (body: { status?: ErrorStatus; assignee?: string | null; note?: string }, done: string) =>
    update.mutate(
      { id: id!, ...body },
      {
        onSuccess: () => {
          toast.success(done);
          if (body.note) setNote('');
        },
        onError: () => toast.error('Update failed'),
      }
    );

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="pr-6 text-sm leading-snug">{e?.message || 'Loading…'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {e && (
              <>
                <StatusBadge status={e.severity} />
                <StatusBadge status={e.status} />
                <Mono>{e.errorCode}</Mono>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data || !e ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={e.status} disabled={!canTriage} onValueChange={(v) => save({ status: v as ErrorStatus }, 'Status updated')}>
                  <SelectTrigger size="sm" className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select
                  value={e.assignee?._id || UNASSIGNED}
                  disabled={!canTriage}
                  onValueChange={(v) => save({ assignee: v === UNASSIGNED ? null : v }, 'Assignee updated')}
                >
                  <SelectTrigger size="sm" className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {devs?.developers.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="stack">Stack trace</TabsTrigger>
                <TabsTrigger value="occurrences">Occurrences ({data.occurrences.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({data.notes.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-3">
                {data.location && (
                  <div className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-xs">
                    <FileCode2 className="size-4 text-muted-foreground" />
                    <span className="font-mono">{data.location.fn}</span>
                    <span className="text-muted-foreground">at</span>
                    <span className="truncate font-mono text-primary">
                      {data.location.file.split(/[\\/]/).slice(-3).join('/')}:{data.location.line}
                    </span>
                  </div>
                )}
                <KeyValue
                  items={[
                    ['Endpoint', e.route ? <span className="flex items-center gap-2"><MethodBadge method={e.httpMethod} /><span className="font-mono text-xs">{e.route}</span></span> : '—'],
                    ['HTTP status', e.statusCode ?? '—'],
                    ['Source', e.source || 'request'],
                    ['Environment', e.environment],
                    ['Latest reference', <Mono key="r">{e.referenceId}</Mono>],
                    ['Request ID', e.requestId ? <Mono key="q">{e.requestId}</Mono> : '—'],
                    ['Last seen', dateTime(e.createdAt)],
                    ['Resolved', e.resolvedAt ? `${dateTime(e.resolvedAt)} by ${e.resolvedBy?.name || '—'}` : '—'],
                  ]}
                />
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Occurrences, last 14 days</h4>
                  <TimeSeriesChart data={data.timeline} bucketMs={86_400_000} height={120} variant="bar" series={[{ key: 'count', label: 'Occurrences', color: 'var(--chart-5)' }]} />
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Metadata (redacted)</h4>
                  <JsonView value={e.metadata} />
                </div>
              </TabsContent>

              <TabsContent value="stack" className="pt-3">
                {e.stack ? (
                  <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">{e.stack}</pre>
                ) : (
                  <EmptyState title="No stack trace captured" />
                )}
              </TabsContent>

              <TabsContent value="occurrences" className="pt-3">
                <ul className="divide-y rounded-md border text-sm">
                  {data.occurrences.map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Mono>{o.requestId || o.referenceId}</Mono>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        {o.userId && <Users className="size-3" />}
                        {o.statusCode}
                        <span>{dateTime(o.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 pt-3">
                <div className={canTriage ? 'space-y-2' : 'hidden'}>
                  <Textarea value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add an investigation note…" maxLength={2000} rows={3} />
                  <Button size="sm" disabled={!note.trim() || update.isPending} onClick={() => save({ note }, 'Note added')}>
                    <MessageSquarePlus /> Add note
                  </Button>
                </div>
                <Separator />
                {data.notes.length ? (
                  <ol className="space-y-3">
                    {[...data.notes].reverse().map((n, i) => (
                      <li key={i} className="rounded-md border bg-card p-3 text-sm">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{n.by?.name || 'Developer'}</span>
                          {ago(n.at)}
                        </div>
                        <p className="whitespace-pre-wrap">{n.text}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ErrorsPage() {
  const [f, setF] = useUrlFilters({ range: '7d', status: 'all', severity: 'all', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevErrors({
    range: f.range as '7d',
    status: f.status === 'all' ? undefined : f.status,
    severity: f.severity === 'all' ? undefined : f.severity,
    q: f.q || undefined,
    page: f.page,
  });

  const countFor = (status: string) =>
    (data?.summary || []).filter((s) => status === 'all' || s.status === status).reduce((a, s) => a + s.count, 0);

  const columns: Column<ErrorGroup>[] = [
    {
      key: 'error',
      header: 'Error',
      className: 'max-w-[460px]',
      cell: (g) => (
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium text-foreground">{g.message || g.errorCode}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="font-mono">{g.errorCode}</span>
            {g.route && (
              <>
                · <span className="font-mono">{g.httpMethod} {g.route}</span>
              </>
            )}
          </p>
        </div>
      ),
    },
    { key: 'severity', header: 'Severity', cell: (g) => <StatusBadge status={g.severity} /> },
    { key: 'status', header: 'Status', cell: (g) => <StatusBadge status={g.status} /> },
    { key: 'count', header: 'Events', align: 'right', cell: (g) => <span className="tabular-nums">{num(g.count)}</span> },
    { key: 'users', header: 'Users', align: 'right', cell: (g) => <span className="tabular-nums text-muted-foreground">{num(g.affectedUsers)}</span> },
    { key: 'assignee', header: 'Assignee', cell: (g) => <span className="text-xs text-muted-foreground">{g.assignee?.name || '—'}</span> },
    {
      key: 'seen',
      header: 'Last / first seen',
      align: 'right',
      cell: (g) => (
        <div className="text-xs">
          <div className="text-foreground">{ago(g.lastSeen)}</div>
          <div className="text-muted-foreground">{ago(g.firstSeen)}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Errors"
        description="Backend errors grouped by code, route and message. Triage, assign and annotate."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={!data?.groups.length}
              onClick={() => downloadCsv(`errors-${f.range}.csv`, (data?.groups || []).map(({ assignee, ...g }) => ({ ...g, assignee: assignee?.name || '' })))}
            >
              <Download /> Export
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Section
        title={
          <Tabs value={f.status} onValueChange={(status) => setF({ status })}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                  {t.label}
                  <span className="rounded-sm bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">{countFor(t.value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative"
              onSubmit={(ev) => {
                ev.preventDefault();
                setF({ q: search.trim() });
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Message, route, ID…" className="h-7 w-52 pl-7 text-xs" aria-label="Search errors" />
            </form>
            <Select value={f.severity} onValueChange={(severity) => setF({ severity })}>
              <SelectTrigger size="sm" className="w-32 capitalize" aria-label="Severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s === 'all' ? 'All severities' : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={data?.groups}
          loading={isLoading}
          rowKey={(g) => g.id}
          onRowClick={(g) => setSelected(g.id)}
          pagination={data?.pagination}
          onPageChange={(p) => setF({ page: String(p) })}
          emptyTitle="No errors in this range"
          emptyDescription="Nice. Errors logged by the API appear here, grouped."
        />
      </Section>
      <ErrorSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
