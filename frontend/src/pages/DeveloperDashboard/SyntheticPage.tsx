import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CircleCheck, CircleX, Clock, Pencil, Play, Plus, Radar, Trash2 } from 'lucide-react';
import { ago, dateTime, ms, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type SyntheticCheckInput, type SyntheticCheckRow, type SyntheticCustom } from '../../api/developer';
import { useDevMe, useDevSynthetic, useDevSyntheticRuns } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { EmptyState, ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Switch } from '../../components/developer/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(v === 100 ? 0 : 2)}%`);
const uptimeTone = (v: number | null) => (v === null ? 'text-muted-foreground' : v >= 99.5 ? 'text-emerald-600' : v >= 95 ? 'text-amber-600' : 'text-red-600');

/** Status-page strip: one bar per run, height = latency, red = failed. */
function RunStrip({ series }: { series: SyntheticCheckRow['series'] }) {
  const runs = series.slice(-60);
  const max = Math.max(1, ...runs.map((r) => r.ms || 0));
  if (!runs.length) return <div className="flex h-8 items-center text-xs text-muted-foreground">No runs in the last 24 h</div>;
  return (
    <div className="flex h-8 items-end gap-px" aria-label="Recent runs">
      {runs.map((r, i) => (
        <span
          key={i}
          title={`${dateTime(r.at)} · ${r.ok ? ms(r.ms) : 'failed'}`}
          className={cn('min-w-[3px] flex-1 rounded-[1px]', r.ok ? 'bg-emerald-500/70' : 'bg-red-500')}
          style={{ height: r.ok ? `${Math.max(15, ((r.ms || 0) / max) * 100)}%` : '100%' }}
        />
      ))}
    </div>
  );
}

const EMPTY: SyntheticCheckInput = { name: '', url: '', method: 'GET', expectStatus: 200, expectText: '', enabled: true };

function CheckDialog({ initial, open, onOpenChange, hosts }: { initial: SyntheticCustom | null; open: boolean; onOpenChange: (o: boolean) => void; hosts: string[] }) {
  const qc = useQueryClient();
  const [v, setV] = useState<SyntheticCheckInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setV(initial ? { name: initial.name, url: initial.url, method: initial.method, expectStatus: initial.expectStatus, expectText: initial.expectText || '', enabled: initial.enabled } : EMPTY);
  }, [open, initial]);
  const save = async () => {
    setBusy(true);
    try {
      if (initial) await devApi.syntheticUpdate(initial._id, v);
      else await devApi.syntheticCreate(v);
      toast.success(initial ? 'Check updated' : 'Check added — it runs on the next cycle');
      qc.invalidateQueries({ queryKey: ['dev', 'synthetic'] });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit check' : 'Add HTTP check'}</DialogTitle>
          <DialogDescription>Allowed hosts: {hosts.join(', ') || 'none'}. Redirects are not followed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sc-name">Name</Label>
            <Input id="sc-name" value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Share card preview" />
          </div>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={v.method} onValueChange={(method) => setV({ ...v, method: method as 'GET' | 'HEAD' })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="HEAD">HEAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-url">URL</Label>
              <Input id="sc-url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://api.jobblo.no/api/categories" className="font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="sc-status">Status</Label>
              <Input id="sc-status" type="number" min={100} max={599} value={v.expectStatus} onChange={(e) => setV({ ...v, expectStatus: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-text">Body contains (optional)</Label>
              <Input id="sc-text" value={v.expectText || ''} disabled={v.method === 'HEAD'} maxLength={200} onChange={(e) => setV({ ...v, expectText: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={v.enabled} onCheckedChange={(enabled) => setV({ ...v, enabled })} /> Enabled
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !v.name.trim() || !v.url.trim()} onClick={save}>
            {initial ? 'Save' : 'Add check'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunsSheet({ check, onClose }: { check: SyntheticCheckRow | null; onClose: () => void }) {
  const { data, isLoading } = useDevSyntheticRuns(check?.key);
  return (
    <Sheet open={Boolean(check)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{check?.name}</SheetTitle>
          <SheetDescription>{check?.describe}</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 overflow-y-auto p-4">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {data?.runs.map((r) => (
            <div key={r._id} className={cn('rounded-md border p-3', !r.ok && 'border-red-200 bg-red-50/50')}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  {r.ok ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleX className="size-4 text-red-600" />}
                  {dateTime(r.at)}
                  {r.trigger === 'manual' && <Badge variant="outline">manual</Badge>}
                </span>
                <span className="tabular-nums text-muted-foreground">{ms(r.latencyMs)}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs">
                {r.steps?.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className={cn('truncate font-mono', !s.ok && 'text-red-700')}>{s.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {s.status ?? '—'} · {ms(s.ms)}
                    </span>
                  </li>
                ))}
              </ul>
              {r.error && <p className="mt-1 text-xs text-red-700">{r.error}</p>}
            </div>
          ))}
          {data && !data.runs.length && <EmptyState title="No runs yet" />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function SyntheticPage() {
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevSynthetic();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<SyntheticCheckRow | null>(null);
  const [editing, setEditing] = useState<SyntheticCustom | null>(null);
  const [dialog, setDialog] = useState(false);
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const checks = data?.checks || [];
  const down = checks.filter((c) => c.state === 'down');
  const measured = checks.filter((c) => c.uptime24h !== null);
  const overall = measured.length ? measured.reduce((a, c) => a + (c.uptime24h || 0), 0) / measured.length : null;

  const run = async (key?: string) => {
    setBusy(key || 'all');
    try {
      const { results } = await devApi.syntheticRun(key);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${failed.length} of ${results.length} failed: ${failed.map((f) => f.name).join(', ')}`);
      else toast.success(`${results.length} check${results.length === 1 ? '' : 's'} passed`);
      qc.invalidateQueries({ queryKey: ['dev', 'synthetic'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (c: SyntheticCustom) => {
    if (!window.confirm(`Delete check "${c.name}"? Its run history is kept for 30 days.`)) return;
    try {
      await devApi.syntheticDelete(c._id);
      toast.success('Check deleted');
      qc.invalidateQueries({ queryKey: ['dev', 'synthetic'] });
    } catch (e) {
      toast.error(errMessage(e));
    }
  };
  const customOf = (key: string) => data?.customs.find((c) => c._id === key) || null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Synthetic Monitoring"
        description="Scripted probes that use the product like a user — API, realtime, web app and the full login journey — on a timer, with uptime and latency. Two failures in a row open an incident."
        actions={
          <>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
            {canAct && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => {
                    setEditing(null);
                    setDialog(true);
                  }}
                >
                  <Plus /> Add check
                </Button>
                <Button size="sm" disabled={Boolean(busy)} onClick={() => run()}>
                  <Play /> {busy === 'all' ? 'Running…' : 'Run all now'}
                </Button>
              </>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Checks down" icon={<CircleX />} tone={down.length ? 'danger' : 'success'} loading={isLoading} value={down.length ? `${down.length} / ${checks.length}` : `0 / ${checks.length}`} hint={down.map((c) => c.name).join(', ') || 'All passing'} />
        <StatCard label="Uptime (24 h)" icon={<Radar />} tone={overall === null ? 'neutral' : overall >= 99.5 ? 'success' : 'warning'} loading={isLoading} value={pct(overall)} hint="average across checks" />
        <StatCard label="Interval" icon={<Clock />} loading={isLoading} value={data ? `${data.config.intervalMin} min` : '—'} hint={data?.config.enabled ? 'runs on this server' : 'disabled (ENABLE_SYNTHETIC=false)'} />
        <StatCard label="Login journey" icon={<CircleCheck />} tone={data?.config.loginJourney ? 'success' : 'warning'} loading={isLoading} value={data?.config.loginJourney ? 'Enabled' : 'Not configured'} hint={data?.config.loginJourney ? 'synthetic account' : 'set SYNTHETIC_USER_EMAIL / _PASSWORD'} />
      </div>

      <Section title="Checks" description={data ? `API ${data.config.api}${data.config.web ? ` · web ${data.config.web}` : ''}. Set SYNTHETIC_API_URL to the public https URL to also cover nginx and TLS. Click a check for its run history.` : undefined}>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {checks.map((c) => {
              const custom = c.custom ? customOf(c.key) : null;
              return (
                <Card key={c.key} size="sm" className={cn('cursor-pointer gap-3 transition-colors hover:border-primary/40', c.state === 'down' && 'border-red-300')} onClick={() => setOpen(c)}>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('size-2 shrink-0 rounded-full', c.state === 'up' ? 'bg-emerald-500' : c.state === 'down' ? 'bg-red-500' : 'bg-muted-foreground/40')} />
                          <span className="truncate font-medium">{c.name}</span>
                          {c.custom && <Badge variant="outline">custom</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={c.describe}>
                          {c.describe}
                        </p>
                      </div>
                      <StatusBadge status={c.state} tone={c.state === 'up' ? 'success' : c.state === 'down' ? 'danger' : 'neutral'} />
                    </div>
                    <RunStrip series={c.series} />
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">24 h</div>
                        <div className={cn('font-medium tabular-nums', uptimeTone(c.uptime24h))}>{pct(c.uptime24h)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">7 d</div>
                        <div className={cn('font-medium tabular-nums', uptimeTone(c.uptime7d))}>{pct(c.uptime7d)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">p50</div>
                        <div className="font-medium tabular-nums">{ms(c.p50)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">p95</div>
                        <div className="font-medium tabular-nums">{ms(c.p95)}</div>
                      </div>
                    </div>
                    {c.state === 'down' && c.lastRun?.error && (
                      <p className="truncate rounded bg-red-50 px-2 py-1 text-xs text-red-700" title={c.lastRun.error}>
                        {c.failingFor > 1 ? `${num(c.failingFor)} failures · ` : ''}
                        {c.lastRun.error}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{c.lastRun ? `last run ${ago(c.lastRun.at)}` : 'waiting for first run'}</span>
                      {canAct && (
                        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {custom && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Edit"
                                onClick={() => {
                                  setEditing(custom);
                                  setDialog(true);
                                }}
                              >
                                <Pencil />
                              </Button>
                              <Button variant="ghost" size="icon-xs" aria-label="Delete" onClick={() => remove(custom)}>
                                <Trash2 />
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="xs" disabled={Boolean(busy)} onClick={() => run(c.key)}>
                            <Play /> {busy === c.key ? '…' : 'Run'}
                          </Button>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {data?.customs.some((c) => !c.enabled) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Disabled custom checks:{' '}
            {data.customs
              .filter((c) => !c.enabled)
              .map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className="mr-2 underline"
                  onClick={() => {
                    setEditing(c);
                    setDialog(true);
                  }}
                >
                  {c.name}
                </button>
              ))}
          </p>
        )}
      </Section>

      <RunsSheet check={open} onClose={() => setOpen(null)} />
      <CheckDialog initial={editing} open={dialog} onOpenChange={setDialog} hosts={data?.config.allowedHosts || []} />
    </div>
  );
}
