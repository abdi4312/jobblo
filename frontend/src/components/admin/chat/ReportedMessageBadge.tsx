import React from 'react';
import { Flag } from 'lucide-react';

interface ReportedMessageBadgeProps {
    reportCount?: number;
}

export function ReportedMessageBadge({ reportCount = 1 }: ReportedMessageBadgeProps) {
    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200"
            aria-label={`Rapportert ${reportCount} gang${reportCount !== 1 ? 'er' : ''}`}
            title={`Denne meldingen er rapportert ${reportCount} gang${reportCount !== 1 ? 'er' : ''}`}
        >
            <Flag size={9} aria-hidden="true" />
            {reportCount > 1 ? `${reportCount}x rapportert` : 'Rapportert'}
        </span>
    );
}
