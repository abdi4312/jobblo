import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ClipboardCheck, Clock, X } from 'lucide-react';
import { ago, dateTime } from '@/lib/devFormat';
import { devApi, type ChangeRequestRow } from '../../api/developer';
import { useDevApprovals, useDevMe, useUrlFilters } from '../../features/developer/hooks';
import { errMessage, useRiskConfirm, useStepUp } from '../../features/developer/stepUp';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState, PageHeader, RefreshButton, Section, StatCard, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Label } from '../../components/developer/ui/label';
import { Textarea } from '../../components/developer/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/developer/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../components/developer/ui/tabs';

const STATUS_TONE = { pending: 'info', executed: 'success', rejected: 'neutral', failed: 'danger', expired: 'neutral', cancelled: 'neutral' } as const;

export default function ApprovalsPage() {
  const [f, setF] = useUrlFilters({ view: 'pending' });
  const { data: me } = useDevMe();
  const { data, isLoading, isFetching, error, refetch } = useDevApprovals({ status: f.view === 'pending' ? 'pending' : undefined, mine: f.view === 'mine' ? 'true' : undefined });
  const withStepUp = useStepUp();
  const withRisk = useRiskConfirm();
  const qc = useQueryClient();
  const [review, setReview] = useState<{ r: ChangeRequestRow; decision: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => ['approvals', 'blocks', 'ips', 'security', 'flags', 'settings'].forEach((k) => qc.invalidateQueries({ queryKey: ['dev', k] }));

  const decide = async () => {
    if (!review) return;
    setBusy(true);
    try {
      if (review.decision === 'approve') await withRisk((ack) => withStepUp((token) => devApi.approve(review.r._id, note, token, ack)));
      else await devApi.reject(review.r._id, note);
      toast.success(review.decision === 'approve' ? 'Approved and executed' : 'Rejected');
      setReview(null);
      setNote('');
      refresh();
    } catch (e) {
      if ((e as Error)?.message !== 'cancelled') toast.error(errMessage(e));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r: ChangeRequestRow) => {
    try {
      await devApi.cancelRequest(r._id);
      toast.success('Request cancelled');
      refresh();
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  const columns: Column<ChangeRequestRow>[] = [
    { key: 'summary', header: 'Change', className: 'max-w-[360px]', cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.summary}</div><div className="truncate text-xs text-muted-foreground">{r.reason}</div></div> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} tone={STATUS_TONE[r.status]} /> },
    { key: 'by', header: 'Requested by', cell: (r) => <span className="text-xs">{r.requestedBy?.name || '—'} · {ago(r.createdAt)}</span> },
    { key: 'review', header: 'Reviewed', cell: (r) => <span className="text-xs text-muted-foreground">{r.reviewedBy ? `${r.reviewedBy.name} · ${ago(r.reviewedAt)}` : r.status === 'pending' ? `expires ${ago(r.expiresAt)}` : '—'}{r.error ? <span className="block text-red-600">{r.error}</span> : null}</span> },
    { key: 'env', header: 'Env', cell: (r) => <StatusBadge status={r.environment} tone={r.environment === 'production' ? 'danger' : 'neutral'} /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status !== 'pending' ? null : me?.can.approve && r.requestedBy?._id !== me._id ? (
          <span className="flex justify-end gap-1">
            <Button size="xs" onClick={() => setReview({ r, decision: 'approve' })}>
              <Check /> Approve
            </Button>
            <Button size="xs" variant="outline" onClick={() => setReview({ r, decision: 'reject' })}>
              <X /> Reject
            </Button>
          </span>
        ) : r.requestedBy?._id === me?._id ? (
          <Button size="xs" variant="ghost" onClick={() => cancel(r)}>
            Cancel
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{r.requestedBy?._id === me?._id ? '' : 'awaiting Super Admin'}</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        description="Sensitive changes requested by operations developers. A Super Admin other than the requester approves (with a one-time code), which runs the change. Requests expire after 24 hours."
        actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Pending" icon={<Clock />} tone={data?.pending ? 'warning' : 'success'} loading={isLoading} value={data?.pending ?? '—'} />
        <StatCard label="Your access" icon={<ClipboardCheck />} tone="info" loading={!me} value={<span className="capitalize">{me?.access}</span>} hint={me?.can.approve ? 'You can approve' : me?.can.request ? 'You can request changes' : 'View only'} />
      </div>

      <Section
        title="Requests"
        action={
          <Tabs value={f.view} onValueChange={(view) => setF({ view })}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <DataTable columns={columns} rows={data?.requests} loading={isLoading} rowKey={(r) => r._id} emptyTitle={f.view === 'pending' ? 'Nothing waiting for approval' : 'No requests'} />
      </Section>

      <Dialog open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{review?.decision === 'approve' ? 'Approve and run' : 'Reject'}: {review?.r.summary}</DialogTitle>
            <DialogDescription>
              Requested by {review?.r.requestedBy?.name} {review ? dateTime(review.r.createdAt) : ''}. Reason: “{review?.r.reason}”.
              {review?.decision === 'approve' ? ' Approving runs the change immediately, under your name.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="review-note">Note (optional)</Label>
            <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <Button variant={review?.decision === 'approve' ? 'default' : 'destructive'} disabled={busy} onClick={decide}>
              {review?.decision === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
