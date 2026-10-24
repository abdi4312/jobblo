import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart';
import { EmptyState } from './kit';
import { tick } from '@/lib/devFormat';

export interface SeriesDef {
  key: string;
  label: string;
  color: string; // a CSS color, normally var(--chart-N)
}

/** Area (default) or stacked bar chart over a time-bucketed series. */
export function TimeSeriesChart({
  data,
  series,
  bucketMs = 3_600_000,
  height = 220,
  variant = 'area',
  valueFormatter,
}: {
  data: Record<string, unknown>[] | undefined;
  series: SeriesDef[];
  bucketMs?: number;
  height?: number;
  variant?: 'area' | 'bar';
  valueFormatter?: (v: number) => string;
}) {
  if (!data?.length) return <EmptyState title="No data in this range" description="Data appears here once traffic is recorded." />;
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const fmt = tick(bucketMs);
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey="t" tickFormatter={fmt} tickLine={false} axisLine={false} minTickGap={32} fontSize={11} />
      <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={valueFormatter} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmt(p?.[0]?.payload?.t)} />} />
      {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  );
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      {variant === 'bar' ? (
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          {axes}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={`var(--color-${s.key})`} radius={i === series.length - 1 ? [2, 2, 0, 0] : 0} />
          ))}
        </BarChart>
      ) : (
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.25} />
                <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {axes}
          {series.map((s) => (
            <Area key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={1.5} fill={`url(#fill-${s.key})`} />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  );
}
