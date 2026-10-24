import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CircleX, Clock, Database, Download, FileCheck2, UserX } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type PrivacyInfo } from '../../api/developer';
import { useDevMe, useDevPrivacy } from '../../features/developer/hooks';
import { errMessage, useStepUp } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';

const STATE_ICON = {
  pass: <CheckCircle2 className="size-4 text-emerald-600" />,
  warn: <AlertTriangle className="size-4 text-amber-600" />,
  fail: <CircleX className="size-4 text-red-600" />,
};
const days = (d: number | null) => (d === null ? 'while account exists' : d >= 365 ? `${+(d / 365).toFixed(1)} y` : `${d} d`);

function ExportForm() {
  const withStepUp = useStepUp();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = /^[a-f0-9]{24}$/i.test(userId.trim()) && reason.trim().length >= 10;
  const run = async () => {
    setBusy(true);
    try {
      const data = await withStepUp((token) => devApi.exportUserData(userId.trim(), reason.trim(), token));
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `jobblo-data-${userId.trim()}.json` });
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded — the export is recorded in the audit log');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void run();
      }}
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        User id
        <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="24-character id" className="w-64 font-mono" />
      </label>
      <label className="grid min-w-64 flex-1 gap-1 text-xs text-muted-foreground">
        Reason (ticket / request reference)
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Access request in ticket #…, verified identity" maxLength={500} />
      </label>
      <Button type="submit" size="sm" disabled={!valid || busy}>
        <Download /> {busy ? 'Exporting…' : 'Export data'}
      </Button>
    </form>
  );
}

export default function PrivacyPage() {
  const { data, isLoading, error, refetch } = useDevPrivacy();
  const { data: me } = useDevMe();
  const isSuperAdmin = me?.access === 'superAdmin';
  const r = data?.retention || [];
  const dirty = data?.deletions.filter((d) => !d.clean) || [];
  const openRequests = data?.requests.filter((q) => q.daysLeft !== null) || [];

  const retentionCols: Column<PrivacyInfo['retention'][number]>[] = [
    { key: 's', header: '', cell: (x) => STATE_ICON[x.state] },
    { key: 'c', header: 'Data', className: 'max-w-[320px]', cell: (x) => <div className="min-w-0"><div className="font-mono text-xs font-medium">{x.collection}</div><div className="truncate text-xs text-muted-foreground" title={x.personal}>{x.personal}</div></div> },
    { key: 'p', header: 'Purpose', className: 'max-w-[220px] whitespace-normal', cell: (x) => <span className="text-xs">{x.purpose}</span> },
    { key: 'r', header: 'Keep for', cell: (x) => <span className="text-xs">{days(x.retentionDays)}{x.legal && <Badge variant="outline" className="ml-1">legal</Badge>}</span> },
    { key: 't', header: 'TTL index', cell: (x) => <span className="text-xs">{x.ttlDays === null ? '—' : x.ttlDays === 0 ? 'per-record expiry' : `${x.ttlDays} d`}</span> },
    { key: 'n', header: 'Records', align: 'right', cell: (x) => <span className="tabular-nums">{num(x.count)}</span> },
    { key: 'o', header: 'Oldest', align: 'right', cell: (x) => <span className="text-xs text-muted-foreground">{x.oldest ? ago(x.oldest) : '—'}</span> },
    { key: 'v', header: 'Verdict', className: 'max-w-[300px] whitespace-normal', cell: (x) => <span className={cn('text-xs', x.state === 'fail' && 'text-red-700', x.state === 'warn' && 'text-amber-700')}>{x.note}</span> },
  ];
  const deletionCols: Column<PrivacyInfo['deletions'][number]>[] = [
    { key: 's', header: '', cell: (d) => (d.clean ? STATE_ICON.pass : STATE_ICON.fail) },
    { key: 'i', header: 'Account', cell: (d) => <Link to={`/developer/users?id=${d.id}`} className="font-mono text-xs text-primary hover:underline">{d.id}</Link> },
    { key: 'd', header: 'Deleted', cell: (d) => <span className="text-xs">{d.deletedAt ? dateTime(d.deletedAt) : '—'}</span> },
    { key: 'm', header: 'How', cell: (d) => <Badge variant="outline" className={d.method === 'soft-deleted' ? 'text-amber-700' : ''}>{d.method === 'soft-deleted' ? 'soft-deleted (admin)' : 'anonymised'}</Badge> },
    { key: 'f', header: 'Personal data still present', className: 'whitespace-normal', cell: (d) => <span className="text-xs">{[...d.fields, ...d.linked].join(', ') || 'none'}</span> },
  ];
  const requestCols: Column<PrivacyInfo['requests'][number]>[] = [
    { key: 's', header: 'Request', cell: (q) => <span className="font-medium">{q.subject}</span> },
    { key: 'k', header: 'Type', cell: (q) => <Badge variant="outline">{q.kind}</Badge> },
    { key: 'st', header: 'Status', cell: (q) => <span className="text-xs">{q.status}</span> },
    { key: 'r', header: 'Received', cell: (q) => <span className="text-xs text-muted-foreground">{dateTime(q.createdAt)}</span> },
    { key: 'd', header: 'Deadline (30 d)', align: 'right', cell: (q) => (q.daysLeft === null ? <span className="text-xs text-muted-foreground">done</span> : <span className={cn('text-xs font-medium tabular-nums', q.overdue ? 'text-red-600' : q.daysLeft <= 7 ? 'text-amber-600' : '')}>{q.overdue ? `${-q.daysLeft} d overdue` : `${q.daysLeft} d left`}</span>) },
    { key: 'l', header: '', cell: (q) => <Link to={`/developer/tickets?id=${q.id}`} className="text-xs text-primary hover:underline">Ticket</Link> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Privacy & Data"
        description="What personal data Jobblo keeps and for how long — checked against the real TTL indexes and the age of what is stored — whether deleted accounts really lost their personal data, open data-subject requests against the one-month GDPR deadline, terms consent, and subject-access exports."
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Retention issues" icon={<Database />} loading={isLoading} tone={r.some((x) => x.state === 'fail') ? 'danger' : r.some((x) => x.state === 'warn') ? 'warning' : 'success'} value={data ? `${r.filter((x) => x.state !== 'pass').length} / ${r.length}` : '—'} hint="collections not cleaned on time" />
        <StatCard label="Deleted, not clean" icon={<UserX />} loading={isLoading} tone={dirty.length ? 'danger' : 'success'} value={num(data ? dirty.length : undefined)} hint={data ? `of ${data.deletions.length} deleted accounts` : undefined} />
        <StatCard label="Open requests" icon={<Clock />} loading={isLoading} tone={openRequests.some((q) => q.overdue) ? 'danger' : openRequests.length ? 'warning' : 'success'} value={num(data ? openRequests.length : undefined)} hint={data ? `${openRequests.filter((q) => q.overdue).length} past the 30-day deadline` : undefined} />
        <StatCard label="On current terms" icon={<FileCheck2 />} loading={isLoading} tone={data && data.consent.onCurrent < data.consent.active ? 'warning' : 'success'} value={data ? `${data.consent.onCurrent} / ${data.consent.active}` : '—'} hint={data ? `version ${data.consent.currentVersion}` : undefined} />
        <StatCard label="Newsletter subscribers" icon={<CheckCircle2 />} loading={isLoading} value={num(data?.consent.newsletterSubscribers)} hint="opted in" />
      </div>

      <Section title="Retention" description="Declared policy per collection vs what is actually stored. 'Legal' = kept 5 years for accounting (bokføringsloven). A warning means nothing deletes the data yet — add a TTL index or a cleanup job.">
        <DataTable columns={retentionCols} rows={r} loading={isLoading} rowKey={(x) => x.collection} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Deleted accounts — cleanup verified" description="Self-service deletion anonymises the account; the admin 'delete' only soft-deletes and leaves personal data in place.">
          <DataTable columns={deletionCols} rows={data?.deletions} loading={isLoading} rowKey={(d) => d.id} emptyTitle="No deleted accounts" />
        </Section>
        <Section title="Data-subject requests" description="Support tickets in the last year that ask for deletion, access or an export. GDPR gives one month to answer.">
          <DataTable columns={requestCols} rows={data?.requests} loading={isLoading} rowKey={(q) => q.id} emptyTitle="No privacy requests found in tickets" />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Consent" description={data?.consent.cookieConsent}>
          <ul className="divide-y text-sm">
            {data?.consent.versions.map((v) => (
              <li key={v.version || 'none'} className="flex items-center justify-between py-2">
                <span>
                  {v.version ? `Terms ${v.version}` : 'Never accepted any terms version'}
                  {v.current && <Badge variant="outline" className="ml-2 text-emerald-700">current</Badge>}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {num(v.users)} users{v.lastActive ? ` · last active ${ago(v.lastActive)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Subject-access export" description="Everything Jobblo holds about one person, as JSON (Art. 15/20): profile, jobs, applications, orders, payments, reviews, the messages they wrote, notifications, sessions, tickets. Passwords, tokens and bank details are never included. Super Admin only, needs a step-up code, and is written to the audit log with the reason.">
          {isSuperAdmin ? <ExportForm /> : <p className="text-sm text-muted-foreground">Only a Super Admin can export personal data.</p>}
        </Section>
      </div>
    </div>
  );
}
