import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Calculator, Database, PiggyBank, Plus, Settings2, ShoppingCart, Trash2, TrendingUp, Users } from 'lucide-react';
import { bytes, money } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type CostConfig, type CostLine } from '../../api/developer';
import { useDevCosts, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { CountBars, ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Label } from '../../components/developer/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';

const KIND = { measured: 'From Stripe', metered: 'Usage × price', fixed: 'Fixed' } as const;
const thisMonth = () => new Date().toISOString().slice(0, 7);

function SettingsDialog({ config, open, onOpenChange }: { config: CostConfig; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [budget, setBudget] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [fixed, setFixed] = useState<{ name: string; category: string; monthlyNok: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setBudget(config.monthlyBudgetNok === null ? '' : String(config.monthlyBudgetNok));
    setPrices({ usdToNok: String(config.prices.usdToNok), bankIdPerAuthNok: String(config.prices.bankIdPerAuthNok), emailPerSendNok: String(config.prices.emailPerSendNok), blobPerGbMonthNok: String(config.prices.blobPerGbMonthNok) });
    setFixed(config.fixed.map((f) => ({ ...f, monthlyNok: String(f.monthlyNok) })));
  }, [open, config]);
  const save = async () => {
    setBusy(true);
    try {
      await devApi.saveCostConfig({
        monthlyBudgetNok: budget.trim() === '' ? null : Number(budget),
        fixed: fixed.filter((f) => f.name.trim()).map((f) => ({ name: f.name, category: f.category || 'Other', monthlyNok: Number(f.monthlyNok) })),
        prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Number(v)])),
      });
      toast.success('Cost settings saved');
      qc.invalidateQueries({ queryKey: ['dev', 'costs'] });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const PRICE_LABELS: [string, string][] = [
    ['usdToNok', 'USD → NOK rate'],
    ['bankIdPerAuthNok', 'BankID per verification (NOK)'],
    ['emailPerSendNok', 'Email per send (NOK)'],
    ['blobPerGbMonthNok', 'Blob storage per GB-month (NOK)'],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cost settings</DialogTitle>
          <DialogDescription>Fixed monthly costs, unit prices and the monthly budget. Check prices against real invoices; every change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="cost-budget">Monthly budget (NOK, empty = none)</Label>
            <Input id="cost-budget" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className="max-w-48" />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium">Fixed monthly costs</h4>
            <div className="space-y-2">
              {fixed.map((f, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_auto] gap-2">
                  <Input aria-label="Name" placeholder="VPS (Hetzner CX32)" value={f.name} onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label="Category" placeholder="Hosting" value={f.category} onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} />
                  <Input aria-label="NOK per month" type="number" min={0} value={f.monthlyNok} onChange={(e) => setFixed(fixed.map((x, j) => (j === i ? { ...x, monthlyNok: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setFixed(fixed.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFixed([...fixed, { name: '', category: 'Hosting', monthlyNok: '' }])}>
                <Plus /> Add fixed cost
              </Button>
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium">Unit prices</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRICE_LABELS.map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label htmlFor={`price-${k}`} className="text-xs">
                    {label}
                  </Label>
                  <Input id={`price-${k}`} type="number" min={0} step="0.01" value={prices[k] ?? ''} onChange={(e) => setPrices({ ...prices, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">OpenAI token prices per model use list prices ({Object.keys(config.prices.aiModels).filter((m) => m !== 'default').join(', ')}).</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CostsPage() {
  const [f, setF] = useUrlFilters({ month: '' });
  const { data: me } = useDevMe();
  const { data, isLoading, error, refetch } = useDevCosts(f.month || undefined);
  const [editing, setEditing] = useState(false);
  const canEdit = Boolean(me?.can.request || me?.can.execute);
  const overBudget = data?.budgetNok !== null && data?.budgetNok !== undefined && data.projectedNok > data.budgetNok;
  const delta = data && data.previous.totalNok ? ((data.totalNok - data.previous.totalNok) / data.previous.totalNok) * 100 : null;
  const margin = data ? data.income.platformFeesNok - data.totalNok : null;

  const columns: Column<CostLine>[] = [
    { key: 'name', header: 'Cost', cell: (l) => <div className="min-w-0"><div className="font-medium">{l.name}{l.excluded && <Badge variant="outline" className="ml-2">not counted</Badge>}</div><div className="truncate text-xs text-muted-foreground" title={l.detail}>{l.detail}</div></div> },
    { key: 'cat', header: 'Category', cell: (l) => <span className="text-xs">{l.category}</span> },
    { key: 'kind', header: 'Source', cell: (l) => <Badge variant="secondary">{KIND[l.kind]}</Badge> },
    { key: 'so', header: data?.complete ? 'Month' : 'So far', align: 'right', cell: (l) => <span className={cn('tabular-nums', l.excluded && 'text-muted-foreground line-through')}>{money(l.nok)}</span> },
    { key: 'proj', header: 'Projected', align: 'right', cell: (l) => <span className={cn('tabular-nums', l.excluded ? 'text-muted-foreground line-through' : 'font-medium')}>{money(l.projectedNok)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost Center"
        description="Monthly infrastructure cost in NOK: Stripe fees read from Stripe, usage-based costs from what the platform actually used (AI tokens, BankID, email, storage) × unit price, and fixed costs you enter. Projections scale usage to month end."
        actions={
          <>
            <Input type="month" aria-label="Month" value={f.month || thisMonth()} max={thisMonth()} onChange={(e) => setF({ month: e.target.value === thisMonth() ? '' : e.target.value })} className="h-8 w-40 bg-card" />
            {canEdit && (
              <Button size="sm" variant="outline" className="bg-card" disabled={!data} onClick={() => setEditing(true)}>
                <Settings2 /> Settings
              </Button>
            )}
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={data?.complete ? 'Month total' : 'Spent so far'} icon={<Banknote />} loading={isLoading} value={money(data?.totalNok)} hint={delta === null ? `${data?.previous.month ?? ''}: ${money(data?.previous.totalNok)}` : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% vs ${data?.previous.month}`} />
        <StatCard label="Projected month end" icon={<TrendingUp />} tone={overBudget ? 'danger' : 'neutral'} loading={isLoading} value={money(data?.projectedNok)} hint={data?.budgetNok !== null && data?.budgetNok !== undefined ? `budget ${money(data.budgetNok)}${overBudget ? ' — over' : ''}` : 'no budget set'} />
        <StatCard label="Platform fee income" icon={<PiggyBank />} tone={margin !== null && margin < 0 ? 'warning' : 'success'} loading={isLoading} value={money(data?.income.platformFeesNok)} hint={margin === null ? '' : `${margin >= 0 ? 'covers costs by' : 'short by'} ${money(Math.abs(margin))}`} />
        <StatCard label="Cost per order" icon={<ShoppingCart />} loading={isLoading} value={money(data?.units.costPerOrder)} hint={`${data?.units.ordersCompleted ?? 0} completed orders`} />
        <StatCard label="Cost per active user" icon={<Users />} loading={isLoading} value={money(data?.units.costPerActiveUser)} hint={`${data?.units.activeUsers ?? 0} users active`} />
        <StatCard label="Database size" icon={<Database />} loading={isLoading} value={bytes(data?.database ? data.database.storageBytes + data.database.indexBytes : null)} hint={data?.database ? `data ${bytes(data.database.dataBytes)} · indexes ${bytes(data.database.indexBytes)}` : ''} />
      </div>

      {data && !data.config.fixed.length && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Calculator className="mr-1.5 inline size-4" />
          No fixed costs entered yet — add the VPS, domains, app-store fees and any Atlas tier under <b>Settings</b> so totals reflect the real bill.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Section title={`Cost lines · ${data?.month ?? ''}`} description={data?.complete ? 'Closed month: actuals.' : 'Projected = usage so far scaled to the full month; fixed costs count in full.'}>
          <DataTable columns={columns} rows={data?.lines} loading={isLoading} rowKey={(l) => l.key} />
        </Section>
        <div className="space-y-4">
          <Section title="By category" description="Projected month end, NOK.">
            <CountBars counts={Object.fromEntries(Object.entries(data?.byCategory || {}).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]))} />
          </Section>
          <Section title="Last month" description={data?.previous.month}>
            <CountBars counts={Object.fromEntries(Object.entries(data?.previous.byCategory || {}).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]))} />
          </Section>
        </div>
      </div>

      {data && <SettingsDialog config={data.config} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}
