import { Skeleton } from '../Ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminLoadingSkeletonProps {
    rows?: number;
    className?: string;
}

export function AdminLoadingSkeleton({ rows = 5, className }: AdminLoadingSkeletonProps) {
    return (
        <div className={cn('space-y-3', className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
        </div>
    );
}

export function AdminStatCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

export function AdminChartSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
        </div>
    );
}

export function AdminTableSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg opacity-70" />
            ))}
        </div>
    );
}
