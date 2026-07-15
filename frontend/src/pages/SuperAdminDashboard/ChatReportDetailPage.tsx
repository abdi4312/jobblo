import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, ExternalLink, AlertTriangle, Clock, CheckCircle2,
    MessageSquare, Loader2, Flag, StickyNote, Send, RotateCcw,
} from 'lucide-react';
import {
    useAdminChatReportById, useAssignChatReport, useUpdateChatReportStatus,
    useUpdateChatReportPriority, useAddChatReportNote, useResolveChatReport,
    useCreateDisputeFromReport,
} from '../../hooks/admin/chats';
import { REPORT_TYPE_LABELS } from '../../types/admin/chats';
import { AdminChatViewer } from '../../components/admin/chat/AdminChatViewer';
import { ChatIdCell } from '../../components/admin/chat/ChatIdCell';
import {
    AdminStatusBadge, AdminLoadingSkeleton, AdminErrorState, AdminPageHeader,
    AdminConfirmDialog,
} from '../../components/admin';

const PRIORITY_OPTIONS = [
    { label: 'Lav', value: 'low' },
    { label: 'Middels', value: 'medium' },
    { label: 'Høy', value: 'high' },
    { label: 'Kritisk', value: 'urgent' },
];

const RESOLVE_OUTCOMES = [
    { label: 'Ingen brudd', value: 'no_violation' },
    { label: 'Advarsel utstedt', value: 'warning_issued' },
    { label: 'Innholdsbrudd', value: 'content_violation' },
    { label: 'Bruker begrenset', value: 'user_restricted' },
    { label: 'SafePay-tvist åpnet', value: 'safepay_dispute_opened' },
    { label: 'Løst mellom brukere', value: 'resolved_between_users' },
    { label: 'Annet', value: 'other' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, value, badge }: { label: string; value?: React.ReactNode; badge?: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-36">{label}</span>
            <span className="text-sm text-gray-800 text-right flex items-center gap-1 min-w-0">
                {badge ? <AdminStatusBadge status={badge} /> : (value ?? <span className="text-gray-300">–</span>)}
            </span>
        </div>
    );
}

function TimelineItem({ entry }: { entry: { action: string; actorId?: { name: string }; description?: string; createdAt: string } }) {
    const actionLabels: Record<string, string> = {
        report_opened: 'Rapport åpnet',
        assigned: 'Tildelt',
        priority_changed: 'Prioritet endret',
        status_changed_to_under_review: 'Under behandling',
        status_changed_to_action_required: 'Handling kreves',
        internal_note_added: 'Internt notat',
        information_requested_from_reporter: 'Info forespurt fra reporter',
        information_requested_from_reported_user: 'Info forespurt fra bruker',
        safepay_dispute_opened: 'SafePay-tvist åpnet',
        resolved: 'Løst',
        reopened: 'Gjenåpnet',
    };
    return (
        <div className="flex gap-3 py-2">
            <div className="w-2 h-2 rounded-full bg-[#2d4a3e] mt-1.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-sm text-gray-800">{actionLabels[entry.action] ?? entry.action}</p>
                {entry.description && <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>}
                <p className="text-[10px] text-gray-300 mt-0.5">
                    {entry.actorId?.name ?? 'System'} · {new Date(entry.createdAt).toLocaleString('nb-NO')}
                </p>
            </div>
        </div>
    );
}

export default function ChatReportDetailPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const { data: report, isLoading, isError, refetch } = useAdminChatReportById(reportId ?? '');

    const assignMutation = useAssignChatReport();
    const statusMutation = useUpdateChatReportStatus();
    const priorityMutation = useUpdateChatReportPriority();
    const noteMutation = useAddChatReportNote();
    const resolveMutation = useResolveChatReport();
    const disputeMutation = useCreateDisputeFromReport();

    const [noteText, setNoteText] = useState('');
    const [resolveForm, setResolveForm] = useState({ outcome: '', reason: '' });
    const [showResolve, setShowResolve] = useState(false);

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={4} /><AdminLoadingSkeleton rows={6} /></div>;
    if (isError || !report) return <AdminErrorState onRetry={refetch} title="Rapport ikke funnet" />;

    const isActive = !['resolved', 'dismissed', 'closed'].includes(report.status);
    const chatId = typeof report.chatId === 'object' ? report.chatId._id : report.chatId;
    const chatStatus = typeof report.chatId === 'object' ? (report.chatId as { status?: string }).status : undefined;

    return (
        <div className="space-y-6">
            <Link to="/dashboard/chat-reports" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft size={15} /> Tilbake til rapporter
            </Link>

            <AdminPageHeader
                title={report.title}
                description={`Rapport ${report._id.slice(-8).toUpperCase()}`}
                actions={
                    <div className="flex items-center gap-2">
                        {isActive && !report.assignedAdminId && (
                            <button onClick={() => assignMutation.mutate(report._id)} disabled={assignMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
                                {assignMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />} Ta sak
                            </button>
                        )}
                        {isActive && (
                            <button onClick={() => setShowResolve(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors">
                                <CheckCircle2 size={13} /> Løs
                            </button>
                        )}
                    </div>
                }
            />

            {/* Status bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Status:</span><AdminStatusBadge status={report.status} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Prioritet:</span><AdminStatusBadge status={report.priority} /></div>
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Type:</span><span className="text-xs text-gray-700">{REPORT_TYPE_LABELS[report.reportType] ?? report.reportType}</span></div>
                {report.assignedAdminId && (
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Tildelt:</span><span className="text-xs text-gray-700">{report.assignedAdminId.name}</span></div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    {/* Report details */}
                    <Section title="Rapportdetaljer">
                        <Row label="Rapport-ID" value={<span className="font-mono text-xs">{report._id}</span>} />
                        <Row label="Chat ID" value={<ChatIdCell chatId={chatId} />} />
                        <Row label="Type" value={REPORT_TYPE_LABELS[report.reportType] ?? report.reportType} />
                        <Row label="Omfang" value={report.scope === 'message' ? 'Melding' : 'Chat'} />
                        {report.messageId && <Row label="Meldings-ID" value={<span className="font-mono text-xs">{report.messageId}</span>} />}
                        <Row label="Beskrivelse" value={<p className="text-sm text-gray-600 whitespace-pre-wrap">{report.description}</p>} />
                        <Row label="Opprettet" value={new Date(report.createdAt).toLocaleString('nb-NO')} />
                        <Row label="Sist oppdatert" value={new Date(report.updatedAt).toLocaleString('nb-NO')} />
                    </Section>

                    {/* Reporter and reported user */}
                    <Section title="Involverte brukere">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-400 mb-2">Rapportert av</p>
                                {report.reportedBy ? (
                                    <div className="flex items-start gap-2">
                                        <img src={report.reportedBy.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.reportedBy.name)}&background=2d4a3e&color=fff&size=32`}
                                            alt={report.reportedBy.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{report.reportedBy.name}</p>
                                            <p className="text-xs text-gray-400">{report.reportedBy.email}</p>
                                            <p className="text-[10px] text-gray-400 capitalize">{report.reportedBy.role}</p>
                                        </div>
                                    </div>
                                ) : <span className="text-gray-300">–</span>}
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 mb-2">Om bruker</p>
                                {report.reportedUser ? (
                                    <div className="flex items-start gap-2">
                                        <img src={report.reportedUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.reportedUser.name)}&background=2d4a3e&color=fff&size=32`}
                                            alt={report.reportedUser.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{report.reportedUser.name}</p>
                                            <p className="text-xs text-gray-400">{report.reportedUser.email}</p>
                                            <p className="text-[10px] text-gray-400 capitalize">{report.reportedUser.role}</p>
                                        </div>
                                    </div>
                                ) : <span className="text-gray-300">–</span>}
                            </div>
                        </div>
                    </Section>

                    {/* SafePay info */}
                    {(report.orderId || report.safePayOrderId) && (
                        <Section title="SafePay informasjon">
                            {report.orderId && typeof report.orderId === 'object' && (
                                <>
                                    <Row label="Ordre-ID" value={
                                        <Link to={`/dashboard/safepay/${(report.orderId as { _id: string })._id}`}
                                            className="font-mono text-xs text-[#2d4a3e] hover:underline flex items-center gap-1">
                                            {(report.orderId as { _id: string })._id.slice(-8).toUpperCase()} <ExternalLink size={10} />
                                        </Link>
                                    } />
                                    <Row label="Ordrestatus" badge={(report.orderId as { status: string }).status} />
                                    {report.safePayOrderId && typeof report.safePayOrderId === 'object' && (
                                        <Row label="SafePay-status" badge={(report.safePayOrderId as { status: string }).status} />
                                    )}
                                </>
                            )}
                            {report.disputeId && typeof report.disputeId === 'object' && (
                                <Row label="Tvist" value={
                                    <Link to={`/dashboard/disputes/${(report.disputeId as { _id: string })._id}`}
                                        className="text-xs text-red-600 hover:underline flex items-center gap-1">
                                        Se tvist <ExternalLink size={10} />
                                    </Link>
                                } />
                            )}
                            {report.safePayOrderId && !report.disputeId && isActive && (
                                <button onClick={() => disputeMutation.mutate(report._id)} disabled={disputeMutation.isPending}
                                    className="mt-2 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50">
                                    {disputeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />} Åpne SafePay-tvist
                                </button>
                            )}
                        </Section>
                    )}

                    {/* Complete chat */}
                    <Section title="Chatmeldinger">
                        <AdminChatViewer
                            chatId={chatId}
                            highlightMessageId={report.scope === 'message' ? report.messageId : undefined}
                            presetReason="Brukerrapport-undersøkelse"
                        />
                    </Section>

                    {/* Evidence */}
                    {report.evidence && report.evidence.length > 0 && (
                        <Section title="Bevis">
                            <div className="space-y-2">
                                {report.evidence.map((ev: { _id: string; fileUrl: string; fileType?: string; description?: string }, i: number) => (
                                    <div key={ev._id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-xs text-[#2d4a3e] hover:underline flex items-center gap-1">
                                            <ExternalLink size={12} /> Bevis {i + 1}
                                        </a>
                                        {ev.description && <span className="text-xs text-gray-400">{ev.description}</span>}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Quick actions */}
                    {isActive && (
                        <Section title="Handlinger">
                            <div className="space-y-2">
                                <select value={report.priority} onChange={(e) => priorityMutation.mutate({ id: report._id, priority: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                    {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </Section>
                    )}

                    {/* Internal notes */}
                    <Section title="Interne notater">
                        <div className="space-y-2">
                            {report.internalNotes && report.internalNotes.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {report.internalNotes.map((n: { _id: string; note: string; createdAt: string }) => (
                                        <div key={n._id} className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                                            <p className="text-xs text-gray-700">{n.note}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('nb-NO')}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                placeholder="Skriv internt notat..." />
                            <button onClick={() => {
                                if (noteText.trim()) { noteMutation.mutate({ id: report._id, note: noteText.trim() }); setNoteText(''); }
                            }} disabled={!noteText.trim() || noteMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2d4a3e] bg-green-50 hover:bg-green-100 rounded-xl transition-colors disabled:opacity-50">
                                {noteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <StickyNote size={12} />} Lagre notat
                            </button>
                        </div>
                    </Section>

                    {/* Timeline */}
                    <Section title="Tidslinje">
                        <div className="space-y-1">
                            {report.timeline && report.timeline.length > 0
                                ? [...report.timeline].reverse().map((entry: { _id: string; action: string; actorId?: { name: string }; description?: string; createdAt: string }) => (
                                    <TimelineItem key={entry._id} entry={entry} />
                                ))
                                : <p className="text-xs text-gray-400">Ingen hendelser ennå</p>
                            }
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
                            <select value={resolveForm.outcome} onChange={(e) => setResolveForm((f) => ({ ...f, outcome: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                <option value="">Velg utfall</option>
                                {RESOLVE_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={resolveForm.reason} onChange={(e) => setResolveForm((f) => ({ ...f, reason: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                                placeholder="Forklar avgjørelsen..." />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowResolve(false)}
                                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    if (!resolveForm.outcome || !resolveForm.reason.trim()) return;
                                    await resolveMutation.mutateAsync({ id: report._id, outcome: resolveForm.outcome, reason: resolveForm.reason.trim() });
                                    setShowResolve(false);
                                }}
                                disabled={resolveMutation.isPending || !resolveForm.outcome || !resolveForm.reason.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-50 transition-colors">
                                {resolveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                Bekreft
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
