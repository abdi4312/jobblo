import { Link } from 'react-router-dom';
import { Briefcase, Handshake, Inbox, UserCheck, Users } from 'lucide-react';
import { ago, money, num, pct } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type { MarketSegment, MarketVerdict, MarketplaceInfo } from '../../api/developer';
import { useDevMarketplace, useUrlFilters } from '../../features/developer/hooks';
import { EmptyState, ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const VERDICT: Record<MarketVerdict, { label: string; className: string; why: string }> = {
  healthy: { label: 'Healthy', className: 'text-emerald-700 border-emerald-200 bg-emerald-50', why: 'Most jobs get applicants and a fair share are hired.' },
  undersupplied: { label: 'Needs providers', className: 'text-red-700 border-red-200 bg-red-50', why: 'Under half the jobs get an applicant, or over 30 % sit unanswered for 48 h.' },
  oversupplied: { label: 'Too many providers', className: 'text-amber-700 border-amber-200 bg-amber-50', why: 'Over 8 applicants per job but under 20 % hired: providers compete for little work.' },
  low_conversion: { label: 'Low hiring', className: 'text-amber-700 border-amber-200 bg-amber-50', why: 'Applicants arrive but under 15 % of jobs end in a hire.' },
  thin: { label: 'Too little data', className: 'text-muted-foreground', why: 'Fewer than 3 jobs posted in this period.' },
};

function columns(first: string): Column<MarketSegment>[] {
  return [
    { key: 'k', header: first, cell: (s) => <span className="font-medium">{s.key}</span> },
    { key: 'v', header: 'Health', cell: (s) => <Badge variant="outline" className={VERDICT[s.verdict].className} title={VERDICT[s.verdict].why}>{VERDICT[s.verdict].label}</Badge> },
    { key: 'p', header: 'Jobs', align: 'right', cell: (s) => <span className="tabular-nums">{num(s.posted)}</span> },
    { key: 'a', header: 'Got applicant', align: 'right', cell: (s) => <span className={cn('tabular-nums', s.applicantRate !== null && s.applicantRate < 50 && 'font-medium text-red-600')}>{pct(s.applicantRate)}</span> },
    { key: 'apj', header: 'Apps / job', align: 'right', cell: (s) => <span className="tabular-nums">{s.appsPerJob}</span> },
    { key: 'pr', header: 'Providers', align: 'right', cell: (s) => <span className="tabular-nums">{num(s.providers)}</span> },
    { key: 'h', header: 'Hired', align: 'right', cell: (s) => <span className="tabular-nums">{pct(s.hireRate)}</span> },
    { key: 'f', header: 'First applicant', align: 'right', cell: (s) => <span className="tabular-nums text-xs">{s.medianFirstAppHours === null ? '—' : s.medianFirstAppHours < 1 ? `${Math.round(s.medianFirstAppHours * 60)} min` : `${s.medianFirstAppHours} h`}</span> },
    { key: 'u', header: 'Unanswered', align: 'right', cell: (s) => <span className={cn('tabular-nums', s.unanswered > 0 && 'font-medium text-red-600')}>{s.unanswered || '—'}</span> },
    { key: 'm', header: 'Median price', align: 'right', cell: (s) => <span className="tabular-nums text-xs">{money(s.medianPrice)}</span> },
  ];
}

export default function MarketplacePage() {
  const [f, setF] = useUrlFilters({ days: '30' });
  const { data, isLoading, error, refetch } = useDevMarketplace(Number(f.days));
  const t = data?.total;
  const unansweredCols: Column<MarketplaceInfo['unanswered'][number]>[] = [
    { key: 't', header: 'Job', cell: (j) => <Link to={`/developer/transactions?id=${j.id}`} className="font-medium text-primary hover:underline">{j.title}</Link> },
    { key: 'c', header: 'Category', cell: (j) => <span className="text-xs">{j.category || '—'}</span> },
    { key: 'r', header: 'Region', cell: (j) => <span className="text-xs">{j.region}</span> },
    { key: 'p', header: 'Price', align: 'right', cell: (j) => <span className="tabular-nums">{money(j.price)}</span> },
    { key: 'a', header: 'Waiting', align: 'right', cell: (j) => <span className="text-xs text-muted-foreground">{ago(j.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace Health"
        description="Supply vs demand for jobs posted in the period: do they get applicants, how fast, and do they end in a hire — per category and per county. Applications and hires are counted for those jobs whenever they happened."
        actions={
          <Tabs value={f.days} onValueChange={(days) => setF({ days })}>
            <TabsList>
              <TabsTrigger value="7">7 d</TabsTrigger>
              <TabsTrigger value="30">30 d</TabsTrigger>
              <TabsTrigger value="90">90 d</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Jobs posted" icon={<Briefcase />} loading={isLoading} value={num(t?.posted ?? 0)} hint={t?.medianPrice ? `median ${money(t.medianPrice)}` : undefined} />
        <StatCard label="Got an applicant" icon={<Inbox />} loading={isLoading} tone={!t || t.applicantRate === null ? 'neutral' : t.applicantRate >= 70 ? 'success' : t.applicantRate >= 50 ? 'warning' : 'danger'} value={pct(t?.applicantRate)} hint={t ? `${t.appsPerJob} applications per job` : undefined} />
        <StatCard label="Hired" icon={<Handshake />} loading={isLoading} value={pct(t?.hireRate)} hint={t ? `${num(t.hires)} jobs became orders` : undefined} />
        <StatCard label="Active providers" icon={<Users />} loading={isLoading} value={num(t?.providers ?? 0)} hint={data ? `${data.concentration.providersHired} got hired` : undefined} />
        <StatCard
          label="Top provider share"
          icon={<UserCheck />}
          loading={isLoading}
          tone={data?.concentration.topShare === null || data?.concentration.topShare === undefined ? 'neutral' : data.concentration.topShare > 50 ? 'warning' : 'success'}
          value={pct(data?.concentration.topShare)}
          hint={data?.concentration.top3Share !== null && data ? `top 3: ${pct(data.concentration.top3Share)} of hires` : 'of hires'}
        />
      </div>

      {data && !t ? (
        <EmptyState title="No jobs posted in this period" description="Pick a longer period." />
      ) : (
        <>
          <Section title="Liquidity" description="Jobs posted, applications sent and hires made over time.">
            <TimeSeriesChart
              data={data?.series}
              bucketMs={data?.bucketMs}
              height={200}
              variant="bar"
              series={[
                { key: 'posted', label: 'Jobs posted', color: 'var(--chart-1)' },
                { key: 'applications', label: 'Applications', color: 'var(--chart-2)' },
                { key: 'hires', label: 'Hires', color: 'var(--chart-4)' },
              ]}
            />
          </Section>
          <Section title="Categories" description="A job with several categories counts in each. Hover a health label for the rule.">
            <DataTable columns={columns('Category')} rows={data?.categories} loading={isLoading} rowKey={(s) => s.key} emptyTitle="No categories" />
            {data && data.emptyCategories.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                No jobs posted in: {data.emptyCategories.join(', ')} — no demand, or a category nobody finds.
              </p>
            )}
          </Section>
          <Section title="Regions" description="By county; jobs without a county fall back to the city on the listing.">
            <DataTable columns={columns('Region')} rows={data?.regions} loading={isLoading} rowKey={(s) => s.key} emptyTitle="No regions" />
          </Section>
          <Section title="Unanswered jobs" description="Open for over 48 hours without a single applicant — customers who may leave.">
            <DataTable columns={unansweredCols} rows={data?.unanswered} loading={isLoading} rowKey={(j) => j.id} emptyTitle="Every open job has an applicant" />
          </Section>
        </>
      )}
    </div>
  );
}
