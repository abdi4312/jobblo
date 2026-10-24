import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Download, Globe, Search, ShieldAlert, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ago, compact, downloadCsv, num, pct } from '@/lib/devFormat';
import { useDevIps, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import type { IpRow, RangeKey } from '../../api/developer';
import { ErrorState, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { IpSheet } from '../../components/developer/IpSheet';
import { BlockIpDialog } from '../../components/developer/BlockIpDialog';
import { BlockedIpsTable } from '../../components/developer/BlockedIpsTable';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const RISK_TONE = { normal: 'success', suspicious: 'warning', high: 'danger', blocked: 'danger' } as const;
const RISKS = [
  { value: 'all', label: 'All IPs' },
  { value: 'flagged', label: 'Flagged (suspicious + high)' },
  { value: 'high', label: 'High risk' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'normal', label: 'Normal' },
];
const SORTS = [
  { value: 'risk', label: 'Risk first' },
  { value: 'requests', label: 'Most requests' },
  { value: 'failed', label: 'Most failures' },
  { value: 'security', label: 'Most security events' },
  { value: 'lastSeen', label: 'Recently active' },
];

export default function IpsPage() {
  const [f, setF] = useUrlFilters({ range: '24h', risk: 'all', sort: 'risk', q: '', page: '1', tab: 'ips' });
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevIps({
    range: f.range as RangeKey,
    risk: f.risk === 'all' ? undefined : f.risk,
    sort: f.sort === 'risk' ? undefined : f.sort,
    q: f.q || undefined,
    page: f.page,
  });
  const s = data?.summary;
  const canBlock = Boolean(me?.can.execute || me?.can.request);

  const columns: Column<IpRow>[] = [
    {
      key: 'ip',
      header: 'IP address',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Globe className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs">{r.ip}</span>
          {r.isYou && <StatusBadge status="you" tone="info" label="you" />}
        </div>
      ),
    },
    { key: 'risk', header: 'Risk', cell: (r) => <StatusBadge status={r.risk} tone={RISK_TONE[r.risk]} label={r.risk === 'high' ? 'high risk' : r.risk} /> },
    { key: 'reasons', header: 'Why', className: 'max-w-[280px]', cell: (r) => <span className="block truncate text-xs text-muted-foreground" title={r.reasons.join(' · ')}>{r.reasons.join(' · ') || '—'}</span> },
    { key: 'requests', header: 'Requests', align: 'right', cell: (r) => <span className="tabular-nums">{num(r.requests)}</span> },
    { key: 'failed', header: 'Failed', align: 'right', cell: (r) => <span className={cn('tabular-nums', r.requests && r.failed / r.requests > 0.3 ? 'text-amber-600' : 'text-muted-foreground')}>{num(r.failed)}{r.requests ? <span className="ml-1 text-[11px]">({pct((r.failed / r.requests) * 100, 0)})</span> : null}</span> },
    { key: 'security', header: 'Security events', align: 'right', cell: (r) => <span className={cn('tabular-nums', r.securityTotal ? 'text-red-600' : 'text-muted-foreground')}>{num(r.securityTotal)}</span> },
    { key: 'endpoints', header: 'APIs', align: 'right', cell: (r) => <span className="tabular-nums">{r.endpoints}</span> },
    { key: 'last', header: 'Last seen', align: 'right', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.lastSeen)}</span> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (r) =>
        canBlock && !r.blocked && !r.isYou ? (
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setBlockTarget(r.ip);
            }}
          >
            <Ban /> Block
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="IP Management"
        description="Every client IP that called the API or triggered a security event: traffic, failures, risk, and block / unblock in one place."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={!data?.ips.length}
              onClick={() => downloadCsv(`ips-${f.range}.csv`, (data?.ips || []).map(({ security, reasons, ...r }) => ({ ...r, ...security, reasons: reasons.join(' | ') })))}
            >
              <Download /> Export
            </Button>
            {canBlock && (
              <Button size="sm" variant="destructive" onClick={() => setBlockTarget('')}>
                <Ban /> Block IP
              </Button>
            )}
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {me && !canBlock && (
        <div className="flex items-start gap-2 rounded-md border border-sky-200/70 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Your dashboard access is <b>read-only</b>, so Block / Unblock is hidden. A Super Admin can set you to <b>Operations</b> in{' '}
            <Link to="/developer/settings" className="underline">
              Access &amp; Settings
            </Link>
            ; Operations developers block and unblock directly after a one-time code.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Unique IPs" icon={<Users />} loading={isLoading} value={num(s?.total)} hint={`${compact(s?.requests)} requests`} />
        <StatCard label="High risk" icon={<ShieldAlert />} tone={s?.high ? 'danger' : 'success'} loading={isLoading} value={num(s?.high)} />
        <StatCard label="Suspicious" icon={<AlertTriangle />} tone={s?.suspicious ? 'warning' : 'success'} loading={isLoading} value={num(s?.suspicious)} />
        <StatCard label="Blocked & seen" icon={<Ban />} tone={s?.blocked ? 'warning' : 'neutral'} loading={isLoading} value={num(s?.blocked)} hint="still trying while blocked" />
        <StatCard label="Active blocks" icon={<Ban />} loading={isLoading} value={num(s?.activeBlocks)} hint={data?.yourIp ? `your IP: ${data.yourIp}` : ''} />
      </div>

      <Tabs value={f.tab} onValueChange={(tab) => setF({ tab })}>
        <TabsList>
          <TabsTrigger value="ips">All IPs</TabsTrigger>
          <TabsTrigger value="blocks">Block list ({num(s?.activeBlocks)})</TabsTrigger>
        </TabsList>

        <TabsContent value="ips" className="pt-3">
          <Section
            title="Client IPs"
            description="Risk: suspicious = one warning signal (5+ failed logins, rate limited, 10+ permission denials, or most requests failing); high = several, or 20+ failed logins."
            action={
              <div className="flex flex-wrap gap-2">
                <form
                  className="relative"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setF({ q: search.trim() });
                  }}
                >
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IP…" className="h-7 w-44 pl-7 font-mono text-xs" aria-label="Search IP" />
                </form>
                <Select value={f.risk} onValueChange={(risk) => setF({ risk })}>
                  <SelectTrigger size="sm" className="w-52" aria-label="Risk filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISKS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={f.sort} onValueChange={(sort) => setF({ sort })}>
                  <SelectTrigger size="sm" className="w-44" aria-label="Sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <DataTable
              columns={columns}
              rows={data?.ips}
              loading={isLoading}
              rowKey={(r) => r.ip}
              onRowClick={(r) => setSelected(r.ip)}
              pagination={data?.pagination}
              onPageChange={(p) => setF({ page: String(p) })}
              emptyTitle="No IPs match"
              emptyDescription="IPs appear once traffic is recorded (flushed every minute)."
            />
          </Section>
        </TabsContent>

        <TabsContent value="blocks" className="pt-3">
          <Section title="Active blocks" description="Click a row to see what that IP did. Expired blocks are removed automatically; every change is audited.">
            <BlockedIpsTable onPick={(target) => !target.includes('/') && setSelected(target)} />
          </Section>
        </TabsContent>
      </Tabs>

      <IpSheet ip={selected} range={f.range as RangeKey} onClose={() => setSelected(null)} />
      <BlockIpDialog ip={blockTarget || ''} open={blockTarget !== null} onOpenChange={(o) => !o && setBlockTarget(null)} />
    </div>
  );
}
