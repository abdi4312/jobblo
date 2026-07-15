import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import type { AdminChatMessage } from '../../../types/admin/chats';

interface AdminMessageBubbleProps {
    msg: AdminChatMessage;
    isHighlighted?: boolean;
    highlightRef?: React.RefObject<HTMLDivElement>;
}

export function AdminMessageBubble({ msg, isHighlighted, highlightRef }: AdminMessageBubbleProps) {
    const isSystem = msg.type?.startsWith('system_');
    const isCustomer = msg.sender?.role === 'user';

    if (isSystem) {
        return (
            <div className="text-center my-2">
                <span className="inline-block text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                    {msg.text ?? msg.type}
                </span>
            </div>
        );
    }

    return (
        <div
            ref={isHighlighted ? highlightRef : undefined}
            className={`flex gap-2.5 ${isCustomer ? '' : 'flex-row-reverse'} ${isHighlighted ? 'ring-2 ring-red-400 ring-offset-2 rounded-2xl' : ''}`}
        >
            <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-500 mt-1">
                {(msg.sender?.name?.[0] ?? '?').toUpperCase()}
            </div>
            <div className={`max-w-[70%] ${isCustomer ? '' : 'items-end'} flex flex-col gap-0.5`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-gray-700">{msg.sender?.name ?? 'Ukjent'}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{msg.sender?.role}</span>
                    {msg.isReported && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle size={9} /> Rapportert
                        </span>
                    )}
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isHighlighted
                        ? 'bg-red-50 border border-red-200 text-red-900'
                        : isCustomer
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-[#2d4a3e]/10 text-gray-800'
                    }`}>
                    {msg.text && <p>{msg.text}</p>}
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                            {msg.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] text-[#2d4a3e] hover:underline">
                                    <FileText size={11} /> Vedlegg {i + 1}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
                <time className="text-[10px] text-gray-300">{new Date(msg.createdAt).toLocaleString('nb-NO')}</time>
            </div>
        </div>
    );
}
