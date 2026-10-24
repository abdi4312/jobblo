import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Eye, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion, UserX } from 'lucide-react';
import { ago, dateTime } from '@/lib/devFormat';
import { cn } from '@/lib/utils';
import { devApi, type FraudFlag, type FraudStatus } from '../../api/developer';
import { useDevFraud, useDevFraudCase, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { errMessage } from '../../features/developer/stepUp';
import { ErrorState, PageHeader, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Label } from '../../components/developer/ui/label';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Textarea } from '../../components/developer/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

const LEVEL_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;
const STATUS_TONE: Record<FraudStatus, 'info' | 'warning' | 'danger' | 'neutral'> = { open: 'info', investigating: 'warning', confirmed: 'danger', dismissed: 'neutral' };

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', score >= 60 ? 'bg-red-500' : score >= 30 ? 'bg-amber-500' : 'bg-muted-foreground/40')} style={{ width: `${score}%` }} />
      </div>
      <span className="tabular-nums text-sm font-medium">{score}</span>
    </div>
  );
}

function CaseSheet({ userId, onClose, canAct }: { userId: string | null; onClose: () => void; canAct: boolean }) {
  const { data, isLoading, error } = useDevFraudCase(userId || undefined);
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<FraudStatus | null>(null);
  useEffect(() => setNote(''), [userId]);
  const decide = async (status: FraudStatus) => {
    setBusy(status);
    try {
      await devApi.updateFraudCase(userId!, status, note.trim());
      toast.success(`Case marked ${status}`);
      qc.invalidateQueries({ queryKey: ['dev', 'fraud'] });
      setNote('');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={Boolean(userId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{data?.user?.name || 'Case'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {data && <StatusBadge status={data.level} tone={LEVEL_TONE[data.level]} />}
            {data && <StatusBadge status={data.status} tone={STATUS_TONE[data.status]} />}
            {data && <span>score {data.score}/100 · {data.user?.email}</span>}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto p-4 text-sm">
          {isLoading && <Skeleton className="h-60 w-full" />}
          {error && <ErrorState error={error} />}
          {data && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/dashboard/users/${data.userId}`}>
                    Admin user page <ArrowUpRight />
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/developer/users?id=${data.userId}`}>
                    Technical view <ArrowUpRight />
                  </Link>
                </Button>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Why this account was flagged</h4>
                <ul className="space-y-2">
                  {data.hits.map((h, i) => (
                    <li key={i} className="rounded-md border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{data.rules.find((r) => r.key === h.rule)?.title || h.rule}</span>
                        <Badge variant="outline">+{h.weight}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{h.evidence}</p>
                      {h.refs?.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {h.refs.map((r) => (
                            <Link key={r.id} to={r.type === 'order' ? `/dashboard/orders/${r.id}` : `/dashboard/chats/${r.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              {r.type === 'chat' && <Eye className="size-3" />}
                              {r.type} {r.id.slice(-8).toUpperCase()}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Chat contents are not shown here — open a chat through admin chat review, which records access.</p>
              </div>
              {data.related.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Linked accounts</h4>
                  <ul className="space-y-1">
                    {data.related.map((u) => (
                      <li key={u._id} className="flex items-center justify-between gap-2">
                        <Link to={`/dashboard/users/${u._id}`} className="truncate hover:underline">
                          {u.name} <span className="text-xs text-muted-foreground">{u.email}</span>
                        </Link>
                        {u.flagged && <Badge variant="destructive">flagged</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canAct && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label htmlFor="fraud-note">Decision note</Label>
                  <Textarea id="fraud-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you check? (required to confirm or dismiss)" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => decide('investigating')}>
                      <ShieldQuestion /> Investigating
                    </Button>
                    <Button size="sm" variant="destructive" disabled={Boolean(busy) || note.trim().length < 5} onClick={() => decide('confirmed')}>
                      <UserX /> Confirm abuse
                    </Button>
                    <Button size="sm" variant="outline" disabled={Boolean(busy) || note.trim().length < 5} onClick={() => decide('dismissed')}>
                      <ShieldCheck /> Dismiss
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Confirming does not touch the account — hand it to an admin to suspend or refund. A dismissed case returns only if new evidence raises its score.</p>
                </div>
              )}
              {data.history.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Review history</h4>
                  <ul className="space-y-1.5 text-xs">
                    {data.history.map((h, i) => (
                      <li key={i}>
                        <span className="font-medium capitalize">{h.status}</span> by {h.by?.name || '—'} · {dateTime(h.at)} · score {h.score ?? '—'}
                        {h.note && <span className="block text-muted-foreground">“{h.note}”</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function FraudPage() {
  const [f, setF] = useUrlFilters({ view: 'open', user: '' });
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevFraud();
  const qc = useQueryClient();
  const canAct = Boolean(me?.can.request || me?.can.execute);
  const rows = (data?.flagged || []).filter((x) => (f.view === 'all' ? true : f.view === 'open' ? ['open', 'investigating'].includes(x.status) : x.status === f.view));

  const rescan = async () => {
    try {
      qc.setQueryData(['dev', 'fraud'], await devApi.fraud(true));
      toast.success('Rescanned');
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const columns: Column<FraudFlag>[] = [
    { key: 'user', header: 'Account', cell: (x) => <div className="min-w-0"><div className="truncate font-medium">{x.user?.name}</div><div className="truncate text-xs text-muted-foreground">{x.user?.email} · joined {ago(x.user?.createdAt)}</div></div> },
    { key: 'score', header: 'Risk', cell: (x) => <div className="flex items-center gap-2"><ScoreBar score={x.score} /><StatusBadge status={x.level} tone={LEVEL_TONE[x.level]} /></div> },
    { key: 'why', header: 'Why', className: 'max-w-[420px]', cell: (x) => <div className="min-w-0"><div className="flex flex-wrap gap-1">{x.rules.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{data?.ruleStats.find((s) => s.key === r)?.title || r}</Badge>)}</div><div className="mt-0.5 truncate text-xs text-muted-foreground" title={x.topEvidence.join(' · ')}>{x.topEvidence[0]}</div></div> },
    { key: 'status', header: 'Status', cell: (x) => <span className="flex items-center gap-1"><StatusBadge status={x.status} tone={STATUS_TONE[x.status]} />{x.reopened && <Badge variant="outline" className="text-[10px]">new evidence</Badge>}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fraud & Abuse"
        description="Explainable rules over real activity — shared networks and devices, customer/provider collusion, refund and dispute patterns, chargebacks, off-platform payment attempts in chat, listing and review manipulation, card testing. Every flag shows its evidence; nothing here changes an account."
        actions={
          <Button size="sm" variant="outline" className="bg-card" onClick={rescan} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} /> Rescan
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="High risk" icon={<ShieldAlert />} tone={data?.summary.high ? 'danger' : 'success'} loading={isLoading} value={data?.summary.high ?? '—'} hint="open, score ≥ 60" />
        <StatCard label="Medium risk" icon={<ShieldAlert />} tone={data?.summary.medium ? 'warning' : 'success'} loading={isLoading} value={data?.summary.medium ?? '—'} hint="open, score 30–59" />
        <StatCard label="Investigating" icon={<ShieldQuestion />} loading={isLoading} value={data?.summary.investigating ?? '—'} />
        <StatCard label="Confirmed" icon={<UserX />} tone={data?.summary.confirmed ? 'danger' : 'neutral'} loading={isLoading} value={data?.summary.confirmed ?? '—'} />
        <StatCard label="Scanned" icon={<ShieldCheck />} loading={isLoading} value={data ? `${data.sessionsScanned}` : '—'} hint={data ? `sessions · ${ago(data.generatedAt)}` : ''} />
      </div>

      <Section
        title="Flagged accounts"
        description="Click an account for the evidence, linked accounts and the review decision."
        action={
          <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
            <TabsList>
              <TabsTrigger value="open">Needs review</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <DataTable columns={columns} rows={rows} loading={isLoading} rowKey={(x) => x.userId} onRowClick={(x) => setF({ user: x.userId })} emptyTitle={f.view === 'open' ? 'Nothing needs review' : 'No accounts'} />
      </Section>

      <Section title="Rules" description="Accounts each rule currently flags. Private and local IP addresses are ignored by the network rules.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data?.ruleStats.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.error ? <span className="text-red-600">{r.error}</span> : r.category}</div>
              </div>
              <span className={cn('tabular-nums font-medium', r.users ? 'text-amber-600' : 'text-muted-foreground')}>{r.users}</span>
            </div>
          ))}
        </div>
      </Section>

      <CaseSheet userId={f.user || null} onClose={() => setF({ user: '' })} canAct={canAct} />
    </div>
  );
}
