import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { ReportedMessageBadge } from './ReportedMessageBadge';
import type { AdminChatMessage } from '../../../api/admin/chats';

interface AdminMessageBubbleProps {
    message: AdminChatMessage;
    customerId?: string;
    isHighlighted?: boolean;
}

// Colour coding per message type / sender role
function getBubbleStyle(message: AdminChatMessage, customerId?: string): string {
    if (message.type === 'system_payment') {
        return 'bg-emerald-50 border border-emerald-200 text-emerald-800';
    }
    if (message.type === 'system_contract') {
        return 'bg-blue-50 border border-blue-200 text-blue-800';
    }
    if (message.type === 'system_status' || message.type?.startsWith('system_')) {
        return 'bg-gray-100 border border-gray-200 text-gray-600';
    }
    if (message.isReported) {
        return 'bg-red-50 border border-red-300 text-gray-800';
    }

    const isCustomer = message.sender?._id === customerId;
    if (isCustomer) return 'bg-[#eef5f2] border border-[#c8ddd6] text-gray-800';
    return 'bg-white border border-gray-200 text-gray-800';
}

function getRoleLabel(role?: string): string {
    const map: Record<string, string> = {
        user: 'Kunde',
        provider: 'Tilbyder',
        company: 'Bedrift',
        superAdmin: 'Admin',
    };
    return role ? (map[role] ?? role) : '';
}

export function AdminMessageBubble({
    message,
    customerId,
    isHighlighted = false,
}: AdminMessageBubbleProps) {
    const isSystem = message.type?.startsWith('system_');

    // System messages rendered as centred pill
    if (isSystem) {
        return (
            <div
                id={`msg-${message._id}`}
                className={`flex justify-center my-2 ${isHighlighted ? 'ring-2 ring-amber-400 rounded-full' : ''}`}
            >
                <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${getBubbleStyle(message, customerId)}`}
                >
                    {message.text || message.type}
                    {message.isReported && <ReportedMessageBadge />}
                </span>
            </div>
        );
    }

    const senderName = message.sender?.name ?? 'Ukjent';
    const senderInitial = senderName[0]?.toUpperCase() ?? '?';

    return (
        <div
            id={`msg-${message._id}`}
            className={`flex gap-2.5 ${isHighlighted ? 'ring-2 ring-amber-400 rounded-xl p-1 -mx-1' : ''}`}
        >
            {/* Avatar */}
            <div
                className="w-7 h-7 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-bold text-gray-600 mt-0.5"
                aria-hidden="true"
            >
                {senderInitial}
            </div>

            {/* Bubble */}
            <div className="flex-1 min-w-0 max-w-lg">
                {/* Meta */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">{senderName}</span>
                    {message.sender?.role && (
                        <span className="text-[10px] text-gray-400 capitalize">
                            {getRoleLabel(message.sender.role)}
                        </span>
                    )}
                    {message.isReported && <ReportedMessageBadge />}
                    <time className="text-[10px] text-gray-300 ml-auto whitespace-nowrap">
                        {new Date(message.createdAt).toLocaleString('nb-NO', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </time>
                </div>

                {/* Content */}
                <div className={`rounded-xl px-3 py-2 text-sm ${getBubbleStyle(message, customerId)}`}>
                    {message.text && (
                        <p className="whitespace-pre-wrap break-all leading-relaxed">{message.text}</p>
                    )}

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {message.attachments.map((url, i) => (
                                <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] text-[#2d4a3e] hover:underline bg-white/70 px-2 py-1 rounded-lg border border-gray-200"
                                >
                                    <FileText size={11} aria-hidden="true" />
                                    Vedlegg {i + 1}
                                    <ExternalLink size={9} aria-hidden="true" />
                                </a>
                            ))}
                        </div>
                    )}

                    {/* System data preview */}
                    {message.systemData && Object.keys(message.systemData).length > 0 && (
                        <details className="mt-2 text-[10px] text-gray-400">
                            <summary className="cursor-pointer hover:text-gray-600">Systemdata</summary>
                            <pre className="mt-1 bg-gray-50 rounded p-1 overflow-x-auto text-gray-500 text-[10px]">
                                {JSON.stringify(message.systemData, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        </div>
    );
}
