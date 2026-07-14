import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminEmptyStateProps {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export function AdminEmptyState({
    title = 'Ingen resultater',
    description = 'Det er ingen data å vise her ennå.',
    icon,
    action,
    className,
}: AdminEmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-16 text-center',
                className
            )}
            role="status"
            aria-label={title}
        >
            <div className="p-4 bg-gray-100 rounded-2xl mb-4 text-gray-400">
                {icon ?? <Inbox size={32} />}
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
            <p className="text-sm text-gray-400 max-w-xs">{description}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
