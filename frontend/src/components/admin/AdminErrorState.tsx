import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
    className?: string;
}

export function AdminErrorState({
    title = 'Noe gikk galt',
    description = 'Kunne ikke laste data. Sjekk nettverkstilkoblingen og prøv igjen.',
    onRetry,
    className,
}: AdminErrorStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-16 text-center',
                className
            )}
            role="alert"
        >
            <div className="p-4 bg-red-50 rounded-2xl mb-4 text-red-400">
                <AlertTriangle size={32} />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
            <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e] focus:ring-offset-2"
                    aria-label="Prøv igjen"
                >
                    <RefreshCw size={15} />
                    Prøv igjen
                </button>
            )}
        </div>
    );
}
