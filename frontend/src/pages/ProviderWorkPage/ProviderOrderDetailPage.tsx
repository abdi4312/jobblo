import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, ShieldCheck, MessageCircle, Play, CheckSquare,
    Upload, Clock, AlertTriangle, FileText, Check, ChevronRight,
    Loader2, Camera, TrendingUp, Star, X,
} from 'lucide-react';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/Ui/button/Button';
import { ContractViewModal } from '../../components/SafePay/ContractViewModal';

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

const DISPUTE_REASON_OPTIONS = [
    { value: 'work_not_completed', label: 'Jobb ikke fullført' },
    { value: 'poor_quality', label: 'Dårlig kvalitet' },
    { value: 'different_from_agreement', label: 'Avviker fra avtalen' },
    { value: 'customer_not_cooperating', label: 'Kunde samarbeider ikke' },
    { value: 'provider_not_cooperating', label: 'Tilbyder samarbeider ikke' },
    { value: 'payment_issue', label: 'Betalingsproblem' },
    { value: 'unauthorized_payment', label: 'Uautorisert betaling' },
    { value: 'fraud_or_scam', label: 'Svindel eller bedrageri' },
    { value: 'damaged_property', label: 'Skadet eiendom' },
    { value: 'other', label: 'Annet' },
];

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

    // Dispute state (BUG-003: applicant could not raise a dispute)
    const [showDisputeDialog, setShowDisputeDialog] = useState(false);
    const [disputeForm, setDisputeForm] = useState({
        reasonCategory: '',
        title: '',
        description: '',
    });
    const [disputeTouched, setDisputeTouched] = useState({
        reasonCategory: false,
        title: false,
        description: false,
    });

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

    // Dispute mutation — works for the applicant (provider) side too.
    // We re-use the same backend endpoint as the customer side.
    const disputeMutation = useMutation({
        mutationFn: async () => {
            const res = await mainLink.post(`/api/safepay/contract/${orderId}/dispute`, {
                reasonCategory: disputeForm.reasonCategory,
                title: disputeForm.title.trim(),
                description: disputeForm.description.trim(),
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Tvist opprettet. Admin vil gjennomgå saken.');
            setShowDisputeDialog(false);
            setDisputeForm({ reasonCategory: '', title: '', description: '' });
            setDisputeTouched({ reasonCategory: false, title: false, description: false });
            invalidate();
        },
        onError: (err: any) => {
            const msg =
                err?.response?.data?.message ??
                err?.response?.data?.error ??
                'Noe gikk galt. Prøv igjen.';
            toast.error(msg);
        },
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

    // Dispute form validation
    const disputeErrors = {
        reasonCategory: !disputeForm.reasonCategory ? 'Velg en årsak' : '',
        title: !disputeForm.title.trim()
            ? 'Tittel er påkrevd'
            : disputeForm.title.trim().length < 5
                ? 'Minst 5 tegn'
                : disputeForm.title.trim().length > 200
                    ? 'Maks 200 tegn'
                    : '',
        description: !disputeForm.description.trim()
            ? 'Beskrivelse er påkrevd'
            : disputeForm.description.trim().length < 20
                ? 'Minst 20 tegn'
                : disputeForm.description.trim().length > 2000
                    ? 'Maks 2000 tegn'
                    : '',
    };
    const disputeIsValid =
        !disputeErrors.reasonCategory && !disputeErrors.title && !disputeErrors.description;

    const openDispute = () => {
        setDisputeTouched({ reasonCategory: true, title: true, description: true });
        if (!disputeIsValid) return;
        disputeMutation.mutate();
    };

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
    // Applicant can raise a dispute at any active/approval stage, before the
    // order is closed (completed/cancelled/refunded). Mirrors the customer side.
    const canRaiseDispute =
        isProvider &&
        !activeDispute &&
        ['paid', 'in_progress', 'ready_for_review'].includes(status);

    return (
        <div className="min-h-screen bg-[#f5f0e8] pb-16">
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Back + contract view */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800">
                        <ArrowLeft size={15} /> Tilbake
                    </button>
                    <ContractViewModal
                        orderId={orderId!}
                        trigger={
                            <span className="flex items-center gap-1.5 text-[13px] text-[#1a3a1a] font-semibold hover:underline cursor-pointer">
                                <FileText size={14} /> Se kontrakt
                            </span>
                        }
                    />
                </div>

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
                                    <label
                                        key={item.id}
                                        htmlFor={`provider-check-${item.id}`}
                                        role="button"
                                        tabIndex={canToggle ? 0 : -1}
                                        aria-checked={!!completed}
                                        aria-disabled={!canToggle}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (!canToggle) return;
                                            // ponytail: direct click toggles (mirrors SafePayApproval fix).
                                            // Do not rely on label→sr-only input propagation which can fail silently.
                                            checklistMutation.mutate({ itemId: item.id, val: !completed });
                                        }}
                                        onKeyDown={(e) => {
                                            if (!canToggle) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                checklistMutation.mutate({ itemId: item.id, val: !completed });
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all select-none ${completed ? 'bg-[#f0faf0] border-[#c6f0d8]' : 'bg-[#f9f9f7] border-transparent'
                                            } ${canToggle ? 'cursor-pointer hover:border-black/10 hover:bg-[#f0faf0]/50' : 'cursor-default opacity-90'}`}
                                    >
                                        <input
                                            id={`provider-check-${item.id}`}
                                            type="checkbox"
                                            checked={!!completed}
                                            disabled={!canToggle}
                                            onChange={() => {
                                                if (canToggle) {
                                                    checklistMutation.mutate({ itemId: item.id, val: !completed });
                                                }
                                            }}
                                            className="sr-only"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${completed ? 'bg-custom-green border-custom-green' : 'border-gray-300 bg-white'}`}
                                        >
                                            {completed && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </span>
                                        <span className={`text-[13px] flex-1 ${completed ? 'text-[#166534]' : 'text-gray-600'}`}>{item.text}</span>
                                        {item.customerConfirmed && (
                                            <span className="text-[10px] text-custom-green font-medium">✓ Bekreftet</span>
                                        )}
                                    </label>
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

                    {/* Dispute — applicant side (BUG-003) */}
                    {canRaiseDispute && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDisputeDialog(true)}
                                className="w-full text-center text-[12px] text-gray-400 hover:text-red-500 py-2 flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <AlertTriangle size={13} /> Noe gikk galt? Opprett en tvist
                            </button>
                        </div>
                    )}

                    {/* Active dispute notice */}
                    {activeDispute && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-[13px] text-red-700 font-medium">
                            ⚠️ Tvist pågår — admin gjennomgår saken
                        </div>
                    )}
                </div>
            </div>

            {/* Dispute dialog (BUG-003) */}
            {showDisputeDialog && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="provider-dispute-dialog-title"
                >
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3
                                id="provider-dispute-dialog-title"
                                className="text-lg font-bold text-gray-900"
                            >
                                Opprett en tvist
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowDisputeDialog(false)}
                                className="text-gray-400 hover:text-gray-700"
                                aria-label="Lukk"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">
                            Fyll ut alle feltene. Admin vil gjennomgå saken og kontakte begge parter.
                        </p>

                        {/* Reason */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Årsak <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={disputeForm.reasonCategory}
                                onChange={(e) => {
                                    setDisputeForm((f) => ({ ...f, reasonCategory: e.target.value }));
                                    setDisputeTouched((t) => ({ ...t, reasonCategory: true }));
                                }}
                                onBlur={() => setDisputeTouched((t) => ({ ...t, reasonCategory: true }))}
                                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${disputeTouched.reasonCategory && disputeErrors.reasonCategory
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                    }`}
                            >
                                <option value="">Velg årsak…</option>
                                {DISPUTE_REASON_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            {disputeTouched.reasonCategory && disputeErrors.reasonCategory && (
                                <p className="mt-1 text-xs text-red-500">{disputeErrors.reasonCategory}</p>
                            )}
                        </div>

                        {/* Title */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium text-gray-700">
                                    Tittel <span className="text-red-500">*</span>
                                </label>
                                <span
                                    className={`text-xs ${disputeForm.title.length > 200 ? 'text-red-500' : 'text-gray-400'}`}
                                >
                                    {disputeForm.title.length}/200
                                </span>
                            </div>
                            <input
                                type="text"
                                maxLength={200}
                                placeholder="Kort beskrivelse av problemet (min. 5 tegn)"
                                value={disputeForm.title}
                                onChange={(e) => {
                                    setDisputeForm((f) => ({ ...f, title: e.target.value }));
                                    setDisputeTouched((t) => ({ ...t, title: true }));
                                }}
                                onBlur={() => setDisputeTouched((t) => ({ ...t, title: true }))}
                                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${disputeTouched.title && disputeErrors.title
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                    }`}
                            />
                            {disputeTouched.title && disputeErrors.title && (
                                <p className="mt-1 text-xs text-red-500">{disputeErrors.title}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium text-gray-700">
                                    Beskrivelse <span className="text-red-500">*</span>
                                </label>
                                <span
                                    className={`text-xs ${disputeForm.description.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}
                                >
                                    {disputeForm.description.length}/2000
                                </span>
                            </div>
                            <textarea
                                rows={4}
                                maxLength={2000}
                                placeholder="Beskriv problemet i detalj (min. 20 tegn)…"
                                value={disputeForm.description}
                                onChange={(e) => {
                                    setDisputeForm((f) => ({ ...f, description: e.target.value }));
                                    setDisputeTouched((t) => ({ ...t, description: true }));
                                }}
                                onBlur={() => setDisputeTouched((t) => ({ ...t, description: true }))}
                                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none ${disputeTouched.description && disputeErrors.description
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                    }`}
                            />
                            {disputeTouched.description && disputeErrors.description && (
                                <p className="mt-1 text-xs text-red-500">{disputeErrors.description}</p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDisputeDialog(false);
                                    setDisputeTouched({ reasonCategory: false, title: false, description: false });
                                }}
                                className="flex-1 py-2.5 border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                onClick={openDispute}
                                disabled={disputeMutation.isPending}
                                className="flex-1 py-2.5 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {disputeMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                                Send tvist
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderOrderDetailPage;
