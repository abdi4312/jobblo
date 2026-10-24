import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { ago, dateTime, num } from '@/lib/devFormat';
import type { IpBlockRow } from '../../api/developer';
import { useDevBlocks, useDevMe } from '../../features/developer/hooks';
import { useSensitiveAction } from '../../features/developer/stepUp';
import { DataTable, type Column } from './DataTable';
import { EmptyState } from './kit';
import { ReasonDialog } from './ReasonDialog';
import { Button } from './ui/button';

/** Active IP blocks with unblock. Shared by Security Center and IP Management. */
export function BlockedIpsTable({ onPick }: { onPick?: (target: string) => void }) {
  const { data: me } = useDevMe();
  const { data, isLoading } = useDevBlocks();
  const submit = useSensitiveAction(['blocks', 'security', 'ips']);
  const [unblocking, setUnblocking] = useState<IpBlockRow | null>(null);
  const canAct = Boolean(me?.can.execute || me?.can.request);

  const columns: Column<IpBlockRow>[] = [
    { key: 'target', header: 'IP / range', cell: (x) => <span className="font-mono text-xs">{x.target}</span> },
    { key: 'reason', header: 'Reason', className: 'max-w-[320px]', cell: (x) => <span className="block truncate text-xs" title={x.reason}>{x.reason}</span> },
    { key: 'by', header: 'Blocked by', cell: (x) => <span className="text-xs">{x.createdBy?.name || '—'} · {ago(x.createdAt)}</span> },
    { key: 'expires', header: 'Expires', cell: (x) => <span className="text-xs text-muted-foreground">{x.expiresAt ? dateTime(x.expiresAt) : 'never'}</span> },
    { key: 'hits', header: 'Refused requests', align: 'right', cell: (x) => <span className="tabular-nums">{num(x.blockedRequests)}{x.lastBlockedAt ? <span className="ml-1 text-xs text-muted-foreground">· {ago(x.lastBlockedAt)}</span> : null}</span> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (x) =>
        canAct ? (
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setUnblocking(x);
            }}
          >
            <ShieldOff /> Unblock
          </Button>
        ) : null,
    },
  ];

  if (!isLoading && !data?.blocks.length) {
    return <EmptyState title="No blocked IPs" description="Block an IP from IP Management, Security Center or API Monitoring." />;
  }
  return (
    <>
      <DataTable columns={columns} rows={data?.blocks} loading={isLoading} rowKey={(x) => x._id} onRowClick={onPick && ((x) => onPick(x.target))} />
      <ReasonDialog
        open={Boolean(unblocking)}
        onOpenChange={(o) => !o && setUnblocking(null)}
        title={`Unblock ${unblocking?.target ?? ''}`}
        description="Requests from this address will be accepted again within 30 seconds."
        confirmLabel="Unblock"
        selfService
        onConfirm={(reason) => submit('ip_unblock', { id: unblocking!._id }, reason)}
      />
    </>
  );
}
