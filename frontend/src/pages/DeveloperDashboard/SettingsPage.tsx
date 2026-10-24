import { useEffect, useState } from 'react';
import { KeyRound, Lock, Save, ShieldCheck, Users } from 'lucide-react';
import { ago } from '@/lib/devFormat';
import type { DevAccess } from '../../api/developer';
import { useDevMe, useDevSettings } from '../../features/developer/hooks';
import { useSensitiveAction } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { ReasonDialog } from '../../components/developer/ReasonDialog';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';

const THRESHOLD_LABELS: Record<string, string> = {
  apiErrorRatePct: 'API 5xx rate (%, 5 min)',
  apiP95Ms: 'API P95 latency (ms, 5 min)',
  criticalErrors: 'Critical errors (5 min)',
  webhookFailures: 'Failing Stripe webhooks (15 min)',
  schedulerFailures: 'Failed scheduler runs (15 min)',
  queueStuck: 'Stuck queue items',
  loginFailuresPerIp: 'Failed logins per IP (15 min)',
  recoveryMinutes: 'Recovery confirmation after (min)',
};
const ACCESS_LABEL: Record<DevAccess, string> = { readonly: 'Read-only', operations: 'Operations', superAdmin: 'Super Admin' };

export default function SettingsPage() {
  const { data, isLoading, isFetching, error, refetch } = useDevSettings();
  const { data: me } = useDevMe();
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(Object.entries(data.thresholds).map(([k, v]) => [k, String(v)])));
  }, [data]);
  const submit = useSensitiveAction(['settings']);
  const [confirmThresholds, setConfirmThresholds] = useState(false);
  const [accessChange, setAccessChange] = useState<{ userId: string; name: string; access: DevAccess } | null>(null);
  const changed = data ? Object.entries(draft).filter(([k, v]) => Number(v) !== data.thresholds[k]) : [];
  const canAct = Boolean(me?.can.execute || me?.can.request);

  type Dev = NonNullable<typeof data>['developers'][number];
  const columns: Column<Dev>[] = [
    { key: 'name', header: 'Developer', cell: (d) => <div><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.email}</div></div> },
    {
      key: 'access',
      header: 'Dashboard access',
      cell: (d) =>
        d.role === 'superAdmin' || !canAct ? (
          <StatusBadge status={d.access} tone={d.access === 'superAdmin' ? 'danger' : d.access === 'operations' ? 'info' : 'neutral'} label={ACCESS_LABEL[d.access]} />
        ) : (
          <Select value={d.access} onValueChange={(access) => access !== d.access && setAccessChange({ userId: d._id, name: d.name, access: access as DevAccess })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="readonly">Read-only</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
            </SelectContent>
          </Select>
        ),
    },
    { key: 'sessions', header: 'Active sessions', align: 'right', cell: (d) => <span className="tabular-nums">{d.activeSessions}</span> },
    { key: 'active', header: 'Last active', align: 'right', cell: (d) => <span className="text-xs text-muted-foreground">{d.lastActive ? ago(d.lastActive) : d.lastLogin ? `login ${ago(d.lastLogin)}` : 'never'}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Access & Settings"
        description="Developer access, alert thresholds, retention, integrations and sensitive-action policies. Sensitive changes need a one-time code and, for operations developers, Super Admin approval."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Your access" icon={<ShieldCheck />} tone="info" loading={!me} value={me ? ACCESS_LABEL[me.access] : '—'} hint={me?.environment} />
        <StatCard label="Developers" icon={<Users />} loading={isLoading} value={data?.developers.length ?? '—'} />
        <StatCard label="Integrations" icon={<KeyRound />} loading={isLoading} value={data ? `${data.integrations.filter((i) => i.configured).length}/${data.integrations.length}` : '—'} hint="configured" />
        <StatCard label="MFA" icon={<Lock />} tone="warning" loading={isLoading} value="Not available" hint="Jobblo has no MFA yet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Developer accounts" description="Read-only: view only. Operations: triage, and request sensitive changes. Super Admin: runs and approves sensitive changes. New developers start read-only; grant the developer role from the admin Users page." className="lg:col-span-3">
          <DataTable columns={columns} rows={data?.developers} loading={isLoading} rowKey={(d) => d._id} emptyTitle="No developers" />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title="Alert thresholds"
          description="Changes apply on the next evaluation (every minute)."
          className="lg:col-span-2"
          action={
            canAct && (
              <Button size="sm" disabled={!changed.length} onClick={() => setConfirmThresholds(true)}>
                <Save /> {me?.can.execute ? 'Save' : 'Request change'} {changed.length ? `(${changed.length})` : ''}
              </Button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(THRESHOLD_LABELS).map((k) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`t-${k}`} className="text-xs text-muted-foreground">
                  {THRESHOLD_LABELS[k]}
                </Label>
                <Input id={`t-${k}`} type="number" min={1} value={draft[k] ?? ''} disabled={!canAct} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="h-8" />
                {data && data.defaultThresholds[k] !== Number(draft[k]) && <p className="text-[11px] text-muted-foreground">default {data.defaultThresholds[k]}</p>}
              </div>
            ))}
          </div>
        </Section>
        <Section title="Log retention">
          <ul className="space-y-1.5 text-sm">
            {data?.retention.map((r) => (
              <li key={r.data} className="flex justify-between gap-2">
                <span>{r.data}</span>
                <span className="text-muted-foreground">{r.days ? `${r.days} days` : 'kept'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Retention is enforced by MongoDB TTL indexes; changing it is a code change.</p>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Integrations & secret references" description="Presence only — values never leave the server">
          <ul className="divide-y rounded-md border text-sm">
            {data?.integrations.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{i.label}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {i.secrets.map((s) => (
                    <span key={s.name} className={`rounded-sm border px-1 font-mono text-[10px] ${s.present ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {s.name}
                    </span>
                  ))}
                  <StatusBadge status={i.configured ? 'ok' : 'n/a'} label={i.configured ? 'configured' : 'missing'} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Sensitive action policies">
          <ul className="divide-y rounded-md border text-sm">
            {data?.policies.map((p) => (
              <li key={p.action} className="flex justify-between gap-3 px-3 py-2">
                <span className="font-medium">{p.action}</span>
                <span className="text-right text-xs text-muted-foreground">{p.rule}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <ReasonDialog
        open={confirmThresholds}
        onOpenChange={setConfirmThresholds}
        title="Change alert thresholds"
        description={changed.map(([k, v]) => `${THRESHOLD_LABELS[k] || k}: ${data?.thresholds[k]} → ${v}`).join(' · ')}
        confirmLabel="Save thresholds"
        onConfirm={(reason) => submit('thresholds_set', { thresholds: Object.fromEntries(changed.map(([k, v]) => [k, Number(v)])) }, reason)}
      />
      <ReasonDialog
        open={Boolean(accessChange)}
        onOpenChange={(o) => !o && setAccessChange(null)}
        title={`Set ${accessChange?.name}'s access to ${accessChange ? ACCESS_LABEL[accessChange.access] : ''}`}
        description="Operations developers can triage and request sensitive changes; read-only developers can only view."
        confirmLabel="Change access"
        onConfirm={(reason) => submit('developer_access', { userId: accessChange!.userId, access: accessChange!.access }, reason)}
      />

      <Section title="Developer access audit" description="Developer role grants and removals">
        {data?.accessAudit.length ? (
          <Timeline reverse events={data.accessAudit.map((a) => ({ at: a.createdAt, source: 'access', title: a.description, by: a.adminId?.name, tone: 'info' }))} />
        ) : (
          <p className="text-sm text-muted-foreground">No access changes recorded.</p>
        )}
      </Section>
    </div>
  );
}
