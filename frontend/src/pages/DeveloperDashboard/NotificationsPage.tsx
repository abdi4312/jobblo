import { Bell, Mail, MailX, Smartphone, Timer } from 'lucide-react';
import { ago, ms, num, pct } from '@/lib/devFormat';
import { useDevNotifications, useUrlFilters } from '../../features/developer/hooks';
import type { DeliveryRow } from '../../api/developer';
import { CountBars, ErrorState, KeyValue, NotConfigured, PageHeader, RangeSelect, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { TimeSeriesChart } from '../../components/developer/TimeSeriesChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';

export default function NotificationsPage() {
  const [f, setF] = useUrlFilters({ range: '7d', channel: 'all', status: 'all' });
  const { data, isLoading, isFetching, error, refetch } = useDevNotifications({
    range: f.range as '7d',
    channel: f.channel === 'all' ? undefined : f.channel,
    status: f.status === 'all' ? undefined : f.status,
  });
  const t = data?.totals || {};
  const sent = (c: 'email' | 'push') => (t[c]?.sent || 0) + (t[c]?.partial || 0);
  const failed = (t.email?.failed || 0) + (t.push?.failed || 0);

  const columns: Column<DeliveryRow>[] = [
    { key: 'at', header: 'Time', cell: (r) => <span className="text-xs text-muted-foreground">{ago(r.at)}</span> },
    { key: 'channel', header: 'Channel', cell: (r) => <StatusBadge status={r.channel} tone="info" /> },
    { key: 'template', header: 'Template / title', className: 'max-w-[320px]', cell: (r) => <span className="block truncate">{r.template || '—'}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status === 'sent' ? 'ok' : r.status} label={r.status} /> },
    { key: 'to', header: 'Recipient', cell: (r) => <span className="text-xs text-muted-foreground">{r.to || '—'}</span> },
    { key: 'lat', header: 'Latency', align: 'right', cell: (r) => <span className="tabular-nums">{ms(r.latencyMs)}</span> },
    { key: 'err', header: 'Error', className: 'max-w-[260px]', cell: (r) => <span className="block truncate text-xs text-red-600">{r.errorCode || r.error || ''}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications & Email"
        description="Delivery of every email (SMTP) and push (FCM) send, plus in-app notification volume. Recipients are masked."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Emails sent" icon={<Mail />} loading={isLoading} value={num(sent('email'))} hint={`${num(t.email?.failed || 0)} failed`} />
        <StatCard label="Push sent" icon={<Smartphone />} loading={isLoading} value={num(sent('push'))} hint={`${num(t.push?.skipped || 0)} skipped (no device)`} />
        <StatCard label="Failed" icon={<MailX />} tone={failed ? 'danger' : 'success'} loading={isLoading} value={num(failed)} />
        <StatCard label="Email latency" icon={<Timer />} loading={isLoading} value={ms(data?.latency.email?.avg)} hint={`P95 ${ms(data?.latency.email?.p95)}`} />
        <StatCard label="Push latency" icon={<Timer />} loading={isLoading} value={ms(data?.latency.push?.avg)} hint={`P95 ${ms(data?.latency.push?.p95)}`} />
        <StatCard label="In-app" icon={<Bell />} loading={isLoading} value={num(data?.inApp.total)} hint={`read rate ${pct(data?.inApp.readRate)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Deliveries over time" className="lg:col-span-2">
          <TimeSeriesChart data={data?.series} bucketMs={data?.range.bucketMs} variant="bar" series={[{ key: 'sent', label: 'Sent', color: 'var(--chart-2)' }, { key: 'failed', label: 'Failed', color: 'var(--chart-5)' }]} />
        </Section>
        <Section title="Provider health" description="Latest outcome per channel">
          <div className="space-y-4">
            {(data?.health || []).map((h) => (
              <div key={h.channel} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{h.channel === 'email' ? 'Email (SMTP)' : 'Push (FCM)'}</span>
                  <StatusBadge status={h.status} />
                </div>
                <KeyValue items={[['Last success', ago(h.lastSuccess)], ['Last failure', h.lastFailure ? `${ago(h.lastFailure)}${h.lastError ? ` · ${h.lastError}` : ''}` : '—']]} />
              </div>
            ))}
            <KeyValue items={[['Active push devices', num(data?.pushTokens)]]} />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Templates" description="Email subject / push title">
          <ul className="space-y-1.5 text-xs">
            {(data?.templates || []).map((tpl, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 rounded-sm bg-muted px-1 font-mono text-[10px] uppercase">{tpl.channel}</span>
                  {tpl.template || '—'}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {num(tpl.count)}
                  {tpl.failed ? <span className="ml-1 text-red-600">({tpl.failed} failed)</span> : null}
                </span>
              </li>
            ))}
            {!data?.templates.length && <li className="text-muted-foreground">No sends recorded yet.</li>}
          </ul>
        </Section>
        <Section title="Failure reasons">
          {data?.failures.length ? (
            <ul className="space-y-2 text-sm">
              {data.failures.map((x, i) => (
                <li key={i} className="rounded-md border p-2">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="font-mono">
                      {x.channel} · {x.code || 'unknown'}
                    </span>
                    <span className="text-muted-foreground">
                      {x.count}× · {ago(x.last)}
                    </span>
                  </div>
                  {x.example && <p className="mt-1 text-xs text-muted-foreground">{x.example}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No failures in range.</p>
          )}
        </Section>
        <Section title="In-app notifications" description="By type">
          <CountBars counts={data?.inApp.byType || {}} />
        </Section>
      </div>

      <Section
        title="Recent deliveries"
        action={
          <div className="flex gap-2">
            <Select value={f.channel} onValueChange={(channel) => setF({ channel })}>
              <SelectTrigger size="sm" className="w-28" aria-label="Channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>
            <Select value={f.status} onValueChange={(status) => setF({ status })}>
              <SelectTrigger size="sm" className="w-28" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <DataTable columns={columns} rows={data?.recent} loading={isLoading} rowKey={(r) => r._id} emptyTitle="No deliveries recorded" emptyDescription="Sends are recorded from this release onward." />
      </Section>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(data?.notConfigured || {}).map(([k, v]) => (
          <Section key={k} title={k === 'sms' ? 'SMS' : k.charAt(0).toUpperCase() + k.slice(1)}>
            <NotConfigured title="Not available" description={v} />
          </Section>
        ))}
      </div>
    </div>
  );
}
