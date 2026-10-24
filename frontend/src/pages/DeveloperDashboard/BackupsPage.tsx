import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, CloudUpload, DatabaseBackup, HardDrive, History, LifeBuoy, Play, RotateCcw } from 'lucide-react';
import { ago, bytes, dateTime, ms, num } from '@/lib/devFormat';
import { devApi, type AtlasSnapshot, type BackupRunRow } from '../../api/developer';
import { useDevBackups, useDevMe } from '../../features/developer/hooks';
import { errMessage, useStepUp } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const hours = (h: number | null | undefined) => (h === null || h === undefined ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} days`);
const TONE = { succeeded: 'success', failed: 'danger', running: 'info' } as const;

export default function BackupsPage() {
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevBackups();
  const withStepUp = useStepUp();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<BackupRunRow | null>(null);
  const [drillOf, setDrillOf] = useState<BackupRunRow | 'latest' | null>(null);
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const running = data?.runs.find((r) => r.status === 'running');
  const ready = Boolean(data?.config.configured && data.config.tools.mongodump);
  const refresh = () => qc.invalidateQueries({ queryKey: ['dev', 'backups'] });

  const startBackup = async () => {
    setBusy(true);
    try {
      await devApi.runBackup();
      toast.success('Backup started');
      refresh();
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const startDrill = async () => {
    const target = drillOf === 'latest' ? null : drillOf?._id || null;
    setBusy(true);
    try {
      await withStepUp((token) => devApi.runDrill(target, token));
      toast.success('Restore drill started');
      setDrillOf(null);
      setOpen(null);
      refresh();
    } catch (e) {
      if ((e as Error)?.message !== 'cancelled') toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<BackupRunRow>[] = [
    { key: 'kind', header: 'Run', cell: (r) => <span className="flex items-center gap-2">{r.kind === 'backup' ? <Archive className="size-4 text-muted-foreground" /> : <RotateCcw className="size-4 text-muted-foreground" />}<span className="font-medium capitalize">{r.kind === 'drill' ? 'Restore drill' : 'Backup'}</span></span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.deletedAt ? 'pruned' : r.status} tone={r.deletedAt ? 'neutral' : TONE[r.status]} /> },
    { key: 'at', header: 'Started', cell: (r) => <span className="text-xs" title={dateTime(r.startedAt)}>{ago(r.startedAt)}</span> },
    { key: 'dur', header: 'Duration', align: 'right', cell: (r) => <span className="text-xs tabular-nums">{r.status === 'running' ? '…' : ms(r.durationMs)}</span> },
    { key: 'size', header: 'Size', align: 'right', cell: (r) => <span className="text-xs tabular-nums">{r.kind === 'backup' ? bytes(r.sizeBytes) : '—'}</span> },
    { key: 'offsite', header: 'Offsite', cell: (r) => (r.kind === 'backup' && r.offsite ? <StatusBadge status={r.offsite.status.replace('_', ' ')} tone={r.offsite.status === 'succeeded' ? 'success' : r.offsite.status === 'failed' ? 'danger' : 'neutral'} /> : <span className="text-xs text-muted-foreground">—</span>) },
    { key: 'by', header: 'Trigger', cell: (r) => <span className="text-xs text-muted-foreground">{r.trigger === 'dashboard' ? r.by?.name || 'dashboard' : 'schedule'}</span> },
    { key: 'err', header: '', className: 'max-w-[280px]', cell: (r) => <span className="block truncate text-xs text-red-600" title={r.error || ''}>{r.error}</span> },
  ];
  const atlasColumns: Column<AtlasSnapshot>[] = [
    { key: 'at', header: 'Created', cell: (s) => <span className="text-xs" title={dateTime(s.createdAt)}>{ago(s.createdAt)}</span> },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
    { key: 'type', header: 'Type', cell: (s) => <span className="text-xs">{s.type}{s.frequency ? ` · ${s.frequency}` : ''}</span> },
    { key: 'size', header: 'Size', align: 'right', cell: (s) => <span className="text-xs tabular-nums">{bytes(s.sizeBytes)}</span> },
    { key: 'exp', header: 'Expires', align: 'right', cell: (s) => <span className="text-xs text-muted-foreground">{s.expiresAt ? dateTime(s.expiresAt) : '—'}</span> },
  ];

  const c = data?.config;
  const drill = data?.lastDrill;
  const lastBackup = data?.runs.find((r) => r.kind === 'backup' && r.status === 'succeeded');
  const disk = data?.storage.disk;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Backup & Disaster Recovery"
        description="Database dumps, verified restore drills and cloud snapshots. A backup only counts once a restore of it has been tested — drills restore into a scratch database, compare every collection and drop it again. The live database is never touched."
        actions={
          <>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
            {canAct && (
              <>
                <Button variant="outline" size="sm" className="bg-card" disabled={!ready || !lastBackup || Boolean(running) || busy} onClick={() => setDrillOf('latest')}>
                  <RotateCcw /> Restore drill
                </Button>
                <Button size="sm" disabled={!ready || Boolean(running) || busy} onClick={startBackup}>
                  <Play /> {running?.kind === 'backup' ? 'Backing up…' : 'Back up now'}
                </Button>
              </>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {c && (!c.configured || !c.tools.mongodump || !c.tools.mongorestore) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{!c.configured ? 'Backups are not configured on this server.' : 'MongoDB Database Tools are missing on this server.'}</p>
          <p className="mt-1 text-amber-800">
            {!c.configured ? 'Set BACKUP_DIR (a directory outside the app) and schedule ' : 'Install mongodump/mongorestore (or set MONGODUMP_BIN / MONGORESTORE_BIN) and schedule '}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">node scripts/backup.js backup</code> from cron — see docs/runbooks/disaster-recovery.md. Works the same for the VPS database and MongoDB Atlas.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Last backup"
          icon={<DatabaseBackup />}
          loading={isLoading}
          tone={data?.rpo.ok ? 'success' : 'danger'}
          value={data?.rpo.lastBackupAt ? `${hours(data.rpo.ageHours)} ago` : 'Never'}
          hint={c ? `Target: every ${c.maxAgeHours} h or less (RPO)` : ''}
        />
        <StatCard
          label="Last restore drill"
          icon={<RotateCcw />}
          loading={isLoading}
          tone={!drill ? 'warning' : drill.status === 'succeeded' ? 'success' : 'danger'}
          value={drill ? (drill.status === 'succeeded' ? 'Passed' : 'Failed') : 'Never'}
          hint={drill ? `${ago(drill.startedAt)} · restore took ${ms(drill.durationMs)}` : 'An untested backup may not restore'}
        />
        <StatCard label="Retained backups" icon={<Archive />} loading={isLoading} value={num(data?.storage.retained)} hint={c ? `${bytes(data?.storage.bytes)} · kept ${c.retentionDays} days` : ''} />
        <StatCard
          label="Backup disk free"
          icon={<HardDrive />}
          loading={isLoading}
          tone={disk && lastBackup?.sizeBytes && disk.freeBytes < lastBackup.sizeBytes * 3 ? 'danger' : 'neutral'}
          value={disk ? bytes(disk.freeBytes) : '—'}
          hint={disk ? `of ${bytes(disk.totalBytes)}` : 'BACKUP_DIR not set'}
        />
        <StatCard
          label="Offsite copy"
          icon={<CloudUpload />}
          loading={isLoading}
          tone={!c?.offsite ? 'warning' : lastBackup?.offsite?.status === 'succeeded' ? 'success' : 'danger'}
          value={!c?.offsite ? 'Not configured' : lastBackup?.offsite?.status === 'succeeded' ? 'Copied' : 'Failing'}
          hint={!c?.offsite ? 'Dumps on the same server are lost with it' : lastBackup?.offsite?.at ? ago(lastBackup.offsite.at) : ''}
        />
      </div>

      <Section title="History" description={c ? `Database ${c.database || '—'} · tools ${c.tools.mongodump || 'missing'} · ${c.scheduleHours ? `in-app schedule every ${c.scheduleHours} h` : 'scheduled by host cron'}. Click a row for details.` : undefined} action={<History className="size-4 text-muted-foreground" />}>
        <DataTable columns={columns} rows={data?.runs} loading={isLoading} rowKey={(r) => r._id} onRowClick={setOpen} emptyTitle="No backups yet" />
      </Section>

      <Section title="MongoDB Atlas snapshots" description={data?.atlas.configured ? `Cluster ${data.atlas.cluster} · cloud backups managed by Atlas` : 'Shown after the move to Atlas: set ATLAS_CLIENT_ID, ATLAS_CLIENT_SECRET (read-only service account), ATLAS_GROUP_ID and ATLAS_CLUSTER_NAME.'}>
        {data?.atlas.error && <ErrorState error={new Error(data.atlas.error)} />}
        {data?.atlas.configured ? (
          <DataTable columns={atlasColumns} rows={data.atlas.snapshots} loading={isLoading} rowKey={(s) => s.id} emptyTitle="No snapshots" />
        ) : (
          <EmptyState icon={<LifeBuoy />} title="Atlas not connected" description="The mongodump backups above work against Atlas too, so nothing changes in the meantime." />
        )}
      </Section>

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>{open?.kind === 'drill' ? 'Restore drill' : 'Backup'} · {open ? dateTime(open.startedAt) : ''}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              {open && <StatusBadge status={open.status} tone={TONE[open.status]} />}
              {open?.host && <Badge variant="outline">{open.host}</Badge>}
              {open?.durationMs !== null && open?.durationMs !== undefined && <span>took {ms(open.durationMs)}</span>}
            </SheetDescription>
          </SheetHeader>
          {open && (
            <div className="space-y-4 overflow-y-auto p-4 text-sm">
              {open.error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{open.error}</p>}
              <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">File</dt>
                <dd className="font-mono break-all">{open.file || '—'}{open.deletedAt ? ` (pruned ${ago(open.deletedAt)})` : ''}</dd>
                {open.kind === 'backup' && (
                  <>
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>{bytes(open.sizeBytes)}</dd>
                    <dt className="text-muted-foreground">SHA-256</dt>
                    <dd className="font-mono break-all">{open.sha256 || '—'}</dd>
                    <dt className="text-muted-foreground">Offsite</dt>
                    <dd>{open.offsite?.status.replace('_', ' ') || '—'}{open.offsite?.error ? ` · ${open.offsite.error}` : ''}</dd>
                  </>
                )}
                {open.kind === 'drill' && (
                  <>
                    <dt className="text-muted-foreground">Restored into</dt>
                    <dd className="font-mono">{open.restoredDb} (dropped afterwards)</dd>
                  </>
                )}
              </dl>
              {open.kind === 'drill' && open.mismatches && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Count check</h4>
                  {open.mismatches.length ? (
                    <ul className="space-y-1 text-xs">
                      {open.mismatches.map((m) => (
                        <li key={m.name} className="flex justify-between rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                          <span className="font-mono">{m.name}</span>
                          <span>expected {num(m.expected)}, restored {num(m.actual)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-emerald-700">Every collection restored with the expected number of documents.</p>
                  )}
                </div>
              )}
              {open.kind === 'backup' && open.collections?.length ? (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    {open.collections.length} collections · {num(open.collections.reduce((a, x) => a + x.count, 0))} documents
                  </h4>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {open.collections.map((x) => (
                      <li key={x.name} className="flex justify-between gap-2">
                        <span className="truncate font-mono">{x.name}</span>
                        <span className="tabular-nums text-muted-foreground">{num(x.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canAct && open.kind === 'backup' && open.status === 'succeeded' && !open.deletedAt && (
                <Button variant="outline" size="sm" disabled={!ready || Boolean(running)} onClick={() => setDrillOf(open)}>
                  <RotateCcw /> Restore drill from this backup
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(drillOf)} onOpenChange={(o) => !o && setDrillOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run a restore drill</DialogTitle>
            <DialogDescription>
              Restores {drillOf === 'latest' ? 'the latest backup' : `the backup from ${drillOf ? dateTime(drillOf.startedAt) : ''}`} into the scratch database{' '}
              <code className="font-mono">{c?.database}_restore_drill</code>, counts every collection against the backup, then drops the scratch database. The live database is not modified, but the restore uses disk and I/O on the database server — prefer a quiet hour. Requires a one-time code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillOf(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={startDrill}>
              Start drill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
