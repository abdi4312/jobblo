import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, FileText, ExternalLink } from 'lucide-react';
import {
    useDisputeById, useAssignDispute,
    useResolveDispute, useReopenDispute, useAddInternalNote,
} from '../../hooks/admin/safepay';
import {
    AdminStatusBadge, AdminLoadingSkeleton, AdminErrorState, AdminPageHeader,
} from '../../components/admin';
import type { Dispute, DisputeOutcome } from '../../types/admin/safepay';
import { toast } from 'sonner';

const OUTCOME_OPTIONS: { label: string; value: DisputeOutcome }[] = [
    { label: 'Frigi til tilbyder', value: 'release_to_provider' },
    { label: 'Full refusjon til kunde', value: 'full_refund_to_customer' },
    { label: 'Delvis refusjon', value: 'partial_refund' },
    { label: 'Del betaling', value: 'split_payment' },
    { label: 'Avbryt uten betaling', value: 'cancel_without_payment' },
    { label: 'Ingen handling', value: 'no_action' },
];

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b border-gray-50 pb-2">{title}</h3>
            {children}
        </div>
    );
}

export default function DisputeDetailPage() {
    const { disputeId } = useParams<{ disputeId: string }>();
    const { data: dispute, isLoading, isError, refetch } = useDisputeById(disputeId ?? '');

    const [noteText, setNoteText] = useState('');
    const [showResolve, setShowResolve] = useState(false);
    const [resolveOutcome, setResolveOutcome] = useState<DisputeOutcome | ''>('');
    const [resolveReason, setResolveReason] = useState('');
    const [resolveCustomer, setResolveCustomer] = useState('');
    const [resolveProvider, setResolveProvider] = useState('');
    const [reopenReason, setReopenReason] = useState('');
    const [showReopen, setShowReopen] = useState(false);

    const assignMut = useAssignDispute();
    const noteMut = useAddInternalNote();
    const resolveMut = useResolveDispute();
    const reopenMut = useReopenDispute();

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={3} /><AdminLoadingSkeleton rows={6} /></div>;
    if (isError || !dispute) return <AdminErrorState onRetry={refetch} title="Tvist ikke funnet" description="Tvisten finnes ikke eller tilgang er nektet." />;

    const d = dispute as Dispute;
    const orderId = typeof d.orderId === 'object' ? d.orderId._id : d.orderId;
    const isActive = ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'].includes(d.status);
    const isResolved = ['resolved', 'closed'].includes(d.status);
    const PRIORITY_COLOR: Record<string, string> = { low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-50 text-yellow-700', high: 'bg-orange-50 text-orange-700', critical: 'bg-red-100 text-red-700' };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link to="/dashboard/disputes" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft size={16} /> Tilbake til tvister
                </Link>
            </div>

            <AdminPageHeader
                title={d.title}
                description={`${d.reasonCategory?.replace(/_/g, ' ')} · Opprettet ${new Date(d.openedAt ?? d.createdAt).toLocaleDateString('nb-NO')}`}
                actions={orderId ? (
                    <Link to={`/dashboard/safepay/${orderId}`} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#2d4a3e] bg-[#eef5f2] hover:bg-[#d7ece4] rounded-xl transition-colors">
                        <ExternalLink size={14} /> Se kontrakt
                    </Link>
                ) : undefined}
            />

            {/* Status bar */}
            <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-gray-100 p-4 items-center">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Status:</span><AdminStatusBadge status={d.status} /></div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Prioritet:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOR[d.priority] ?? ''}`}>{d.priority}</span>
                </div>
                {d.assignedAdminId && (
                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Tildelt:</span>
                        <span className="text-xs text-gray-700">{(d.assignedAdminId as { name?: string }).name ?? '–'}</span>
                    </div>
                )}
                {!d.assignedAdminId && isActive && (
                    <button onClick={() => assignMut.mutate(d._id)} disabled={assignMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 ml-auto">
                        {assignMut.isPending && <Loader2 size={12} className="animate-spin" />} Ta sak
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left */}
                <div className="lg:col-span-2 space-y-4">
                    <Section title="Tvistdetaljer">
                        <Row label="Tvist-ID" value={<span className="font-mono text-xs">{d._id}</span>} />
                        <Row label="Årsak" value={d.reasonCategory?.replace(/_/g, ' ')} />
                        <Row label="Beskrivelse" value={<span className="text-xs leading-relaxed whitespace-pre-wrap">{d.description}</span>} />
                        <Row label="Åpnet" value={new Date(d.openedAt ?? d.createdAt).toLocaleString('nb-NO')} />
                        {d.closedAt && <Row label="Lukket" value={new Date(d.closedAt).toLocaleString('nb-NO')} />}
                        <Row label="Ordre-ID" value={orderId ? <Link to={`/dashboard/safepay/${orderId}`} className="font-mono text-xs text-[#2d4a3e] hover:underline">{String(orderId).slice(-8).toUpperCase()}</Link> : undefined} />
                    </Section>

                    {/* Messages */}
                    {d.messages && d.messages.length > 0 && (
                        <Section title={`Meldinger (${d.messages.length})`}>
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {d.messages.filter((m) => !m.isInternal).map((m) => (
                                    <div key={m._id} className={`p-3 rounded-xl text-sm ${m.senderRole === 'admin' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-700 capitalize">{m.senderRole}</span>
                                            <time className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString('nb-NO')}</time>
                                        </div>
                                        <p className="text-gray-800 leading-relaxed">{m.message}</p>
                                        {m.attachments?.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#2d4a3e] hover:underline mt-1">
                                                <FileText size={11} /> Vedlegg {i + 1} <ExternalLink size={9} />
                                            </a>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Internal notes — admin only */}
                    <Section title="Interne notater (kun admin)">
                        {d.messages?.filter((m) => m.isInternal).map((m) => (
                            <div key={m._id} className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl mb-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span className="font-medium">{(m.senderId as { name?: string })?.name ?? 'Admin'}</span>
                                    <time>{new Date(m.createdAt).toLocaleString('nb-NO')}</time>
                                </div>
                                <p className="text-sm text-gray-800">{m.message}</p>
                            </div>
                        ))}
                        <div className="space-y-2 mt-2">
                            <textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Legg til internt notat…"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none" />
                            <button onClick={() => { if (!noteText.trim()) return; noteMut.mutate({ id: d._id, note: noteText.trim() }); setNoteText(''); }}
                                disabled={!noteText.trim() || noteMut.isPending}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-40 transition-colors">
                                {noteMut.isPending && <Loader2 size={13} className="animate-spin" />} Lagre notat
                            </button>
                        </div>
                    </Section>

                    {/* Timeline */}
                    {d.timeline && d.timeline.length > 0 && (
                        <Section title="Tidslinje">
                            <div className="relative pl-6">
                                <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-100" />
                                <div className="space-y-3">
                                    {[...d.timeline].reverse().map((t, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-4 w-2 h-2 rounded-full bg-gray-300 border-2 border-white mt-1" />
                                            <p className="text-xs font-medium text-gray-700">{t.action.replace(/_/g, ' ')}</p>
                                            {t.note && <p className="text-xs text-gray-500 mt-0.5">{t.note}</p>}
                                            <time className="text-[10px] text-gray-300">{new Date(t.createdAt).toLocaleString('nb-NO')}</time>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Section>
                    )}
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                    <Section title="Parter">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Åpnet av</p>
                                {d.openedBy && typeof d.openedBy === 'object' ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{(d.openedBy as { name?: string }).name ?? '–'}</p>
                                        <p className="text-xs text-gray-400">{(d.openedBy as { email?: string }).email ?? ''}</p>
                                        <p className="text-xs text-gray-400 capitalize">{d.openedByRole}</p>
                                    </div>
                                ) : <p className="text-sm text-gray-400">–</p>}
                            </div>
                            <div className="border-t border-gray-50 pt-3">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Åpnet mot</p>
                                {d.openedAgainst && typeof d.openedAgainst === 'object' ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{(d.openedAgainst as { name?: string }).name ?? '–'}</p>
                                        <p className="text-xs text-gray-400">{(d.openedAgainst as { email?: string }).email ?? ''}</p>
                                    </div>
                                ) : <p className="text-sm text-gray-400">–</p>}
                            </div>
                        </div>
                    </Section>

                    {d.resolution?.outcome && (
                        <Section title="Løsning">
                            <Row label="Utfall" value={d.resolution.outcome.replace(/_/g, ' ')} />
                            <Row label="Begrunnelse" value={<span className="text-xs">{d.resolution.reason}</span>} />
                            {d.resolution.resolvedBy && typeof d.resolution.resolvedBy === 'object' && (
                                <Row label="Løst av" value={(d.resolution.resolvedBy as { name?: string }).name} />
                            )}
                            {d.resolution.resolvedAt && <Row label="Løst dato" value={new Date(d.resolution.resolvedAt).toLocaleString('nb-NO')} />}
                            {d.resolution.stripeRefundId && <Row label="Stripe refusjon" value={<span className="font-mono text-xs">{d.resolution.stripeRefundId}</span>} />}
                        </Section>
                    )}

                    <Section title="Handlinger">
                        <div className="space-y-2">
                            {isActive && (
                                <button onClick={() => setShowResolve(true)}
                                    className="w-full py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl transition-colors">
                                    Løs tvist
                                </button>
                            )}
                            {isResolved && (
                                <button onClick={() => setShowReopen(true)}
                                    className="w-full py-2.5 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors">
                                    Gjenåpne
                                </button>
                            )}
                        </div>
                    </Section>

                    {/* Evidence */}
                    {d.evidence && d.evidence.length > 0 && (
                        <Section title={`Bevis (${d.evidence.length})`}>
                            {d.evidence.map((e) => (
                                <a key={e._id} href={e.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs text-[#2d4a3e] hover:underline mb-1.5">
                                    <FileText size={12} /> {e.fileType ?? 'Fil'} <ExternalLink size={10} />
                                </a>
                            ))}
                        </Section>
                    )}
                </div>
            </div>

            {/* Resolve dialog */}
            {showResolve && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Løs tvist: {d.title}</h2>
                        <p className="text-sm text-gray-500">Alle handlinger logges og varsler berørte parter. Stripe-refusjoner behandles i sanntid.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Utfall *</label>
                            <select value={resolveOutcome} onChange={(e) => setResolveOutcome(e.target.value as DisputeOutcome)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50">
                                <option value="">Velg utfall</option>
                                {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Begrunnelse *</label>
                            <textarea rows={3} value={resolveReason} onChange={(e) => setResolveReason(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                                placeholder="Forklar beslutningen…" />
                        </div>
                        {['partial_refund', 'split_payment'].includes(resolveOutcome) && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kundebeløp (NOK)</label>
                                    <input type="number" min="0" value={resolveCustomer} onChange={(e) => setResolveCustomer(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tilbyderbeløp (NOK)</label>
                                    <input type="number" min="0" value={resolveProvider} onChange={(e) => setResolveProvider(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50" />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">⚠️ For refusjoner: Stripe API kalles umiddelbart. Dette kan ikke angres.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowResolve(false)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Avbryt</button>
                            <button onClick={() => {
                                if (!resolveOutcome || !resolveReason.trim()) { toast.error('Fyll ut utfall og begrunnelse.'); return; }
                                resolveMut.mutate({ id: d._id, payload: { outcome: resolveOutcome, reason: resolveReason.trim(), customerAmount: resolveCustomer ? parseFloat(resolveCustomer) : 0, providerAmount: resolveProvider ? parseFloat(resolveProvider) : 0 } });
                                setShowResolve(false);
                            }} disabled={resolveMut.isPending || !resolveOutcome || !resolveReason.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2d4a3e] hover:bg-[#233b31] rounded-xl disabled:opacity-40 transition-colors">
                                {resolveMut.isPending && <Loader2 size={13} className="animate-spin" />} Bekreft løsning
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reopen dialog */}
            {showReopen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">Gjenåpne tvist?</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Årsak *</label>
                            <textarea rows={2} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none"
                                placeholder="Skriv årsaken til gjenåpning…" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowReopen(false)} className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Avbryt</button>
                            <button onClick={() => { if (!reopenReason.trim()) return; reopenMut.mutate({ id: d._id, reason: reopenReason.trim() }); setShowReopen(false); }}
                                disabled={!reopenReason.trim() || reopenMut.isPending}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-40 transition-colors">
                                {reopenMut.isPending && <Loader2 size={13} className="animate-spin" />} Gjenåpne
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
