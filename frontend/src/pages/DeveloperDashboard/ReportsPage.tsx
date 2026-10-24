import { CalendarClock, Download, FileJson, FileText, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateTime, downloadCsv } from '@/lib/devFormat';
import { useDevReport, useDevReportTypes, useUrlFilters } from '../../features/developer/hooks';
import type { ReportSection } from '../../api/developer';
import { EmptyState, ErrorState, NotConfigured, PageHeader, RangeSelect, Section } from '../../components/developer/kit';
import { Button } from '../../components/developer/ui/button';
import { Skeleton } from '../../components/developer/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/developer/ui/table';

const cell = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dateTime(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function SectionView({ s }: { s: ReportSection }) {
  if (!s.rows.length) return <Section title={s.title}><p className="text-sm text-muted-foreground">No data in range.</p></Section>;
  const cols = Object.keys(s.rows[0]);
  return (
    <Section title={s.title} className="break-inside-avoid" action={<Button variant="ghost" size="xs" className="print:hidden" onClick={() => downloadCsv(`${s.title.toLowerCase().replace(/\W+/g, '-')}.csv`, s.rows)}><Download /> CSV</Button>}>
      {s.kind === 'kv' ? (
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {s.rows.map((r) => (
            <div key={String(r.metric)} className="flex justify-between gap-3 border-b border-dashed py-1">
              <dt className="text-muted-foreground">{String(r.metric)}</dt>
              <dd className="font-medium tabular-nums">{cell(r.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c} className="h-8 text-xs capitalize">
                    {c.replace(/([A-Z])/g, ' $1')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.rows.map((r, i) => (
                <TableRow key={i}>
                  {cols.map((c) => (
                    <TableCell key={c} className="py-1.5 text-xs">
                      {cell(r[c])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

export default function ReportsPage() {
  const [f, setF] = useUrlFilters({ type: 'health', range: '7d' });
  const { data: types } = useDevReportTypes();
  const { data, isFetching, error, refetch } = useDevReport(f.type, { range: f.range as '7d' });

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `${f.type}-report.json` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & Analytics"
        description="Technical reports generated on demand from live data. Every generation is recorded in the audit log."
        actions={
          <>
            <RangeSelect value={f.range} onChange={(range) => setF({ range })} />
            <Button variant="outline" size="sm" className="bg-card" disabled={!data} onClick={exportJson}>
              <FileJson /> JSON
            </Button>
            <Button variant="outline" size="sm" className="bg-card" disabled={!data} onClick={() => window.print()}>
              <Printer /> Print / PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <div className="space-y-4 print:hidden">
          <nav className="flex flex-col gap-0.5 rounded-md border bg-card p-1.5" aria-label="Report types">
            {types?.types.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setF({ type: t.key })}
                className={cn('flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-muted', f.type === t.key && 'bg-accent font-medium text-accent-foreground')}
              >
                <FileText className="size-3.5 text-muted-foreground" />
                {t.title}
              </button>
            ))}
          </nav>
          <Section title="Scheduled reports">
            <NotConfigured title="Not scheduled" description="Reports are generated on demand. Scheduled email delivery is not set up." />
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {isFetching && !data ? (
            <Skeleton className="h-96 w-full" />
          ) : data ? (
            <>
              <div className="rounded-md border bg-card px-4 py-3">
                <h2 className="text-lg font-semibold">{data.title} report</h2>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {dateTime(data.range.from)} – {dateTime(data.range.to)} · {data.environment} · generated {dateTime(data.generatedAt)}
                </p>
              </div>
              {data.sections.map((s) => (
                <SectionView key={s.title} s={s} />
              ))}
            </>
          ) : (
            <EmptyState title="Pick a report" />
          )}
        </div>
      </div>
    </div>
  );
}
