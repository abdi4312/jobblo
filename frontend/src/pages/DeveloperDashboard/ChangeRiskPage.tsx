import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, GitBranch, ShieldQuestion, UserCog } from 'lucide-react';
import { ago } from '@/lib/devFormat';
import { devApi, type RiskAssessment, type RiskOverview } from '../../api/developer';
import { useDevRisk } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { RiskBadge, RiskFactors } from '../../components/developer/StepUp';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

type Kind = 'deployment' | 'role' | 'stripe_mode';
const ROLES = ['user', 'provider', 'company', 'developer', 'superAdmin'];

function Preview() {
  const [kind, setKind] = useState<Kind>('deployment');
  const [ref, setRef] = useState('main');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('developer');
  const [mode, setMode] = useState<'live' | 'test'>('live');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RiskAssessment | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      setResult(await devApi.riskAssess(kind === 'deployment' ? { kind, ref } : kind === 'role' ? { kind, userId: userId.trim(), role } : { kind, mode }));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Check a change before applying it" description="Nothing is applied here. Console actions (IP blocks, flags, thresholds, SLOs, access) are scored automatically when submitted; a critical score needs an explicit confirmation.">
      <Tabs
        value={kind}
        onValueChange={(k) => {
          setKind(k as Kind);
          setResult(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="deployment"><GitBranch /> Deployment</TabsTrigger>
          <TabsTrigger value="role"><UserCog /> Role change</TabsTrigger>
          <TabsTrigger value="stripe_mode"><CreditCard /> Stripe mode</TabsTrigger>
        </TabsList>
      </Tabs>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {kind === 'deployment' && (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Branch, tag or commit to deploy (compared with the running commit)
            <Input value={ref} onChange={(e) => setRef(e.target.value)} className="w-72 font-mono" />
          </label>
        )}
        {kind === 'role' && (
          <>
            <label className="grid gap-1 text-xs text-muted-foreground">
              User id
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="24-character id" className="w-64 font-mono" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              New role
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </>
        )}
        {kind === 'stripe_mode' && (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Switch Stripe to
            <select value={mode} onChange={(e) => setMode(e.target.value as 'live' | 'test')} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="live">live</option>
              <option value="test">test</option>
            </select>
          </label>
        )}
        <Button type="submit" size="sm" disabled={busy || (kind === 'role' && !/^[a-f0-9]{24}$/i.test(userId.trim()))}>
          <ShieldQuestion /> {busy ? 'Scoring…' : 'Score the risk'}
        </Button>
      </form>
      {result && (
        <div className="mt-4 space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk={result} />
            <span className="font-medium">{result.subject}</span>
          </div>
          {result.diff && (
            <p className="text-xs text-muted-foreground">
              {result.diff.error || `${result.diff.files} file(s), ${result.diff.lines} line(s) changed (${result.diff.source})`}
              {result.ci && <> · CI: <a href={result.ci.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{result.ci.conclusion}</a></>}
            </p>
          )}
          <RiskFactors risk={result} />
        </div>
      )}
    </Section>
  );
}

export default function ChangeRiskPage() {
  const { data, isLoading, error, refetch } = useDevRisk();
  const cols: Column<RiskOverview['requests'][number]>[] = [
    { key: 'r', header: 'Risk', cell: (r) => <RiskBadge risk={r.risk} /> },
    { key: 's', header: 'Change', className: 'max-w-[420px]', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.summary}</div><div className="truncate text-xs text-muted-foreground">{'direct' in r && r.direct ? 'Applied directly by a Super Admin — reasons at the time are in Audit' : r.risk.factors.slice(0, 2).map((f) => f.why).join(' · ') || 'no risk factors'}</div></div> },
    { key: 'st', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'b', header: 'Requested by', cell: (r) => <span className="text-xs">{r.requestedBy?.name || '—'}</span> },
    { key: 'w', header: 'When', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.createdAt)}</span> },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Change Risk"
        description="A 0–100 risk score with the reasons, before a change is applied: what the change touches (money, sign-in, access, the database, infrastructure) plus the situation right now (open incidents, burning error budgets, blocked quality gates, Friday afternoon). Scores are hand-tuned weights — a prompt to think, not a verdict."
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <Section title="Risk of changing anything right now" description="Added to every change scored below." action={data ? <RiskBadge risk={data.now} /> : null}>
        {data ? <RiskFactors risk={data.now} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
      </Section>
      <Preview />
      <Section title="Recent console changes" description="Sensitive actions as they were scored when submitted.">
        <DataTable columns={cols} rows={data?.requests} loading={isLoading} rowKey={(r) => r._id} emptyTitle="No scored changes yet" />
      </Section>
    </div>
  );
}
