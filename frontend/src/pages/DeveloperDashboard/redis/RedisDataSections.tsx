import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Boxes, KeyRound, RotateCcw, Search, ShieldCheck, Timer, Trash2 } from 'lucide-react';
import { ago, bytes, every, ms, num, pct } from '@/lib/devFormat';
import { useDevMe, useDevRedis } from '../../../features/developer/hooks';
import { errMessage, useSensitiveAction } from '../../../features/developer/stepUp';
import { devApi, type RedisRateLimits } from '../../../api/developer';
import { DataTable } from '../../../components/developer/DataTable';
import { ReasonDialog } from '../../../components/developer/ReasonDialog';
import { Mono, Section, StatCard, StatusBadge } from '../../../components/developer/kit';
import { Button } from '../../../components/developer/ui/button';
import { Input } from '../../../components/developer/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../../components/developer/ui/tabs';
import { RedisShell } from './RedisPage';

const ttl = (v: number | null) => (v === null ? 'no expiry' : ms(v));

export function CacheSection() {
  const q = useDevRedis('cache', devApi.redisCache, 15_000);
  const { data: me } = useDevMe();
  const canAct = Boolean(me?.can.triage);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, confirmText: string, fn: () => Promise<unknown>, done: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      await qc.invalidateQueries({ queryKey: ['dev', 'redis'] });
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };
  const d = q.data;
  const totals = (d?.namespaces || []).reduce((a, n) => ({ hits: a.hits + n.hits, misses: a.misses + n.misses, keys: a.keys + n.keys.length }), { hits: 0, misses: 0, keys: 0 });
  return (
    <RedisShell path="redis/cache" query={q} needsRedis={false}>
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Store" icon={<Boxes />} value={d.store === 'redis' ? 'Redis' : 'Memory'} hint={d.store === 'redis' ? 'shared by every instance' : `this process · ${num(d.localEntries)} entries`} />
            <StatCard label="Namespaces" value={num(d.namespaces.length)} />
            <StatCard label="Cached responses" value={num(totals.keys)} />
            <StatCard label="Hit rate" tone={totals.hits + totals.misses && totals.hits / (totals.hits + totals.misses) < 0.5 ? 'warning' : 'neutral'} value={totals.hits + totals.misses ? pct((totals.hits / (totals.hits + totals.misses)) * 100) : '—'} hint={`${num(totals.hits)} hits · ${num(totals.misses)} misses (this process)`} />
          </div>
          {d.namespaces.map((n) => (
            <Section
              key={n.name}
              title={<span className="font-mono">{n.name}</span>}
              description={`TTL ${every(n.ttlSec * 1000)} · ${num(n.hits)} hits · ${num(n.misses)} misses · hit rate ${pct(n.hitRate)}`}
              action={
                canAct && (
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`ns-${n.name}`, `Invalidate every cached "${n.name}" response? The next request rebuilds it.`, () => devApi.invalidateCache(n.name), `Cache "${n.name}" invalidated`)}>
                    <RotateCcw /> Invalidate namespace
                  </Button>
                )
              }
            >
              <DataTable
                rows={n.keys}
                rowKey={(k) => k.key}
                emptyTitle="Nothing cached right now"
                emptyDescription="Entries appear after the first request and disappear when their TTL runs out."
                columns={[
                  { key: 'k', header: 'Key', cell: (k) => <span className="font-mono text-xs break-all">{k.key}</span> },
                  { key: 't', header: 'Expires in', align: 'right', cell: (k) => ttl(k.ttlMs) },
                  { key: 'b', header: 'Size', align: 'right', cell: (k) => bytes(k.bytes) },
                  {
                    key: 'a',
                    header: '',
                    align: 'right',
                    cell: (k) =>
                      canAct ? (
                        <Button size="xs" variant="ghost" aria-label={`Delete ${k.key}`} disabled={busy !== null} onClick={() => run(`k-${k.key}`, `Delete cached response ${k.key}?`, () => devApi.deleteCacheKey(k.key), 'Cached response deleted')}>
                          <Trash2 />
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </Section>
          ))}
        </>
      )}
    </RedisShell>
  );
}

export function KeysSection() {
  const [group, setGroup] = useState('cache');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState('0');
  const query = useDevRedis(`keys:${group}:${q}:${cursor}`, () => devApi.redisKeys({ group, q, cursor }), 30_000);
  const d = query.data;
  const reset = (g: string) => {
    setGroup(g);
    setCursor('0');
  };
  return (
    <RedisShell path="redis/keys" query={query}>
      {d && (
        <Section
          title="Keys"
          description={`Only keys under Jobblo's prefixes are listed (SCAN, never KEYS); values are never shown. ${num(d.dbsize)} keys in the database.`}
          action={
            <Tabs value={group} onValueChange={reset}>
              <TabsList>
                {d.groups.map((g) => (
                  <TabsTrigger key={g.id} value={g.id}>
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        >
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(search.trim());
              setCursor('0');
            }}
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Contains… (plain text, no wildcards)" aria-label="Search keys" maxLength={100} />
            <Button type="submit" variant="outline">
              <Search /> Search
            </Button>
          </form>
          <p className="mb-2 text-xs text-muted-foreground">
            Prefix <Mono>{d.groups.find((g) => g.id === group)?.match}</Mono>
          </p>
          <DataTable
            rows={d.keys}
            rowKey={(k) => k.key}
            emptyTitle="No keys found"
            columns={[
              { key: 'k', header: 'Key', cell: (k) => <span className="font-mono text-xs break-all">{k.key}</span> },
              { key: 'ty', header: 'Type', cell: (k) => <Mono>{k.type}</Mono> },
              { key: 't', header: 'Expires in', align: 'right', cell: (k) => ttl(k.ttlMs) },
              { key: 'b', header: 'Size', align: 'right', cell: (k) => bytes(k.bytes) },
            ]}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{d.complete ? 'End of the list.' : 'More keys match.'}</span>
            <span className="flex gap-2">
              {cursor !== '0' && (
                <Button size="sm" variant="outline" onClick={() => setCursor('0')}>
                  From the start
                </Button>
              )}
              {!d.complete && d.cursor && (
                <Button size="sm" variant="outline" onClick={() => setCursor(d.cursor!)}>
                  Next page
                </Button>
              )}
            </span>
          </div>
        </Section>
      )}
    </RedisShell>
  );
}

type Counter = RedisRateLimits['counters'][number];

export function RateLimitsSection() {
  const q = useDevRedis('rate-limits', devApi.redisRateLimits, 15_000);
  const { data: me } = useDevMe();
  const canReset = Boolean(me?.can.execute || me?.can.request);
  const submit = useSensitiveAction(['redis']);
  const [resetting, setResetting] = useState<{ limiter: string; client: string } | null>(null);
  const d = q.data;
  return (
    <RedisShell path="redis/rate-limits" query={q} needsRedis={false}>
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Store" icon={<Timer />} value={d.store === 'redis' ? 'Redis' : 'Memory'} hint={d.store === 'redis' ? 'one limit across all instances' : 'per process — limits multiply with instances'} />
            <StatCard label="Limiters" icon={<ShieldCheck />} value={num(d.limiters.length)} />
            <StatCard label="Clients over a limit" icon={<Ban />} tone={d.counters.some((c) => c.blocked) ? 'warning' : 'success'} value={num(d.counters.filter((c) => c.blocked).length)} hint={d.store === 'redis' ? `${num(d.counters.length)} active counters${d.complete ? '' : '+'}` : 'counters need Redis'} />
            <StatCard label="Blocked requests (24 h)" icon={<KeyRound />} tone={d.blocked.total ? 'warning' : 'neutral'} value={num(d.blocked.total)} hint="429 responses" />
          </div>

          <Section title="Limiters">
            <DataTable
              rows={d.limiters}
              rowKey={(l) => l.name}
              columns={[
                { key: 'n', header: 'Name', cell: (l) => <Mono>{l.name}</Mono> },
                { key: 'm', header: 'Limit', align: 'right', cell: (l) => (l.max === null ? 'dynamic' : `${num(l.max)} ${l.failedOnly ? 'failed requests' : 'requests'}`) },
                { key: 'w', header: 'Window', align: 'right', cell: (l) => every(l.windowMs) },
              ]}
            />
          </Section>

          {d.store === 'redis' && (
            <Section title="Active counters" description="Clients closest to their limit first. A reset clears the counter on every instance and is audited.">
              <DataTable<Counter>
                rows={d.counters}
                rowKey={(c) => `${c.limiter}:${c.client}`}
                emptyTitle="No active counters"
                columns={[
                  { key: 'l', header: 'Limiter', cell: (c) => <Mono>{c.limiter}</Mono> },
                  { key: 'c', header: 'Client (IP or user)', cell: (c) => <span className="font-mono text-xs break-all">{c.client}</span> },
                  { key: 'h', header: 'Used', align: 'right', cell: (c) => <span className="tabular-nums">{num(c.hits)}{c.max ? ` / ${num(c.max)}` : ''}</span> },
                  { key: 's', header: '', cell: (c) => (c.blocked ? <StatusBadge status="failing" label="blocked" /> : null) },
                  { key: 'r', header: 'Resets in', align: 'right', cell: (c) => (c.resetInMs === null ? '—' : ms(c.resetInMs)) },
                  {
                    key: 'a',
                    header: '',
                    align: 'right',
                    cell: (c) =>
                      canReset ? (
                        <Button size="xs" variant="outline" onClick={() => setResetting({ limiter: c.limiter, client: c.client })}>
                          <RotateCcw /> Reset
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </Section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Blocked by route (24 h)">
              <DataTable rows={d.blocked.byRoute} rowKey={(r, i) => `${r.route}-${i}`} emptyTitle="Nothing blocked" columns={[{ key: 'r', header: 'Route', cell: (r) => <span className="font-mono text-xs">{r.route || '—'}</span> }, { key: 'n', header: 'Requests', align: 'right', cell: (r) => num(r.n) }, { key: 'l', header: 'Last', align: 'right', cell: (r) => ago(r.last) }]} />
            </Section>
            <Section title="Blocked by IP (24 h)">
              <DataTable rows={d.blocked.byIp} rowKey={(r, i) => `${r.ip}-${i}`} emptyTitle="Nothing blocked" columns={[{ key: 'i', header: 'IP', cell: (r) => <span className="font-mono text-xs">{r.ip || '—'}</span> }, { key: 'n', header: 'Requests', align: 'right', cell: (r) => num(r.n) }, { key: 'l', header: 'Last', align: 'right', cell: (r) => ago(r.last) }]} />
            </Section>
          </div>

          <ReasonDialog
            open={Boolean(resetting)}
            onOpenChange={(o) => !o && setResetting(null)}
            title={`Reset ${resetting?.limiter ?? ''} for ${resetting?.client ?? ''}`}
            description="The client can make requests again immediately. Use it for a locked-out household or office, not to silence an attack."
            confirmLabel="Reset rate limit"
            selfService
            onConfirm={(reason) => submit('rate_limit_reset', { ...resetting! }, reason)}
          />
        </>
      )}
    </RedisShell>
  );
}
