import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookX, Check, FileJson, GitPullRequestArrow, RefreshCw, TriangleAlert } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type ContractEndpoint, type ContractEventRow } from '../../api/developer';
import { useDevContract, useDevContracts, useDevMe } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const KIND = { removed: 'Field removed', type_changed: 'Type changed', added: 'Field added' } as const;

function EventRow({ e, canAck, onAck, showRoute = true }: { e: ContractEventRow; canAck: boolean; onAck: (e: ContractEventRow) => void; showRoute?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={KIND[e.kind]} tone={e.breaking ? 'danger' : 'info'} />
          <span className="font-mono text-xs">{e.path}</span>
          {showRoute && (
            <span className="font-mono text-xs text-muted-foreground">
              {e.method} {e.route} ({e.status})
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {e.detail} · {dateTime(e.at)} · release {e.version ?? '?'}@{e.commit?.slice(0, 7) ?? '?'}
          {e.acknowledgedAt && ` · acknowledged by ${e.acknowledgedBy?.name || '—'}${e.note ? `: “${e.note}”` : ''}`}
        </p>
      </div>
      {canAck && !e.acknowledgedAt && (
        <Button size="xs" variant="outline" onClick={() => onAck(e)}>
          <Check /> Intended
        </Button>
      )}
    </li>
  );
}

function EndpointSheet({ ep, onClose, canAck, onAck }: { ep: ContractEndpoint | null; onClose: () => void; canAck: boolean; onAck: (e: ContractEventRow) => void }) {
  const { data, isLoading, error } = useDevContract(ep ? { method: ep.method, route: ep.route, status: ep.status } : null);
  return (
    <Sheet open={Boolean(ep)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono text-sm">
            {ep?.method} {ep?.route}
          </SheetTitle>
          <SheetDescription>
            {ep?.status} responses · {num(data?.samples)} sampled since {data ? dateTime(data.firstSeen) : '—'}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto p-4 text-sm">
          {isLoading && <Skeleton className="h-60 w-full" />}
          {error && <ErrorState error={error} />}
          {data && (
            <>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Observed contract</h4>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 font-normal">Field</th>
                        <th className="px-2 py-1.5 font-normal">Type</th>
                        <th className="px-2 py-1.5 text-right font-normal">Present</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.fields.map((f) => (
                        <tr key={f.path}>
                          <td className="px-2 py-1 font-mono">
                            {f.path}
                            {f.required && <Badge variant="secondary" className="ml-1.5 text-[9px]">required</Badge>}
                          </td>
                          <td className={cn('px-2 py-1', f.types.filter((t) => t !== 'null').length > 1 && 'text-amber-700')}>{f.types.join(' | ')}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{f.presence}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Required = present in ≥ 90 % of responses; removing one is a breaking change.</p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Shape variants</h4>
                <ul className="space-y-1 text-xs">
                  {data.variants.map((v) => (
                    <li key={v.sig} className="flex justify-between gap-2">
                      <span className="font-mono">{v.sig.slice(0, 8)} · {v.fieldCount} fields</span>
                      <span className="text-muted-foreground">
                        {num(v.count)}× · first {ago(v.firstSeen)} in {v.version ?? '?'}@{v.commit?.slice(0, 7) ?? '?'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Changes</h4>
                {data.events.length ? <ul className="divide-y">{data.events.map((e) => <EventRow key={e._id} e={e} canAck={canAck} onAck={onAck} showRoute={false} />)}</ul> : <p className="text-muted-foreground">No changes since the first sample.</p>}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ContractsPage() {
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevContracts();
  const qc = useQueryClient();
  const [open, setOpen] = useState<ContractEndpoint | null>(null);
  const [view, setView] = useState<'breaking' | 'all'>('breaking');
  const canAck = Boolean(me?.can.request || me?.can.execute);
  const s = data?.summary;
  const events = (data?.events || []).filter((e) => (view === 'breaking' ? e.breaking && !e.acknowledgedAt : true));

  const ack = async (e: ContractEventRow) => {
    const note = window.prompt(`Mark "${KIND[e.kind]} ${e.path}" on ${e.method} ${e.route} as intended? Optional note:`, '');
    if (note === null) return;
    try {
      await devApi.ackContract(e._id, note);
      toast.success('Acknowledged');
      qc.invalidateQueries({ queryKey: ['dev', 'contracts'] });
    } catch (err) {
      toast.error(errMessage(err));
    }
  };
  const sync = async () => {
    try {
      qc.setQueryData(['dev', 'contracts'], await devApi.contracts(true));
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const columns: Column<ContractEndpoint>[] = [
    { key: 'ep', header: 'Endpoint', cell: (c) => <span className="font-mono text-xs">{c.method} {c.route}</span> },
    { key: 'st', header: 'Status', cell: (c) => <Badge variant="outline">{c.status}</Badge> },
    { key: 'samples', header: 'Sampled', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.samples)}</span> },
    { key: 'var', header: 'Shapes', align: 'right', cell: (c) => <span className="tabular-nums">{c.variants}</span> },
    { key: 'stable', header: 'Dominant shape', align: 'right', cell: (c) => <span className="tabular-nums text-xs">{c.stable === null ? '—' : `${c.stable}%`}</span> },
    { key: 'brk', header: 'Open breaking', align: 'right', cell: (c) => (c.openBreaking ? <Badge variant="destructive">{c.openBreaking}</Badge> : <span className="text-xs text-muted-foreground">0</span>) },
    { key: 'last', header: 'Last seen', align: 'right', cell: (c) => <span className="text-xs text-muted-foreground">{ago(c.lastSeen)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Contracts"
        description="The response shape of every API endpoint, learned from real traffic (field names and types only — never values). A required field disappearing or changing type is a breaking change for the web and mobile apps; each change is tied to the release that introduced it. Plus: which endpoints the Swagger docs miss."
        actions={
          <Button size="sm" variant="outline" className="bg-card" onClick={sync} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} /> Sync now
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open breaking changes" icon={<TriangleAlert />} tone={s?.openBreaking ? 'danger' : 'success'} loading={isLoading} value={s?.openBreaking ?? '—'} hint="not yet acknowledged as intended" />
        <StatCard label="Endpoints tracked" icon={<FileJson />} loading={isLoading} value={s?.endpoints ?? '—'} hint={s ? `${num(s.samples)} responses sampled` : ''} />
        <StatCard label="Additive changes (7 d)" icon={<GitPullRequestArrow />} loading={isLoading} value={s?.additive7d ?? '—'} hint="new fields — safe for clients" />
        <StatCard label="Undocumented endpoints" icon={<BookX />} tone={s?.undocumented ? 'warning' : 'success'} loading={isLoading} value={s?.undocumented ?? '—'} hint={data ? `of ${data.docs.used} with traffic · ${data.docs.documented} documented` : ''} />
      </div>

      <Section
        title="Contract changes"
        action={
          <Tabs value={view} onValueChange={(v) => setView(v as 'breaking' | 'all')}>
            <TabsList>
              <TabsTrigger value="breaking">Open breaking</TabsTrigger>
              <TabsTrigger value="all">All changes</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        {events.length ? <ul className="divide-y">{events.map((e) => <EventRow key={e._id} e={e} canAck={canAck} onAck={ack} />)}</ul> : <EmptyState title={view === 'breaking' ? 'No open breaking changes' : 'No changes recorded yet'} description="Changes appear once an endpoint has 20+ sampled responses and its shape changes." />}
      </Section>

      <Section title="Endpoints" description="Samples every response until an endpoint has 100, then 5 %. Click for the observed contract.">
        <DataTable columns={columns} rows={data?.endpoints} loading={isLoading} rowKey={(c) => c._id} onRowClick={setOpen} emptyTitle="No responses sampled yet" />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Used but undocumented" description="Endpoints with traffic in the last 30 days that Swagger does not describe.">
          <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
            {data?.docs.undocumented.map((u) => (
              <li key={u.key} className="flex justify-between gap-2">
                <span className="truncate font-mono">{u.key}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{num(u.n)} req</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Documented but unused" description="In the Swagger docs with no traffic in 30 days — stale docs or dead endpoints.">
          <ul className="max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
            {data?.docs.unused.map((u) => (
              <li key={u} className="truncate">
                {u}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <EndpointSheet ep={open} onClose={() => setOpen(null)} canAck={canAck} onAck={ack} />
    </div>
  );
}
