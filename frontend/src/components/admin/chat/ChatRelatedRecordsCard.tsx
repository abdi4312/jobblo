import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AdminStatusBadge } from '../AdminStatusBadge';
import type { AdminChatRelatedRecords } from '../../../api/admin/chats';

interface ChatRelatedRecordsCardProps {
    records: AdminChatRelatedRecords;
}

function Row({
    label,
    value,
    badge,
    link,
    mono,
}: {
    label: string;
    value?: React.ReactNode;
    badge?: string;
    link?: string;
    mono?: boolean;
}) {
    if (value === null || value === undefined) return null;

    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-36">{label}</span>
            <span
                className={`text-sm text-gray-800 text-right flex items-center gap-1.5 min-w-0 flex-wrap justify-end ${mono ? 'font-mono text-xs' : ''
                    }`}
            >
                {badge ? (
                    <AdminStatusBadge status={badge} />
                ) : link ? (
                    <Link
                        to={link}
                        className="flex items-center gap-1 text-[#2d4a3e] hover:underline text-xs"
                    >
                        {String(value)} <ExternalLink size={10} aria-hidden="true" />
                    </Link>
                ) : (
                    <span className="break-all">{value ?? <span className="text-gray-300">–</span>}</span>
                )}
            </span>
        </div>
    );
}

export function ChatRelatedRecordsCard({ records }: ChatRelatedRecordsCardProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">
                Tilknyttede data
            </h3>

            <div className="space-y-0.5">
                {records.serviceTitle && (
                    <Row label="Tjeneste" value={records.serviceTitle} />
                )}
                {records.serviceId && (
                    <Row label="Tjeneste-ID" value={records.serviceId} mono />
                )}
                {records.orderId && (
                    <Row
                        label="Ordre-ID"
                        value={String(records.orderId).slice(-8).toUpperCase()}
                        link={`/dashboard/orders/${records.orderId}`}
                    />
                )}
                {records.safePayOrderId && (
                    <Row
                        label="SafePay-ordre"
                        value={String(records.safePayOrderId).slice(-8).toUpperCase()}
                        link={records.safePayDetailLink ?? undefined}
                    />
                )}
                {records.orderStatus && (
                    <Row label="Ordrestatus" badge={records.orderStatus} />
                )}
                {records.paymentStatus && (
                    <Row label="Betalingsstatus" badge={records.paymentStatus} />
                )}
                {records.disputeStatus && (
                    <Row label="Tviststatus" badge={records.disputeStatus} />
                )}
                {records.agreedPrice != null && (
                    <Row
                        label="Avtalt pris"
                        value={`${Number(records.agreedPrice).toLocaleString('nb-NO')} NOK`}
                    />
                )}
                {records.disputeId && (
                    <Row
                        label="Tvist"
                        value="Se tvist"
                        link={`/dashboard/disputes/${records.disputeId}`}
                    />
                )}
            </div>

            {/* Quick-nav links */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
                {records.safePayDetailLink && (
                    <Link
                        to={records.safePayDetailLink}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-lg transition-colors"
                    >
                        SafePay-detaljer <ExternalLink size={10} aria-hidden="true" />
                    </Link>
                )}
                {records.reportDetailLink && (
                    <Link
                        to={records.reportDetailLink}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                    >
                        Se rapporter <ExternalLink size={10} aria-hidden="true" />
                    </Link>
                )}
            </div>
        </div>
    );
}
