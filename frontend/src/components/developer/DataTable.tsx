import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { EmptyState } from './kit';
import type { Pagination } from '../../types/admin';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

/** shadcn Table + loading skeleton, empty state, row click and server pagination. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  emptyTitle = 'No data',
  emptyDescription,
  pagination,
  onPageChange,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T, i: number) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: Pagination | null;
  onPageChange?: (page: number) => void;
  className?: string;
}) {
  const alignClass = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');
  return (
    <div className={cn('overflow-hidden rounded-md border bg-card', className)}>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn('h-9 text-xs font-medium text-muted-foreground', alignClass(c.align), c.className)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !rows?.length
            ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows?.map((row, i) => (
                <TableRow
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(onRowClick && 'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none')}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn('py-2.5 text-sm', alignClass(c.align), c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!loading && !rows?.length && <EmptyState title={emptyTitle} description={emptyDescription} />}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={!pagination.hasPreviousPage} onClick={() => onPageChange(pagination.page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={!pagination.hasNextPage} onClick={() => onPageChange(pagination.page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
