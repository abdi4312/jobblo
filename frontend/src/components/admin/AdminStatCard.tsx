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
                'inline-flex items-center gap-1 text-xs font-medium',
                change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-gray-400'
            )}
            aria-label={`${change > 0 ? 'Økning' : change < 0 ? 'Nedgang' : 'Ingen endring'} på ${Math.abs(change)}%`}
        >
            {change > 0 ? (
                <TrendingUp size={13} />
            ) : change < 0 ? (
                <TrendingDown size={13} />
            ) : (
                <Minus size={13} />
            )}
            {change > 0 ? '+' : ''}
            {change}% {changeSuffix}
        </span>
    ) : null;

    const content = (
        <>
            <div className="flex items-start justify-between">
                <p className="text-sm text-[#758078] font-medium">{title}</p>
                <div
                    className={cn(
                        'p-2.5 rounded-2xl bg-[#eaf1e9] text-[#38644a]',
                        iconClassName
                    )}
                    aria-hidden="true"
                >
                    {icon}
                </div>
            </div>
            <p className="text-[2rem] font-semibold text-[#183126] tracking-tight leading-none tabular-nums">
                {typeof value === 'number' ? value.toLocaleString('nb-NO') : value}
            </p>
            <div className="flex items-center gap-2 min-h-[20px] border-t border-[#e4e9e2] pt-3">
                {trendEl}
                {!hasChange && subtitle && (
                    <span className="text-xs text-gray-400">{subtitle}</span>
                )}
            </div>
        </>
    );

    const cardClassName = cn(
        'relative flex flex-col gap-4 overflow-hidden rounded-[24px] border bg-[#fbfcfa] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397453]/50 md:p-6',
        active ? 'border-[#7c9d86] ring-2 ring-[#d9e6db]' : 'border-[#e2e8df]',
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
