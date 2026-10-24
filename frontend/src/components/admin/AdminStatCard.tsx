import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface AdminStatCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    /** Calculated % change vs previous period. Pass null when no prior data. */
    change?: number | null;
    changeSuffix?: string;
    subtitle?: string;
    to?: string;
    onClick?: () => void;
    active?: boolean;
    className?: string;
    iconClassName?: string;
    loading?: boolean;
}

export function AdminStatCard({
    title,
    value,
    icon,
    change,
    changeSuffix = 'siste måned',
    subtitle,
    to,
    onClick,
    active = false,
    className,
    iconClassName,
}: AdminStatCardProps) {
    const hasChange = change !== undefined && change !== null;

    const trendEl = hasChange ? (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
                change > 0 ? 'text-emerald-700' : change < 0 ? 'text-red-600' : 'text-muted-foreground'
            )}
            aria-label={`${change > 0 ? 'Økning' : change < 0 ? 'Nedgang' : 'Ingen endring'} på ${Math.abs(change)}%`}
        >
            {change > 0 ? <TrendingUp size={13} /> : change < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            {change > 0 ? '+' : ''}
            {change}% {changeSuffix}
        </span>
    ) : null;

    // Developer Console StatCard: uppercase label, tinted icon, large tabular value.
    const content = (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
                <div
                    className={cn('flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4', iconClassName)}
                    aria-hidden="true"
                >
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
                {typeof value === 'number' ? value.toLocaleString('nb-NO') : value}
            </p>
            <div className="flex min-h-4 items-center gap-2">
                {trendEl}
                {!hasChange && subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
            </div>
        </>
    );

    const cardClassName = cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'border-primary/50 ring-2 ring-primary/15' : '',
        (to || onClick) && 'hover:bg-muted/40',
        className
    );

    if (to) {
        return (
            <Link to={to} className="block h-full">
                <div className={cn(cardClassName, 'cursor-pointer')}>{content}</div>
            </Link>
        );
    }
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-pressed={active}
                className={cn(cardClassName, 'w-full cursor-pointer')}
            >
                {content}
            </button>
        );
    }
    return <div className={cardClassName}>{content}</div>;
}
