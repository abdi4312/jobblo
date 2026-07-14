import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle2, AlertTriangle, Copy,
    ExternalLink, FileText, MessageSquare, Lock, Loader2,
} from 'lucide-react';
import { useSafePayDetail, useSafePayTimeline, useSafePayChat } from '../../hooks/admin/safepay';
import type { AdminChatMessage } from '../../api/admin/safepay';
import {
    AdminStatusBadge, AdminLoadingSkeleton,
    AdminErrorState, AdminEmptyState, AdminPageHeader,
} from '../../components/admin';

// ── Helpers ────────────────────────────────────────────────────────────────────
function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => { });
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { copyToClipboard(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="ml-1.5 text-gray-400 hover:text-gray-700 transition-colors" aria-label="Kopier">
            {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, value, badge, copy }: { label: string; value?: React.ReactNode; badge?: string; copy?: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-gray-400 shrink-0 w-36">{label}</span>
            <span className="text-sm text-gray-800 text-right flex items-center gap-1 min-w-0">
                {badge ? <AdminStatusBadge status={badge} /> : (value ?? <span className="text-gray-300">–</span>)}
                {copy && <CopyButton value={copy} />}
            </span>
        </div>
    );
}

function UserCard({ user, role }: {
    user?: { _id?: string; name?: string; email?: string; avatarUrl?: string; verified?: boolean; accountStatus?: string; averageRating?: number; completedJobs?: number } | null;
    role: string;
}) {
    if (!user) return <p className="text-sm text-gray-400">Ikke tilgjengelig</p>;
    return (
        <div className="flex items-start gap-3">
            <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name ?? 'U')}&background=2d4a3e&color=fff&size=48`}
                alt={user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-400 capitalize">{role}</p>
                <div className="flex items-center gap-2 mt-1">
                    {user.verified && <span className="text-xs text-green-600 font-medium">✓ Verifisert</span>}
                    {user.accountStatus && <AdminStatusBadge status={user.accountStatus} />}
                </div>
                <p className="text-xs text-gray-500">⭐ {user.averageRating?.toFixed(1) ?? '–'} · {user.completedJobs ?? 0} jobber</p>
            </div>
        </div>
    );
}

const SOURCE_COLORS: Record<string, string> = {
    order: 'bg-blue-100 text-blue-700',
    chat: 'bg-purple-100 text-purple-700',
    dispute: 'bg-red-100 text-red-700',
    admin: 'bg-orange-100 text-orange-700',
};

// ── Chat access panel ──────────────────────────────────────────────────────────
function ChatAccessPanel({ orderId, hasActiveDispute }: { orderId: string; hasActiveDispute: boolean }) {
    const [showForm, setShowForm] = useState(false);
    const [reason, setReason] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [auditMode] = useState(!hasActiveDispute);

    const chatQuery = useSafePayChat(orderId, reason, submitted, auditMode);

    const handleSubmit = () => {
        if (reason.trim().length < 5) return;
        setSubmitted(true);
    };

    const resetAccess = () => {
        setSubmitted(false);
        setReason('');
        setShowForm(false);
    };

    if (!showForm && !submitted) {
        return (
            <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
                <Lock size={13} />
                {hasActiveDispute ? 'Se full chat (tvist åpen)' : 'Be om tilgang til full chat'}
            </button>
        );
    }

    if (showForm && !submitted) {
        return (
            <div className="space-y-2 pt-2">
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                    Tilgang logges som admin-aktivitet. Oppgi en gyldig grunn.
                </p>
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Grunn for tilgang (min. 5 tegn)…"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none" />
                <div className="flex gap-2">
                    <button onClick={resetAccess}
                        className="flex-1 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                        Avbryt
                    </button>
                    <button onClick={handleSubmit} disabled={reason.trim().length < 5}
                        className="flex-1 py-2 text-xs font-medium text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors disabled:opacity-40">
                        Hent chat
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-2 space-y-2">
            {chatQuery.isLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                    <Loader2 size={14} className="animate-spin" /> Laster chatthistorikk…
                </div>
            )}
            {chatQuery.isError && (
                <div className="space-y-2">
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                        {(chatQuery.error as { response?: { data?: { message?: string } } })?.response?.data?.message
                            ?? 'Tilgang nektet. Krever aktiv tvist eller revisjonstillatelse.'}
                    </p>
                    <button onClick={resetAccess}
                        className="text-xs text-gray-500 hover:text-gray-700 underline">Prøv igjen</button>
                </div>
            )}
            {chatQuery.data && (
                <ChatMessagesView messages={chatQuery.data.chat.messages} onClose={resetAccess} />
            )}
        </div>
    );
}

// ── Chat messages read-only view ──────────────────────────────────────────────
function ChatMessagesView({ messages, onClose }: { messages: AdminChatMessage[]; onClose: () => void }) {
    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <MessageSquare size={13} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">Chatthistorikk (skrivebeskyttet)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Kun lesing</span>
                    <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Lukk</button>
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 space-y-2 bg-white">
                {messages.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Ingen meldinger</p>
                ) : (
                    messages.map((msg) => {
                        const isSystem = msg.type?.startsWith('system_');
                        if (isSystem) {
                            return (
                                <div key={msg._id} className="text-center">
                                    <span className="inline-block text-[10px] text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                                        {msg.text ?? msg.type}
                                    </span>
                                </div>
                            );
                        }
                        const senderName = msg.sender?.name ?? 'Ukjent';
                        const senderRole = msg.sender?.role ?? '';
                        return (
                            <div key={msg._id} className="flex gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500 mt-0.5">
                                    {senderName[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-xs font-semibold text-gray-700">{senderName}</span>
                                        {senderRole && <span className="text-[10px] text-gray-400 capitalize">{senderRole}</span>}
                                        <time className="text-[10px] text-gray-300 ml-auto">{new Date(msg.createdAt).toLocaleString('nb-NO')}</time>
                                    </div>
                                    {msg.text && <p className="text-xs text-gray-700 leading-relaxed">{msg.text}</p>}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            {msg.attachments.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] text-[#2d4a3e] hover:underline">
                                                    <FileText size={10} /> Vedlegg {i + 1}
                                                    <ExternalLink size={9} />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────
type OrderData = {
    _id: string; status: string; paymentStatus: string;
    agreedPrice?: number; initialPrice?: number; fee?: number;
    customerTotal?: number; providerNet?: number;
    scheduledDate?: string; createdAt: string;
    checklist?: Array<{ id: string; text: string; checked: boolean; checkedBy?: { name: string }; checkedAt?: string }>;
    beforeImages?: string[]; afterImages?: string[]; attachments?: string[];
    customerId?: { _id: string; name: string; email: string; avatarUrl?: string; verified?: boolean; accountStatus?: string; averageRating?: number; completedJobs?: number };
    providerId?: { _id: string; name: string; email: string; avatarUrl?: string; verified?: boolean; accountStatus?: string; averageRating?: number; completedJobs?: number };
    serviceId?: { _id: string; title: string; price: number; status: string; categories?: string[] };
};

export default function SafePayDetailPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const { data, isLoading, isError, refetch } = useSafePayDetail(orderId ?? '');
    const { data: timeline, isLoading: timelineLoading } = useSafePayTimeline(orderId ?? '');

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={3} /><AdminLoadingSkeleton rows={5} /></div>;
    if (isError || !data) return <AdminErrorState onRetry={refetch} title="Kontrakt ikke funnet" description="Kontrakten finnes ikke eller tilgang er nektet." />;

    const d = data as {
        order: OrderData;
        payment?: { _id: string; status: string; amount: number; stripePaymentIntentId?: string; createdAt: string } | null;
        safePayHistory?: { status: string; amounts: { agreedPrice: number; fee: number; totalCustomer: number; netProvider: number }; paymentDate?: string } | null;
        dispute?: { _id: string; status: string; priority: string; title: string; reasonCategory: string } | null;
        chatMeta?: { _id: string; status: string; messageCount: number; systemMessageCount: number; lastMessageAt?: string } | null;
    };
    const { order, payment, safePayHistory, dispute, chatMeta } = d;
    const fee = order.agreedPrice ? Math.round(order.agreedPrice * 0.03) : 0;
    const checklist = order.checklist ?? [];
    const checkedCount = checklist.filter((i) => i.checked).length;
    const checklistPct = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;
    const hasActiveDispute = !!dispute && ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'].includes(dispute.status);

    return (
        <div className="space-y-6">
            {/* Back nav */}
            <div className="flex items-center gap-3">
                <Link to="/dashboard/safepay" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft size={16} /> Tilbake til SafePay
                </Link>
            </div>

            <AdminPageHeader
                title={`Kontrakt ${order._id.slice(-8).toUpperCase()}`}
                description={order.serviceId?.title ?? 'Ukjent tjeneste'}
                actions={dispute ? (
                    <Link to={`/dashboard/disputes/${dispute._id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                        <AlertTriangle size={15} /> Vis tvist
                    </Link>
                ) : undefined}
            />

            {/* Status bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4">
                {([
                    { label: 'Ordre', value: order.status },
                    { label: 'Betaling', value: order.paymentStatus },
                    { label: 'Chat', value: chatMeta?.status },
                    { label: 'Tvist', value: dispute?.status },
                ] as { label: string; value?: string }[]).map(({ label, value }) =>
                    value ? (
                        <div key={label} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{label}:</span>
                            <AdminStatusBadge status={value} />
                        </div>
                    ) : null
                )}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Contract overview */}
                    <Section title="Kontraktoversikt">
                        <Row label="Ordre-ID" value={<span className="font-mono text-xs">{order._id}</span>} copy={order._id} />
                        <Row label="Tjeneste" value={order.serviceId?.title} />
                        <Row label="Ordrestatus" badge={order.status} />
                        <Row label="Betalingsstatus" badge={order.paymentStatus} />
                        <Row label="Opprinnelig pris" value={order.initialPrice != null ? `${order.initialPrice.toLocaleString('nb-NO')} NOK` : undefined} />
                        <Row label="Avtalt pris" value={order.agreedPrice != null ? `${order.agreedPrice.toLocaleString('nb-NO')} NOK` : undefined} />
                        <Row label="Jobblo-gebyr (3%)" value={`${fee.toLocaleString('nb-NO')} NOK`} />
                        <Row label="Kunden betaler" value={order.agreedPrice != null ? `${(order.agreedPrice + fee).toLocaleString('nb-NO')} NOK` : undefined} />
                        <Row label="Tilbyder får (intern)" value={order.agreedPrice != null ? `${(order.agreedPrice - fee).toLocaleString('nb-NO')} NOK` : undefined} />
                        <Row label="Opprettet" value={new Date(order.createdAt).toLocaleString('nb-NO')} />
                        {order.scheduledDate && <Row label="Planlagt dato" value={new Date(order.scheduledDate).toLocaleDateString('nb-NO')} />}
                    </Section>

                    {/* Payment */}
                    <Section title="Betalingsinformasjon">
                        {payment ? (
                            <>
                                <Row label="Status" badge={payment.status} />
                                <Row label="Beløp" value={`${payment.amount.toLocaleString('nb-NO')} NOK`} />
                                {payment.stripePaymentIntentId && (
                                    <Row label="Stripe PI (trunkert)"
                                        value={<span className="font-mono text-xs">{payment.stripePaymentIntentId}</span>}
                                        copy={payment.stripePaymentIntentId} />
                                )}
                                <Row label="Betalingsdato" value={new Date(payment.createdAt).toLocaleString('nb-NO')} />
                            </>
                        ) : (
                            <AdminEmptyState title="Ingen betaling" description="Betaling er ikke behandlet ennå." className="py-4" />
                        )}
                    </Section>

                    {/* SafePayHistory */}
                    {safePayHistory && (
                        <Section title="SafePay-historikk">
                            <Row label="Status" badge={safePayHistory.status} />
                            <Row label="Avtalt pris" value={`${safePayHistory.amounts.agreedPrice.toLocaleString('nb-NO')} NOK`} />
                            <Row label="Gebyr" value={`${safePayHistory.amounts.fee.toLocaleString('nb-NO')} NOK`} />
                            <Row label="Kunden betalte" value={`${safePayHistory.amounts.totalCustomer.toLocaleString('nb-NO')} NOK`} />
                            <Row label="Tilbyder fikk (intern)" value={`${safePayHistory.amounts.netProvider.toLocaleString('nb-NO')} NOK`} />
                            {safePayHistory.paymentDate && (
                                <Row label="Betalingsdato" value={new Date(safePayHistory.paymentDate).toLocaleString('nb-NO')} />
                            )}
                            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-2">
                                ⚠️ "Tilbyder fikk" er en intern saldooppdatering — ikke en ekstern bankoverføring.
                            </p>
                        </Section>
                    )}

                    {/* Checklist */}
                    <Section title={`Sjekkliste (${checkedCount}/${checklist.length}${checklist.length > 0 ? ` · ${checklistPct}%` : ''})`}>
                        {checklist.length === 0 ? (
                            <AdminEmptyState title="Ingen sjekkliste" description="Ingen sjekklistepunkter." className="py-4" />
                        ) : (
                            <div className="space-y-2">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                                    <div className="h-full bg-[#2d4a3e] rounded-full transition-all" style={{ width: `${checklistPct}%` }} />
                                </div>
                                {checklist.map((item) => (
                                    <div key={item.id} className="flex items-start gap-2.5 py-1.5">
                                        <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${item.checked ? 'bg-[#2d4a3e] border-[#2d4a3e]' : 'border-gray-300'}`}>
                                            {item.checked && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm ${item.checked ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.text}</p>
                                            {item.checked && item.checkedBy && (
                                                <p className="text-xs text-gray-400">
                                                    {item.checkedBy.name}{item.checkedAt ? ` · ${new Date(item.checkedAt).toLocaleDateString('nb-NO')}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Files */}
                    {((order.beforeImages?.length ?? 0) > 0 || (order.afterImages?.length ?? 0) > 0 || (order.attachments?.length ?? 0) > 0) && (
                        <Section title="Filer og bilder">
                            {order.beforeImages && order.beforeImages.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Før</p>
                                    <div className="flex flex-wrap gap-2">
                                        {order.beforeImages.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Før ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {order.afterImages && order.afterImages.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-medium text-gray-500 mb-2">Etter</p>
                                    <div className="flex flex-wrap gap-2">
                                        {order.afterImages.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Etter ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {order.attachments && order.attachments.length > 0 && (
                                <div>
                                    <p className="text-xs font-medium text-gray-500 mb-2">Vedlegg</p>
                                    {order.attachments.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-xs text-[#2d4a3e] hover:underline mb-1">
                                            <FileText size={13} /> Vedlegg {i + 1} <ExternalLink size={11} />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </Section>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    <Section title="Kunde"><UserCard user={order.customerId} role="Kunde" /></Section>
                    <Section title="Tilbyder"><UserCard user={order.providerId} role="Tilbyder" /></Section>

                    {/* Chat — fully functional with access reason dialog */}
                    <Section title="Chat">
                        {chatMeta ? (
                            <div className="space-y-2">
                                <Row label="Chat-ID" value={<span className="font-mono text-xs">{String(chatMeta._id).slice(-8)}</span>} copy={String(chatMeta._id)} />
                                <Row label="Status" badge={chatMeta.status} />
                                <Row label="Meldinger" value={String(chatMeta.messageCount)} />
                                <Row label="Systemmeldinger" value={String(chatMeta.systemMessageCount)} />
                                {chatMeta.lastMessageAt && (
                                    <Row label="Siste melding" value={new Date(chatMeta.lastMessageAt).toLocaleDateString('nb-NO')} />
                                )}
                                {/* Functional chat access panel */}
                                <ChatAccessPanel orderId={order._id} hasActiveDispute={hasActiveDispute} />
                            </div>
                        ) : (
                            <AdminEmptyState title="Ingen chat" description="Ingen chat er knyttet til denne kontrakten." className="py-4" />
                        )}
                    </Section>

                    {/* Dispute summary */}
                    {dispute && (
                        <Section title="Aktiv tvist">
                            <Row label="Tvist-ID" value={<span className="font-mono text-xs">{dispute._id.slice(-8)}</span>} />
                            <Row label="Tittel" value={dispute.title} />
                            <Row label="Årsak" value={dispute.reasonCategory.replace(/_/g, ' ')} />
                            <Row label="Status" badge={dispute.status} />
                            <Row label="Prioritet" value={dispute.priority} />
                            <div className="pt-2">
                                <Link to={`/dashboard/disputes/${dispute._id}`}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                                    <AlertTriangle size={13} /> Administrer tvist
                                </Link>
                            </div>
                        </Section>
                    )}

                    {/* Timeline */}
                    <Section title="Tidslinje">
                        {timelineLoading ? (
                            <AdminLoadingSkeleton rows={4} />
                        ) : !timeline || timeline.length === 0 ? (
                            <AdminEmptyState title="Ingen hendelser" description="Ingen loggede hendelser ennå." className="py-4" />
                        ) : (
                            <div className="relative">
                                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" aria-hidden="true" />
                                <div className="space-y-3 pl-8">
                                    {timeline.map((event, i) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-5 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white mt-1" aria-hidden="true" />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[event.source] ?? 'bg-gray-100 text-gray-600'}`}>
                                                        {event.source}
                                                    </span>
                                                    <span className="text-xs font-medium text-gray-700">{event.action.replace(/_/g, ' ')}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                                                <time className="text-[10px] text-gray-300">{new Date(event.timestamp).toLocaleString('nb-NO')}</time>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
}
