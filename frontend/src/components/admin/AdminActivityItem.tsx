import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { AdminActivity } from '../../types/admin';

interface AdminActivityItemProps {
    item: AdminActivity;
    occurrences?: number;
}

export function AdminActivityItem({ item, occurrences = 1 }: AdminActivityItemProps) {
    const actor =
        typeof item.adminId === 'object' && item.adminId
            ? item.adminId.name
            : 'System';
    const isOperationalIssue = /error|fail|reconcil|incident|refund/i.test(
        `${item.action} ${item.description}`
    );

    const time = formatDistanceToNow(new Date(item.createdAt), {
        addSuffix: true,
        locale: nb,
    });

    return (
        <div className="flex items-start gap-3 rounded-xl px-3 py-3.5 hover:bg-[#f7f9f6] transition-colors">
            <div
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                    isOperationalIssue ? 'bg-amber-50 text-amber-700' : 'bg-[#edf3ed] text-[#477052]'
                }`}
                aria-hidden="true"
            >
                {isOperationalIssue ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-[#26382d] leading-5 break-words">{item.description}</p>
                    {occurrences > 1 && (
                        <span className="shrink-0 rounded-full bg-[#f0f2ed] px-2 py-0.5 text-[10px] font-semibold text-[#65746a]">
                            ×{occurrences}
                        </span>
                    )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[11px] font-medium text-[#69766e]">{actor}</span>
                    <span className="text-[#c3cbc3]" aria-hidden="true">·</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#8b968e]">{item.targetModel}</span>
                    <span className="text-[#c3cbc3]" aria-hidden="true">·</span>
                    <time className="text-[11px] text-[#8b968e]" dateTime={item.createdAt}>
                        {time}
                    </time>
                </div>
            </div>
        </div>
    );
}
