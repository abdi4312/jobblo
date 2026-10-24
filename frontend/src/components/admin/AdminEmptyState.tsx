import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminEmptyStateProps {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

/** Centred icon box, title and description — the Developer Console's EmptyState. */
export function AdminEmptyState({
    title = 'Ingen resultater',
    description = 'Det er ingen data å vise her ennå.',
    icon,
    action,
    className,
}: AdminEmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)} role="status" aria-label={title}>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border bg-muted text-muted-foreground [&_svg]:size-5">
                {icon ?? <Inbox />}
            </div>
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
