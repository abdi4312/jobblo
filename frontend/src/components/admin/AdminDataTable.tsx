import React from 'react';
import { cn } from '@/lib/utils';
import { AdminLoadingSkeleton } from './AdminLoadingSkeleton';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminErrorState } from './AdminErrorState';
import { AdminPagination } from './AdminPagination';
import type { Pagination } from '../../types/admin';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '../developer/ui/table';

export interface ColumnDef<T> {
    key: string;
    header: string;
    render: (row: T) => React.ReactNode;
    className?: string;
    headerClassName?: string;
}

interface AdminDataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    emptyTitle?: string;
    emptyDescription?: string;
    pagination?: Pagination;
    onPageChange?: (page: number) => void;
    toolbar?: React.ReactNode;
    className?: string;
}

export function AdminDataTable<T>({
    columns,
    data,
    keyExtractor,
    loading,
    error,
    onRetry,
    emptyTitle,
    emptyDescription,
    pagination,
    onPageChange,
    toolbar,
    className,
}: AdminDataTableProps<T>) {
    return (
        <div className={cn('overflow-hidden rounded-lg border bg-card shadow-xs', className)} translate="no">
            {toolbar && (
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                    {toolbar}
                </div>
            )}

            {loading ? (
                <div className="p-6">
                    <AdminLoadingSkeleton rows={6} />
                </div>
            ) : error ? (
                <AdminErrorState onRetry={onRetry} />
            ) : data.length === 0 ? (
                <AdminEmptyState title={emptyTitle} description={emptyDescription} />
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                {columns.map((col) => (
                                    <TableHead
                                        key={col.key}
                                        className={cn(
                                            'h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground',
                                            col.headerClassName
                                        )}
                                    >
                                        {col.header}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody className="">
                            {data.map((row) => (
                                <TableRow
                                    key={keyExtractor(row)}
                                    className="transition-colors hover:bg-muted/40"
                                >
                                    {columns.map((col) => (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                'px-3 py-2.5 text-sm text-foreground',
                                                col.className
                                            )}
                                        >
                                            {col.render(row)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {pagination && onPageChange && !loading && !error && data.length > 0 && (
                <div className="border-t px-3">
                    <AdminPagination pagination={pagination} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    );
}
