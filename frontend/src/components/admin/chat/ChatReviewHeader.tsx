import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { AdminStatusBadge } from '../AdminStatusBadge';
import type { AdminChatDetail } from '../../../api/admin/chats';

interface ChatReviewHeaderProps {
    chat: AdminChatDetail;
    onClear?: () => void;
    onSearchAnother?: () => void;
}

export function ChatReviewHeader({ chat, onClear, onSearchAnother }: ChatReviewHeaderProps) {
    const [copied, setCopied] = useState(false);

    const copyId = () => {
        navigator.clipboard.writeText(chat._id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const fmt = (d?: string | null) =>
        d
            ? new Date(d).toLocaleString('nb-NO', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            })
            : '–';

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">Chat ID</span>
                        <span className="font-mono text-sm font-semibold text-gray-800 select-all">
                            {chat._id}
                        </span>
                        <button
                            onClick={copyId}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label="Kopier Chat ID"
                            title="Kopier Chat ID"
                        >
                            {copied ? (
                                <CheckCircle2 size={14} className="text-green-500" aria-hidden="true" />
                            ) : (
                                <Copy size={14} aria-hidden="true" />
                            )}
                        </button>
                    </div>
                    <AdminStatusBadge status={chat.status} />
                </div>

                {/* Reset buttons */}
                <div className="flex items-center gap-2">
                    {onSearchAnother && (
                        <button
                            onClick={onSearchAnother}
                            className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Søk annen chat
                        </button>
                    )}
                    {onClear && (
                        <button
                            onClick={onClear}
                            className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                        >
                            Fjern chat
                        </button>
                    )}
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Meldinger', value: chat.messageCount },
                    { label: 'Vedlegg', value: chat.attachmentCount },
                    { label: 'Rapporter', value: chat.reportCount },
                    { label: 'Opprettet', value: fmt(chat.createdAt) },
                    { label: 'Oppdatert', value: fmt(chat.updatedAt) },
                    { label: 'Siste melding', value: fmt(chat.lastMessageAt) },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
                            {label}
                        </p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                    </div>
                ))}
            </div>

            {/* Read-only notice */}
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                <span aria-hidden="true">⚠️</span>
                <span>Skrivebeskyttet visning — admin kan ikke redigere, slette eller sende meldinger.</span>
            </div>
        </div>
    );
}
