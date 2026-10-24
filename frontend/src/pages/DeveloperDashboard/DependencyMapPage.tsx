import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  CircleCheck,
  CircleSlash,
  CircleX,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { ago, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import {
  devApi,
  type DependencyInfo,
  type DepNode,
  type DepStatus,
  type ExternalService,
} from '../../api/developer';
import {
  useDevDependencies,
  useDevExternalServices,
  useUrlFilters,
} from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import {
  ErrorState,
  PageHeader,
  Section,
  StatCard,
  StatusBadge,
} from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/developer/ui/sheet';
import { Badge } from '../../components/developer/ui/badge';
import { Card, CardContent } from '../../components/developer/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';

/* Hand-placed layout: requests flow left → right (clients → proxy → API → data / external). */
const W = 1100;
const H = 600;
const NW = 156;
const NH = 40;
const POS: Record<string, [number, number]> = {
  web: [95, 230],
  mobile: [95, 370],
  stripeWebhooks: [760, 120],
  nginx: [300, 300],
  realtime: [520, 130],
  api: [520, 300],
  scheduler: [520, 470],
  mongo: [760, 250],
  blob: [760, 360],
  backups: [760, 490],
  stripe: [990, 50],
  smtp: [990, 108],
  fcm: [990, 166],
  idura: [990, 224],
  vipps: [990, 282],
  google: [990, 340],
  openai: [990, 398],
  github: [990, 456],
  slack: [990, 514],
};
const GROUP_LABELS: [string, number][] = [
  ['Clients', 95],
  ['Edge', 300],
  ['Platform', 520],
  ['Data', 760],
  ['External services', 990],
];

const TONE: Record<
  DepStatus,
  { node: string; dot: string; edge: string; badge: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  healthy: {
    node: 'stroke-emerald-400',
    dot: 'fill-emerald-500',
    edge: 'stroke-emerald-500/50',
    badge: 'success',
  },
  degraded: {
    node: 'stroke-amber-400',
    dot: 'fill-amber-500',
    edge: 'stroke-amber-500/80',
    badge: 'warning',
  },
  down: { node: 'stroke-red-500', dot: 'fill-red-500', edge: 'stroke-red-500', badge: 'danger' },
  unknown: {
    node: 'stroke-border',
    dot: 'fill-muted-foreground/50',
    edge: 'stroke-muted-foreground/30',
    badge: 'neutral',
  },
  off: {
    node: 'stroke-border',
    dot: 'fill-muted-foreground/25',
    edge: 'stroke-muted-foreground/20',
    badge: 'neutral',
  },
};

function edgePath(from: string, to: string) {
  const a = POS[from];
  const b = POS[to];
  if (!a || !b) return null;
  // Leave from the side facing the target; horizontal-ish cubic curve.
  const dir = b[0] >= a[0] ? 1 : -1;
  const sx = a[0] + (dir * NW) / 2;
  const ex = b[0] - (dir * NW) / 2;
  if (Math.abs(a[0] - b[0]) < 1) {
    const sy = a[1] + (b[1] > a[1] ? NH / 2 : -NH / 2);
    const ey = b[1] - (b[1] > a[1] ? NH / 2 : -NH / 2);
    return `M${a[0]},${sy} L${b[0]},${ey}`;
  }
  const mx = (sx + ex) / 2;
  return `M${sx},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${ex},${b[1]}`;
}

function DependencyGraph({
  data,
  selected,
  onSelect,
}: {
  data: DependencyInfo;
  selected: string | null;
  onSelect: (n: DepNode) => void;
}) {
  const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const related = (e: { from: string; to: string }) =>
    !selected || e.from === selected || e.to === selected;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full min-w-[900px] select-none"
      role="img"
      aria-label="System dependency map"
    >
      <defs>
        <marker
          id="dep-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground/50" />
        </marker>
      </defs>
      {GROUP_LABELS.map(([label, x]) => (
        <text
          key={label}
          x={x}
          y={14}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] font-medium tracking-wider uppercase"
        >
          {label}
        </text>
      ))}
      {data.edges.map((e) => {
        const d = edgePath(e.from, e.to);
        const target = byId[e.to];
        if (!d || !target) return null;
        const tone = TONE[target.status];
        return (
          <path
            key={`${e.from}>${e.to}`}
            d={d}
            fill="none"
            strokeWidth={target.status === 'down' ? 2 : 1.4}
            strokeDasharray={
              target.status === 'off' || target.status === 'unknown' ? '4 4' : undefined
            }
            markerEnd="url(#dep-arrow)"
            className={cn(tone.edge, 'transition-opacity', !related(e) && 'opacity-10')}
          />
        );
      })}
      {data.nodes.map((n) => {
        const p = POS[n.id];
        if (!p) return null;
        const tone = TONE[n.status];
        const active = selected === n.id;
        const dim =
          selected &&
          !active &&
          !data.edges.some(
            (e) => (e.from === selected && e.to === n.id) || (e.to === selected && e.from === n.id)
          );
        return (
          <g
            key={n.id}
            transform={`translate(${p[0] - NW / 2},${p[1] - NH / 2})`}
            className={cn('cursor-pointer transition-opacity', dim && 'opacity-30')}
            onClick={() => onSelect(n)}
          >
            <title>{`${n.name}: ${n.status}`}</title>
            <rect
              width={NW}
              height={NH}
              rx={6}
              strokeWidth={active ? 2 : 1.2}
              className={cn(
                'fill-card',
                active ? 'stroke-primary' : tone.node,
                n.status === 'off' && 'fill-muted/40'
              )}
            />
            <circle cx={14} cy={NH / 2} r={4.5} className={tone.dot} />
            <text
              x={26}
              y={NH / 2 + 4}
              className={cn(
                'text-[12px] font-medium',
                n.status === 'off' ? 'fill-muted-foreground' : 'fill-foreground'
              )}
            >
              {n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const EXT_TONE: Record<ExternalService['status'], string> = {
  healthy: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  degraded: 'text-amber-700 border-amber-200 bg-amber-50',
  throttled: 'text-red-700 border-red-200 bg-red-50',
  idle: 'text-muted-foreground',
  off: 'text-muted-foreground',
};
const msText = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`;

/** Outbound calls to third parties: latency, failures, rate limits and quota headroom. */
function ExternalServices({ hours }: { hours: number }) {
  const { data, isLoading, error, refetch } = useDevExternalServices(hours);
  const [selected, setSelected] = useState('stripe');
  const s = data?.services.find((x) => x.key === selected) || data?.services[0];
  const opCols: Column<ExternalService['ops'][number]>[] = [
    {
      key: 'o',
      header: 'Operation',
      cell: (o) => <span className="font-mono text-xs">{o.op}</span>,
    },
    {
      key: 'c',
      header: 'Calls',
      align: 'right',
      cell: (o) => <span className="tabular-nums">{num(o.calls)}</span>,
    },
    {
      key: 'f',
      header: 'Failed',
      align: 'right',
      cell: (o) => (
        <span className={cn('tabular-nums', o.failed > 0 && 'font-medium text-red-600')}>
          {o.failed || '—'}
        </span>
      ),
    },
    {
      key: 'r',
      header: 'Rate-limited',
      align: 'right',
      cell: (o) => (
        <span className={cn('tabular-nums', o.rateLimited > 0 && 'font-medium text-red-600')}>
          {o.rateLimited || '—'}
        </span>
      ),
    },
    {
      key: 'a',
      header: 'Avg',
      align: 'right',
      cell: (o) => <span className="text-xs tabular-nums">{msText(o.avgMs)}</span>,
    },
    {
      key: 'p',
      header: 'p95',
      align: 'right',
      cell: (o) => <span className="text-xs tabular-nums">{msText(o.p95)}</span>,
    },
  ];
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(data?.services || []).map((x) => (
          <Card
            key={x.key}
            size="sm"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelected(x.key)}
            className={cn(
              'cursor-pointer gap-2 transition-colors hover:border-primary/40',
              s?.key === x.key && 'border-primary ring-1 ring-primary/30'
            )}
            onClick={() => setSelected(x.key)}
          >
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{x.name}</span>
                <Badge variant="outline" className={cn('shrink-0 capitalize', EXT_TONE[x.status])}>
                  {x.status === 'off'
                    ? 'not configured'
                    : x.status === 'idle'
                      ? 'no calls'
                      : x.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div>
                  <div className="text-muted-foreground">Calls</div>
                  <div className="font-medium tabular-nums">{num(x.calls)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Failed</div>
                  <div
                    className={cn(
                      'font-medium tabular-nums',
                      (x.errorRate ?? 0) >= 5 && 'text-red-600'
                    )}
                  >
                    {x.errorRate === null ? '—' : `${x.errorRate}%`}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">p95</div>
                  <div className="font-medium tabular-nums">{msText(x.p95)}</div>
                </div>
              </div>
              {x.quota && (
                <div title={`${x.quota.used} ${x.quota.unit} of ${x.quota.limit}`}>
                  <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{x.quota.label}</span>
                    <span className="tabular-nums">{x.quota.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full',
                        (x.quota.pct ?? 0) >= 80
                          ? 'bg-red-500'
                          : (x.quota.pct ?? 0) >= 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, x.quota.pct ?? 0)}%` }}
                    />
                  </div>
                </div>
              )}
              {x.rateLimited > 0 && (
                <p className="text-xs font-medium text-red-600">{x.rateLimited} rate-limited</p>
              )}
            </CardContent>
          </Card>
        ))}
        {isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      {s && (
        <>
          <Section
            title={s.name}
            description={`${s.usedFor}${s.probe ? ' Measured by a synthetic probe every few minutes, not live traffic.' : ''}`}
          >
            <TimeSeriesChart
              data={s.series}
              bucketMs={data?.bucketMs}
              height={200}
              variant="bar"
              series={[
                { key: 'calls', label: 'Calls', color: 'var(--chart-1)' },
                { key: 'errors', label: 'Failed', color: 'var(--chart-5)' },
                { key: 'rateLimited', label: 'Rate-limited', color: 'var(--chart-4)' },
              ]}
            />
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>
                Average <b className="text-foreground">{msText(s.avgMs)}</b>
              </span>
              <span>
                Slowest <b className="text-foreground">{msText(s.maxMs || null)}</b>
              </span>
              <span>
                4xx (our side) <b className="text-foreground">{num(s.clientErrors)}</b>
              </span>
              <span>
                {s.quota ? (
                  <>
                    Quota{' '}
                    <b className="text-foreground">
                      {num(s.quota.used)} / {num(s.quota.limit)}
                    </b>{' '}
                    {s.quota.unit}
                  </>
                ) : (
                  'No quota known'
                )}
              </span>
            </div>
            {s.lastError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                Last failure {ago(s.lastErrorAt)}: <span className="font-mono">{s.lastError}</span>
              </p>
            )}
          </Section>
          <Section title="Operations">
            <DataTable
              columns={opCols}
              rows={s.ops}
              loading={isLoading}
              rowKey={(o) => o.op}
              emptyTitle={
                s.configured ? 'No calls in this period' : 'Not configured in this environment'
              }
            />
          </Section>
        </>
      )}
    </div>
  );
}

export default function DependencyMapPage() {
  const [f, setF] = useUrlFilters({ view: 'map', hours: '24' });
  const { data, isLoading, error, refetch } = useDevDependencies();
  const qc = useQueryClient();
  const [open, setOpen] = useState<DepNode | null>(null);
  const [checking, setChecking] = useState(false);
  const count = (s: DepStatus) => data?.nodes.filter((n) => n.status === s).length ?? 0;
  const neighbours = (id: string, dir: 'from' | 'to') =>
    (data?.edges || [])
      .filter((e) => e[dir] === id)
      .map((e) => data!.nodes.find((n) => n.id === (dir === 'from' ? e.to : e.from)))
      .filter(Boolean) as DepNode[];

  const runChecks = async () => {
    setChecking(true);
    try {
      qc.setQueryData(['dev', 'dependencies'], await devApi.dependencies(true));
      toast.success('Live checks finished');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const columns: Column<DepNode>[] = [
    {
      key: 'status',
      header: 'Status',
      cell: (n) => <StatusBadge status={n.status} tone={TONE[n.status].badge} />,
    },
    {
      key: 'name',
      header: 'Component',
      cell: (n) => <span className="font-medium">{n.name}</span>,
    },
    {
      key: 'group',
      header: 'Layer',
      cell: (n) => <span className="text-xs capitalize text-muted-foreground">{n.group}</span>,
    },
    {
      key: 'signal',
      header: 'Signals',
      className: 'max-w-[460px]',
      cell: (n) => (
        <span className="block truncate text-xs text-muted-foreground">
          {Object.entries(n.metrics)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ') || '—'}
        </span>
      ),
    },
  ];
  const order: DepStatus[] = ['down', 'degraded', 'unknown', 'healthy', 'off'];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dependency Map"
        description={
          f.view === 'external'
            ? 'Every call Jobblo makes to a third party (Stripe, email, push, OpenAI, geocoding): latency, failures, rate limiting and how close each quota is. Stripe and OpenAI are measured on every real call, email and push from the delivery log, geocoding by a probe.'
            : 'Everything Jobblo depends on and how it connects. Health combines live checks (cached 60 s: Mongo ping, Stripe balance read, SMTP login, blob container, OIDC discovery) with real traffic signals — APM, delivery logs, webhook health, synthetic probes and mobile telemetry. Click a component to see what breaks without it.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
              <TabsList>
                <TabsTrigger value="map">Map</TabsTrigger>
                <TabsTrigger value="external">External services</TabsTrigger>
              </TabsList>
            </Tabs>
            {f.view === 'external' ? (
              <Tabs value={f.hours} onValueChange={(hours) => setF({ hours })}>
                <TabsList>
                  <TabsTrigger value="24">24 h</TabsTrigger>
                  <TabsTrigger value="168">7 d</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                disabled={checking}
                onClick={runChecks}
              >
                <RefreshCw className={cn(checking && 'animate-spin')} />{' '}
                {checking ? 'Checking…' : 'Run live checks'}
              </Button>
            )}
          </div>
        }
      />
      {f.view === 'external' ? (
        <ExternalServices hours={Number(f.hours)} />
      ) : (
        <>
          {error && <ErrorState error={error} onRetry={() => refetch()} />}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Down"
              icon={<CircleX />}
              tone={count('down') ? 'danger' : 'success'}
              loading={isLoading}
              value={count('down')}
              hint={
                data?.nodes
                  .filter((n) => n.status === 'down')
                  .map((n) => n.name)
                  .join(', ') || 'none'
              }
            />
            <StatCard
              label="Degraded"
              icon={<TriangleAlert />}
              tone={count('degraded') ? 'warning' : 'success'}
              loading={isLoading}
              value={count('degraded')}
              hint={
                data?.nodes
                  .filter((n) => n.status === 'degraded')
                  .map((n) => n.name)
                  .join(', ') || 'none'
              }
            />
            <StatCard
              label="Healthy"
              icon={<CircleCheck />}
              tone="success"
              loading={isLoading}
              value={count('healthy')}
            />
            <StatCard
              label="No signal"
              icon={<Activity />}
              loading={isLoading}
              value={count('unknown')}
              hint="no traffic or probe yet"
            />
            <StatCard
              label="Not configured"
              icon={<CircleSlash />}
              loading={isLoading}
              value={count('off')}
              hint={data ? `checked ${ago(data.checkedAt)}` : ''}
            />
          </div>

          <Section
            title="Map"
            description="Arrows point from a component to what it needs. Edge colour = health of the component it points to; dashed = no signal or not configured."
            contentClassName="overflow-x-auto"
          >
            {data ? (
              <DependencyGraph data={data} selected={open?.id ?? null} onSelect={setOpen} />
            ) : (
              <Skeleton className="h-[480px] w-full" />
            )}
          </Section>

          <Section title="Components">
            <DataTable
              columns={columns}
              rows={
                data
                  ? [...data.nodes].sort(
                      (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
                    )
                  : undefined
              }
              loading={isLoading}
              rowKey={(n) => n.id}
              onRowClick={setOpen}
            />
          </Section>
        </>
      )}

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>{open?.name}</SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {open && <StatusBadge status={open.status} tone={TONE[open.status].badge} />}
              <span className="capitalize">{open?.group}</span>
            </SheetDescription>
          </SheetHeader>
          {open && (
            <div className="space-y-5 overflow-y-auto p-4 text-sm">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <div className="text-xs font-medium uppercase">If this fails</div>
                <p className="mt-1">{open.impact}</p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                  Signals
                </h4>
                {Object.keys(open.metrics).length ? (
                  <dl className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                    {Object.entries(open.metrics).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="break-words">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted-foreground">
                    {open.status === 'off'
                      ? 'Not configured in this environment.'
                      : 'No signal yet.'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['from', 'to'] as const).map((dir) => (
                  <div key={dir}>
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                      {dir === 'from' ? 'Depends on' : 'Used by'}
                    </h4>
                    <ul className="space-y-1">
                      {neighbours(open.id, dir).map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            className="flex items-center gap-2 hover:underline"
                            onClick={() => setOpen(n)}
                          >
                            <span
                              className={cn(
                                'size-2 rounded-full',
                                {
                                  healthy: 'bg-emerald-500',
                                  degraded: 'bg-amber-500',
                                  down: 'bg-red-500',
                                  unknown: 'bg-muted-foreground/50',
                                  off: 'bg-muted-foreground/25',
                                }[n.status]
                              )}
                            />
                            {n.name}
                          </button>
                        </li>
                      ))}
                      {!neighbours(open.id, dir).length && (
                        <li className="text-muted-foreground">—</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
