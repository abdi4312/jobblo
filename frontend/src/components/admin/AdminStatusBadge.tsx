import { cn } from '@/lib/utils';

type StatusVariant =
    | 'active'
    | 'inactive'
    | 'verified'
    | 'pending'
    | 'completed'
    | 'cancelled'
    | 'paid'
    | 'unpaid'
    | 'refunded'
    | 'succeeded'
    | 'failed'
    | 'open'
    | 'closed'
    | 'in_progress'
    | 'superAdmin'
    | 'provider'
    | 'company'
    | 'user'
    | string;

const variantMap: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    verified: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    succeeded: 'bg-green-100 text-green-700',
    open: 'bg-sky-100 text-sky-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-yellow-100 text-yellow-700',
    awaiting_payment: 'bg-orange-100 text-orange-700',
    inactive: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-600',
    closed: 'bg-gray-100 text-gray-500',
    failed: 'bg-red-100 text-red-600',
    unpaid: 'bg-orange-100 text-orange-600',
    refunded: 'bg-purple-100 text-purple-600',
    superAdmin: 'bg-red-100 text-red-700',
    provider: 'bg-indigo-100 text-indigo-700',
    company: 'bg-violet-100 text-violet-700',
    user: 'bg-gray-100 text-gray-600',
};

const labelMap: Record<string, string> = {
    in_progress: 'Pågår',
    awaiting_payment: 'Venter betaling',
    superAdmin: 'Super Admin',
    provider: 'Tilbyder',
    company: 'Bedrift',
    user: 'Bruker',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    verified: 'Verifisert',
    completed: 'Fullført',
    cancelled: 'Avbrutt',
    pending: 'Venter',
    paid: 'Betalt',
    unpaid: 'Ubetalt',
    refunded: 'Refundert',
    succeeded: 'Vellykket',
    failed: 'Feilet',
    open: 'Åpen',
    closed: 'Lukket',
};

interface AdminStatusBadgeProps {
    status: StatusVariant;
    className?: string;
}

export function AdminStatusBadge({ status, className }: AdminStatusBadgeProps) {
    const colorClass = variantMap[status] ?? 'bg-gray-100 text-gray-600';
    const label = labelMap[status] ?? status;
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                colorClass,
                className
            )}
        >
            {label}
        </span>
    );
}
