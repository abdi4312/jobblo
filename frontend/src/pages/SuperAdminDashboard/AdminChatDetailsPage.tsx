import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { fetchAdminChatById } from '../../api/admin/chats';
import { AdminChatViewer } from '../../components/admin/chat/AdminChatViewer';
import { ChatAccessReasonDialog } from '../../components/admin/chat/ChatAccessReasonDialog';
import { AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';

export default function AdminChatDetailsPage() {
    const { chatId } = useParams<{ chatId: string }>();
    const [confirmedReason, setConfirmedReason] = useState<string>('');
    const [showDialog, setShowDialog] = useState(true);

    const chatQuery = useQuery({
        queryKey: ['admin-chat-detail', chatId, confirmedReason],
        queryFn: () => fetchAdminChatById(chatId!, confirmedReason),
        // Never fire when chatId is empty or reason not confirmed
        enabled: !!chatId && chatId.length === 24 && confirmedReason.length > 0,
        staleTime: 60_000,
        retry: false,
    });

    const handleConfirm = (reason: string) => {
        setConfirmedReason(reason);
        setShowDialog(false);
    };

    const handleCancel = () => {
        // Navigate back if they cancel
        window.history.back();
    };

    return (
        <div className="space-y-6">
            {/* Back link */}
            <div className="flex items-center gap-3">
                <Link
                    to="/dashboard/chats"
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft size={16} aria-hidden="true" /> Tilbake til chatter
                </Link>
            </div>

            {/* Access reason dialog — shown on first load */}
            <ChatAccessReasonDialog
                open={showDialog}
                defaultReason="Admin chat list navigation"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />

            {/* Content */}
            {!confirmedReason ? null : chatQuery.isLoading ? (
                <div className="space-y-4">
                    <AdminLoadingSkeleton rows={3} />
                    <AdminLoadingSkeleton rows={6} />
                </div>
            ) : chatQuery.isError ? (
                <AdminErrorState
                    onRetry={() => chatQuery.refetch()}
                    title="Chat ikke funnet"
                    description="Chatten finnes ikke eller tilgang er nektet."
                />
            ) : chatQuery.data ? (
                <AdminChatViewer
                    data={chatQuery.data}
                    onClear={() => window.history.back()}
                />
            ) : null}
        </div>
    );
}
