import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, KeyRound, Lock, ShieldAlert, ShieldX, Timer, UserX } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { useDevBlocks, useDevMe, useDevSecurity, useUrlFilters } from '../../features/developer/hooks';
import type { SecurityEventRow } from '../../api/developer';
import { CountBars, ErrorState, MethodBadge, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { BlockIpDialog } from '../../components/developer/BlockIpDialog';
import { BlockedIpsTable } from '../../components/developer/BlockedIpsTable';
import { Button } from '../../components/developer/ui/button';

const SERIES = [
  { key: 'login_failed', label: 'Failed logins', color: 'var(--chart-5)' },
  { key: 'rate_limited', label: 'Rate limited', color: 'var(--chart-4)' },
  { key: 'permission_denied', label: 'Permission denied', color: 'var(--chart-3)' },
  { key: 'token_invalid', label: 'Invalid token', color: 'var(--chart-1)' },
];

export default function SecurityPage() {
  const [f, setF] = useUrlFilters({ range: '24h', type: '' });
  const { data, isLoading, isFetching, error, refetch } = useDevSecurity({ range: f.range as '24h' });
  const b = data?.byType || {};
  const recent = (data?.recent || []).filter((r) => !f.type || r.type === f.type);
  const { data: me } = useDevMe();
  const { data: blockData } = useDevBlocks();
  const [blockIp, setBlockIp] = useState<string | null>(null);
  const canBlock = Boolean(me?.can.execute || me?.can.request);
  const blocked = new Set((blockData?.blocks || []).map((x) => x.target));

  const columns: Column<SecurityEventRow>[] = [
    { key: 'at', header: 'Time', cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground" title={dateTime(r.at)}>{ago(r.at)}</span> },
    { key: 'type', header: 'Event', cell: (r) => <StatusBadge status={r.type} tone={r.type === 'login_failed' || r.type === 'rate_limited' ? 'warning' : r.type === 'permission_denied' ? 'danger' : 'neutral'} /> },
    { key: 'route', header: 'Request', className: 'max-w-[320px]', cell: (r) => <span className="flex items-center gap-2"><MethodBadge method={r.method} /><span className="truncate font-mono text-xs">{r.route}</span></span> },
    { key: 'status', header: 'Status', cell: (r) => <span className="font-mono text-xs">{r.status}{r.code ? ` · ${r.code}` : ''}</span> },
    { key: 'ip', header: 'IP', cell: (r) => <span className="font-mono text-xs">{r.ip || '—'}</span> },
    { key: 'email', header: 'Account', cell: (r) => <span className="text-xs text-muted-foreground">{r.email || '—'}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security Center"
        description="Authentication failures, rate limits, permission denials and privileged changes. Derived from every API response; emails are masked."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data?.alerts.length ? (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${a.severity === 'critical' ? 'border-red-200/70 bg-red-50 text-red-800' : 'border-amber-200/70 bg-amber-50 text-amber-800'}`}>
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs opacity-90">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Failed logins" icon={<UserX />} tone={b.login_failed ? 'warning' : 'success'} loading={isLoading} value={num(b.login_failed || 0)} />
        <StatCard label="Rate limited" icon={<Timer />} tone={b.rate_limited ? 'warning' : 'neutral'} loading={isLoading} value={num(b.rate_limited || 0)} />
        <StatCard label="Permission denied" icon={<Ban />} tone={b.permission_denied ? 'danger' : 'neutral'} loading={isLoading} value={num(b.permission_denied || 0)} />
        <StatCard label="Invalid / expired tokens" icon={<KeyRound />} loading={isLoading} value={num((b.token_invalid || 0) + (b.token_expired || 0))} hint={`${num(b.session_revoked || 0)} revoked sessions`} />
        <StatCard label="OTP failures" icon={<Lock />} loading={isLoading} value={num(b.otp_failed || 0)} />
        <StatCard label="Blocked IPs" icon={<Ban />} tone={blockData?.blocks.length ? 'warning' : 'neutral'} loading={!blockData} value={num(blockData?.blocks.length)} hint={`${num(b.ip_blocked || 0)} requests refused`} />
        <StatCard label="Alerts" icon={<ShieldX />} tone={data?.alerts.length ? 'danger' : 'success'} loading={isLoading} value={num(data?.alerts.length)} hint="stuffing / brute force" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Security events over time" className="lg:col-span-2">
          <TimeSeriesChart data={data?.series} bucketMs={data?.range.bucketMs} variant="bar" series={SERIES} />
        </Section>
        <Section title="By type" description="Click to filter the event list">
          <CountBars counts={b} selected={f.type} onSelect={(type) => setF({ type })} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Top sources" description="IPs with the most rejected requests" className="lg:col-span-2">
          <ul className="divide-y rounded-md border text-sm">
            {(data?.topIps || []).map((i) => (
              <li key={i.ip} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-xs">{i.ip}</span>
                <span className="flex flex-wrap gap-1">
                  {i.types.map((t) => (
                    <StatusBadge key={t} status={t} tone="neutral" />
                  ))}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {num(i.count)} · last {ago(i.last)}
                  {canBlock && i.ip !== blockData?.yourIp && !blocked.has(i.ip) && (
                    <Button variant="outline" size="xs" onClick={() => setBlockIp(i.ip)}>
                      <Ban /> Block
                    </Button>
                  )}
                  {blocked.has(i.ip) && <StatusBadge status="blocked" tone="danger" />}
                  {i.ip === blockData?.yourIp && <StatusBadge status="you" tone="info" label="your IP" />}
                </span>
              </li>
            ))}
            {!data?.topIps.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No rejected requests in range.</li>}
          </ul>
        </Section>
        <Section title="How blocking works">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• Blocked IPs get 403 on every API request, on all servers within 30s.</li>
            <li>• Operations developers and Super Admins block directly after confirming with a one-time code.</li>
            <li>• Default 24h; choose “Always” to keep it until someone unblocks it.</li>
            <li>• You cannot block your own IP{blockData?.yourIp ? ` (${blockData.yourIp})` : ''}.</li>
            <li>• Stripe webhooks are never blocked. Ranges wider than /16 are refused.</li>
            <li>• Every block and unblock is in the audit log.</li>
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Privileged role changes" description="From the audit log">
          {data?.roleChanges.length ? (
            <Timeline reverse events={data.roleChanges.map((r) => ({ at: r.createdAt, source: 'role', title: r.description, by: r.adminId?.name, tone: 'warning' }))} />
          ) : (
            <p className="text-sm text-muted-foreground">No role changes in range.</p>
          )}
        </Section>
        <Section title="Developer actions" description="Triage, checks and flag changes made from this dashboard" action={<Link className="text-xs text-primary hover:underline" to="/developer/audit">Full audit log</Link>}>
          {data?.developerActions.length ? (
            <Timeline reverse events={data.developerActions.map((r) => ({ at: r.createdAt, source: r.adminId?.role || 'dev', title: r.description, by: r.adminId?.name, tone: 'info' }))} />
          ) : (
            <p className="text-sm text-muted-foreground">No developer actions in range.</p>
          )}
        </Section>
      </div>

      <Section
        title="Blocked IPs"
        description="Active blocks. Expired blocks are removed automatically."
        action={
          canBlock && (
            <Button size="sm" variant="destructive" onClick={() => setBlockIp('')}>
              <Ban /> Block IP
            </Button>
          )
        }
      >
        <BlockedIpsTable />
      </Section>

      <BlockIpDialog ip={blockIp || ''} open={blockIp !== null} onOpenChange={(o) => !o && setBlockIp(null)} />

      <Section title="Recent events" description={f.type ? `Filtered: ${f.type.replace(/_/g, ' ')}` : 'Latest 100'}>
        <DataTable columns={columns} rows={recent} loading={isLoading} rowKey={(r) => r._id} emptyTitle="No security events" />
      </Section>
    </div>
  );
}
