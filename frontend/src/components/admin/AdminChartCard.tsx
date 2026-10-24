import React from 'react';
import { cn } from '@/lib/utils';
import { AdminChartSkeleton } from './AdminLoadingSkeleton';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminErrorState } from './AdminErrorState';

interface AdminChartCardProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    loading?: boolean;
    error?: boolean;
    onRetry?: () => void;
    isEmpty?: boolean;
    emptyTitle?: string;
    action?: React.ReactNode;
    className?: string;
}

export function AdminChartCard({
    title,
    description,
    children,
    loading,
    error,
    onRetry,
    isEmpty,
    emptyTitle,
    action,
    className,
}: AdminChartCardProps) {
    return (
        <div className={cn('flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-xs', className)}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-medium text-foreground">{title}</h3>
                    {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>

            {loading ? (
                <AdminChartSkeleton />
            ) : error ? (
                <AdminErrorState onRetry={onRetry} className="py-8" />
            ) : isEmpty ? (
                <AdminEmptyState title={emptyTitle} className="py-8" />
            ) : (
                <div className="w-full min-h-[200px]">{children}</div>
            )}
        </div>
    );
}
