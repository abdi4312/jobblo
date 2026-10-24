import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../developer/ui/button';

interface AdminErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
    className?: string;
}

/** shadcn error block, styled like the Developer Console's ErrorState. */
export function AdminErrorState({
    title = 'Noe gikk galt',
    description = 'Kunne ikke laste data. Sjekk nettverkstilkoblingen og prøv igjen.',
    onRetry,
    className,
}: AdminErrorStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)} role="alert">
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-red-200/70 bg-red-50 text-red-600">
                <AlertTriangle className="size-5" />
            </div>
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
            {onRetry && (
                <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
                    <RefreshCw /> Prøv igjen
                </Button>
            )}
        </div>
    );
}
