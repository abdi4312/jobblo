import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Activity, Clock, Cpu, Gauge, HardDrive, Plug, Timer, Zap } from 'lucide-react';
import { bytes, dateTime, duration, num, pct } from '@/lib/devFormat';
import { useDevRedis } from '../../../features/developer/hooks';
import { devApi, type RedisStatus } from '../../../api/developer';
import { DataTable } from '../../../components/developer/DataTable';
import { ErrorState, IssueList, KeyValue, Meter, Mono, NotConfigured, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../../components/developer/kit';
import { Skeleton } from '../../../components/developer/ui/skeleton';
import { findNavItem } from '../nav';
import QueuesPage from '../QueuesPage';
import { CacheSection, KeysSection, RateLimitsSection } from './RedisDataSections';
import { AlertsSection, AuditSection, RealtimeSection, WorkersSection } from './RedisRuntimeSections';

/**
 * Redis management: one route (/developer/redis/:section), one section per sidebar item.
 * Every section reads its own endpoint (backend services/monitoring/redisInsights.js).
 */

/** Header + refresh + error + "Redis is off/down" for every section. */
export function RedisShell({
  path,
  query,
  needsRedis = true,
  children,
}: {
  path: string;
  query: { data?: RedisStatus; isLoading: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };
  needsRedis?: boolean;
  children: ReactNode;
}) {
  const nav = findNavItem(path);
  const d = query.data;
  return (
    <div className="space-y-5">
      <PageHeader title={nav?.label || 'Redis'} description={nav?.description} actions={<RefreshButton onClick={() => query.refetch()} spinning={query.isFetching} />} />
      {Boolean(query.error) && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {d && !d.enabled && (
        <Section title="Redis is not configured" description="REDIS_URL is not set on this server.">
          <NotConfigured
            title="Running in-process"
            description="Jobs run right after the request (no retries, lost on restart), rate limits and the cache live in each process' memory, and realtime events reach only sockets on this instance. Set REDIS_URL to share them across instances."
          />
        </Section>
      )}
      {d && d.enabled && !d.ok && (
        <Section title="Redis is unreachable" action={<StatusBadge status="failing" label="down" />}>
          <KeyValue
            items={[
              ['Error', <span className="text-red-700">{d.error || d.state.lastError || 'No answer'}</span>],
              ['Client state', d.state.status],
              ['Last error', d.state.lastErrorAt ? dateTime(d.state.lastErrorAt) : '—'],
              ['Fallback', 'Jobs run in-process, rate limits fail open, the cache is skipped.'],
            ]}
          />
        </Section>
      )}
      {query.isLoading ? <Skeleton className="h-64 w-full" /> : (!needsRedis || (d?.enabled && d.ok)) && children}
    </div>
  );
}

function OverviewSection() {
  const q = useDevRedis('overview', devApi.redisOverview, 10_000);
  const d = q.data;
  const m = d?.memory;
  return (
    <RedisShell path="redis" query={q}>
      {d && m && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Health" icon={<Activity />} tone={d.health!.score >= 100 ? 'success' : d.health!.score >= 60 ? 'warning' : 'danger'} value={`${d.health!.score}%`} hint={`${d.health!.checks.filter((c) => c.ok).length}/${d.health!.checks.length} checks pass`} />
            <StatCard label="Latency" icon={<Timer />} value={`${d.latency!.avg} ms`} hint={`ping min ${d.latency!.min} · max ${d.latency!.max} ms`} />
            <StatCard label="Ops / sec" icon={<Zap />} value={num(d.opsPerSec)} hint={`hit rate ${pct(d.hitRate)}`} />
            <StatCard label="Memory" icon={<HardDrive />} tone={(m.pct ?? 0) >= 85 ? 'danger' : 'neutral'} value={bytes(m.used)} hint={m.max ? `${m.pct}% of ${bytes(m.max)}` : 'no maxmemory limit'} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Server" action={<StatusBadge status="healthy" label="connected" />}>
              <KeyValue
                items={[
                  ['Version', d.server!.version],
                  ['Mode', d.server!.mode],
                  ['Uptime', duration(d.server!.uptimeSec)],
                  ['OS', d.server!.os],
                  ['Key prefix', <Mono>{d.prefix}:</Mono>],
                  ['Clients', `${num(d.clients!.connected)} connected · ${num(d.clients!.blocked)} blocked · max ${num(d.clients!.maxclients)}`],
                  ['Keyspace', Object.entries(d.keyspace || {}).map(([db, k]) => `${db}: ${num(k.keys)} keys (${num(k.expires)} with TTL)`).join(' · ') || 'empty'],
                ]}
              />
            </Section>
            <Section title="Health checks">
              <ul className="space-y-1.5 text-sm">
                {d.health!.checks.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2">
                    <span>{c.label}</span>
                    <StatusBadge status={c.ok ? 'ok' : 'warning'} />
                  </li>
                ))}
              </ul>
            </Section>
          </div>
          <Section title="This instance's connections" description="Each API instance opens its own: shared commands, BullMQ queues and workers, socket.io pub/sub.">
            <DataTable rows={d.connections} rowKey={(c, i) => `${c.label}-${i}`} columns={[{ key: 'l', header: 'Connection', cell: (c) => <Mono>{c.label}</Mono> }, { key: 's', header: 'State', align: 'right', cell: (c) => <StatusBadge status={c.status === 'ready' ? 'connected' : c.status} label={c.status} /> }]} />
          </Section>
        </>
      )}
    </RedisShell>
  );
}

function MemorySection() {
  const q = useDevRedis('memory', devApi.redisMemory, 30_000);
  const m = q.data?.memory;
  return (
    <RedisShell path="redis/memory" query={q}>
      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Used" icon={<HardDrive />} value={bytes(m.used)} hint={`peak ${bytes(m.peak)}`} />
            <StatCard label="Limit (maxmemory)" icon={<Gauge />} tone={m.max ? 'neutral' : 'warning'} value={m.max ? bytes(m.max) : 'none'} hint={m.system ? `host RAM ${bytes(m.system)}` : undefined} />
            <StatCard label="Fragmentation" icon={<Cpu />} tone={(m.fragmentation ?? 1) > 1.5 ? 'warning' : 'neutral'} value={m.fragmentation ?? '—'} hint="RSS ÷ used; > 1.5 wastes RAM" />
            <StatCard label="Evicted keys" icon={<Clock />} tone={m.evictedKeys ? 'danger' : 'success'} value={num(m.evictedKeys)} hint={`${num(m.expiredKeys)} expired by TTL`} />
          </div>
          <Section title="Usage">
            <div className="space-y-4">
              <Meter label="Used of maxmemory" value={m.pct} detail={m.max ? `${bytes(m.used)} of ${bytes(m.max)} — writes fail at 100% with noeviction` : 'No limit set: Redis grows until the host is out of memory (see Configuration).'} />
              <KeyValue
                items={[
                  ['Eviction policy', <span>{m.policy} {m.policy !== 'noeviction' && <StatusBadge status="critical" label="can drop queued jobs" />}</span>],
                  ['RSS (from the OS)', bytes(m.rss)],
                  ['Dataset', bytes(m.dataset)],
                  ['Scripts', bytes(m.luaAndScripts)],
                  ['Allocator', m.allocator],
                  ['Keys in database', num(q.data?.dbsize)],
                ]}
              />
            </div>
          </Section>
          <Section title="Memory by key group" description="Summed from MEMORY USAGE over a bounded sample of each group's keys.">
            <DataTable
              rows={q.data?.groups}
              rowKey={(g) => g.id}
              columns={[
                { key: 'g', header: 'Group', cell: (g) => g.label },
                { key: 'k', header: 'Keys sampled', align: 'right', cell: (g) => `${num(g.sampledKeys)}${g.complete ? '' : '+'}` },
                { key: 'b', header: 'Memory', align: 'right', cell: (g) => bytes(g.bytes) },
              ]}
            />
          </Section>
        </>
      )}
    </RedisShell>
  );
}

function PerformanceSection() {
  const q = useDevRedis('performance', devApi.redisPerformance, 10_000);
  const d = q.data;
  const hits = d?.keyspace?.hits ?? 0;
  const misses = d?.keyspace?.misses ?? 0;
  return (
    <RedisShell path="redis/performance" query={q}>
      {d?.latency && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Commands / sec" icon={<Zap />} value={num(d.opsPerSec)} hint={`${num(d.totalCommands)} since start`} />
            <StatCard label="Latency (10 pings)" icon={<Timer />} tone={d.latency.avg > 20 ? 'warning' : 'neutral'} value={`${d.latency.avg} ms`} hint={`max ${d.latency.max} ms`} />
            <StatCard label="Connections" icon={<Plug />} tone={d.connections?.rejected ? 'danger' : 'neutral'} value={num(d.connections?.connected)} hint={`${num(d.connections?.rejected)} rejected · ${num(d.connections?.blocked)} blocked`} />
            <StatCard label="Keyspace hit rate" icon={<Gauge />} value={hits + misses ? pct((hits / (hits + misses)) * 100) : '—'} hint={`${num(d.inputKbps)} kB/s in · ${num(d.outputKbps)} kB/s out`} />
          </div>
          <Section title="Slow commands" description="SLOWLOG: the command and its key only — values are never sent to the browser.">
            <DataTable
              rows={d.slowlog}
              rowKey={(s) => String(s.id)}
              emptyTitle="No slow commands logged"
              columns={[
                { key: 'at', header: 'When', cell: (s) => <span className="text-xs">{dateTime(s.at)}</span> },
                { key: 'ms', header: 'Took', align: 'right', cell: (s) => `${s.ms} ms` },
                { key: 'c', header: 'Command', cell: (s) => <Mono>{s.command}</Mono> },
                { key: 'k', header: 'Key', cell: (s) => <span className="font-mono text-xs break-all">{s.key || '—'}{s.args ? <span className="text-muted-foreground"> +{s.args} args</span> : null}</span> },
                { key: 'cl', header: 'Client', cell: (s) => <span className="text-xs">{s.client || s.clientAddr || '—'}</span> },
              ]}
            />
          </Section>
          <Section title="Commands by total time" description="INFO commandstats since the server started.">
            <DataTable
              rows={d.commands}
              rowKey={(c) => c.command}
              columns={[
                { key: 'c', header: 'Command', cell: (c) => <Mono>{c.command}</Mono> },
                { key: 'n', header: 'Calls', align: 'right', cell: (c) => num(c.calls) },
                { key: 'p', header: 'µs / call', align: 'right', cell: (c) => num(Math.round(c.usecPerCall)) },
                { key: 't', header: 'Total', align: 'right', cell: (c) => `${num(Math.round(c.usec / 1000))} ms` },
                { key: 'f', header: 'Failed', align: 'right', cell: (c) => (c.failed ? <span className="text-red-600">{num(c.failed)}</span> : '0') },
              ]}
            />
          </Section>
          {Boolean(d.latencyEvents?.length) && (
            <Section title="Latency events" description="LATENCY LATEST (needs latency-monitor-threshold > 0).">
              <DataTable rows={d.latencyEvents} rowKey={(e) => e.event} columns={[{ key: 'e', header: 'Event', cell: (e) => e.event }, { key: 'l', header: 'Last', align: 'right', cell: (e) => `${e.lastMs} ms` }, { key: 'm', header: 'Max', align: 'right', cell: (e) => `${e.maxMs} ms` }]} />
            </Section>
          )}
        </>
      )}
    </RedisShell>
  );
}

const SEV = { critical: 'critical', warning: 'medium', info: 'low' } as const;

function ConfigSection() {
  const q = useDevRedis('config', devApi.redisConfig, 60_000);
  const d = q.data;
  return (
    <RedisShell path="redis/config" query={q} needsRedis={false}>
      {d && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Connection" description="From REDIS_URL — the password is never shown.">
              <KeyValue
                items={[
                  ['Status', d.enabled ? <StatusBadge status={d.ok ? 'connected' : 'disconnected'} /> : 'not configured'],
                  ['Host', d.url ? <Mono>{`${d.url.host}:${d.url.port}`}</Mono> : '—'],
                  ['TLS', d.url ? (d.url.tls ? 'yes (rediss://)' : 'no') : '—'],
                  ['Database', d.url?.db ?? '—'],
                  ['User / password', d.url ? `${d.url.user || 'default'} / ${d.url.password}` : '—'],
                  ['Key prefix', <Mono>{d.prefix}:</Mono>],
                ]}
              />
            </Section>
            <Section title="Environment">
              <KeyValue
                items={[
                  ['NODE_ENV', d.environment],
                  ['Workers on this instance', d.workersEnabled ? 'yes' : 'no (ENABLE_WORKERS=false)'],
                  ['Changes', 'Settings are changed in redis.conf or the provider console, and REDIS_* in the server .env — never from this dashboard.'],
                ]}
              />
            </Section>
          </div>
          {d.configError && <div className="rounded-md border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs text-amber-800">{d.configError}</div>}
          {d.ok && (
            <Section title="Checks against what Jobblo needs">
              <IssueList issues={d.checks.filter((c) => !c.ok).map((c) => ({ code: c.key, severity: SEV[c.severity as keyof typeof SEV] || 'low', detail: `Now ${c.value ?? 'unset'}, expected ${c.expected}. ${c.why}` }))} empty="All checked settings are as recommended." />
            </Section>
          )}
          {d.settings && (
            <Section title="Approved settings (read-only)" description="Only these are read; passwords and ACLs are never requested.">
              <DataTable
                rows={Object.entries(d.settings).sort(([a], [b]) => a.localeCompare(b))}
                rowKey={([k]) => k}
                columns={[
                  { key: 'k', header: 'Setting', cell: ([k]) => <Mono>{k}</Mono> },
                  { key: 'v', header: 'Value', cell: ([, v]) => <span className="font-mono text-xs">{v === '' ? '(empty)' : v}</span> },
                  { key: 's', header: '', align: 'right', cell: ([k]) => { const c = d.checks.find((x) => x.key === k); return c ? <StatusBadge status={c.ok ? 'ok' : c.severity} /> : null; } },
                ]}
              />
            </Section>
          )}
        </>
      )}
    </RedisShell>
  );
}

const SECTIONS: Record<string, () => ReactNode> = {
  overview: OverviewSection,
  memory: MemorySection,
  cache: CacheSection,
  keys: KeysSection,
  queues: QueuesPage,
  workers: WorkersSection,
  realtime: RealtimeSection,
  'rate-limits': RateLimitsSection,
  performance: PerformanceSection,
  alerts: AlertsSection,
  config: ConfigSection,
  audit: AuditSection,
};

export default function RedisPage() {
  const { section = 'overview' } = useParams();
  const Section_ = SECTIONS[section];
  if (!Section_) return <Navigate to="/developer/redis" replace />;
  return <Section_ />;
}
