import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, Gauge, Network, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { ago, dateTime, ms, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import type {
  MobileErrorGroup,
  MobileInfo,
  MobileReleasesInfo,
  MobileReleaseStatus,
  RangeKey,
} from '../../api/developer';
import {
  useDevMobile,
  useDevMobileError,
  useDevMobileReleases,
  useUrlFilters,
} from '../../features/developer/hooks';
import {
  CountBars,
  EmptyState,
  ErrorState,
  PageHeader,
  RangeSelect,
  RefreshButton,
  Section,
  StatCard,
  StatusBadge,
} from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Badge } from '../../components/developer/ui/badge';
import { Skeleton } from '../../components/developer/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/developer/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(v === 100 ? 0 : 2)}%`);
const crashTone = (v: number | null) =>
  v === null ? 'neutral' : v >= 99.5 ? 'success' : v >= 98 ? 'warning' : 'danger';
const platformLabel = (p: string | null) =>
  p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : p || '—';

function ErrorSheet({ group, onClose }: { group: MobileErrorGroup | null; onClose: () => void }) {
  const { data, isLoading } = useDevMobileError(group?.fingerprint);
  const latest = data?.events[0];
  return (
    <Sheet open={Boolean(group)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="break-words">
            {group?.name}: {group?.message}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {group &&
              (group.fatal ? (
                <StatusBadge status="crash" tone="danger" />
              ) : (
                <StatusBadge status="handled" tone="warning" />
              ))}
            {group && <Badge variant="outline">{group.kind}</Badge>}
            <span>
              {num(group?.count)} events · {num(group?.installs)} devices · first{' '}
              {ago(group?.firstSeen)}
            </span>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto p-4">
          {isLoading && <Skeleton className="h-60 w-full" />}
          {latest?.stack && (
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">
                Latest stack trace
              </h4>
              <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {latest.stack}
              </pre>
            </div>
          )}
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">
              Occurrences
            </h4>
            <ul className="divide-y rounded-md border">
              {data?.events.map((e) => (
                <li
                  key={e._id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate">
                      {platformLabel(e.platform)} {e.osVersion} · {e.device || 'unknown device'} · v
                      {e.appVersion || '?'}
                      {e.build ? ` (${e.build})` : ''}
                    </div>
                    <div className="truncate text-muted-foreground">
                      {e.screen || 'unknown screen'}
                      {e.userId ? (
                        <>
                          {' · '}
                          <Link
                            to={`/developer/users?id=${e.userId._id}`}
                            className="text-primary hover:underline"
                          >
                            {e.userId.name}
                          </Link>
                        </>
                      ) : (
                        ' · signed out'
                      )}
                    </div>
                  </div>
                  <span className="text-muted-foreground" title={dateTime(e.at)}>
                    {ago(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const RELEASE_STATUS: Record<MobileReleaseStatus, { label: string; className: string }> = {
  latest: { label: 'Latest', className: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
  previous: { label: 'Previous', className: 'text-muted-foreground' },
  outdated: { label: 'Outdated', className: 'text-amber-700 border-amber-200 bg-amber-50' },
  unsupported: { label: 'Below minimum', className: 'text-red-700 border-red-200 bg-red-50' },
};

/** Release management: versions per platform, adoption of the newest, outdated/unsupported, API compatibility. */
function MobileReleases() {
  const [days, setDays] = useState('30');
  const { data, isLoading, error, refetch } = useDevMobileReleases(Number(days));
  const cols: Column<MobileReleasesInfo['versions'][number]>[] = [
    { key: 'v', header: 'Version', cell: (v) => <span className="font-medium">{v.version}</span> },
    {
      key: 'p',
      header: 'Platform',
      cell: (v) => <Badge variant="outline">{platformLabel(v.platform)}</Badge>,
    },
    {
      key: 's',
      header: 'Status',
      cell: (v) => (
        <Badge variant="outline" className={RELEASE_STATUS[v.status].className}>
          {RELEASE_STATUS[v.status].label}
          {v.behind > 0 ? ` · ${v.behind} behind` : ''}
        </Badge>
      ),
    },
    {
      key: 'sh',
      header: 'Devices (7 d)',
      align: 'right',
      cell: (v) => (
        <span className="tabular-nums">
          {num(v.installs)} <span className="text-xs text-muted-foreground">({v.share}%)</span>
        </span>
      ),
    },
    {
      key: 'cf',
      header: 'Crash-free',
      align: 'right',
      cell: (v) => (
        <span
          className={cn(
            'tabular-nums',
            crashTone(v.crashFree) === 'danger'
              ? 'text-red-600'
              : crashTone(v.crashFree) === 'warning'
                ? 'text-amber-600'
                : ''
          )}
        >
          {pct(v.crashFree)}
        </span>
      ),
    },
    {
      key: 'api',
      header: 'API failures / 100 sessions',
      align: 'right',
      cell: (v) => <span className="tabular-nums">{v.apiFailuresPer100 ?? '—'}</span>,
    },
    {
      key: 'b',
      header: 'Breaking API changes since',
      className: 'max-w-[280px] whitespace-normal',
      cell: (v) =>
        v.breakingSince ? (
          <span className="text-xs font-medium text-red-600" title={v.breakingRoutes.join('\n')}>
            {v.breakingSince} — {v.breakingRoutes.slice(0, 2).join(', ')}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">none</span>
        ),
    },
    {
      key: 'f',
      header: 'First seen',
      align: 'right',
      cell: (v) => (
        <span className="text-xs text-muted-foreground">
          {v.firstSeen ? dateTime(v.firstSeen) : '—'}
        </span>
      ),
    },
  ];
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Version in this repository (next build):{' '}
          <b className="text-foreground">{data?.repoVersion || 'unknown'}</b>. Minimum supported:
          iOS <b className="text-foreground">{data?.minVersion.ios || 'not set'}</b>, Android{' '}
          <b className="text-foreground">{data?.minVersion.android || 'not set'}</b>{' '}
          (MOBILE_MIN_VERSION[_IOS|_ANDROID]).
        </span>
        <Tabs value={days} onValueChange={setDays}>
          <TabsList>
            <TabsTrigger value="7">7 d</TabsTrigger>
            <TabsTrigger value="30">30 d</TabsTrigger>
            <TabsTrigger value="90">90 d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(data?.platforms || []).map((p) => (
          <div key={p.platform} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label={`${platformLabel(p.platform)} latest`}
              icon={<Smartphone />}
              loading={isLoading}
              value={p.latest || '—'}
              hint={`${num(p.installs)} devices (7 d)`}
            />
            <StatCard
              label="On latest"
              icon={<Users />}
              loading={isLoading}
              tone={
                p.onLatest === null
                  ? 'neutral'
                  : p.onLatest >= 80
                    ? 'success'
                    : p.onLatest >= 50
                      ? 'warning'
                      : 'danger'
              }
              value={p.onLatest === null ? '—' : `${p.onLatest}%`}
            />
            <StatCard
              label="Outdated"
              icon={<Gauge />}
              loading={isLoading}
              tone={(p.outdated ?? 0) > 20 ? 'warning' : 'success'}
              value={p.outdated === null ? '—' : `${p.outdated}%`}
              hint="2+ releases behind or below minimum"
            />
            <StatCard
              label="Below minimum"
              icon={<ShieldCheck />}
              loading={isLoading}
              tone={(p.unsupported ?? 0) > 0 ? 'danger' : 'success'}
              value={p.unsupported === null ? '—' : `${p.unsupported}%`}
              hint={p.minVersion ? `min ${p.minVersion}` : 'no minimum set'}
            />
          </div>
        ))}
      </div>
      {data && !data.versions.length ? (
        <EmptyState
          title="No app sessions in the last 7 days"
          description="Versions appear once the app (with the built-in reporter) is used."
        />
      ) : (
        <>
          <Section
            title="Adoption of the latest version"
            description="Share of each day's active devices running that platform's newest version."
          >
            <TimeSeriesChart
              data={(() => {
                const byT: Record<string, { t: string; ios?: number; android?: number }> = {};
                for (const [platform, a] of Object.entries(data?.adoption || {}))
                  for (const s of a.series)
                    (byT[s.t] ||= { t: s.t })[platform as 'ios' | 'android'] = s.share;
                // A day without sessions on one platform keeps that platform's last known share.
                const rows = Object.values(byT).sort((a, b) => a.t.localeCompare(b.t));
                rows.forEach((r, j) => (['ios', 'android'] as const).forEach((k) => r[k] === undefined && j > 0 && (r[k] = rows[j - 1][k])));
                return rows;
              })()}
              bucketMs={data?.bucketMs}
              height={200}
              series={[
                {
                  key: 'ios',
                  label: `iOS ${data?.adoption.ios?.latest || ''}`,
                  color: 'var(--chart-1)',
                },
                {
                  key: 'android',
                  label: `Android ${data?.adoption.android?.latest || ''}`,
                  color: 'var(--chart-2)',
                },
              ]}
            />
          </Section>
          <Section
            title="Versions in use"
            description="Breaking API changes = response fields removed or retyped (API Contracts) after the version first appeared — those builds may misbehave until updated."
          >
            <DataTable
              columns={cols}
              rows={data?.versions}
              loading={isLoading}
              rowKey={(v) => `${v.platform}-${v.version}`}
              emptyTitle="No versions"
            />
          </Section>
          <Section
            title="OS versions (7 d)"
            description="Devices per major OS version — what you can stop supporting."
          >
            <CountBars
              counts={Object.fromEntries(
                (data?.os || []).map((o) => [`${platformLabel(o.platform)} ${o.os}`, o.installs])
              )}
            />
          </Section>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        <Link to="/developer/deployment-impact" className="text-primary hover:underline">
          Deployment Impact
        </Link>{' '}
        compares crash-free sessions of each release against the rest of the fleet.
      </p>
    </div>
  );
}

export default function MobilePage() {
  const [f, setF] = useUrlFilters({ range: '7d', view: 'health' });
  const { data, isLoading, isFetching, error, refetch } = useDevMobile({
    range: f.range as RangeKey,
  });
  const [open, setOpen] = useState<MobileErrorGroup | null>(null);
  const s = data?.summary;

  const errorCols: Column<MobileErrorGroup>[] = [
    {
      key: 'sev',
      header: '',
      cell: (g) =>
        g.fatal ? (
          <StatusBadge status="crash" tone="danger" />
        ) : (
          <StatusBadge status="error" tone="warning" />
        ),
    },
    {
      key: 'msg',
      header: 'Error',
      className: 'max-w-[420px]',
      cell: (g) => (
        <div className="min-w-0">
          <div className="truncate font-medium">
            {g.name}: {g.message}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {g.screen || '—'} · {g.kind}
          </div>
        </div>
      ),
    },
    {
      key: 'count',
      header: 'Events',
      align: 'right',
      cell: (g) => (
        <span className="tabular-nums">
          {num(g.count)}
          {g.fatal ? <span className="ml-1 text-xs text-red-600">({g.fatal} fatal)</span> : null}
        </span>
      ),
    },
    {
      key: 'inst',
      header: 'Devices',
      align: 'right',
      cell: (g) => <span className="tabular-nums">{num(g.installs)}</span>,
    },
    {
      key: 'ver',
      header: 'Versions',
      cell: (g) => <span className="text-xs">{g.versions.filter(Boolean).join(', ') || '—'}</span>,
    },
    {
      key: 'last',
      header: 'Last seen',
      align: 'right',
      cell: (g) => <span className="text-xs text-muted-foreground">{ago(g.lastSeen)}</span>,
    },
  ];
  const versionCols: Column<MobileInfo['versions'][number]>[] = [
    {
      key: 'v',
      header: 'Version',
      cell: (v) => (
        <span className="font-medium">
          {v.appVersion || '—'}
          <span className="ml-1 text-xs text-muted-foreground">
            {v.build ? `build ${v.build}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'p',
      header: 'Platform',
      cell: (v) => <Badge variant="outline">{platformLabel(v.platform)}</Badge>,
    },
    {
      key: 'inst',
      header: 'Devices',
      align: 'right',
      cell: (v) => <span className="tabular-nums">{num(v.installs)}</span>,
    },
    {
      key: 'sess',
      header: 'Sessions',
      align: 'right',
      cell: (v) => <span className="tabular-nums">{num(v.sessions)}</span>,
    },
    {
      key: 'cf',
      header: 'Crash-free',
      align: 'right',
      cell: (v) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            crashTone(v.crashFree) === 'danger'
              ? 'text-red-600'
              : crashTone(v.crashFree) === 'warning'
                ? 'text-amber-600'
                : 'text-emerald-600'
          )}
        >
          {pct(v.crashFree)}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last seen',
      align: 'right',
      cell: (v) => <span className="text-xs text-muted-foreground">{ago(v.lastSeen)}</span>,
    },
  ];
  const apiCols: Column<MobileInfo['api'][number]>[] = [
    {
      key: 'path',
      header: 'Endpoint',
      cell: (a) => (
        <span className="font-mono text-xs">
          {a.method} {a.path}
        </span>
      ),
    },
    {
      key: 'count',
      header: 'Failed / slow',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{num(a.count)}</span>,
    },
    {
      key: 'codes',
      header: 'Status',
      cell: (a) => (
        <span className="flex flex-wrap gap-1">
          {Object.entries(a.codes).map(([c, n]) => (
            <Badge key={c} variant={c === '0' || Number(c) >= 500 ? 'destructive' : 'secondary'}>
              {c === '0' ? 'network' : c} × {n}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'p95',
      header: 'p95',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{ms(a.p95)}</span>,
    },
    {
      key: 'inst',
      header: 'Devices',
      align: 'right',
      cell: (a) => <span className="tabular-nums">{num(a.installs)}</span>,
    },
    {
      key: 'last',
      header: 'Last',
      align: 'right',
      cell: (a) => <span className="text-xs text-muted-foreground">{ago(a.lastSeen)}</span>,
    },
  ];

  const header = (
    <PageHeader
      title="Mobile App"
      description="Crashes, errors, versions and API failures reported by the Jobblo app's built-in reporter (jobblo-app/src/monitoring). Sentry is installed in the app but switched off."
      actions={
        <>
          <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
            <TabsList>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="releases">Releases</TabsTrigger>
            </TabsList>
          </Tabs>
          {f.view === 'health' && (
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
          )}
          {f.view === 'health' && <RefreshButton onClick={() => refetch()} spinning={isFetching} />}
        </>
      }
    />
  );
  if (f.view === 'releases')
    return (
      <div className="space-y-5">
        {header}
        <MobileReleases />
      </div>
    );
  return (
    <div className="space-y-5">
      {header}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Crash-free sessions"
          icon={<ShieldCheck />}
          tone={crashTone(s?.crashFreeSessions ?? null)}
          loading={isLoading}
          value={pct(s?.crashFreeSessions ?? null)}
          hint={s ? `${num(s.crashedSessions)} of ${num(s.sessions)} crashed` : ''}
        />
        <StatCard
          label="Active devices"
          icon={<Smartphone />}
          loading={isLoading}
          value={num(s?.installs)}
          hint={`${num(s?.users)} signed-in users`}
        />
        <StatCard label="Sessions" icon={<Users />} loading={isLoading} value={num(s?.sessions)} />
        <StatCard
          label="Crashes"
          icon={<Bug />}
          tone={s?.fatal ? 'danger' : 'success'}
          loading={isLoading}
          value={num(s?.fatal)}
          hint="fatal JS errors"
        />
        <StatCard
          label="Handled errors"
          icon={<Bug />}
          tone={s && s.errors - s.fatal > 0 ? 'warning' : 'neutral'}
          loading={isLoading}
          value={num(s ? s.errors - s.fatal : null)}
          hint="render, promise and caught"
        />
        <StatCard
          label="API failures"
          icon={<Network />}
          tone={s?.apiFailures ? 'warning' : 'success'}
          loading={isLoading}
          value={num(s?.apiFailures)}
          hint="5xx, network or > 3 s"
        />
      </div>

      <Section title="Sessions, errors and crashes">
        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <TimeSeriesChart
            data={data?.series}
            bucketMs={data?.range.bucketMs}
            height={200}
            variant="bar"
            series={[
              { key: 'sessions', label: 'Sessions', color: 'var(--chart-1)' },
              { key: 'errors', label: 'Errors', color: 'var(--chart-4)' },
              { key: 'crashes', label: 'Crashes', color: 'var(--chart-5)' },
            ]}
          />
        )}
      </Section>

      <Section
        title="Error groups"
        description="Same message and top stack frame across builds = one group. Click for the stack trace and affected devices."
      >
        <DataTable
          columns={errorCols}
          rows={data?.errorGroups}
          loading={isLoading}
          rowKey={(g) => g.fingerprint}
          onRowClick={setOpen}
          emptyTitle="No errors reported in this range"
        />
      </Section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section title="Versions in use" description="Crash-free = sessions without a fatal crash.">
          <DataTable
            columns={versionCols}
            rows={data?.versions}
            loading={isLoading}
            rowKey={(v) => `${v.appVersion}-${v.build}-${v.platform}`}
            emptyTitle="No sessions yet"
          />
        </Section>
        <div className="space-y-4">
          <Section title="Platforms">
            <CountBars
              counts={Object.fromEntries(
                (data?.platforms || []).map((p) => [
                  `${platformLabel(p.platform)} ${p.osVersion || ''}`.trim(),
                  p.installs,
                ])
              )}
            />
          </Section>
          <Section title="Devices">
            <CountBars
              counts={Object.fromEntries(
                (data?.devices || []).map((d) => [d.device || 'unknown', d.installs])
              )}
            />
          </Section>
        </div>
      </div>

      <Section
        title="API failures seen by the app"
        description="Only 5xx responses, network errors/timeouts and calls slower than 3 s are reported. Ids in paths are replaced by :id on the device."
      >
        <DataTable
          columns={apiCols}
          rows={data?.api}
          loading={isLoading}
          rowKey={(a) => `${a.method}-${a.path}`}
          emptyTitle="No failed or slow API calls"
        />
      </Section>

      <Section title="Recent crashes">
        {data?.recentCrashes.length ? (
          <ul className="divide-y">
            {data.recentCrashes.map((c) => (
              <li key={c._id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-sm">
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() =>
                    setOpen(data.errorGroups.find((g) => g.fingerprint === c.fingerprint) || null)
                  }
                >
                  <div className="truncate font-medium hover:underline">
                    {c.name}: {c.message}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {platformLabel(c.platform)} · {c.device || 'unknown device'} · v
                    {c.appVersion || '?'} · {c.screen || 'unknown screen'}
                  </div>
                </button>
                <span className="text-xs text-muted-foreground" title={dateTime(c.at)}>
                  {ago(c.at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No crashes in this range" />
        )}
      </Section>

      <p className="text-xs text-muted-foreground">
        <Gauge className="mr-1 inline size-3.5" />
        Range {f.range as RangeKey} · reporter batches every 30 s and on app background; a crash
        that kills the app is sent on its next launch.
      </p>
      <ErrorSheet group={open} onClose={() => setOpen(null)} />
    </div>
  );
}
