import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, CheckCircle2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface ChatIdCellProps {
    chatId?: string | null;
    /** URL source param — used to pre-select access reason */
    reviewSource?: 'safepay' | 'report';
    reportId?: string;
}

export function ChatIdCell({ chatId, reviewSource = 'safepay', reportId }: ChatIdCellProps) {
    const [copied, setCopied] = useState(false);

    if (!chatId) {
        return <span className="text-xs text-gray-400 italic">Ingen tilknyttet chat</span>;
    }

    const truncated = `${chatId.slice(0, 8)}…${chatId.slice(-4)}`;

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(chatId).then(() => {
            setCopied(true);
            toast.success('Chat ID kopiert');
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const reviewUrl = reportId
        ? `/dashboard/chat-review?chatId=${chatId}&reportId=${reportId}&source=${reviewSource}`
        : `/dashboard/chat-review?chatId=${chatId}&source=${reviewSource}`;

    return (
        <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-gray-600 select-all" title={chatId}>
                {truncated}
            </span>
            <button
                onClick={handleCopy}
                className="p-0.5 rounded text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Kopier Chat ID"
                title="Kopier Chat ID"
            >
                {copied ? (
                    <CheckCircle2 size={12} className="text-green-500" aria-hidden="true" />
                ) : (
                    <Copy size={12} aria-hidden="true" />
                )}
            </button>
            <Link
                to={reviewUrl}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded transition-colors"
                title="Gjennomgå chat"
            >
                <MessageSquare size={10} aria-hidden="true" />
                Gjennomgå
            </Link>
        </div>
    );
}
