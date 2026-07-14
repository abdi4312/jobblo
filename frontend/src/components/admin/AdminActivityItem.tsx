import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Activity } from 'lucide-react';
import type { AdminActivity } from '../../types/admin';

interface AdminActivityItemProps {
    item: AdminActivity;
}

export function AdminActivityItem({ item }: AdminActivityItemProps) {
    const actor =
        typeof item.adminId === 'object' && item.adminId
            ? item.adminId.name
            : 'Ukjent admin';

    const time = formatDistanceToNow(new Date(item.createdAt), {
        addSuffix: true,
        locale: nb,
    });

    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-500 shrink-0 mt-0.5" aria-hidden="true">
                <Activity size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 leading-snug">{item.description}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{actor}</span>
                    <span className="text-gray-200" aria-hidden="true">·</span>
                    <time className="text-xs text-gray-400" dateTime={item.createdAt}>
                        {time}
                    </time>
                </div>
            </div>
        </div>
    );
}
