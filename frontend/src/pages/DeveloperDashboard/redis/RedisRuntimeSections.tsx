import { Link } from 'react-router-dom';
import { BellRing, Cpu, Network, Radio, RadioTower, Server, Users } from 'lucide-react';
import { ago, dateTime, duration, ms, num } from '@/lib/devFormat';
import { useDevRedis } from '../../../features/developer/hooks';
import { devApi, type RedisWorkerQueue } from '../../../api/developer';
import { DataTable } from '../../../components/developer/DataTable';
import { KeyValue, Mono, Section, StatCard, StatusBadge } from '../../../components/developer/kit';
import { RedisShell } from './RedisPage';

/** Jobs per minute over the last hour, newest on the right. */
function MinuteBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-10 items-end gap-px" aria-label={`Completed jobs per minute, last ${values.length} minutes`} role="img">
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-t-sm bg-primary/70" style={{ height: `${Math.max(v ? 8 : 2, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} title={`${v} jobs`} />
      ))}
    </div>
  );
}

function WorkerCard({ q }: { q: RedisWorkerQueue }) {
  const failing = (q.lastHour?.failed ?? 0) > 0;
  return (
    <Section
      title={<span className="font-mono">{q.name}</span>}
      description={`concurrency ${q.concurrency} per worker · ${q.attempts ?? 1} attempts${q.paused ? ' · PAUSED' : ''}`}
      action={<StatusBadge status={!q.workers.length ? 'failing' : failing ? 'warning' : 'healthy'} label={!q.workers.length ? 'no worker' : `${q.workers.length} worker${q.workers.length > 1 ? 's' : ''}`} />}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <KeyValue
          items={[
            ['Waiting / active', `${num(q.counts?.waiting)} / ${num(q.counts?.active)}`],
            ['Last hour', <span>{num(q.lastHour?.completed)} done{failing && <span className="text-red-600"> · {num(q.lastHour?.failed)} failed</span>}</span>],
            ['Since start', `${num(q.total?.completed)} done · ${num(q.total?.failed)} failed`],
            ['Job duration', q.avgMs === null || q.avgMs === undefined ? '—' : `avg ${ms(q.avgMs)} · max ${ms(q.maxMs)}`],
            ['On this instance', q.here ? 'yes' : 'no'],
          ]}
        />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Completed per minute (last hour)</div>
          <MinuteBars values={q.lastHour?.perMinute || []} />
        </div>
      </div>
      {q.workers.length > 0 && (
        <DataTable
          className="mt-3"
          rows={q.workers}
          rowKey={(w) => w.id}
          columns={[
            { key: 'a', header: 'Instance', cell: (w) => <Mono>{w.addr || '—'}</Mono> },
            { key: 'g', header: 'Connected for', align: 'right', cell: (w) => duration(w.ageSec) },
            { key: 'i', header: 'Idle', align: 'right', cell: (w) => duration(w.idleSec) },
          ]}
        />
      )}
    </Section>
  );
}

export function WorkersSection() {
  const q = useDevRedis('workers', devApi.redisWorkers, 10_000);
  const d = q.data;
  const workers = (d?.queues || []).reduce((a, x) => a + x.workers.length, 0);
  const instances = new Set((d?.queues || []).flatMap((x) => x.workers.map((w) => w.addr))).size;
  return (
    <RedisShell path="redis/workers" query={q} needsRedis={false}>
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Mode" icon={<Cpu />} value={d.mode === 'redis' ? 'BullMQ' : 'In-process'} hint={d.mode === 'redis' ? 'workers on every instance' : `${num(d.inline.ran)} ran · ${num(d.inline.failed)} failed since start`} />
            <StatCard label="Workers" icon={<Server />} tone={d.mode === 'redis' && !workers ? 'danger' : 'neutral'} value={num(workers)} hint={`on ${num(instances)} instance(s)`} />
            <StatCard label="Done (last hour)" value={num(d.queues.reduce((a, x) => a + (x.lastHour?.completed || 0), 0))} />
            <StatCard label="Failed (last hour)" tone={d.queues.some((x) => x.lastHour?.failed) ? 'warning' : 'success'} value={num(d.queues.reduce((a, x) => a + (x.lastHour?.failed || 0), 0))} hint={<Link className="text-primary hover:underline" to="/developer/redis/queues">Dead letters →</Link>} />
          </div>
          {d.mode === 'redis' ? d.queues.map((x) => <WorkerCard key={x.name} q={x} />) : <p className="text-sm text-muted-foreground">Without Redis there are no separate workers: each job runs in the process that queued it.{d.inline.lastError && ` Last error: ${d.inline.lastError}`}</p>}
        </>
      )}
    </RedisShell>
  );
}

export function RealtimeSection() {
  const q = useDevRedis('realtime', devApi.redisRealtime, 10_000);
  const d = q.data;
  return (
    <RedisShell path="redis/realtime" query={q} needsRedis={false}>
      {d && !d.running && <p className="text-sm text-muted-foreground">socket.io is not running in this process.</p>}
      {d?.running && d.local && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Adapter" icon={<Network />} tone={d.adapter === 'redis' ? 'success' : 'warning'} value={d.adapter === 'redis' ? 'Redis' : 'Memory'} hint={d.adapter === 'redis' ? 'events reach every instance' : 'events reach this instance only'} />
            <StatCard label="Sockets (all instances)" icon={<RadioTower />} value={num(d.cluster?.sockets ?? d.local.sockets)} hint={`${num(d.local.sockets)} on this instance`} />
            <StatCard label="Online users (this instance)" icon={<Users />} value={num(d.local.onlineUsers)} hint={`${num(d.local.rooms)} rooms`} />
            <StatCard label="API instances" icon={<Server />} value={num(d.cluster?.servers ?? 1)} hint={d.cluster ? `adapter round trip ${d.cluster.roundTripMs} ms` : undefined} />
          </div>
          {d.pubsub && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Pub/Sub channels" description="Each instance subscribes once; a channel with 0 subscribers means an instance stopped listening.">
                <DataTable
                  rows={d.pubsub.channels}
                  rowKey={(c) => c.channel}
                  emptyTitle="No adapter channels"
                  columns={[
                    { key: 'c', header: 'Channel', cell: (c) => <span className="font-mono text-xs break-all">{c.channel}</span> },
                    { key: 's', header: 'Subscribers', align: 'right', cell: (c) => <span className={c.subscribers ? '' : 'text-red-600'}>{num(c.subscribers)}</span> },
                  ]}
                />
              </Section>
              <Section title="Adapter connections (this instance)">
                <DataTable rows={d.pubsub.connections} rowKey={(c) => c.label} columns={[{ key: 'l', header: 'Connection', cell: (c) => <Mono>{c.label}</Mono> }, { key: 's', header: 'State', align: 'right', cell: (c) => <StatusBadge status={c.status === 'ready' ? 'connected' : 'disconnected'} label={c.status} /> }]} />
              </Section>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="size-3.5" /> Presence is tracked per instance; with several instances each one counts its own users.
          </p>
        </>
      )}
    </RedisShell>
  );
}

export function AlertsSection() {
  const q = useDevRedis('alerts', devApi.redisAlerts, 30_000);
  const d = q.data;
  const firing = (d?.rules || []).filter((r) => r.firing.length).length;
  return (
    <RedisShell path="redis/alerts" query={{ ...q, data: d && { enabled: d.enabled, ok: true, error: null, ms: null, state: { status: '', lastError: null, lastErrorAt: null }, prefix: '' } }} needsRedis={false}>
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Firing now" icon={<BellRing />} tone={firing ? 'danger' : 'success'} value={num(firing)} hint={`of ${d.rules.length} rules`} />
            <StatCard label="Memory" value={d.metrics.memoryPct === null || d.metrics.memoryPct === undefined ? 'no limit' : `${d.metrics.memoryPct}%`} hint={`policy ${d.metrics.policy || '—'}`} />
            <StatCard label="Waiting jobs" value={num((d.metrics.backlog || []).reduce((a, b) => a + b.waiting, 0))} hint={(d.metrics.backlog || []).map((b) => `${b.name} ${b.waiting}`).join(' · ')} />
          </div>
          <Section title="Rules" description={<span>Checked every minute by the alert evaluator; a firing rule opens an incident and notifies Slack/email. Thresholds are changed on <Link className="text-primary hover:underline" to="/developer/settings">Access & Settings</Link>.</span>}>
            <DataTable
              rows={d.rules}
              rowKey={(r) => r.key}
              columns={[
                { key: 'l', header: 'Rule', cell: (r) => r.label },
                { key: 's', header: 'Severity', cell: (r) => <StatusBadge status={r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'failing' : 'warning'} label={r.severity} /> },
                { key: 't', header: 'Fires when', cell: (r) => <span className="text-xs">{r.threshold}</span> },
                { key: 'f', header: 'Now', align: 'right', cell: (r) => (r.firing.length ? <span className="text-xs text-red-700">{r.firing.join(' · ')}</span> : <StatusBadge status="ok" />) },
              ]}
            />
          </Section>
          <Section title="Redis and queue incidents (30 days)" action={<Link className="text-xs text-primary hover:underline" to="/developer/incidents">All incidents →</Link>}>
            <DataTable
              rows={d.incidents}
              rowKey={(i) => i._id}
              emptyTitle="No Redis incidents in 30 days"
              columns={[
                { key: 't', header: 'Incident', cell: (i) => <div><div className="text-sm">{i.title}</div><div className="text-xs text-muted-foreground">{i.detail}</div></div> },
                { key: 'v', header: 'Severity', cell: (i) => <StatusBadge status={i.severity === 'critical' ? 'critical' : 'warning'} label={i.severity} /> },
                { key: 's', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
                { key: 'w', header: 'Started', align: 'right', cell: (i) => <span className="text-xs">{ago(i.startedAt)} · {num(i.occurrences)}×</span> },
              ]}
            />
          </Section>
        </>
      )}
    </RedisShell>
  );
}

export function AuditSection() {
  const q = useDevRedis('audit', devApi.redisAudit, 30_000);
  return (
    <RedisShell path="redis/audit" query={{ ...q, data: q.data && { enabled: true, ok: true, error: null, ms: null, state: { status: '', lastError: null, lastErrorAt: null }, prefix: '' } }} needsRedis={false}>
      <Section title="Redis, cache, rate-limit and queue changes" action={<Link className="text-xs text-primary hover:underline" to="/developer/audit">Full audit log →</Link>}>
        <DataTable
          rows={q.data?.logs}
          rowKey={(l) => l._id}
          emptyTitle="No changes recorded yet"
          columns={[
            { key: 'w', header: 'When', cell: (l) => <span className="text-xs" title={dateTime(l.createdAt)}>{ago(l.createdAt)}</span> },
            { key: 'u', header: 'Developer', cell: (l) => <span className="text-xs">{l.adminId?.name || '—'}<span className="text-muted-foreground"> · {l.adminId?.role}</span></span> },
            { key: 'd', header: 'Change', cell: (l) => <span className="text-sm">{l.description}</span> },
            { key: 'a', header: 'Area', align: 'right', cell: (l) => <Mono>{String(l.metadata?.area || l.metadata?.type || '—').replace('developer.', '')}</Mono> },
          ]}
        />
      </Section>
    </RedisShell>
  );
}
