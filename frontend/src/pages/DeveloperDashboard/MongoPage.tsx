import { useMemo, useState } from 'react';
import { Database, HardDrive, Layers, Link2, Lock, Search, Timer } from 'lucide-react';
import { bytes, compact, num } from '@/lib/devFormat';
import { useDevMongo, useDevMongoIndexes } from '../../features/developer/hooks';
import type { MongoCollection } from '../../api/developer';
import { EmptyState, ErrorState, KeyValue, Mono, NotConfigured, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Input } from '../../components/developer/ui/input';
import { Progress } from '../../components/developer/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

function IndexSheet({ collection, onClose }: { collection: MongoCollection | null; onClose: () => void }) {
  const { data, isLoading } = useDevMongoIndexes(collection?.name);
  const unused = data?.indexes.filter((i) => i.ops === 0 && i.name !== '_id_') || [];
  return (
    <Sheet open={Boolean(collection)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        {collection && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="font-mono text-sm">{collection.name}</SheetTitle>
              <SheetDescription>Read-only statistics · {num(collection.count)} documents</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 overflow-y-auto p-4">
              <KeyValue
                items={[
                  ['Data size', bytes(collection.size)],
                  ['Storage size', bytes(collection.storageSize)],
                  ['Index size', bytes(collection.indexSize)],
                  ['Indexes', num(collection.indexes)],
                ]}
              />
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Index utilisation (since last restart)</h4>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : data?.indexes.length ? (
                  <ul className="divide-y rounded-md border text-sm">
                    {[...data.indexes].sort((a, b) => b.ops - a.ops).map((i) => (
                      <li key={i.name} className="space-y-1 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs">{i.name}</span>
                          <StatusBadge status={i.ops ? 'healthy' : 'idle'} label={`${compact(i.ops)} ops`} />
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{JSON.stringify(i.key)}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Index stats unavailable" />
                )}
              </div>
              {unused.length > 0 && (
                <div className="rounded-md border border-amber-200/70 bg-amber-50 p-3 text-xs text-amber-800">
                  {unused.length} index{unused.length > 1 ? 'es have' : ' has'} no recorded use: {unused.map((u) => u.name).join(', ')}. Review before removing — counters reset on restart.
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function MongoPage() {
  const { data, isLoading, isFetching, error, refetch } = useDevMongo();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<MongoCollection | null>(null);
  const rows = useMemo(() => (data?.collections || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const maxSize = Math.max(1, ...(data?.collections || []).map((c) => c.size || 0));

  const columns: Column<MongoCollection>[] = [
    { key: 'name', header: 'Collection', cell: (c) => <span className="font-mono text-xs">{c.name}</span> },
    { key: 'count', header: 'Documents', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.count)}</span> },
    {
      key: 'size',
      header: 'Data size',
      cell: (c) => (
        <div className="flex items-center gap-2">
          <Progress value={((c.size || 0) / maxSize) * 100} className="h-1.5 w-24 bg-muted" />
          <span className="text-xs tabular-nums text-muted-foreground">{bytes(c.size)}</span>
        </div>
      ),
    },
    { key: 'storage', header: 'Storage', align: 'right', cell: (c) => <span className="tabular-nums text-muted-foreground">{bytes(c.storageSize)}</span> },
    { key: 'indexSize', header: 'Index size', align: 'right', cell: (c) => <span className="tabular-nums text-muted-foreground">{bytes(c.indexSize)}</span> },
    { key: 'indexes', header: 'Indexes', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.indexes)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="MongoDB"
        description="Production database statistics. Read-only — no queries, writes or deletes are possible from here."
        actions={
          <>
            <StatusBadge status="read-only" tone="info" label="Read-only" />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && !data.connected ? (
        <Section title="Connection">
          <EmptyState icon={<Database />} title="MongoDB is not connected" description="The API process cannot reach the database right now." />
        </Section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Status" icon={<Link2 />} tone="success" loading={isLoading} value={<StatusBadge status="connected" />} hint={`ping ${data?.ping.ms ?? '—'} ms`} />
            <StatCard label="Version" icon={<Database />} loading={isLoading} value={data?.database?.version || '—'} hint={data?.database?.name} />
            <StatCard label="Collections" icon={<Layers />} loading={isLoading} value={num(data?.stats?.collections)} hint={`${compact(data?.stats?.objects)} documents`} />
            <StatCard label="Data size" icon={<HardDrive />} loading={isLoading} value={bytes(data?.stats?.dataSize)} hint={`storage ${bytes(data?.stats?.storageSize)}`} />
            <StatCard label="Index size" icon={<Search />} loading={isLoading} value={bytes(data?.stats?.indexSize)} hint={`${num(data?.stats?.indexes)} indexes`} />
            <StatCard label="Connections" icon={<Timer />} loading={isLoading} value={num(data?.connections?.current)} hint={data?.connections ? `${num(data.connections.available)} available` : 'Not permitted'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Operation counters" description="Since server start">
              {data?.opcounters ? (
                <KeyValue items={Object.entries(data.opcounters).map(([k, v]) => [k, <span key={k} className="tabular-nums">{compact(Number(v))}</span>])} />
              ) : (
                <NotConfigured title="serverStatus not permitted" description="The database user lacks the clusterMonitor role." />
              )}
            </Section>
            <Section title="Replica set">
              {data?.replicaSet ? (
                <ul className="space-y-2 text-sm">
                  {data.replicaSet.members.map((m) => (
                    <li key={m.name} className="flex items-center justify-between gap-2">
                      <Mono>{m.name}</Mono>
                      <StatusBadge status={m.health ? 'healthy' : 'failing'} label={m.state} />
                    </li>
                  ))}
                </ul>
              ) : (
                <NotConfigured title="No replica set info" description="Standalone server, or replSetGetStatus is not permitted (e.g. Atlas shared tier)." />
              )}
            </Section>
            <Section title="Safety" description="What this page can and cannot do">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Statistics and index usage only', 'No document reads or ad-hoc queries', 'No writes, drops or deletes', 'Backups: managed by the hosting provider'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Lock className="size-3.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section
            title="Collections"
            description="Click a collection for index utilisation and unused-index hints"
            action={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter collections…" className="h-7 w-48 text-xs" aria-label="Filter collections" />}
          >
            <DataTable columns={columns} rows={rows} loading={isLoading} rowKey={(c) => c.name} onRowClick={setSelected} emptyTitle="No collections" />
          </Section>
        </>
      )}
      <IndexSheet collection={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
