import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, UserCheck, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    fetchAdminChatReportById,
    assignChatReport,
    updateChatReportStatus,
    updateChatReportPriority,
    addChatReportInternalNote,
    sendChatReportOfficialMessage,
    resolveChatReport,
    dismissChatReport,
    reopenChatReport,
} from '../../api/admin/chats';
import { AdminStatusBadge, AdminLoadingSkeleton, AdminErrorState, AdminPageHeader } from '../../components/admin';

const RESOLVE_OUTCOMES = [
    { label: 'Ingen overtredelse', value: 'no_violation' },
    { label: 'Advarsel utstedt', value: 'warning_issued' },
    { label: 'Innholdsbrudd', value: 'content_violation' },
    { label: 'Bruker begrenset', value: 'user_restricted' },
    { label: 'Bruker suspendert', value: 'user_suspended' },
    { label: 'Chat begrenset', value: 'chat_restricted' },
    { label: 'SafePay-tvist åpnet', value: 'safepay_dispute_opened' },
    { label: 'Betalingsgjennomgang kreves', value: 'payment_review_required' },
    { label: 'Svindel eskalert', value: 'fraud_escalated' },
    { label: 'Løst mellom brukerne', value: 'resolved_between_users' },
    { label: 'Annet', value: 'other' },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const STATUS_OPTIONS = [
    'open', 'under_review', 'waiting_for_reporter',
    'waiting_for_reported_user', 'action_required', 'resolved', 'dismissed', 'closed',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, value, badge }: { label: string; value?: React.ReactNode; badge?: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-40">{label}</span>
            <span className="text-sm text-gray-800 text-right flex items-center gap-1 min-w-0">
                {badge ? <AdminStatusBadge status={badge} /> : (value ?? <span className="text-gray-300">–</span>)}
            </span>
        </div>
    );
}

export default function AdminChatReportDetailPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const qc = useQueryClient();
    const [noteText, setNoteText] = useState('');
    const [msgText, setMsgText] = useState('');
    const [msgRecipient, setMsgRecipient] = useState<'reporter' | 'reported_user'>('reporter');
    const [resolveOutcome, setResolveOutcome] = useState('');
    const [resolveReason, setResolveReason] = useState('');
    const [dismissReason, setDismissReason] = useState('');
    const [showResolve, setShowResolve] = useState(false);
    const [showDismiss, setShowDismiss] = useState(false);

    const { data: report, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-chat-report-detail', reportId],
        queryFn: () => fetchAdminChatReportById(reportId!),
        enabled: !!reportId,
        staleTime: 30_000,
    });

    const inv = () => qc.invalidateQueries({ queryKey: ['admin-chat-report-detail', reportId] });

    const assignMut = useMutation({ mutationFn: () => assignChatReport(reportId!), onSuccess: () => { toast.success('Rapport tildelt.'); inv(); } });
    const noteMut = useMutation({ mutationFn: (note: string) => addChatReportInternalNote(reportId!, note), onSuccess: () => { toast.success('Notat lagret.'); setNoteText(''); inv(); } });
    const msgMut = useMutation({ mutationFn: () => sendChatReportOfficialMessage(reportId!, msgRecipient, msgText), onSuccess: () => { toast.success('Melding sendt.'); setMsgText(''); inv(); } });
    const resolveMut = useMutation({ mutationFn: () => resolveChatReport(reportId!, { outcome: resolveOutcome, reason: resolveReason }), onSuccess: () => { toast.success('Rapport løst.'); setShowResolve(false); inv(); } });
    const dismissMut = useMutation({ mutationFn: () => dismissChatReport(reportId!, dismissReason), onSuccess: () => { toast.success('Rapport avvist.'); setShowDismiss(false); inv(); } });
    const reopenMut = useMutation({ mutationFn: () => reopenChatReport(reportId!), onSuccess: () => { toast.success('Rapport gjenåpnet.'); inv(); } });

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={4} /><AdminLoadingSkeleton rows={6} /></div>;
    if (isError || !report) return <AdminErrorState onRetry={refetch} title="Rapport ikke funnet" />;

    const chatId = typeof report.chatId === 'object' ? report.chatId?._id : report.chatId;
    const isActive = !['resolved', 'dismissed', 'closed'].includes(report.status);
    const isClosed = ['resolved', 'dismissed', 'closed'].includes(report.status);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link to="/dashboard/chat-reports" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft size={16} /> Tilbake til rapporter
                </Link>
            </div>

            <AdminPageHeader
                title={`Rapport: ${report.title}`}
                description={`${report.reportType.replace(/_/g, ' ')} · ${report.scope}`}
                actions={
                    chatId ? (
                        <Link
                            to={`/dashboard/chat-review?chatId=${chatId}&reportId=${report._id}&source=report`}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-xl transition-colors"
                        >
                            <MessageSquare size={15} /> Gjennomgå chat
                        </Link>
                    ) : undefined
                }
            />

            {/* Status bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Status:</span><AdminStatusBadge status={report.status} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Prioritet:</span>
                    <span className="text-xs font-semibold text-gray-700 capitalize">{report.priority}</span>
                </div>
                {report.assignedAdminId && (
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Tildelt:</span>
                        <span className="text-xs text-gray-700">{report.assignedAdminId.name}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Report details */}
                    <Section title="Rapportdetaljer">
                        <Row label="Rapport-ID" value={<span className="font-mono text-xs">{report._id}</span>} />
                        <Row label="Type" value={report.reportType.replace(/_/g, ' ')} />
                        <Row label="Omfang" value={report.scope} />
                        {report.messageId && <Row label="Meldings-ID" value={<span className="font-mono text-xs">{report.messageId}</span>} />}
                        <Row label="Beskrivelse" value={<span className="text-xs leading-relaxed">{report.description}</span>} />
                        <Row label="Opprettet" value={new Date(report.createdAt).toLocaleString('nb-NO')} />
                    </Section>

                    {/* Evidence */}
                    {report.evidence && report.evidence.length > 0 && (
                        <Section title={`Bevis (${report.evidence.length})`}>
                            <div className="space-y-2">
                                {report.evidence.map((e) => (
                                    <div key={e._id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                                        <FileText size={14} className="text-gray-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-600 truncate">{e.fileType ?? 'Fil'}</p>
                                            {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                                        </div>
                                        <a href={e.fileUrl} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-[#2d4a3e] hover:underline">
                                            Åpne <ExternalLink size={10} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Official messages */}
                    {report.officialMessages && report.officialMessages.length > 0 && (
                        <Section title="Offisielle meldinger">
                            <div className="space-y-3">
                                {report.officialMessages.map((m) => (
                                    <div key={m._id} className="p-3 bg-blue-50 rounded-xl">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>Fra: {m.senderId?.name ?? '–'} → Til: {m.recipientId?.name ?? '–'}</span>
                                            <time>{new Date(m.createdAt).toLocaleString('nb-NO')}</time>
                                        </div>
                                        <p className="text-sm text-gray-800">{m.message}</p>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Timeline */}
                    {report.timeline && report.timeline.length > 0 && (
                        <Section title="Tidslinje">
                            <div className="relative pl-6">
                                <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-100" />
                                <div className="space-y-3">
                                    {[...report.timeline].reverse().map((t) => (
                                        <div key={t._id} className="relative">
                                            <div className="absolute -left-4 w-2 h-2 rounded-full bg-gray-300 border-2 border-white mt-1" />
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-medium text-gray-700">{t.action.replace(/_/g, ' ')}</span>
                                                {t.actorId && <span className="text-xs text-gray-400">av {t.actorId.name}</span>}
                                                <time className="text-[10px] text-gray-300 ml-auto">{new Date(t.createdAt).toLocaleString('nb-NO')}</time>
                                            </div>
                                            {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Section>
                    )}

                    {/* Internal notes (admin-only) */}
                    <Section title="Interne notater (kun admin)">
                        {report.internalNotes && report.internalNotes.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {report.internalNotes.map((n) => (
                                    <div key={n._id} className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>{n.adminId?.name ?? '–'}</span>
                                            <time>{new Date(n.createdAt).toLocaleString('nb-NO')}</time>
                                        </div>
                                        <p className="text-sm text-gray-800">{n.note}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="space-y-2">
                            <textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Legg til internt notat (kun synlig for admins)…"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none" />
                            <button onClick={() => noteMut.mutate(noteText)} disabled={noteText.trim().length < 3 || noteMut.isPending}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-40 transition-colors">
                                {noteMut.isPending && <Loader2 size={13} className="animate-spin" />} Lagre notat
                            </button>
                        </div>
                    </Section>
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                    {/* Participants */}
                    <Section title="Deltakere">
                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Rapportert av</p>
                                {report.reportedBy ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{report.reportedBy.name}</p>
                                        <p className="text-xs text-gray-400">{report.reportedBy.email}</p>
                                    </div>
                                ) : <p className="text-sm text-gray-400">–</p>}
                            </div>
                            <div className="border-t border-gray-50 pt-3">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Rapportert bruker</p>
                                {report.reportedUser ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{report.reportedUser.name}</p>
                                        <p className="text-xs text-gray-400">{report.reportedUser.email}</p>
                                    </div>
                                ) : <p className="text-sm text-gray-400">–</p>}
                            </div>
                        </div>
                    </Section>

                    {/* Send official message */}
                    <Section title="Send offisiell melding">
                        <div className="space-y-2">
                            <select value={msgRecipient} onChange={(e) => setMsgRecipient(e.target.value as 'reporter' | 'reported_user')}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                <option value="reporter">Til: Reporter</option>
                                <option value="reported_user">Til: Rapportert bruker</option>
                            </select>
                            <textarea rows={2} value={msgText} onChange={(e) => setMsgText(e.target.value)}
                                placeholder="Melding…"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none" />
                            <button onClick={() => msgMut.mutate()} disabled={msgText.trim().length < 3 || msgMut.isPending}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-40 transition-colors">
                                {msgMut.isPending && <Loader2 size={13} className="animate-spin" />} Send melding
                            </button>
                        </div>
                    </Section>

                    {/* Actions */}
                    <Section title="Handlinger">
                        <div className="space-y-2">
                            {isActive && !report.assignedAdminId && (
                                <button onClick={() => assignMut.mutate()} disabled={assignMut.isPending}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-xl disabled:opacity-50 transition-colors">
                                    <UserCheck size={14} /> Ta sak
                                </button>
                            )}
                            {isActive && (
                                <>
                                    <button onClick={() => setShowResolve(true)}
                                        className="w-full px-3 py-2 text-sm font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-xl transition-colors">
                                        Løs rapport
                                    </button>
                                    <button onClick={() => setShowDismiss(true)}
                                        className="w-full px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                        Avvis rapport
                                    </button>
                                </>
                            )}
                            {isClosed && (
                                <button onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl disabled:opacity-50 transition-colors">
                                    {reopenMut.isPending && <Loader2 size={13} className="animate-spin" />} Gjenåpne
                                </button>
                            )}
                        </div>
                    </Section>
                </div>
            </div>

            {/* Resolve dialog */}
            {showResolve && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Løs rapport</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Utfall *</label>
                            <select value={resolveOutcome} onChange={(e) => setResolveOutcome(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                <option value="">Velg utfall</option>
                                {RESOLVE_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={resolveReason} onChange={(e) => setResolveReason(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                                placeholder="Forklar beslutningen…" />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowResolve(false)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Avbryt</button>
                            <button onClick={() => resolveMut.mutate()} disabled={!resolveOutcome || !resolveReason.trim() || resolveMut.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-40 transition-colors">
                                {resolveMut.isPending && <Loader2 size={13} className="animate-spin" />} Bekreft
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dismiss dialog */}
            {showDismiss && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Avvis rapport</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={dismissReason} onChange={(e) => setDismissReason(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                                placeholder="Forklar avvisningen…" />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowDismiss(false)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Avbryt</button>
                            <button onClick={() => dismissMut.mutate()} disabled={!dismissReason.trim() || dismissMut.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-40 transition-colors">
                                {dismissMut.isPending && <Loader2 size={13} className="animate-spin" />} Avvis
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
