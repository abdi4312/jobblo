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
                'bg-white rounded-[20px] border border-[#e7ebe5] p-5 md:p-6 flex flex-col gap-5 shadow-[0_2px_10px_rgba(24,49,38,0.025)]',
                className
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-[15px] font-semibold text-[#20382d]">{title}</h3>
                    {description && (
                        <p className="text-xs text-[#87928a] mt-1">{description}</p>
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
