import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../developer/ui/select';
import { cn } from '@/lib/utils';

interface FilterOption {
    label: string;
    value: string;
}

interface AdminFilterSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function AdminFilterSelect({
    value,
    onChange,
    options,
    placeholder = 'Alle',
    className,
    disabled,
}: AdminFilterSelectProps) {
    return (
        <Select
            value={value || '__all__'}
            onValueChange={(v) => onChange(v === '__all__' ? '' : v)}
            disabled={disabled}
        >
            <SelectTrigger
                className={cn('h-9 min-w-[140px] bg-card shadow-xs', className)}
                aria-label={placeholder}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="__all__">{placeholder}</SelectItem>
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
