import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { ago, dateTime, downloadCsv } from '@/lib/devFormat';
import { useDevAudit, useUrlFilters } from '../../features/developer/hooks';
import type { AuditLog } from '../../api/developer';
import { ErrorState, JsonView, KeyValue, Mono, PageHeader, RangeSelect, RefreshButton, Section, StatusBadge } from '../../components/developer/kit';
import { DataTable, type Column } from '../../components/developer/DataTable';
import { Button } from '../../components/developer/ui/button';
import { Input } from '../../components/developer/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/developer/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/developer/ui/sheet';

export default function AuditPage() {
  const [f, setF] = useUrlFilters({ range: '30d', action: 'all', q: '', page: '1' });
  const [search, setSearch] = useState(f.q);
  const [log, setLog] = useState<AuditLog | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useDevAudit({
    range: f.range as '30d',
    action: f.action === 'all' ? undefined : f.action,
    q: f.q || undefined,
    page: f.page,
    limit: 50,
  });

  const columns: Column<AuditLog>[] = [
    { key: 'at', header: 'Time', cell: (l) => <span className="text-xs whitespace-nowrap text-muted-foreground" title={dateTime(l.createdAt)}>{ago(l.createdAt)}</span> },
    {
      key: 'actor',
      header: 'Actor',
      cell: (l) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{l.adminId?.name || 'System'}</div>
          <div className="text-muted-foreground capitalize">{l.adminId?.role || ''}</div>
        </div>
      ),
    },
    { key: 'action', header: 'Action', cell: (l) => <StatusBadge status={l.action} tone={l.action === 'other' ? 'neutral' : 'info'} /> },
    { key: 'desc', header: 'Description', className: 'max-w-[480px]', cell: (l) => <span className="block truncate">{l.description}</span> },
    { key: 'target', header: 'Target', cell: (l) => <span className="text-xs text-muted-foreground">{l.targetModel !== 'other' ? l.targetModel : (l.metadata?.area as string) || '—'}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Append-only record of admin and developer actions. Sensitive metadata is redacted."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={!data?.logs.length}
              onClick={() => downloadCsv(`audit-${f.range}.csv`, (data?.logs || []).map((l) => ({ time: l.createdAt, actor: l.adminId?.name || 'System', role: l.adminId?.role || '', action: l.action, description: l.description, target: l.targetModel, targetId: l.targetId, ip: l.ip })))}
            >
              <Download /> Export page
            </Button>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
          </>
        }
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Section
        title="Events"
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
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description…" className="h-7 w-52 pl-7 text-xs" aria-label="Search audit log" />
            </form>
            <Select value={f.action} onValueChange={(action) => setF({ action })}>
              <SelectTrigger size="sm" className="w-44" aria-label="Action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(data?.actions || []).filter((a) => !a.startsWith('error_')).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <DataTable columns={columns} rows={data?.logs} loading={isLoading} rowKey={(l) => l._id} onRowClick={setLog} pagination={data?.pagination} onPageChange={(p) => setF({ page: String(p) })} emptyTitle="No audit events in range" />
      </Section>

      <Sheet open={Boolean(log)} onOpenChange={(o) => !o && setLog(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {log && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="text-sm">{log.description}</SheetTitle>
                <SheetDescription>{dateTime(log.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto p-4">
                <KeyValue
                  items={[
                    ['Actor', log.adminId ? `${log.adminId.name} (${log.adminId.role || '—'})` : 'System'],
                    ['Action', log.action],
                    ['Severity', log.severity],
                    ['Target', log.targetModel],
                    ['Target ID', log.targetId ? <Mono key="t">{log.targetId}</Mono> : '—'],
                    ['IP', log.ip || '—'],
                    ['Entry ID', <Mono key="i">{log._id}</Mono>],
                  ]}
                />
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Metadata</h4>
                  <JsonView value={log.metadata} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
