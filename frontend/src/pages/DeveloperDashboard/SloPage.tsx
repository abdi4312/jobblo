import { useEffect, useState } from 'react';
import { Flame, Gauge, Pencil, ShieldCheck, TriangleAlert } from 'lucide-react';
import { num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { Slo, SloStatus } from '../../api/developer';
import { useDevMe, useDevSlo, useUrlFilters } from '../../features/developer/hooks';
import { useSensitiveAction } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { ReasonDialog } from '../../components/developer/ReasonDialog';
import { Button } from '../../components/developer/ui/button';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const STATUS: Record<SloStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ok: { label: 'Healthy', tone: 'success' },
  at_risk: { label: 'At risk', tone: 'warning' },
  fast_burn: { label: 'Fast burn', tone: 'danger' },
  breached: { label: 'Breached', tone: 'danger' },
  no_data: { label: 'No data', tone: 'neutral' },
};
const pct = (v: number | null, d = 2) => (v === null ? '—' : `${v.toFixed(d)}%`);
const burn = (v: number | null) => (v === null ? '—' : `${v.toFixed(v >= 10 ? 0 : 1)}×`);

function BudgetBar({ remaining }: { remaining: number | null }) {
  const v = remaining === null ? 0 : Math.max(0, Math.min(100, remaining));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={`Error budget remaining ${pct(remaining, 0)}`}>
      <div className={cn('h-full rounded-full transition-all', v > 50 ? 'bg-emerald-500' : v > 25 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${v}%` }} />
    </div>
  );
}

function SloCard({ s, active, onClick, fastBurn, slowBurn }: { s: Slo; active: boolean; onClick: () => void; fastBurn: number; slowBurn: number }) {
  const st = STATUS[s.status];
  return (
    <Card size="sm" className={cn('cursor-pointer gap-3 transition-colors hover:border-primary/40', active && 'border-primary ring-1 ring-primary/30', (s.status === 'breached' || s.status === 'fast_burn') && !active && 'border-red-300')} onClick={onClick}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{s.name}</div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
          </div>
          <StatusBadge status={st.label} tone={st.tone} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl font-semibold tabular-nums', s.sli !== null && s.sli < s.target && 'text-red-600')}>{pct(s.sli, s.target >= 99.9 ? 3 : 2)}</span>
          <span className="text-xs text-muted-foreground">target {s.target}%</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Error budget left</span>
            <span className="font-medium tabular-nums">{s.remaining === null ? '—' : s.remaining < 0 ? 'exhausted' : pct(s.remaining, 0)}</span>
          </div>
          <BudgetBar remaining={s.remaining} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Bad / allowed</div>
            <div className="tabular-nums">
              {num(s.bad)} / {num(Math.floor(s.budget))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Burn 1 h</div>
            <div className={cn('tabular-nums', (s.burn1h ?? 0) >= fastBurn && 'font-semibold text-red-600')}>{burn(s.burn1h)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Burn 6 h</div>
            <div className={cn('tabular-nums', (s.burn6h ?? 0) >= slowBurn && 'font-semibold text-amber-600')}>{burn(s.burn6h)}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{num(s.total)} events in {s.windowDays} days</div>
      </CardContent>
    </Card>
  );
}

function TargetsDialog({ slos, open, onOpenChange }: { slos: Slo[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const submit = useSensitiveAction(['slo']);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setValues(Object.fromEntries(slos.map((s) => [s.key, String(s.target)])));
  }, [open, slos]);
  const changed = slos.filter((s) => values[s.key] !== undefined && Number(values[s.key]) !== s.target);
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change SLO targets"
      description="Targets between 90 and 99.999 %. A higher target means a smaller error budget and earlier alerts."
      confirmLabel={`Save ${changed.length || ''} target${changed.length === 1 ? '' : 's'}`.replace('  ', ' ')}
      canSubmit={changed.length > 0}
      onConfirm={(reason) => submit('slo_targets_set', { targets: Object.fromEntries(changed.map((s) => [s.key, Number(values[s.key])])) }, reason)}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {slos.map((s) => (
          <div key={s.key} className="space-y-1">
            <Label htmlFor={`slo-${s.key}`} className="text-xs">
              {s.name} <span className="text-muted-foreground">(default {s.defaultTarget})</span>
            </Label>
            <Input id={`slo-${s.key}`} type="number" step="0.1" min={90} max={99.999} value={values[s.key] ?? ''} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />
          </div>
        ))}
      </div>
    </ReasonDialog>
  );
}

export default function SloPage() {
  const [f, setF] = useUrlFilters({ window: '30', slo: '' });
  const { data: me } = useDevMe();
  const { data, isLoading, error, refetch } = useDevSlo(Number(f.window));
  const [editing, setEditing] = useState(false);
  const slos = data?.slos || [];
  const selected = slos.find((s) => s.key === f.slo) || slos.find((s) => s.status === 'breached' || s.status === 'fast_burn') || slos[0];
  const count = (...st: SloStatus[]) => slos.filter((s) => st.includes(s.status)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="SLOs & Error Budgets"
        description="Service level objectives measured on real traffic. The error budget is how many bad events the window can absorb before the objective is missed; the burn rate is how fast it is being spent (1× = exactly on budget). A 1-hour burn of 14.4× or more opens an incident."
        actions={
          <>
            <Tabs value={f.window} onValueChange={(window) => setF({ window })}>
              <TabsList>
                <TabsTrigger value="7">7 d</TabsTrigger>
                <TabsTrigger value="14">14 d</TabsTrigger>
                <TabsTrigger value="30">30 d</TabsTrigger>
              </TabsList>
            </Tabs>
            {(me?.can.request || me?.can.execute) && (
              <Button size="sm" variant="outline" className="bg-card" disabled={!slos.length} onClick={() => setEditing(true)}>
                <Pencil /> Targets
              </Button>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Meeting objective" icon={<ShieldCheck />} tone={count('breached') ? 'warning' : 'success'} loading={isLoading} value={`${count('ok', 'at_risk', 'fast_burn')} / ${slos.length - count('no_data')}`} hint={count('no_data') ? `${count('no_data')} without data` : 'with data'} />
        <StatCard label="Breached" icon={<TriangleAlert />} tone={count('breached') ? 'danger' : 'success'} loading={isLoading} value={count('breached')} hint={slos.filter((s) => s.status === 'breached').map((s) => s.name).join(', ') || 'none'} />
        <StatCard label="Burning fast" icon={<Flame />} tone={count('fast_burn') ? 'danger' : 'success'} loading={isLoading} value={count('fast_burn')} hint={`1 h burn ≥ ${data?.fastBurn ?? 14.4}×`} />
        <StatCard label="At risk" icon={<Gauge />} tone={count('at_risk') ? 'warning' : 'success'} loading={isLoading} value={count('at_risk')} hint={`≤ 25 % budget left or 6 h burn ≥ ${data?.slowBurn ?? 6}×`} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {slos.map((s) => (
            <SloCard key={s.key} s={s} active={selected?.key === s.key} onClick={() => setF({ slo: s.key })} fastBurn={data!.fastBurn} slowBurn={data!.slowBurn} />
          ))}
        </div>
      )}

      {selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title={`${selected.name}: budget burn-down`} description={`Error budget left over the ${selected.windowDays}-day window, day by day. Crossing 0 % means the objective is missed.`}>
            <TimeSeriesChart
              data={selected.series.map((p) => ({ t: p.t, remaining: p.remaining === null ? null : Math.max(-100, p.remaining) }))}
              bucketMs={86_400_000}
              height={220}
              series={[{ key: 'remaining', label: 'Budget left %', color: 'var(--chart-1)' }]}
              valueFormatter={(v) => `${v}%`}
            />
          </Section>
          <Section title={`${selected.name}: daily SLI`} description={`Share of good events per day against the ${selected.target}% target.`}>
            <TimeSeriesChart
              data={selected.series.map((p) => ({ t: p.t, sli: p.sli === null ? null : Number(p.sli.toFixed(3)), target: selected.target }))}
              bucketMs={86_400_000}
              height={220}
              series={[
                { key: 'sli', label: 'SLI %', color: 'var(--chart-2)' },
                { key: 'target', label: 'Target %', color: 'var(--chart-5)' },
              ]}
              valueFormatter={(v) => `${v}%`}
            />
          </Section>
        </div>
      )}

      <TargetsDialog slos={slos} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
