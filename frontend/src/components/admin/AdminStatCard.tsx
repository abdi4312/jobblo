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

    const inner = (
        <div
            className={cn(
                'group bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all duration-200 flex flex-col gap-3',
                to && 'cursor-pointer',
                className
            )}
        >
            <div className="flex items-start justify-between">
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <div
                    className={cn(
                        'p-2.5 rounded-xl bg-gray-50 text-gray-600 group-hover:bg-[#2d4a3e]/10 transition-colors',
                        iconClassName
                    )}
                    aria-hidden="true"
                >
                    {icon}
                </div>
            </div>
            <p className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                {typeof value === 'number' ? value.toLocaleString('nb-NO') : value}
            </p>
            <div className="flex items-center gap-2 min-h-[18px]">
                {trendEl}
                {!hasChange && subtitle && (
                    <span className="text-xs text-gray-400">{subtitle}</span>
                )}
            </div>
        </div>
    );

    return to ? <Link to={to}>{inner}</Link> : inner;
}
