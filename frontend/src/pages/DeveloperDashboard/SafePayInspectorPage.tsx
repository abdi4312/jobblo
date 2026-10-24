import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleAlert, CircleCheck, Search, Workflow } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { MachineInfo, MachineViolation } from '../../api/developer';
import { useDevSafePayMachine, useDevSafePayOrderMachine, useUrlFilters } from '../../features/developer/hooks';
import { ErrorState, IssueList, PageHeader, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';

/* Hand-placed layout of ORDER_TRANSITIONS: the happy path runs left → right. */
const W = 1000;
const H = 390;
const NODE_W = 132;
const NODE_H = 46;
const POS: Record<string, [number, number]> = {
  pending: [75, 205],
  accepted: [240, 115],
  awaiting_payment: [240, 295],
  declined: [75, 335],
  paid: [410, 205],
  in_progress: [580, 205],
  ready_for_review: [750, 205],
  completed: [920, 205],
  disputed: [750, 340],
  cancelled: [410, 50],
};
const label = (s: string) => s.replace(/_/g, ' ');

/** Point where the segment from the node centre towards (tx, ty) leaves the node box. */
function boxExit([cx, cy]: [number, number], tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  const s = Math.min(dx ? NODE_W / 2 / Math.abs(dx) : Infinity, dy ? NODE_H / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * s, cy + dy * s];
}

function edgePath(from: string, to: string) {
  const a = POS[from];
  const b = POS[to];
  if (!a || !b) return null;
  // Curve every edge a little; a reverse edge (b → a) curves to the other side.
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const bend = Math.min(40, len * 0.18);
  const [qx, qy] = [mx - ((b[1] - a[1]) / len) * bend, my + ((b[0] - a[0]) / len) * bend];
  const [sx, sy] = boxExit(a, qx, qy);
  const [ex, ey] = boxExit(b, qx, qy);
  return { d: `M${sx},${sy} Q${qx},${qy} ${ex},${ey}`, lx: (sx + 2 * qx + ex) / 4, ly: (sy + 2 * qy + ey) / 4 };
}

function StateDiagram({ data, selected, onSelect }: { data: MachineInfo; selected: string; onSelect: (s: string) => void }) {
  const observed = new Map(data.edges.map((e) => [`${e.from}>${e.to}`, e]));
  const allowed = data.states.flatMap((s) => s.next.map((to) => ({ from: s.status, to })));
  const illegal = data.edges.filter((e) => !e.legal);
  const max = Math.max(1, ...data.edges.map((e) => e.n));
  const touches = (e: { from: string; to: string }) => !selected || e.from === selected || e.to === selected;
  const violating = new Set(data.violations.map((v) => v.status));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[720px] select-none" role="img" aria-label="Order state machine">
      <defs>
        {(['muted', 'flow', 'bad'] as const).map((k) => (
          <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={k === 'bad' ? 'fill-red-500' : k === 'flow' ? 'fill-primary' : 'fill-muted-foreground/40'} />
          </marker>
        ))}
      </defs>
      {allowed.map((e) => {
        const p = edgePath(e.from, e.to);
        const o = observed.get(`${e.from}>${e.to}`);
        if (!p) return null;
        const dim = !touches(e);
        return (
          <g key={`${e.from}>${e.to}`} className={cn('transition-opacity', dim && 'opacity-15')}>
            <path
              d={p.d}
              fill="none"
              strokeWidth={o ? 1.5 + (Math.log(o.n + 1) / Math.log(max + 1)) * 3.5 : 1}
              strokeDasharray={o ? undefined : '4 4'}
              markerEnd={`url(#arrow-${o ? 'flow' : 'muted'})`}
              className={o ? 'stroke-primary/70' : 'stroke-muted-foreground/30'}
            >
              <title>{`${label(e.from)} → ${label(e.to)}: ${o ? `${o.n} order(s)` : 'allowed, not observed'}`}</title>
            </path>
            {o && (
              <text x={p.lx} y={p.ly - 4} textAnchor="middle" paintOrder="stroke" strokeWidth={4} className="fill-primary stroke-card text-[11px] font-medium tabular-nums">
                {o.n}
              </text>
            )}
          </g>
        );
      })}
      {illegal.map((e) => {
        const p = edgePath(e.from, e.to);
        if (!p) return null;
        return (
          <g key={`bad-${e.from}>${e.to}`} className={cn(!touches(e) && 'opacity-15')}>
            <path d={p.d} fill="none" strokeWidth={2.5} strokeDasharray="6 3" markerEnd="url(#arrow-bad)" className="stroke-red-500">
              <title>{`ILLEGAL ${label(e.from)} → ${label(e.to)}: ${e.n} order(s)`}</title>
            </path>
            <text x={p.lx} y={p.ly - 4} textAnchor="middle" paintOrder="stroke" strokeWidth={4} className="fill-red-600 stroke-card text-[11px] font-semibold">
              ✕ {e.n}
            </text>
          </g>
        );
      })}
      {data.states.map((s) => {
        const pos = POS[s.status];
        if (!pos) return null;
        const active = selected === s.status;
        return (
          <g key={s.status} transform={`translate(${pos[0] - NODE_W / 2},${pos[1] - NODE_H / 2})`} className="cursor-pointer" onClick={() => onSelect(active ? '' : s.status)}>
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={6}
              strokeWidth={active ? 2 : 1}
              className={cn(active ? 'fill-primary/10 stroke-primary' : 'fill-card stroke-border', violating.has(s.status) && !active && 'stroke-amber-500')}
            />
            {s.terminal && <rect x={3} y={3} width={NODE_W - 6} height={NODE_H - 6} rx={4} fill="none" className="stroke-border" />}
            <text x={NODE_W / 2} y={19} textAnchor="middle" className="fill-foreground text-[12px] font-medium capitalize">
              {label(s.status)}
            </text>
            <text x={NODE_W / 2} y={35} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
              {num(s.count)} order{s.count === 1 ? '' : 's'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function OrderView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading, error } = useDevSafePayOrderMachine(id);
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const o = data.order;
  return (
    <div className="space-y-4">
      <Section
        title={`Order · ${o.title || 'Untitled'}`}
        description={`${o._id} · ${o.agreedPrice ?? '—'} NOK · created ${dateTime(o.createdAt)}`}
        action={
          <span className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft /> Machine
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/developer/jobs?id=${o._id}`}>
                Job Diagnostics <ArrowUpRight />
              </Link>
            </Button>
          </span>
        }
      >
        <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Path through the machine</h4>
        {data.path.length ? (
          <ol className="flex flex-wrap items-center gap-1.5">
            {data.path.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i === 0 && s.from && <Badge variant="outline" className="capitalize">{label(s.from)}</Badge>}
                <span
                  className={cn('flex items-center text-xs', s.legal === false ? 'text-red-600' : 'text-muted-foreground')}
                  title={`${s.action}${s.at ? ` · ${dateTime(s.at)}` : ''}${s.legal === false ? ' · NOT ALLOWED' : ''}`}
                >
                  <ArrowRight className="size-3.5" />
                </span>
                <Badge variant={s.legal === false ? 'destructive' : 'secondary'} className="capitalize" title={s.action}>
                  {label(s.to)}
                </Badge>
              </li>
            ))}
            {data.path[data.path.length - 1]?.to !== o.status && (
              <li className="flex items-center gap-1.5">
                <ArrowRight className="size-3.5 text-amber-600" />
                <Badge variant="outline" className="border-amber-400 text-amber-700 capitalize">{label(o.status)} (unrecorded)</Badge>
              </li>
            )}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No status changes recorded in history — current status {label(o.status)}.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Allowed next: {data.next.length ? data.next.map(label).join(', ') : 'none (terminal)'}
        </p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Record states" description={`What each related record says while the order is ${label(o.status)}.`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-normal">Record</th>
                <th className="pb-2 font-normal">Actual</th>
                <th className="pb-2 font-normal">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Order</td>
                <td className="py-2"><StatusBadge status={o.status} /></td>
                <td className="py-2 text-xs text-muted-foreground">payment {o.paymentStatus}</td>
              </tr>
              {data.companions.map((c) => {
                const ok = !c.expected || c.expected.includes(c.actual);
                return (
                  <tr key={c.model}>
                    <td className="py-2">{c.model}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-1.5">
                        {ok ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleAlert className="size-4 text-red-600" />}
                        {c.actual ? <StatusBadge status={c.actual} /> : <span className="text-xs text-muted-foreground">none</span>}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{c.expected ? c.expected.map((x) => x ?? 'none').join(' / ') : 'any'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
        <Section title="Findings">
          <IssueList issues={data.issues} empty="This order follows the machine." />
        </Section>
      </div>

      <Section title="Timeline">
        <Timeline events={data.timeline} reverse />
      </Section>
    </div>
  );
}

export default function SafePayInspectorPage() {
  const [f, setF] = useUrlFilters({ order: '', state: '' });
  const [input, setInput] = useState('');
  const { data, isLoading, isFetching, error, refetch } = useDevSafePayMachine();
  const rows = useMemo(() => (data?.violations || []).filter((v) => !f.state || v.status === f.state), [data, f.state]);
  const illegal = data?.edges.filter((e) => !e.legal).reduce((a, e) => a + e.n, 0) || 0;
  const totalMoves = data?.edges.reduce((a, e) => a + e.n, 0) || 0;

  const columns: Column<MachineViolation>[] = [
    { key: 'sev', header: 'Severity', cell: (v) => <StatusBadge status={v.severity} /> },
    { key: 'code', header: 'Finding', cell: (v) => <span className="font-medium">{v.code.replace(/_/g, ' ')}</span> },
    { key: 'order', header: 'Order', cell: (v) => <div className="text-xs"><div className="truncate">{v.title || '—'}</div><div className="font-mono text-muted-foreground">{v.orderId}</div></div> },
    { key: 'status', header: 'Status', cell: (v) => <StatusBadge status={v.status} /> },
    { key: 'detail', header: 'Detail', className: 'max-w-[380px]', cell: (v) => <span className="block truncate text-xs text-muted-foreground" title={v.detail}>{v.detail}</span> },
    { key: 'at', header: 'Updated', align: 'right', cell: (v) => <span className="text-xs text-muted-foreground">{ago(v.at)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="SafePay State Machine"
        description="Every order checked against the transition table the code enforces (services/order/orderState.js): its path rebuilt from history, status changes that bypassed it, and whether Payment, SafePay history and Payout agree with the order. Read-only."
        actions={
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) setF({ order: input.trim() });
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Inspect order ID…" className="w-64 bg-card pl-8 font-mono text-xs" aria-label="Order ID" />
              </div>
            </form>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {f.order ? (
        <OrderView id={f.order} onBack={() => setF({ order: '' })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Orders checked" icon={<Workflow />} loading={isLoading} value={num(data?.scanned)} hint={data && data.scanned >= data.scanLimit ? `newest ${num(data.scanLimit)} only` : 'all orders'} />
            <StatCard label="Transitions observed" icon={<ArrowRight />} loading={isLoading} value={num(totalMoves)} hint={`${data?.edges.length ?? 0} distinct`} />
            <StatCard label="Illegal transitions" icon={<CircleAlert />} tone={illegal ? 'danger' : 'success'} loading={isLoading} value={num(illegal)} />
            <StatCard label="Orders off the machine" icon={<CircleAlert />} tone={data?.affectedOrders ? 'warning' : 'success'} loading={isLoading} value={num(data?.affectedOrders)} hint={Object.entries(data?.byCode || {}).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(' · ')} />
          </div>

          <Section
            title="Order states"
            description="Solid arrows: transitions orders actually took (thicker = more). Dashed grey: allowed but never seen. Red: taken but not allowed. Double border: terminal. Click a state to focus it."
            contentClassName="overflow-x-auto"
          >
            {data ? <StateDiagram data={data} selected={f.state} onSelect={(state) => setF({ state })} /> : <Skeleton className="h-80 w-full" />}
            {data?.unknownStates.length ? (
              <p className="mt-2 text-xs text-red-600">Statuses outside the machine: {data.unknownStates.map((s) => `${s.status} (${s.count})`).join(', ')}</p>
            ) : null}
          </Section>

          <Section title={f.state ? `Findings · ${label(f.state)}` : 'Findings'} description="Click a row to walk that order through the machine.">
            <DataTable columns={columns} rows={rows} loading={isLoading} rowKey={(v, i) => `${v.orderId}-${v.code}-${i}`} onRowClick={(v) => setF({ order: v.orderId })} emptyTitle="Every order follows the machine" />
          </Section>
        </>
      )}
    </div>
  );
}
