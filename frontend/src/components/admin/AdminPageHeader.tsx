import React from 'react';
import { cn } from '@/lib/utils';

interface AdminPageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

/** Same as the Developer Console's PageHeader (components/developer/kit.tsx). */
export function AdminPageHeader({ title, description, actions, className }: AdminPageHeaderProps) {
    return (
        <div className={cn('mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center', className)}>
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
