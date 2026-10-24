import { Skeleton } from '../developer/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminLoadingSkeletonProps {
    rows?: number;
    className?: string;
}

export function AdminLoadingSkeleton({ rows = 5, className }: AdminLoadingSkeletonProps) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
            ))}
        </div>
    );
}

export function AdminStatCardSkeleton() {
    return (
        <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-7 rounded-md" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
        </div>
    );
}

export function AdminChartSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}
