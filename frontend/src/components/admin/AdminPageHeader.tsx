import React from 'react';
import { cn } from '@/lib/utils';

interface AdminPageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function AdminPageHeader({
    title,
    description,
    actions,
    className,
}: AdminPageHeaderProps) {
    return (
        <div
            className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6',
                className
            )}
        >
            <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
                {description && (
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}
