import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../developer/ui/input';

interface AdminSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    disabled?: boolean;
}

export function AdminSearchInput({
    value,
    onChange,
    placeholder = 'Søk...',
    className,
    inputClassName,
    disabled,
}: AdminSearchInputProps) {
    return (
        <div className={cn('relative', className)}>
            <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-muted-foreground"
                aria-hidden="true"
            />
            <Input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    'h-9 w-full rounded-md bg-card pl-9 pr-9 text-sm shadow-xs',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    'placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all',
                    inputClassName
                )}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Tøm søk"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
