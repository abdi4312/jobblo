import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, ShieldCheck, MessageCircle, Play, CheckSquare,
    Upload, Clock, AlertTriangle, FileText, Check, ChevronRight,
    Loader2, Camera, TrendingUp, Star,
} from 'lucide-react';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/Ui/button/Button';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    awaiting_payment: { label: 'Venter på betaling', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    paid: { label: 'Betalt — jobb kan starte', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    in_progress: { label: 'Jobb pågår', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
    ready_for_review: { label: 'Klar for gjennomgang', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    completed: { label: 'Fullført', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    disputed: { label: 'Under tvist', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    refunded: { label: 'Refundert', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200' },
    cancelled: { label: 'Kansellert', color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200' },
};

const ACTION_LABELS: Record<string, string> = {
    contract_created: 'Kontrakt opprettet',
    payment_confirmed: 'Betaling bekreftet',
    job_started: 'Jobb startet',
    ready_for_review: 'Klar for gjennomgang',
    work_approved: 'Jobb godkjent',
    job_completed: 'Fullført',
    evidence_uploaded: 'Bevis lastet opp',
    dispute_opened: 'Tvist åpnet',
    payout_approved: 'Utbetaling godkjent',
};

const MiniStarRating: React.FC<{ value: number; onChange: (v: number) => void; size?: number }> = ({ value, onChange, size = 24 }) => {
    const [hover, setHover] = useState<number | null>(null);
    const display = hover ?? value;
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onChange(s)}
                    className="cursor-pointer transition-transform hover:scale-110"
                >
                    <Star
                        size={size}
                        className={s <= display ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#d1d5db]'}
                    />
                </button>
            ))}
        </div>
    );
};

const ProviderOrderDetailPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const user = useUserStore((s) => s.user);
    const [showEvidence, setShowEvidence] = useState(false);
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [completionNote, setCompletionNote] = useState('');

    // Provider review state
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');

    const { data, isLoading, error } = useQuery({
        queryKey: ['provider-order', orderId],
        queryFn: async () => {
            const res = await mainLink.get(`/api/safepay/orders/${orderId}`);
            return res.data;
        },
        enabled: !!orderId,
        refetchInterval: 30000,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider-order', orderId] });

    const startMutation = useMutation({
        mutationFn: () => mainLink.post(`/api/safepay/orders/${orderId}/start`),
        onSuccess: () => { toast.success('Jobb startet!'); invalidate(); },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Feil ved start'),
    });

    const readyMutation = useMutation({
        mutationFn: () => mainLink.post(`/api/safepay/orders/${orderId}/ready-for-review`),
        onSuccess: () => { toast.success('Meldt ferdig!'); invalidate(); },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Feil'),
    });

    const checklistMutation = useMutation({
        mutationFn: ({ itemId, val }: { itemId: string; val: boolean }) =>
            mainLink.patch(`/api/safepay/orders/${orderId}/provider-checklist/${itemId}`, { providerCompleted: val }),
        onSuccess: () => invalidate(),
        onError: (e: any) => toast.error(e.response?.data?.error || 'Feil'),
    });

    const evidenceMutation = useMutation({
        mutationFn: async () => {
            const fd = new FormData();
            evidenceFiles.forEach((f) => fd.append('files', f));
            if (completionNote) fd.append('completionNote', completionNote);
            fd.append('evidenceType', 'after');
            return mainLink.post(`/api/safepay/orders/${orderId}/evidence`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            toast.success('Bevis lastet opp!');
            setEvidenceFiles([]);
            setCompletionNote('');
            setShowEvidence(false);
            invalidate();
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Opplasting feilet'),
    });

    // Check if provider already reviewed this order
    const { data: existingReviews } = useQuery({
        queryKey: ['order-reviews', orderId],
        queryFn: async () => {
            const res = await mainLink.get(`/api/orders/${orderId}/review`);
            return Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
        },
        enabled: !!orderId,
    });

    const providerHasReviewed = existingReviews?.some(
        (r: any) => r.revieweeRole === 'seeker' && (r.reviewerId?._id || r.reviewerId) === user?._id
    );

    const reviewMutation = useMutation({
        mutationFn: async () => {
            const res = await mainLink.post('/api/reviews', {
                orderId,
                serviceId: data?.order?.serviceId?._id,
                revieweeId: data?.order?.customerId?._id,
                revieweeRole: 'seeker',
                rating: reviewRating,
                comment: reviewComment,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Vurdering sendt!');
            setShowReviewForm(false);
            setReviewRating(0);
            setReviewComment('');
            queryClient.invalidateQueries({ queryKey: ['order-reviews', orderId] });
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Kunne ikke sende vurdering'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f5f0e8]">
                <Loader2 className="animate-spin text-custom-green" size={36} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-6">
                <p className="text-red-500 mb-4">Kunne ikke laste oppdrag</p>
                <Button onClick={() => navigate(-1)} label="Gå tilbake" />
            </div>
        );
    }

    const { order, calculation, isProvider, isCustomer, activeDispute } = data;
    const status = order.status as string;
    const statusConf = STATUS_CONFIG[status] || { label: status, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' };

    const canStart = isProvider && status === 'paid' && order.paymentStatus === 'paid' && !activeDispute;
    const canUpload = isProvider && ['paid', 'in_progress'].includes(status);
    const canMarkReady = isProvider && status === 'in_progress' && !activeDispute;
    const canApprove = isCustomer && status === 'ready_for_review' && !activeDispute;

    return (
        <div className="min-h-screen bg-[#f5f0e8] pb-16">
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Back */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 mb-6">
                    <ArrowLeft size={15} /> Tilbake
                </button>

                {/* Header card */}
                <div className="bg-[#1a3a1a] rounded-2xl p-5 mb-4 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-[18px] font-bold mb-1">{order.serviceId?.title}</h1>
                            <p className="text-white/60 text-[12px]">
                                Kontrakt #JB-{order._id?.substring(0, 8).toUpperCase()}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[22px] font-bold text-[#4ade80]">{order.agreedPrice} kr</div>
                            <div className="text-white/50 text-[11px]">Du mottar: {calculation?.providerNet} kr</div>
                        </div>
                    </div>
                </div>

                {/* Status banner */}
                <div className={`border rounded-xl p-4 mb-4 flex items-center gap-3 ${statusConf.bg}`}>
                    <ShieldCheck size={20} className={statusConf.color} />
                    <div>
                        <p className={`font-semibold text-[14px] ${statusConf.color}`}>{statusConf.label}</p>
                        {activeDispute && <p className="text-red-600 text-[12px] mt-0.5">Tvist er åpnet — utbetaling er fryst</p>}
                    </div>
                </div>

                {/* Parties */}
                <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                    <h2 className="font-semibold text-[14px] text-gray-800 mb-3">Avtale mellom</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Oppdragsgiver', u: order.customerId },
                            { label: 'Utfører', u: order.providerId },
                        ].map(({ label, u }) => (
                            <div key={label} className="bg-[#f9f9f7] rounded-xl p-3 text-center">
                                <div className="w-10 h-10 rounded-full bg-[#c8d8c8] mx-auto mb-2 overflow-hidden flex items-center justify-center text-[#1a3a1a] font-bold">
                                    {u?.avatarUrl
                                        ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                                        : (u?.name?.[0] || '?')}
                                </div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                                <p className="text-[13px] font-medium">{u?.name} {u?.lastName || ''}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Details */}
                <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                    <h2 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                        <FileText size={15} className="text-custom-green" /> Oppdragsdetaljer
                    </h2>
                    <div className="space-y-2 text-[13px]">
                        {[
                            ['Sted', order.serviceId?.location?.city || 'Ikke angitt'],
                            ['Avtalt pris', `${order.agreedPrice} kr`],
                            ['Platform-gebyr 3%', `${calculation?.fee} kr`],
                            ['Du mottar', `${calculation?.providerNet} kr`],
                            ['Betalingsstatus', order.paymentStatus === 'paid' ? '✅ Betalt' : '⏳ Venter'],
                        ].map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-black/5 pb-1.5">
                                <span className="text-gray-400">{k}</span>
                                <span className="font-medium text-gray-800">{v}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Checklist */}
                {order.checklist?.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <h2 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                            <CheckSquare size={15} className="text-custom-green" /> Sjekkliste
                        </h2>
                        <div className="space-y-2">
                            {order.checklist.map((item: any) => {
                                const completed = item.providerCompleted ?? item.checked;
                                const canToggle = isProvider && ['paid', 'in_progress'].includes(status);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => canToggle && checklistMutation.mutate({ itemId: item.id, val: !completed })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${completed ? 'bg-[#f0faf0] border-[#c6f0d8]' : 'bg-[#f9f9f7] border-transparent'
                                            } ${canToggle ? 'cursor-pointer hover:border-black/10' : 'cursor-default'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${completed ? 'bg-custom-green border-custom-green' : 'border-gray-300'}`}>
                                            {completed && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <span className={`text-[13px] flex-1 ${completed ? 'text-[#166534]' : 'text-gray-600'}`}>{item.text}</span>
                                        {item.customerConfirmed && (
                                            <span className="text-[10px] text-custom-green font-medium">✓ Bekreftet</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Evidence images */}
                {(order.afterImages?.length > 0 || order.beforeImages?.length > 0) && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <h2 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                            <Camera size={15} className="text-custom-green" /> Bevis
                        </h2>
                        <div className="grid grid-cols-3 gap-2">
                            {[...(order.beforeImages || []), ...(order.afterImages || [])].map((url: string, i: number) => (
                                <img key={i} src={url} alt="bevis" className="w-full aspect-square object-cover rounded-xl" />
                            ))}
                        </div>
                        {order.completionNote && (
                            <p className="mt-3 text-[13px] text-gray-600 bg-[#f9f9f7] p-3 rounded-xl">{order.completionNote}</p>
                        )}
                    </div>
                )}

                {/* Timeline */}
                {order.history?.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <h2 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                            <Clock size={15} className="text-custom-green" /> Tidslinje
                        </h2>
                        <div className="space-y-3">
                            {[...order.history].reverse().map((h: any, i: number) => (
                                <div key={i} className="flex gap-3 text-[12px]">
                                    <div className="w-2 h-2 rounded-full bg-custom-green mt-1.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-gray-800">{ACTION_LABELS[h.action] || h.action}</p>
                                        <p className="text-gray-400">{new Date(h.timestamp).toLocaleString('no-NO')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Evidence upload panel */}
                {showEvidence && canUpload && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <h2 className="font-semibold text-[14px] text-gray-800 mb-3">Last opp bevis</h2>
                        <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                            className="block w-full text-[13px] mb-3"
                        />
                        {evidenceFiles.length > 0 && (
                            <p className="text-[12px] text-gray-500 mb-2">{evidenceFiles.length} fil(er) valgt</p>
                        )}
                        <textarea
                            value={completionNote}
                            onChange={(e) => setCompletionNote(e.target.value)}
                            placeholder="Ferdigstillingsnotat (valgfritt)..."
                            className="w-full border border-black/10 rounded-xl p-3 text-[13px] min-h-[80px] outline-none focus:border-custom-green mb-3"
                        />
                        <div className="flex gap-2">
                            <Button
                                onClick={() => evidenceMutation.mutate()}
                                loading={evidenceMutation.isPending}
                                disabled={!evidenceFiles.length && !completionNote}
                                label="Last opp"
                                className="bg-custom-green text-white rounded-full px-6 py-2.5 text-[13px] font-medium"
                            />
                            <Button onClick={() => setShowEvidence(false)} label="Avbryt" variant="outline" className="rounded-full px-6 py-2.5 text-[13px]" />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="space-y-3">
                    {/* Chat */}
                    {order.chatId && (
                        <button
                            onClick={() => navigate(`/messages/${order.chatId}`)}
                            className="w-full flex items-center justify-between bg-white border border-black/10 rounded-xl p-4 hover:bg-gray-50 transition"
                        >
                            <span className="flex items-center gap-2 text-[14px] font-medium">
                                <MessageCircle size={17} className="text-custom-green" /> Åpne chat
                            </span>
                            <ChevronRight size={15} className="text-gray-400" />
                        </button>
                    )}

                    {/* Start job */}
                    {canStart && (
                        <Button
                            onClick={() => startMutation.mutate()}
                            loading={startMutation.isPending}
                            className="w-full bg-custom-green text-white rounded-full py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 shadow-md"
                        >
                            <Play size={17} /> Start jobben
                        </Button>
                    )}

                    {/* Continue work */}
                    {status === 'in_progress' && isProvider && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
                            <TrendingUp size={18} className="text-indigo-600" />
                            <p className="text-[13px] text-indigo-700 font-medium">Jobb pågår — last opp bevis eller meld ferdig</p>
                        </div>
                    )}

                    {/* Upload evidence */}
                    {canUpload && !showEvidence && (
                        <button
                            onClick={() => setShowEvidence(true)}
                            className="w-full flex items-center justify-between bg-white border border-black/10 rounded-xl p-4 hover:bg-gray-50 transition"
                        >
                            <span className="flex items-center gap-2 text-[14px] font-medium">
                                <Upload size={17} className="text-custom-green" /> Last opp bevis / bilder
                            </span>
                            <ChevronRight size={15} className="text-gray-400" />
                        </button>
                    )}

                    {/* Mark ready for review */}
                    {canMarkReady && (
                        <Button
                            onClick={() => readyMutation.mutate()}
                            loading={readyMutation.isPending}
                            className="w-full bg-[#1a3a1a] text-white rounded-full py-3.5 text-[15px] font-bold flex items-center justify-center gap-2"
                        >
                            <CheckSquare size={17} /> Meld jobb som ferdig
                        </Button>
                    )}

                    {/* Customer approve */}
                    {canApprove && (
                        <Button
                            onClick={() => navigate(`/safepay/approval/${orderId}`)}
                            className="w-full bg-custom-green text-white rounded-full py-3.5 text-[15px] font-bold flex items-center justify-center gap-2"
                        >
                            <Check size={17} /> Godkjenn og utbetal
                        </Button>
                    )}

                    {/* Waiting states */}
                    {status === 'awaiting_payment' && isProvider && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-[13px] text-amber-700">
                            ⏳ Venter på betaling fra oppdragsgiver
                        </div>
                    )}
                    {status === 'ready_for_review' && isProvider && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center text-[13px] text-purple-700">
                            ✅ Meldt ferdig — venter på godkjenning fra oppdragsgiver
                        </div>
                    )}
                    {status === 'completed' && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-[13px] text-green-700 font-medium">
                            🎉 Oppdrag fullført
                        </div>
                    )}

                    {/* Provider review of customer */}
                    {status === 'completed' && isProvider && !providerHasReviewed && !showReviewForm && (
                        <Button
                            onClick={() => setShowReviewForm(true)}
                            className="w-full bg-white border border-black/10 text-gray-800 rounded-full py-3.5 text-[14px] font-bold flex items-center justify-center gap-2"
                        >
                            <Star size={17} className="text-[#F59E0B]" /> Vurder oppdragsgiver
                        </Button>
                    )}
                    {status === 'completed' && isProvider && providerHasReviewed && (
                        <div className="bg-[#f9f9f7] border border-black/5 rounded-xl p-4 text-center text-[13px] text-gray-500">
                            ✓ Du har vurdert oppdragsgiver
                        </div>
                    )}

                    {/* Provider review form */}
                    {showReviewForm && (
                        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                            <h3 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                                <Star size={15} className="text-[#F59E0B]" /> Vurder oppdragsgiver
                            </h3>
                            <p className="text-[12px] text-gray-500 mb-4">
                                Hvordan var din opplevelse med {data?.order?.customerId?.name}?
                            </p>
                            <div className="mb-4">
                                <p className="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-wider">Helhetlig opplevelse</p>
                                <MiniStarRating value={reviewRating} onChange={setReviewRating} />
                            </div>
                            <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Skriv en anmeldelse..."
                                className="w-full border border-black/10 rounded-xl p-3 text-[13px] min-h-[80px] outline-none focus:border-custom-green mb-3"
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => reviewMutation.mutate()}
                                    loading={reviewMutation.isPending}
                                    disabled={reviewRating === 0}
                                    label="Send vurdering"
                                    className="bg-custom-green text-white rounded-full px-6 py-2.5 text-[13px] font-medium"
                                />
                                <Button
                                    onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(''); }}
                                    label="Avbryt"
                                    variant="outline"
                                    className="rounded-full px-6 py-2.5 text-[13px]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Dispute */}
                    {['paid', 'in_progress', 'ready_for_review'].includes(status) && !activeDispute && (
                        <button
                            onClick={() => navigate(`/safepay/approval/${orderId}`)}
                            className="w-full text-center text-[12px] text-gray-400 hover:text-red-500 py-2 flex items-center justify-center gap-1 transition-colors"
                        >
                            <AlertTriangle size={13} /> Opprett tvist
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProviderOrderDetailPage;
