import React, { useState } from 'react';
import { Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChatIdCellProps {
    chatId?: string | null;
    showOpenLink?: boolean;
    reviewSource?: 'safepay' | 'report';
    reportId?: string;
}

export function ChatIdCell({ chatId, showOpenLink = true, reviewSource, reportId }: ChatIdCellProps) {
    const [copied, setCopied] = useState(false);

    if (!chatId) {
        return <span className="text-xs text-gray-300 italic">Ingen chat</span>;
    }

    const truncated = `${chatId.slice(0, 8)}…${chatId.slice(-4)}`;

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(chatId).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-gray-600">{truncated}</span>
            <button
                onClick={handleCopy}
                className="text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Kopier Chat ID"
                title="Kopier Chat ID"
            >
                {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
            {showOpenLink && (
                <Link
                    to={(() => {
                        if (!reviewSource) return `/dashboard/chats/${chatId}`;
                        let url = `/dashboard/chat-review?chatId=${chatId}&source=${reviewSource}`;
                        if (reportId) url += `&reportId=${reportId}`;
                        return url;
                    })()}
                    className="text-[#2d4a3e] hover:text-[#233b31] transition-colors"
                    aria-label={reviewSource ? 'Gå til chat-gjennomgang' : 'Åpne chat'}
                    title={reviewSource ? 'Gå til chat-gjennomgang' : 'Åpne chat'}
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink size={12} />
                </Link>
            )}
        </div>
    );
}
