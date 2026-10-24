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
        <div className="flex items-start gap-3 rounded-md px-3 py-3 hover:bg-muted/40 transition-colors">
            <div
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${
                    isOperationalIssue ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'
                }`}
                aria-hidden="true"
            >
                {isOperationalIssue ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-foreground leading-5 break-words">{item.description}</p>
                    {occurrences > 1 && (
                        <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            ×{occurrences}
                        </span>
                    )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">{actor}</span>
                    <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.targetModel}</span>
                    <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                    <time className="text-[11px] text-muted-foreground" dateTime={item.createdAt}>
                        {time}
                    </time>
                </div>
            </div>
        </div>
    );
}
