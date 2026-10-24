import { useState } from 'react';
import { Flag } from 'lucide-react';
import { ago } from '@/lib/devFormat';
import { useDevFlags, useDevMe } from '../../features/developer/hooks';
import { useSensitiveAction } from '../../features/developer/stepUp';
import type { FlagRow } from '../../api/developer';
import { EmptyState, ErrorState, Mono, NotConfigured, PageHeader, RefreshButton, Section, StatusBadge, Timeline } from '../../components/developer/kit';
import { ReasonDialog } from '../../components/developer/ReasonDialog';
import { Switch } from '../../components/developer/ui/switch';

export default function FeatureFlagsPage() {
  const { data, isLoading, isFetching, error, refetch } = useDevFlags();
  const { data: me } = useDevMe();
  const submit = useSensitiveAction(['flags']);
  const [pending, setPending] = useState<{ flag: FlagRow; enabled: boolean } | null>(null);
  const production = data?.environment === 'production';
  const canAct = Boolean(me?.can.execute || me?.can.request);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feature Flags"
        description="Flags stored in GlobalConfig (keys starting with feature_ or flag_). Changes need a one-time code; operations developers request them and a Super Admin approves."
        actions={
          <>
            {data && <StatusBadge status={data.environment} tone={production ? 'danger' : 'info'} />}
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Flags" description={`${data?.flags.length ?? 0} registered`} className="lg:col-span-2">
          {isLoading ? null : data?.flags.length ? (
            <ul className="divide-y rounded-md border">
              {data.flags.map((flag) => (
                <li key={flag.key} className="flex items-center gap-4 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Mono>{flag.key}</Mono>
                      {flag.rawValue !== undefined && <span className="text-xs text-amber-600">non-boolean value: {String(flag.rawValue)}</span>}
                    </div>
                    {flag.description && <p className="mt-1 text-xs text-muted-foreground">{flag.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{flag.lastChange ? `Changed ${ago(flag.lastChange.createdAt)} by ${flag.lastChange.adminId?.name || 'unknown'}` : 'No recorded changes'}</p>
                  </div>
                  <StatusBadge status={flag.enabled ? 'enabled' : 'disabled'} tone={flag.enabled ? 'success' : 'neutral'} />
                  <Switch checked={flag.enabled} disabled={!canAct} onCheckedChange={(enabled) => setPending({ flag, enabled })} aria-label={`Toggle ${flag.key}`} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Flag />} title="No feature flags" description="Create a GlobalConfig entry whose key starts with feature_ or flag_ (from the admin settings page) to manage it here." />
          )}
        </Section>
        <Section title="Not supported by GlobalConfig">
          <NotConfigured title="Rollouts, cohorts & schedules" description="Flags are global on/off switches. Percentage rollout, user cohorts, scheduled changes and dependency checks need a dedicated flag service." />
        </Section>
      </div>

      <Section title="Change history" description="From the audit log — the rollback reference">
        {data?.history.length ? (
          <Timeline reverse events={data.history.map((h) => ({ at: h.createdAt, source: String(h.metadata?.environment || 'flag'), title: h.description, by: h.adminId?.name, tone: h.metadata?.after ? 'success' : 'warning' }))} />
        ) : (
          <p className="text-sm text-muted-foreground">No flag changes recorded.</p>
        )}
      </Section>

      <ReasonDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          <>
            {pending?.enabled ? 'Enable' : 'Disable'} <span className="font-mono">{pending?.flag.key}</span>
          </>
        }
        description={`Takes effect for every user in ${data?.environment}.`}
        confirmLabel={pending?.enabled ? 'Enable flag' : 'Disable flag'}
        destructive={!pending?.enabled}
        onConfirm={(reason) => submit('flag_set', { key: pending!.flag.key, enabled: pending!.enabled }, reason)}
      />
    </div>
  );
}
