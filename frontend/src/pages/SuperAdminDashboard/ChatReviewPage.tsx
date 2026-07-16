import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { fetchAdminChatById, fetchAdminChatReportById } from '../../api/admin/chats';
import type { AdminChatDetailResponse, AdminChatReportDetail } from '../../api/admin/chats';
import { ChatIdSearchForm } from '../../components/admin/chat/ChatIdSearchForm';
import { ChatAccessReasonDialog } from '../../components/admin/chat/ChatAccessReasonDialog';
import { ChatReviewEmptyState } from '../../components/admin/chat/ChatReviewEmptyState';
import { AdminChatViewer } from '../../components/admin/chat/AdminChatViewer';
import { AdminPageHeader } from '../../components/admin';

// ── Source → default access reason mapping ─────────────────────────────────
const SOURCE_REASON: Record<string, string> = {
    safepay: 'SafePay review',
    report: 'Chat report investigation',
};

// ── Report summary panel ──────────────────────────────────────────────────
function ReportSummaryPanel({ report }: { report: AdminChatReportDetail }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
                Rapport-sammendrag
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-orange-600">Type</span>
                <span className="text-orange-900 font-medium">
                    {report.reportType.replace(/_/g, ' ')}
                </span>
                <span className="text-orange-600">Tittel</span>
                <span className="text-orange-900 font-medium">{report.title}</span>
                <span className="text-orange-600">Status</span>
                <span className="text-orange-900 font-medium">{report.status}</span>
                <span className="text-orange-600">Rapportert av</span>
                <span className="text-orange-900 font-medium">
                    {report.reportedBy?.name ?? '–'}
                </span>
                <span className="text-orange-600">Rapportert bruker</span>
                <span className="text-orange-900 font-medium">
                    {report.reportedUser?.name ?? '–'}
                </span>
            </div>
            {report.description && (
                <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                    {report.description}
                </p>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ChatReviewPage() {
    const [searchParams] = useSearchParams();

    // URL params — pre-fill only; never auto-trigger query
    const urlChatId = searchParams.get('chatId') ?? '';
    const urlSource = searchParams.get('source') ?? '';
    const urlReportId = searchParams.get('reportId') ?? '';

    // Local state — controls when query fires
    const [submittedChatId, setSubmittedChatId] = useState<string>('');
    const [confirmedReason, setConfirmedReason] = useState<string>('');
    const [showDialog, setShowDialog] = useState(false);
    const [pendingChatId, setPendingChatId] = useState<string>('');
    const [chatData, setChatData] = useState<AdminChatDetailResponse | null>(null);

    // React Query — NEVER auto-executes (enabled: false)
    const chatQuery = useQuery({
        queryKey: ['admin-chat', submittedChatId, confirmedReason],
        queryFn: () => fetchAdminChatById(submittedChatId, confirmedReason),
        enabled: false, // manual refetch only
        retry: false,
    });

    // Report detail — only when reportId is present and chat is loaded
    const reportQuery = useQuery({
        queryKey: ['admin-chat-report', urlReportId],
        queryFn: () => fetchAdminChatReportById(urlReportId),
        enabled: false,
        retry: false,
    });

    // When query succeeds — store data
    useEffect(() => {
        if (chatQuery.data) {
            setChatData(chatQuery.data);
            if (urlReportId) {
                reportQuery.refetch();
            }
        }
    }, [chatQuery.data]);

    // ── Step 1: Admin submits a Chat ID ──────────────────────────────────────
    const handleSearch = useCallback((chatId: string) => {
        setPendingChatId(chatId);
        setShowDialog(true);
    }, []);

    // ── Step 2: Admin confirms access reason ──────────────────────────────────
    const handleConfirmReason = useCallback(
        async (reason: string) => {
            setShowDialog(false);
            setConfirmedReason(reason);
            setSubmittedChatId(pendingChatId);

            // Trigger the query after state settles
            setTimeout(() => {
                chatQuery.refetch().catch(() => {
                    // errors handled via chatQuery.isError below
                });
            }, 0);
        },
        [pendingChatId]
    );

    // Refetch whenever submittedChatId + confirmedReason are both set
    useEffect(() => {
        if (submittedChatId && confirmedReason) {
            chatQuery.refetch();
        }
    }, [submittedChatId, confirmedReason]);

    // Show error toast
    useEffect(() => {
        if (chatQuery.isError) {
            const err = chatQuery.error as { response?: { data?: { message?: string } } };
            const msg = err?.response?.data?.message ?? 'Chat ikke funnet eller tilgang nektet.';
            toast.error(msg);
        }
    }, [chatQuery.isError]);

    // ── Reset ────────────────────────────────────────────────────────────────
    const handleClear = useCallback(() => {
        setChatData(null);
        setSubmittedChatId('');
        setConfirmedReason('');
        setPendingChatId('');
    }, []);

    const handleSearchAnother = useCallback(() => {
        setChatData(null);
        setSubmittedChatId('');
        setConfirmedReason('');
        setPendingChatId('');
    }, []);

    // ── Dialog cancel ────────────────────────────────────────────────────────
    const handleCancelDialog = useCallback(() => {
        setShowDialog(false);
        setPendingChatId('');
        // Do NOT load chat — Req 3.5
    }, []);

    const defaultReason = SOURCE_REASON[urlSource] ?? '';
    const highlightMessageId = reportQuery.data?.messageId ?? null;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Chat-gjennomgang"
                description="Søk på Chat ID for å gjennomgå en samtale på en sikker måte."
            />

            {/* Privacy notice */}
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-700">
                <Shield size={16} className="shrink-0 text-blue-500" aria-hidden="true" />
                <span>
                    Chatter vises ikke automatisk. Skriv inn et eksakt Chat ID og oppgi en
                    tilgangsgrunn. Alle tilganger logges automatisk.
                </span>
            </div>

            {/* Search form — always visible */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <ChatIdSearchForm
                    onSearch={handleSearch}
                    defaultValue={urlChatId}
                    loading={chatQuery.isFetching}
                />
                {chatQuery.isError && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                        {(chatQuery.error as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message ?? 'Feil ved henting av chat. Sjekk Chat ID og prøv igjen.'}
                    </p>
                )}
            </div>

            {/* Access reason dialog */}
            <ChatAccessReasonDialog
                open={showDialog}
                defaultReason={defaultReason}
                onConfirm={handleConfirmReason}
                onCancel={handleCancelDialog}
            />

            {/* Main content */}
            {chatQuery.isFetching ? (
                <div className="flex items-center justify-center py-20">
                    <span
                        className="w-8 h-8 border-4 border-[#2d4a3e]/20 border-t-[#2d4a3e] rounded-full animate-spin"
                        role="status"
                        aria-label="Laster chat…"
                    />
                </div>
            ) : chatData ? (
                <AdminChatViewer
                    data={chatData}
                    highlightMessageId={highlightMessageId}
                    onClear={handleClear}
                    onSearchAnother={handleSearchAnother}
                    reportSummary={
                        reportQuery.data ? (
                            <ReportSummaryPanel report={reportQuery.data} />
                        ) : undefined
                    }
                />
            ) : (
                <ChatReviewEmptyState />
            )}
        </div>
    );
}
