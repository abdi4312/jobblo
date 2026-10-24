import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CircleX, FileCode2, KeyRound, ShieldCheck, Smartphone, TableProperties } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type MigrationsInfo } from '../../api/developer';
import { useDevMigrations } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';

const STATE_ICON = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  warn: <AlertTriangle className="size-4 text-amber-600" />,
  fail: <CircleX className="size-4 text-red-600" />,
};

export default function MigrationsPage() {
  const { data, isLoading, error, refetch } = useDevMigrations();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const recheck = async () => {
    setBusy(true);
    try {
      qc.setQueryData(['dev', 'migrations'], await devApi.migrations(true));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pending = data?.migrations.filter((m) => m.pending) || [];
  const ready = data ? data.rollback.filter((r) => r.state === 'pass').length : 0;

  const migCols: Column<MigrationsInfo['migrations'][number]>[] = [
    { key: 's', header: '', cell: (m) => (m.pending === null ? <StatusBadge status="error" tone="danger" /> : m.pending ? <StatusBadge status="pending" tone="warning" /> : <CheckCircle2 className="size-4 text-emerald-600" />) },
    { key: 't', header: 'Migration', className: 'max-w-[460px]', cell: (m) => <div className="min-w-0"><div className="font-medium">{m.title}</div><div className="truncate font-mono text-[11px] text-muted-foreground">scripts/{m.script}</div></div> },
    { key: 'd', header: 'Database state', className: 'min-w-[260px] max-w-[420px] whitespace-normal', cell: (m) => <span className={cn('block text-xs', m.pending && 'text-foreground', !m.pending && 'text-muted-foreground')}>{m.detail}</span> },
    { key: 'k', header: 'Type', cell: (m) => <div className="flex flex-wrap gap-1"><Badge variant="outline">{m.kind}</Badge>{m.destructive && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">destructive</Badge>}{!m.reversible && <Badge variant="outline" className="text-amber-700">no undo</Badge>}</div> },
  ];
  const schemaCols: Column<MigrationsInfo['schema'][number]>[] = [
    { key: 'f', header: 'Field', cell: (s) => <span className="font-mono text-xs">{s.model}.{s.path}</span> },
    { key: 'r', header: 'Rule broken', cell: (s) => (s.rule === 'enum' ? <span className="text-xs">value <b className="font-mono">{s.value}</b> not in [{s.allowed?.join(', ')}]</span> : <span className="text-xs">required, but missing</span>) },
    { key: 'n', header: 'Documents', align: 'right', cell: (s) => <span className="tabular-nums font-medium">{num(s.count)}</span> },
    { key: 'e', header: 'Example', cell: (s) => <Link to={`/developer/investigate?q=${s.sampleId}`} className="font-mono text-xs text-primary hover:underline">{s.sampleId.slice(-8).toUpperCase()}</Link> },
  ];
  const idxCols: Column<MigrationsInfo['indexChanges'][number]>[] = [
    { key: 'c', header: 'Collection', cell: (i) => <span className="font-mono text-xs">{i.collection}</span> },
    { key: 'k', header: 'Index', cell: (i) => <span className="font-mono text-xs">{i.key}{i.unique ? ' (unique)' : ''}</span> },
    { key: 'p', header: 'Change not applied', cell: (i) => <span className="text-xs">{i.problem === 'missing' ? 'Declared in the model, missing in the database' : 'Declared unique, database index is not unique'}</span> },
    { key: 's', header: 'Severity', cell: (i) => <StatusBadge status={i.severity} /> },
  ];
  const clientCols: Column<MigrationsInfo['clients'][number]>[] = [
    { key: 'v', header: 'App version', cell: (c) => <span className="font-medium">{c.version} <span className="text-xs text-muted-foreground">{c.platform}</span></span> },
    { key: 's', header: 'Sessions (7 d)', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.sessions7d)}</span> },
    { key: 'f', header: 'First seen', cell: (c) => <span className="text-xs text-muted-foreground">{dateTime(c.firstSeen)}</span> },
    { key: 'b', header: 'Breaking API changes since', align: 'right', cell: (c) => <span className={cn('tabular-nums', c.breakingSince && 'font-medium text-red-600')}>{c.breakingSince || '—'}</span> },
    { key: 'r', header: 'Routes', cell: (c) => <span className="font-mono text-[11px] text-muted-foreground">{c.routes.join(', ') || '—'}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Migrations"
        description="Migration scripts are checked against the database itself (not a 'has run' log, which a restore would make wrong). Also: index and schema changes the data has not caught up with, whether a release can be rolled back, and app versions that predate a breaking API change. Read-only — scripts are run from a shell with their own dry-run."
        actions={<RefreshButton onClick={recheck} spinning={busy} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Pending migrations" icon={<FileCode2 />} loading={isLoading} tone={pending.length ? 'warning' : 'success'} value={data ? `${pending.length} / ${data.migrations.length}` : '—'} hint={data ? `${pending.filter((m) => m.destructive).length} destructive` : undefined} />
        <StatCard label="Index changes not applied" icon={<KeyRound />} loading={isLoading} tone={data?.indexChanges.some((i) => i.unique) ? 'danger' : data?.indexChanges.length ? 'warning' : 'success'} value={num(data?.indexChanges.length)} />
        <StatCard label="Schema rules broken" icon={<TableProperties />} loading={isLoading} tone={data?.schema.length ? 'warning' : 'success'} value={num(data?.schema.length)} hint={data ? `${num(data.schema.reduce((a, s) => a + s.count, 0))} documents` : undefined} />
        <StatCard label="Rollback readiness" icon={<ShieldCheck />} loading={isLoading} tone={data?.rollback.some((r) => r.state === 'fail') ? 'danger' : data?.rollback.some((r) => r.state === 'warn') ? 'warning' : 'success'} value={data ? `${ready} / ${data.rollback.length}` : '—'} />
        <StatCard label="At-risk app versions" icon={<Smartphone />} loading={isLoading} tone={data?.clients.some((c) => c.breakingSince) ? 'danger' : 'success'} value={num(data?.clients.filter((c) => c.breakingSince).length)} hint={data ? `${data.clients.length} versions active` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section title="Migration scripts" description={data ? `Checked ${ago(data.at)}. Destructive ones need a verified backup first — see Rollback readiness.` : undefined}>
          <DataTable columns={migCols} rows={data?.migrations} loading={isLoading} rowKey={(m) => m.script} emptyTitle="No migration scripts" />
          {data && data.unregistered.length > 0 && (
            <p className="mt-3 text-xs text-amber-700">
              New script(s) without a detector: {data.unregistered.join(', ')} — add one to services/monitoring/migrations.js so their state is visible.
            </p>
          )}
        </Section>
        <Section title="Rollback readiness" description="Can the last change be undone safely?">
          <ul className="space-y-3">
            {data?.rollback.map((r) => (
              <li key={r.key} className="flex gap-2.5">
                <span className="mt-0.5">{STATE_ICON[r.state]}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/developer/backups" className="mt-4 inline-block text-xs text-primary hover:underline">
            Backup &amp; DR →
          </Link>
        </Section>
      </div>

      <Section title="Index changes not applied" description="The model declares an index the database does not have. Unique ones usually fail to build because duplicates exist — fix the data (migration above) first.">
        <DataTable columns={idxCols} rows={data?.indexChanges} loading={isLoading} rowKey={(i) => `${i.collection}:${i.key}`} emptyTitle="Database indexes match the models" />
      </Section>
      <Section title="Stored data vs current schema" description="Documents written by older code (or outside mongoose) that the current model would reject on save — the next .save() on them throws a ValidationError.">
        <DataTable columns={schemaCols} rows={data?.schema} loading={isLoading} rowKey={(s) => `${s.model}.${s.path}.${s.rule}`} emptyTitle="Every stored document passes the current schema rules" />
      </Section>
      <Section title="Incompatible app versions" description="Mobile versions used in the last 7 days, and how many breaking API contract changes landed after that version first appeared.">
        <DataTable columns={clientCols} rows={data?.clients} loading={isLoading} rowKey={(c) => `${c.platform}-${c.version}`} emptyTitle="No mobile sessions in the last 7 days" />
      </Section>
    </div>
  );
}
