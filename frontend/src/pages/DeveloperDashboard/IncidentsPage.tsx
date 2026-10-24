import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BellRing, CheckCircle2, Clock, Plus, Repeat, Siren } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { devApi, type Doc, type IncidentRow, type Sev } from '../../api/developer';
import { useDevAction, useDevDevelopers, useDevIncident, useDevIncidents, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { CountBars, ErrorState, KeyValue, PageHeader, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const SEVS: Sev[] = ['critical', 'high', 'medium', 'low'];
const NONE = '__none__';
const errMsg = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Update failed';
const mins = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

function IncidentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useDevIncident(id || undefined);
  const { data: devs } = useDevDevelopers();
  const { data: me } = useDevMe();
  const update = useDevAction((body: Doc) => devApi.updateIncident(id!, body), ['incidents', 'incident']);
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [postmortem, setPostmortem] = useState<string | null>(null);
  const inc = data?.incident;
  const can = Boolean(me?.can.triage);
  const save = (body: Doc, msg: string) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(msg);
        setNote('');
      },
      onError: (e) => toast.error(errMsg(e)),
    });

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="pr-6">{inc?.title || 'Loading…'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {inc && (
              <>
                <StatusBadge status={inc.severity} />
                <StatusBadge status={inc.status === 'open' ? 'failing' : inc.status === 'acknowledged' ? 'investigating' : 'resolved'} label={inc.status} />
                <StatusBadge status={inc.source} tone="neutral" />
                {inc.recoveredAt && inc.status !== 'resolved' && <StatusBadge status="recovered" tone="success" label="condition cleared" />}
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        {isLoading || !inc ? (
          <Skeleton className="m-4 h-60" />
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {inc.detail && <div className="rounded-md border bg-muted/30 p-3 text-sm">{inc.detail}</div>}
            {can && inc.status !== 'resolved' && (
              <div className="flex flex-wrap items-end gap-2">
                {inc.status === 'open' && (
                  <Button size="sm" onClick={() => save({ status: 'acknowledged' }, 'Acknowledged')} disabled={update.isPending}>
                    <BellRing /> Acknowledge
                  </Button>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Severity</Label>
                  <Select value={inc.severity} onValueChange={(v) => save({ severity: v }, 'Severity updated')}>
                    <SelectTrigger size="sm" className="w-28 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Responder</Label>
                  <Select value={inc.assignee?._id || NONE} onValueChange={(v) => save({ assignee: v === NONE ? null : v }, 'Responder updated')}>
                    <SelectTrigger size="sm" className="w-40">
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
            )}

            <KeyValue
              items={[
                ['Service', inc.service || '—'],
                ['Started', dateTime(inc.startedAt)],
                ['Last seen', `${ago(inc.lastSeenAt)} · ${inc.occurrences}× (deduplicated)`],
                ['Acknowledged', inc.acknowledgedAt ? `${ago(inc.acknowledgedAt)} by ${inc.acknowledgedBy?.name || '—'}` : '—'],
                ['Resolved', inc.resolvedAt ? `${dateTime(inc.resolvedAt)} by ${inc.resolvedBy?.name || '—'}` : '—'],
                ['Notified', inc.notifiedAt ? ago(inc.notifiedAt) : 'not notified'],
              ]}
            />

            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Timeline ({inc.timeline.length})</TabsTrigger>
                <TabsTrigger value="related">Related ({data!.relatedErrors.length + data!.tickets.length})</TabsTrigger>
                <TabsTrigger value="resolution">Resolution & post-mortem</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="space-y-4 pt-3">
                {can && (
                  <div className="space-y-2">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an update to the timeline…" rows={2} maxLength={2000} />
                    <Button size="sm" disabled={!note.trim() || update.isPending} onClick={() => save({ note }, 'Update added')}>
                      Post update
                    </Button>
                  </div>
                )}
                <Timeline reverse events={inc.timeline.map((t) => ({ at: t.at, source: t.kind, title: t.text, by: t.by?.name, tone: t.kind === 'opened' || t.kind === 'alert' ? 'danger' : t.kind === 'recovered' ? 'success' : t.kind === 'status' ? 'info' : 'neutral' }))} />
              </TabsContent>
              <TabsContent value="related" className="space-y-4 pt-3">
                <Section title="Errors during the incident window">
                  {data!.relatedErrors.length ? (
                    <ul className="divide-y rounded-md border text-sm">
                      {data!.relatedErrors.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2 px-3 py-2">
                          <span className="truncate font-mono text-xs">
                            {e.errorCode} · {e.route}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{e.count}×</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No errors in the window.</p>
                  )}
                </Section>
                <Section title="Linked support tickets">
                  {data!.tickets.length ? (
                    <ul className="space-y-1 text-sm">
                      {data!.tickets.map((t) => (
                        <li key={t._id} className="flex justify-between">
                          <Link to="/developer/tickets" className="text-primary hover:underline">
                            {t.subject}
                          </Link>
                          <StatusBadge status={t.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tickets linked.</p>
                  )}
                </Section>
              </TabsContent>
              <TabsContent value="resolution" className="space-y-4 pt-3">
                {inc.status !== 'resolved' && can ? (
                  <div className="space-y-2">
                    <Label htmlFor="res">Resolution notes (required to resolve)</Label>
                    <Textarea id="res" value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="Root cause and what fixed it" />
                    <Button size="sm" disabled={resolution.trim().length < 5 || update.isPending} onClick={() => save({ status: 'resolved', resolutionNotes: resolution }, 'Incident resolved')}>
                      <CheckCircle2 /> Confirm recovery & resolve
                    </Button>
                  </div>
                ) : (
                  <Section title="Resolution">
                    <p className="text-sm whitespace-pre-wrap">{inc.resolutionNotes || '—'}</p>
                  </Section>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pm">Post-incident report</Label>
                  <Textarea id="pm" value={postmortem ?? inc.postmortem ?? ''} onChange={(e) => setPostmortem(e.target.value)} rows={8} disabled={!can} placeholder="Impact, timeline, root cause, follow-ups…" />
                  {can && (
                    <Button size="sm" variant="outline" disabled={postmortem === null || update.isPending} onClick={() => save({ postmortem: postmortem || '' }, 'Post-mortem saved')}>
                      Save post-mortem
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function IncidentsPage() {
  const [f, setF] = useUrlFilters({ view: 'active', id: '', page: '1' });
  const { data, isLoading, isFetching, error, refetch } = useDevIncidents({ active: f.view === 'active' ? undefined : 'false', status: f.view === 'resolved' ? 'resolved' : undefined, page: f.page });
  const { data: me } = useDevMe();
  const create = useDevAction((body: Doc) => devApi.createIncident(body), ['incidents']);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', severity: 'medium' as Sev, service: '', detail: '' });
  const m = data?.metrics;

  const columns: Column<IncidentRow>[] = [
    { key: 'sev', header: 'Severity', cell: (i) => <StatusBadge status={i.severity} /> },
    { key: 'title', header: 'Incident', className: 'max-w-[420px]', cell: (i) => <div className="min-w-0"><div className="truncate font-medium">{i.title}</div><div className="truncate text-xs text-muted-foreground">{i.detail}</div></div> },
    { key: 'status', header: 'State', cell: (i) => <div className="flex gap-1"><StatusBadge status={i.status === 'open' ? 'failing' : i.status === 'acknowledged' ? 'investigating' : 'resolved'} label={i.status} />{i.recoveredAt && i.status !== 'resolved' && <StatusBadge status="recovered" tone="success" label="cleared" />}</div> },
    { key: 'service', header: 'Service', cell: (i) => <span className="text-xs">{i.service || '—'}</span> },
    { key: 'source', header: 'Source', cell: (i) => <span className="text-xs text-muted-foreground">{i.source}{i.occurrences > 1 ? ` · ${i.occurrences}×` : ''}</span> },
    { key: 'resp', header: 'Responder', cell: (i) => <span className="text-xs">{i.assignee?.name || '—'}</span> },
    { key: 'at', header: 'Started', align: 'right', cell: (i) => <span className="text-xs text-muted-foreground">{ago(i.startedAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incidents & Alerts"
        description="Alerts open incidents automatically (deduplicated). Acknowledge, assign, post updates, confirm recovery and write the post-mortem."
        actions={
          <>
            {me?.can.triage && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus /> New incident
              </Button>
            )}
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Open" icon={<Siren />} tone={m?.open ? 'danger' : 'success'} loading={isLoading} value={num(m?.open)} />
        <StatCard label="Acknowledged" icon={<BellRing />} tone={m?.acknowledged ? 'warning' : 'neutral'} loading={isLoading} value={num(m?.acknowledged)} />
        <StatCard label="MTTA" icon={<Clock />} loading={isLoading} value={mins(m?.mttaMinutes ?? null)} hint="mean time to acknowledge, 30d" />
        <StatCard label="MTTR" icon={<CheckCircle2 />} loading={isLoading} value={mins(m?.mttrMinutes ?? null)} hint={`${num(m?.resolved30d)} resolved in 30d`} />
        <StatCard label="Repeat incidents" icon={<Repeat />} tone={data?.repeats.length ? 'warning' : 'neutral'} loading={isLoading} value={num(data?.repeats.length)} hint="same alert reopened, 30d" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Alert routing" description="Alert thresholds live in Access & Settings">
          <KeyValue
            items={[
              ['Slack', data?.notifications.slack ? <StatusBadge key="s" status="ok" label="connected" /> : <span key="s" className="text-xs text-muted-foreground">set SLACK_WEBHOOK_URL</span>],
              ['Email', data?.notifications.email ? <StatusBadge key="e" status="ok" label="connected" /> : <span key="e" className="text-xs text-muted-foreground">set DEV_ALERT_EMAIL</span>],
              ['Escalation', 'Severity changes are recorded on the timeline'],
            ]}
          />
          <Link to="/developer/settings" className="mt-3 inline-block text-xs text-primary hover:underline">
            Edit thresholds →
          </Link>
        </Section>
        <Section title="Open by service">
          <CountBars counts={data?.byService || {}} />
        </Section>
        <Section title="Repeat offenders" description="Alerts that reopened after resolution">
          {data?.repeats.length ? (
            <ul className="space-y-1.5 text-sm">
              {data.repeats.map((r) => (
                <li key={r.fingerprint} className="flex justify-between gap-2">
                  <span className="truncate">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.count}×</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </Section>
      </div>

      <Section
        title="Incidents"
        action={
          <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <DataTable columns={columns} rows={data?.incidents} loading={isLoading} rowKey={(i) => i._id} onRowClick={(i) => setF({ id: i._id })} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} emptyTitle={f.view === 'active' ? 'No active incidents' : 'No incidents'} emptyDescription="All quiet." />
      </Section>

      <IncidentSheet id={f.id || null} onClose={() => setF({ id: '' })} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open an incident</DialogTitle>
            <DialogDescription>For problems the alerts did not catch. It is audited and appears for every developer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="i-title">Title</Label>
              <Input id="i-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as Sev })}>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-svc">Affected service</Label>
                <Input id="i-svc" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="payments, api, …" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-detail">What is happening</Label>
              <Textarea id="i-detail" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} rows={3} maxLength={1000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={form.title.trim().length < 4 || create.isPending}
              onClick={() =>
                create.mutate(form as unknown as Doc, {
                  onSuccess: () => {
                    toast.success('Incident opened');
                    setOpen(false);
                    setForm({ title: '', severity: 'medium', service: '', detail: '' });
                  },
                  onError: (e) => toast.error(errMsg(e)),
                })
              }
            >
              Open incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

