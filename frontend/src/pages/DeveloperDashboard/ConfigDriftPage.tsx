import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CircleCheck, CircleMinus, CircleX, FileDiff, GitCompare, Package, RefreshCw, ShieldCheck, Webhook } from 'lucide-react';
import { ago, dateTime } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type DriftChange, type PolicyCheck } from '../../api/developer';
import { useDevConfigDrift, useDevMe } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';

const AREA: Record<DriftChange['area'], string> = { runtime: 'Runtime', env: 'Env var', packages: 'Package', globalConfig: 'Stored config' };
const CHANGE_TONE: Record<DriftChange['change'], 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = {
  changed: 'warning',
  removed: 'danger',
  unset: 'danger',
  added: 'info',
  set: 'success',
  declared: 'neutral',
  undeclared: 'neutral',
};
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function ChangeList({ changes, empty }: { changes: DriftChange[]; empty: string }) {
  const cols: Column<DriftChange>[] = [
    { key: 'area', header: 'Area', cell: (c) => <span className="text-xs">{AREA[c.area]}</span> },
    { key: 'key', header: 'Item', cell: (c) => <span className="font-mono text-xs">{c.key}</span> },
    { key: 'change', header: 'Change', cell: (c) => <StatusBadge status={c.change} tone={CHANGE_TONE[c.change]} /> },
    { key: 'val', header: 'Detail', cell: (c) => <span className="text-xs text-muted-foreground">{c.from || c.to ? `${c.from ?? '—'} → ${c.to ?? '—'}` : c.area === 'env' || c.area === 'globalConfig' ? 'value hidden' : ''}</span> },
  ];
  return <DataTable columns={cols} rows={changes} rowKey={(c, i) => `${c.area}-${c.key}-${i}`} emptyTitle={empty} />;
}

function Policy({ p }: { p: PolicyCheck }) {
  const Icon = p.ok === null ? CircleMinus : p.ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={cn('mt-0.5 size-4 shrink-0', p.ok === null ? 'text-muted-foreground/50' : p.ok ? 'text-emerald-600' : p.severity === 'critical' || p.severity === 'high' ? 'text-red-600' : 'text-amber-600')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn('font-medium', p.ok === null && 'text-muted-foreground')}>{p.title}</span>
          {p.ok === false && <StatusBadge status={p.severity} />}
          {p.prodOnly && <Badge variant="outline" className="text-[10px]">production</Badge>}
        </div>
        <p className="text-xs break-words text-muted-foreground">{p.ok === null ? `Not checked outside production · ${p.detail}` : p.detail}</p>
      </div>
    </li>
  );
}

export default function ConfigDriftPage() {
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevConfigDrift();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const s = data?.summary;
  const policies = [...(data?.policies || [])].sort((a, b) => Number(a.ok !== false) - Number(b.ok !== false) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  const refresh = async () => {
    try {
      qc.setQueryData(['dev', 'config-drift'], await devApi.configDrift(true));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };
  const accept = async () => {
    setBusy(true);
    try {
      await devApi.acceptBaseline(note.trim());
      toast.success('Baseline accepted');
      setAccepting(false);
      setNote('');
      qc.invalidateQueries({ queryKey: ['dev', 'config-drift'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configuration Drift"
        description="The running configuration compared with an accepted baseline, production policy rules, installed dependencies and Stripe webhook subscriptions. Env vars and stored config are fingerprinted — values never leave the server."
        actions={
          <>
            <Button size="sm" variant="outline" className="bg-card" onClick={refresh} disabled={isFetching}>
              <RefreshCw className={cn(isFetching && 'animate-spin')} /> Refresh
            </Button>
            {canAct && (
              <Button size="sm" disabled={!data} onClick={() => setAccepting(true)}>
                <GitCompare /> Accept as baseline
              </Button>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Drift from baseline"
          icon={<FileDiff />}
          tone={!data?.baseline ? 'warning' : s?.driftFromBaseline ? 'warning' : 'success'}
          loading={isLoading}
          value={!data?.baseline ? 'No baseline' : s?.driftFromBaseline ? `${s.driftFromBaseline} changes` : 'None'}
          hint={data?.baseline ? `accepted ${ago(data.baseline.at)}${data.baseline.by ? ` by ${data.baseline.by}` : ''}` : 'accept the current config to start tracking'}
        />
        <StatCard label="Policy failures" icon={<ShieldCheck />} tone={s?.criticalOrHigh ? 'danger' : s?.policyFailures ? 'warning' : 'success'} loading={isLoading} value={s?.policyFailures ?? '—'} hint={s ? `${s.criticalOrHigh} critical/high · env: ${data?.environment}` : ''} />
        <StatCard label="Webhook gaps" icon={<Webhook />} tone={s?.webhookGaps ? 'warning' : 'success'} loading={isLoading} value={s?.webhookGaps ?? '—'} hint="handled events not subscribed in Stripe" />
        <StatCard label="Dependencies" icon={<Package />} tone={s?.dependencyProblems ? 'danger' : 'success'} loading={isLoading} value={s?.dependencyProblems ? `${s.dependencyProblems} off` : 'In range'} hint={data ? `${data.current.packages} packages · Node ${data.current.nodeVersion}` : ''} />
        <StatCard label="Env vars set" icon={<FileDiff />} loading={isLoading} value={data ? `${data.current.envSet} / ${data.current.envDeclared}` : '—'} hint="declared in .env.example" />
      </div>

      <Section
        title="Changes since the baseline"
        description={data?.baseline ? `Baseline ${dateTime(data.baseline.at)}${data.baseline.note ? ` — “${data.baseline.note}”` : ''} · release ${data.current.version}@${data.current.commit?.slice(0, 7) ?? '?'}` : 'No baseline yet. Review the policy checks below, then accept the running configuration as the baseline.'}
      >
        {data?.baselineDiff ? <ChangeList changes={data.baselineDiff} empty="The running configuration matches the baseline" /> : <p className="text-sm text-muted-foreground">Nothing to compare against yet.</p>}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Policy checks" description="Failing rules first. Production-only rules are shown but not evaluated in other environments.">
          <ul className="divide-y">{policies.map((p) => <Policy key={p.key} p={p} />)}</ul>
        </Section>
        <div className="space-y-4">
          <Section title="Stripe webhook subscriptions" description={data ? `${data.stripeWebhooks.handled} event types handled in code (services/stripe/webhookDispatcher.js)` : undefined}>
            {data && !data.stripeWebhooks.ok && <ErrorState error={new Error(data.stripeWebhooks.error)} />}
            {data?.stripeWebhooks.endpoints.map((e) => (
              <div key={e.id} className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-mono">{e.url}</span>
                <StatusBadge status={e.status} tone={e.status === 'enabled' ? 'success' : 'danger'} />
              </div>
            ))}
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-red-700">Handled but not subscribed ({data?.stripeWebhooks.missing.length ?? 0}) — these events never arrive</div>
                <div className="flex flex-wrap gap-1">{data?.stripeWebhooks.missing.map((m) => <Badge key={m} variant="destructive" className="font-mono text-[10px]">{m}</Badge>)}{data && !data.stripeWebhooks.missing.length && <span className="text-xs text-muted-foreground">none</span>}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Subscribed but not handled ({data?.stripeWebhooks.unhandled.length ?? 0}) — delivered and ignored</div>
                <div className="flex flex-wrap gap-1">{data?.stripeWebhooks.unhandled.map((m) => <Badge key={m} variant="secondary" className="font-mono text-[10px]">{m}</Badge>)}{data && !data.stripeWebhooks.unhandled.length && <span className="text-xs text-muted-foreground">none</span>}</div>
              </div>
            </div>
          </Section>
          <Section title="Dependencies" description="package.json ranges vs installed versions.">
            {data?.dependencies.length ? (
              <ul className="space-y-1 text-sm">
                {data.dependencies.map((d) => (
                  <li key={d.name} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{d.name}</span>
                    <span className="text-xs text-red-600">{d.problem === 'missing' ? `not installed (wants ${d.wanted})` : `${d.installed} outside ${d.wanted}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Every dependency is installed within its declared range.</p>
            )}
          </Section>
          <Section title="Declared but unset" description="Env vars in .env.example with no value here. Many are optional features.">
            <div className="flex flex-wrap gap-1">{data?.unsetEnv.map((k) => <Badge key={k} variant="outline" className="font-mono text-[10px]">{k}</Badge>)}</div>
          </Section>
        </div>
      </div>

      <Section title="Configuration history" description="Recorded on each boot whose configuration differs from the previous one.">
        {data?.history.length ? (
          <ol className="space-y-3">
            {data.history.map((h, i) => (
              <li key={i} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{dateTime(h.at)}</span>
                  <span className="text-xs text-muted-foreground">{h.host} · {h.version}@{h.commit?.slice(0, 7) ?? '?'}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {h.changes === null ? 'First recorded configuration.' : h.changes.length ? h.changes.map((c) => `${AREA[c.area]} ${c.key} ${c.change}${c.to ? ` (${c.from ?? '—'} → ${c.to})` : ''}`).join(' · ') : 'No differences.'}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No boots recorded yet.</p>
        )}
      </Section>

      <Dialog open={accepting} onOpenChange={setAccepting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept the running configuration as baseline</DialogTitle>
            <DialogDescription>From now on, any env var, package, stored config or runtime change is reported as drift against this snapshot. Recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="baseline-note">Note (optional)</Label>
            <Textarea id="baseline-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after rotating JWT secrets, release 1.4" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccepting(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={accept}>
              Accept baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
