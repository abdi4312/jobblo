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
        <div
            className={cn(
                'bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4',
                className
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                    {description && (
                        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                    )}
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
