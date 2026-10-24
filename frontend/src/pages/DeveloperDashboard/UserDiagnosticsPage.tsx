import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Monitor, Search } from 'lucide-react';
import { ago, dateTime } from '@/lib/devFormat';
import { useDevUser, useDevUsers, useUrlFilters } from '../../features/developer/hooks';
import type { UserHit } from '../../api/developer';
import { CountBars, EmptyState, ErrorState, KeyValue, Mono, PageHeader, Section, StatusBadge, Timeline } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/developer/ui/avatar';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

function UserDetail({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useDevUser(id);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  const u = data.user;
  const status = u.isDeleted ? 'deleted' : String(u.accountStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar className="size-10 rounded-md">
          <AvatarImage src={u.avatarUrl} alt="" />
          <AvatarFallback className="rounded-md">{u.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold">{u.name} {String(u.lastName || '')}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </div>
        <StatusBadge status={u.role} tone="info" />
        <StatusBadge status={status} tone={u.isDeleted ? 'danger' : status === 'inactive' ? 'warning' : 'success'} />
        <Mono>{u._id}</Mono>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Account">
          <KeyValue
            items={[
              ['Created', dateTime(u.createdAt)],
              ['Plan type', String(u.planType || '—')],
              ['Email verified', data.auth.emailVerified ? 'yes' : 'no'],
              ['BankID', (u.identityVerification as { verifiedAt?: string } | undefined)?.verifiedAt ? `verified ${ago((u.identityVerification as { verifiedAt: string }).verifiedAt)}` : 'not verified'],
              ['Payout onboarding', String(u.payoutOnboardingStatus || '—')],
              ['Payouts / charges', `${u.payoutEnabled ? 'on' : 'off'} / ${u.chargesEnabled ? 'on' : 'off'}`],
              ['Deactivated', u.deactivatedAt ? dateTime(u.deactivatedAt as string) : '—'],
            ]}
          />
        </Section>
        <Section title="Authentication">
          <KeyValue
            items={[
              ['Last login', data.auth.lastLogin ? `${ago(data.auth.lastLogin)}` : 'never'],
              ['Active sessions', data.auth.activeSessions],
              ['Sign-in methods', ['password', ...data.auth.oauth].join(', ')],
              ['MFA', <span key="m" className="text-muted-foreground">not available in Jobblo</span>],
              ['Failed logins / lockout', <span key="f" className="text-muted-foreground">not tracked per user (IP rate limited)</span>],
            ]}
          />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" /> Passwords, tokens and bank details are never sent here.
          </p>
        </Section>
        <Section title="Subscription">
          {data.subscription ? (
            <KeyValue
              items={[
                ['Plan', data.subscription.planId?.name || data.subscription.planType],
                ['Status', <StatusBadge key="s" status={data.subscription.status} />],
                ['Mode', data.subscription.stripeMode],
                ['Auto-renew', data.subscription.autoRenew ? 'on' : 'off'],
                ['Next renewal', dateTime(data.subscription.nextRenewalAt)],
                ['Recovery', data.subscription.paymentRecoveryStatus],
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No subscription.</p>
          )}
        </Section>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="money">Payment issues ({data.paymentIssues.length})</TabsTrigger>
          <TabsTrigger value="errors">API errors ({data.errors.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({data.auth.sessions.length})</TabsTrigger>
          <TabsTrigger value="support">Support ({data.tickets.length + data.disputes.length})</TabsTrigger>
          <TabsTrigger value="roles">Role history ({data.roleChanges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="pt-3">
          <Section title="Account timeline" description="Newest first">
            <Timeline events={data.timeline} />
          </Section>
        </TabsContent>
        <TabsContent value="jobs" className="grid gap-4 pt-3 md:grid-cols-2">
          <Section title="As customer">
            <CountBars counts={data.jobs.asCustomer} />
          </Section>
          <Section title="As provider">
            <CountBars counts={data.jobs.asProvider} />
          </Section>
        </TabsContent>
        <TabsContent value="money" className="pt-3">
          <Section title="Refund & payout problems on this user's jobs">
            {data.paymentIssues.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {data.paymentIssues.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      <span>{p.kind}</span>
                      {p.detail && <span className="text-xs text-muted-foreground">{p.detail}</span>}
                    </span>
                    <Link className="font-mono text-xs text-primary hover:underline" to={`/developer/jobs?id=${p.orderId}`}>
                      {p.orderId}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payment issues.</p>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="errors" className="pt-3">
          <Section title="Errors raised during this user's requests">
            {data.errors.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {data.errors.map((e) => (
                  <li key={e._id} className="px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs">{e.errorCode}</span>
                      <span className="text-xs text-muted-foreground">{ago(e.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.route} — {e.message}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No errors.</p>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="sessions" className="pt-3">
          <Section title="Sessions" description="Device and last activity only">
            <ul className="divide-y rounded-md border text-sm">
              {data.auth.sessions.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Monitor className="size-4 text-muted-foreground" />
                    {s.deviceName || [s.browser, s.os].filter(Boolean).join(' · ') || s.device || 'Unknown device'}
                    {s.location && <span className="text-xs text-muted-foreground">{s.location}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">last used {ago(s.lastUsed || s.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
        <TabsContent value="support" className="grid gap-4 pt-3 md:grid-cols-2">
          <Section title="Support tickets">
            {data.tickets.length ? (
              <ul className="space-y-2 text-sm">
                {data.tickets.map((t) => (
                  <li key={t._id} className="flex justify-between gap-2">
                    <span className="truncate">{t.subject}</span>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tickets.</p>
            )}
          </Section>
          <Section title="Disputes">
            {data.disputes.length ? (
              <ul className="space-y-2 text-sm">
                {data.disputes.map((d) => (
                  <li key={d._id} className="flex justify-between gap-2">
                    <Link className="truncate text-primary hover:underline" to={`/developer/jobs?id=${d.orderId}`}>
                      {d.title}
                    </Link>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No disputes.</p>
            )}
          </Section>
        </TabsContent>
        <TabsContent value="roles" className="pt-3">
          <Section title="Role & permission history" description="From the audit log">
            {data.roleChanges.length ? (
              <Timeline events={data.roleChanges.map((r) => ({ at: r.createdAt, source: 'audit', title: r.description, by: r.adminId?.name, tone: 'info' }))} reverse />
            ) : (
              <p className="text-sm text-muted-foreground">Role never changed.</p>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function UserDiagnosticsPage() {
  const [f, setF] = useUrlFilters({ id: '', q: '' });
  const [input, setInput] = useState(f.q);
  const { data, isFetching } = useDevUsers(f.q);

  const columns: Column<UserHit>[] = [
    { key: 'name', header: 'User', cell: (u) => <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div> },
    { key: 'role', header: 'Role', cell: (u) => <StatusBadge status={u.role} tone="info" /> },
    { key: 'status', header: 'Status', cell: (u) => <StatusBadge status={u.isDeleted ? 'deleted' : u.accountStatus} tone={u.isDeleted ? 'danger' : 'success'} /> },
    { key: 'login', header: 'Last login', cell: (u) => <span className="text-xs text-muted-foreground">{u.lastLogin ? ago(u.lastLogin) : 'never'}</span> },
    { key: 'created', header: 'Created', align: 'right', cell: (u) => <span className="text-xs text-muted-foreground">{ago(u.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Diagnostics"
        description="Technical view of one account: auth, sessions, jobs, subscription, payment issues and errors. Read-only; account changes stay with Super Admin."
        actions={
          f.id && (
            <Button variant="outline" size="sm" className="bg-card" onClick={() => setF({ id: '' })}>
              <ArrowLeft /> Search
            </Button>
          )
        }
      />
      {f.id ? (
        <UserDetail id={f.id} />
      ) : (
        <>
          <form
            className="flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setF({ q: input.trim() });
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="User ID, email or name prefix" className="bg-card pl-8" aria-label="Search users" />
            </div>
            <Button type="submit" disabled={input.trim().length < 2}>
              Search
            </Button>
          </form>
          {f.q ? (
            <Section title="Results">
              <DataTable columns={columns} rows={data?.users} loading={isFetching} rowKey={(u) => u._id} onRowClick={(u) => setF({ id: u._id })} emptyTitle="No users found" />
            </Section>
          ) : (
            <Section title="Find a user">
              <EmptyState icon={<KeyRound />} title="Search by ID or email" description="Exact user ID, or the start of an email address or name." />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
