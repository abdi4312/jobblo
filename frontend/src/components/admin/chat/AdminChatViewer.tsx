import React, { useEffect, useRef } from 'react';
import { ChatReviewHeader } from './ChatReviewHeader';
import { ChatParticipantsCard } from './ChatParticipantsCard';
import { ChatRelatedRecordsCard } from './ChatRelatedRecordsCard';
import { AdminMessageBubble } from './AdminMessageBubble';
import type { AdminChatDetailResponse } from '../../../api/admin/chats';

interface AdminChatViewerProps {
    data: AdminChatDetailResponse;
    highlightMessageId?: string | null;
    onClear?: () => void;
    onSearchAnother?: () => void;
    reportSummary?: React.ReactNode;
}

export function AdminChatViewer({
    data,
    highlightMessageId,
    onClear,
    onSearchAnother,
    reportSummary,
}: AdminChatViewerProps) {
    const { chat, participants, relatedRecords, messages } = data;
    const highlightRef = useRef<HTMLDivElement>(null);

    // Guard — participants/relatedRecords may be missing if the API shape differs
    const safeParticipants = participants ?? { customer: null, provider: null };
    const safeRecords = relatedRecords ?? {};
    const safeMessages = messages ?? [];
    const customerId = safeParticipants.customer?._id;

    // Scroll to highlighted message after render
    useEffect(() => {
        if (highlightMessageId) {
            const el = document.getElementById(`msg-${highlightMessageId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [highlightMessageId, messages]);

    return (
        <div className="space-y-4">
            {/* Header — with Clear / Search Another buttons */}
            <ChatReviewHeader
                chat={chat}
                onClear={onClear}
                onSearchAnother={onSearchAnother}
            />

            {/* Two-column layout on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Messages — left 2/3 */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Report summary panel (when opened from a report link) */}
                    {reportSummary && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                            {reportSummary}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">
                                Meldinger ({safeMessages.length})
                            </h3>
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                                Kun lesing
                            </span>
                        </div>

                        <div
                            ref={highlightRef}
                            className="p-4 space-y-3 max-h-[600px] overflow-y-auto"
                            aria-label="Chatmeldinger (skrivebeskyttet)"
                            aria-live="off"
                        >
                            {safeMessages.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">
                                    Ingen meldinger i denne chatten.
                                </p>
                            ) : (
                                safeMessages.map((msg) => (
                                    <AdminMessageBubble
                                        key={msg._id}
                                        message={msg}
                                        customerId={customerId}
                                        isHighlighted={!!highlightMessageId && msg._id === highlightMessageId}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar — right 1/3 */}
                <div className="space-y-4">
                    <ChatParticipantsCard participants={safeParticipants} />
                    <ChatRelatedRecordsCard records={safeRecords as typeof relatedRecords} />
                </div>
            </div>
        </div>
    );
}
