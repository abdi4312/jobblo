import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertOctagon, CheckCircle2, DatabaseZap, Download, KeyRound, Play, ShieldAlert } from 'lucide-react';
import { ago, dateTime, downloadCsv, ms, num } from '@/lib/devFormat';
import { devApi, type IndexDrift, type IntegrityCheck } from '../../api/developer';
import { useDevIntegrity, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const CATEGORY_LABEL = { duplicate: 'Duplicate', orphan: 'Dangling reference', invariant: 'Broken rule' } as const;
const PROBLEM_LABEL = { missing: 'Declared in schema, missing in DB', not_unique: 'Should be unique, is not', undeclared: 'In DB only (not in schema)' } as const;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

/** A sample value: ids open Investigate, everything else is shown as text. */
function SampleValue({ v }: { v: unknown }) {
  if (Array.isArray(v)) return <span className="flex flex-wrap gap-x-2">{v.map((x, i) => <SampleValue key={i} v={x} />)}</span>;
  if (isId(v))
    return (
      <Link to={`/developer/investigate?q=${v}`} className="font-mono text-xs text-primary hover:underline">
        {v}
      </Link>
    );
  if (v && typeof v === 'object') return <span className="font-mono text-xs">{JSON.stringify(v)}</span>;
  return <span className="font-mono text-xs">{String(v ?? '—')}</span>;
}

export default function IntegrityPage() {
  const [f, setF] = useUrlFilters({ view: 'failing' });
  const { data: me } = useDevMe();
  const { data, isLoading, error, refetch } = useDevIntegrity();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<IntegrityCheck | null>(null);

  const rows = useMemo(() => (data?.checks || []).filter((c) => (f.view === 'failing' ? !c.ok : f.view === 'all' || c.category === f.view)), [data, f.view]);
  const indexRows = data?.indexes.filter((i) => i.severity !== 'info') || [];
  const undeclared = data?.indexes.filter((i) => i.severity === 'info') || [];

  const run = async () => {
    setBusy(true);
    try {
      qc.setQueryData(['dev', 'integrity'], await devApi.runIntegrity());
      toast.success('Integrity checks finished');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<IntegrityCheck>[] = [
    { key: 'state', header: '', cell: (c) => (c.error ? <StatusBadge status="error" tone="danger" /> : c.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <StatusBadge status={c.severity} />) },
    { key: 'title', header: 'Check', className: 'max-w-[420px]', cell: (c) => <div className="min-w-0"><div className="truncate font-medium">{c.title}</div><div className="truncate text-xs text-muted-foreground">{c.error || c.why}</div></div> },
    { key: 'cat', header: 'Type', cell: (c) => <Badge variant="outline">{CATEGORY_LABEL[c.category]}</Badge> },
    { key: 'entity', header: 'Collection', cell: (c) => <span className="text-xs">{c.entity}</span> },
    { key: 'count', header: 'Affected', align: 'right', cell: (c) => <span className={c.count ? 'font-semibold tabular-nums text-red-600' : 'tabular-nums text-muted-foreground'}>{c.count === null ? '—' : num(c.count)}</span> },
    { key: 'ms', header: 'Took', align: 'right', cell: (c) => <span className="text-xs text-muted-foreground">{ms(c.ms)}</span> },
  ];
  const indexColumns: Column<IndexDrift>[] = [
    { key: 'sev', header: 'Severity', cell: (i) => <StatusBadge status={i.severity} /> },
    { key: 'coll', header: 'Collection', cell: (i) => <span className="font-mono text-xs">{i.collection}</span> },
    { key: 'key', header: 'Index', cell: (i) => <span className="font-mono text-xs">{`{ ${i.key} }`}{i.unique ? <Badge variant="secondary" className="ml-2">unique</Badge> : null}</span> },
    { key: 'problem', header: 'Problem', cell: (i) => <span className="text-xs">{PROBLEM_LABEL[i.problem]}</span> },
  ];

  const s = data?.summary;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Integrity"
        description="Structural checks across collections: duplicates, references to records that no longer exist, rules that must always hold, and indexes the code relies on. Read-only — fixes go through a reviewed script with a dry-run and a backup."
        actions={
          <>
            <Button variant="outline" size="sm" className="bg-card" disabled={!data} onClick={() => downloadCsv(`integrity-${new Date().toISOString().slice(0, 10)}.csv`, (data?.checks || []).map(({ samples, ...c }) => ({ ...c, sampleIds: samples.map((x) => x._id ?? x.key).join(' ') })))}>
              <Download /> Export
            </Button>
            {me?.can.request || me?.can.execute ? (
              <Button size="sm" onClick={run} disabled={busy}>
                <Play /> {busy ? 'Running…' : 'Run checks'}
              </Button>
            ) : null}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Checks passing" icon={<CheckCircle2 />} tone={s?.failing ? 'warning' : 'success'} loading={isLoading} value={s ? `${s.passing}/${s.checks}` : '—'} hint={data ? `ran ${ago(data.generatedAt)} · ${ms(data.durationMs)}` : ''} />
        <StatCard label="Critical" icon={<AlertOctagon />} tone={s?.bySeverity.critical ? 'danger' : 'success'} loading={isLoading} value={num(s?.bySeverity.critical || 0)} />
        <StatCard label="High" icon={<ShieldAlert />} tone={s?.bySeverity.high ? 'warning' : 'neutral'} loading={isLoading} value={num(s?.bySeverity.high || 0)} />
        <StatCard label="Affected records" icon={<DatabaseZap />} tone={s?.affected ? 'warning' : 'success'} loading={isLoading} value={num(s?.affected)} />
        <StatCard label="Index problems" icon={<KeyRound />} tone={s?.indexProblems ? 'danger' : 'success'} loading={isLoading} value={num(s?.indexProblems)} hint={`${undeclared.length} DB-only`} />
      </div>

      <Section
        title="Checks"
        description={data ? `Reference checks look at the newest ${num(data.scanLimit)} documents per collection. Click a row for sample records.` : undefined}
        action={
          <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
            <TabsList>
              <TabsTrigger value="failing">Failing</TabsTrigger>
              <TabsTrigger value="duplicate">Duplicates</TabsTrigger>
              <TabsTrigger value="orphan">References</TabsTrigger>
              <TabsTrigger value="invariant">Rules</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <DataTable columns={columns} rows={rows} loading={isLoading} rowKey={(c) => c.key} onRowClick={(c) => !c.ok && setOpen(c)} emptyTitle={f.view === 'failing' ? 'Every check passes' : 'No checks'} />
      </Section>

      <Section title="Indexes" description="Mongoose logs a failed index build and keeps running, so a missing unique index silently removes a guarantee the code depends on. Build missing indexes in a maintenance window after removing duplicates.">
        {data?.indexError && <ErrorState error={new Error(data.indexError)} />}
        <DataTable columns={indexColumns} rows={indexRows} loading={isLoading} rowKey={(i) => `${i.collection}-${i.key}`} emptyTitle="Every declared index exists" />
        {undeclared.length ? (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">{undeclared.length} index(es) exist only in the database</summary>
            <ul className="mt-2 space-y-1 font-mono">
              {undeclared.map((i) => (
                <li key={`${i.collection}-${i.name}`}>
                  {i.collection}.{i.name} {`{ ${i.key} }`}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>{open?.title}</SheetTitle>
            <SheetDescription>
              {open ? `${num(open.count)} affected in ${open.entity} · showing up to ${open.samples.length} · checked ${data ? dateTime(data.generatedAt) : ''}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">{open?.why}</p>
            {open?.samples.map((x, i) => (
              <div key={i} className="space-y-1 rounded-md border bg-card p-3">
                {Object.entries(x).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                    <span className="text-xs text-muted-foreground">{k === '_id' ? 'id' : k}</span>
                    <SampleValue v={v} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
