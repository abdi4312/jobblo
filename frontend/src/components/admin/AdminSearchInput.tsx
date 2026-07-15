import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../Ui/Input';

interface AdminSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function AdminSearchInput({
    value,
    onChange,
    placeholder = 'Søk...',
    className,
    disabled,
}: AdminSearchInputProps) {
    return (
        <div className={cn('relative', className)}>
            <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
                aria-hidden="true"
            />
            <Input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                    'w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border-gray-200 bg-gray-50',
                    'focus:bg-white focus:border-[#2d4a3e] focus:ring-2 focus:ring-[#2d4a3e]/10 focus:outline-none',
                    'placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all'
                )}
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Tøm søk"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
