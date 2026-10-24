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
    | 'ready_for_review'
    | 'waiting_for_approval'
    | 'disputed'
    | 'superAdmin'
    | 'developer'
    | 'provider'
    | 'company'
    | 'user'
    | string;

const variantMap: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    verified: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    completed: 'bg-sky-50 text-sky-800 ring-sky-700/10',
    ready_for_review: 'bg-sky-50 text-sky-800 ring-sky-700/10',
    waiting_for_approval: 'bg-sky-50 text-sky-800 ring-sky-700/10',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    succeeded: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    open: 'bg-sky-50 text-sky-800 ring-sky-700/10',
    in_progress: 'bg-amber-50 text-amber-800 ring-amber-700/10',
    under_review: 'bg-amber-50 text-amber-800 ring-amber-700/10',
    disputed: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    dismissed: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    pending: 'bg-amber-50 text-amber-800 ring-amber-700/10',
    processing: 'bg-amber-50 text-amber-800 ring-amber-700/10',
    awaiting_payment: 'bg-orange-50 text-orange-800 ring-orange-700/10',
    inactive: 'bg-muted text-slate-600 ring-slate-500/10',
    cancelled: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    closed: 'bg-muted text-slate-600 ring-slate-500/10',
    failed: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    partially_refunded: 'bg-violet-50 text-violet-800 ring-violet-700/10',
    unpaid: 'bg-orange-50 text-orange-800 ring-orange-700/10',
    refunded: 'bg-violet-50 text-violet-800 ring-violet-700/10',
    reconciliation_required: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    manual_review: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    verification_retry: 'bg-amber-50 text-amber-800 ring-amber-700/10',
    ready: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    provider_ready: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    deadline_expired: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    declined: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    accepted: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    awaiting_provider_connect: 'bg-orange-50 text-orange-800 ring-orange-700/10',
    superAdmin: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    developer: 'bg-sky-50 text-sky-800 ring-sky-700/10',
    provider: 'bg-indigo-50 text-indigo-800 ring-indigo-700/10',
    company: 'bg-violet-50 text-violet-800 ring-violet-700/10',
    user: 'bg-muted text-slate-700 ring-slate-500/10',
};

const labelMap: Record<string, string> = {
    in_progress: 'Pågår',
    ready_for_review: 'Klar for godkjenning',
    waiting_for_approval: 'Venter godkjenning',
    awaiting_payment: 'Venter betaling',
    superAdmin: 'Super Admin',
    developer: 'Utvikler',
    provider: 'Tilbyder',
    company: 'Bedrift',
    user: 'Bruker',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    verified: 'Verifisert',
    completed: 'Fullført',
    cancelled: 'Avbrutt',
    pending: 'Venter',
    processing: 'Behandles',
    paid: 'Betalt',
    unpaid: 'Ubetalt',
    refunded: 'Refundert',
    partially_refunded: 'Delvis refundert',
    none: 'Ingen refusjon',
    reconciliation_required: 'Krever avstemming',
    manual_review: 'Manuell kontroll',
    verification_retry: 'Ny verifisering',
    ready: 'Klar',
    provider_ready: 'Tilbyder klar',
    deadline_expired: 'Frist utløpt',
    succeeded: 'Vellykket',
    failed: 'Feilet',
    open: 'Åpen',
    closed: 'Lukket',
    under_review: 'Under behandling',
    resolved: 'Løst',
    dismissed: 'Avvist',
    disputed: 'Tvist',
    declined: 'Avslått',
    accepted: 'Akseptert',
    awaiting_provider_connect: 'Venter på tilbyder',
};

interface AdminStatusBadgeProps {
    status: StatusVariant;
    className?: string;
}

export function AdminStatusBadge({ status, className }: AdminStatusBadgeProps) {
    const colorClass = variantMap[status] ?? 'bg-muted text-muted-foreground';
    const label = labelMap[status] ?? status;
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset',
                colorClass,
                className
            )}
        >
            {label}
        </span>
    );
}
