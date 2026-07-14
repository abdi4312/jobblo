import React from 'react';
import { cn } from '@/lib/utils';
import { AdminLoadingSkeleton } from './AdminLoadingSkeleton';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminErrorState } from './AdminErrorState';
import { AdminPagination } from './AdminPagination';
import type { Pagination } from '../../types/admin';

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
        <div className={cn('bg-white rounded-2xl border border-gray-100 overflow-hidden', className)}>
            {toolbar && (
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
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
                    <table className="w-full text-sm" role="grid">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className={cn(
                                            'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                                            col.headerClassName
                                        )}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.map((row) => (
                                <tr
                                    key={keyExtractor(row)}
                                    className="hover:bg-gray-50/50 transition-colors"
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className={cn(
                                                'px-4 py-3 text-gray-700 align-middle',
                                                col.className
                                            )}
                                        >
                                            {col.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pagination && onPageChange && !loading && !error && data.length > 0 && (
                <div className="px-4 border-t border-gray-100">
                    <AdminPagination pagination={pagination} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    );
}
