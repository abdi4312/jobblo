import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, ShieldCheck, MessageCircle, Play, CheckSquare,
    Upload, Clock, AlertTriangle, FileText, Check, ChevronRight,
    Loader2, Camera, TrendingUp, Star, X, Image as ImageIcon, ZoomIn, Trash2,
} from 'lucide-react';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/Ui/button/Button';
import { ContractViewModal } from '../../components/SafePay/ContractViewModal';
import { DisputePanel } from '../../components/SafePay/DisputePanel';
import { useDispute } from '../../features/disputes/hooks';
import { disputeReasonOptions } from '../../constants/disputes';

// ── Status config ──────────────────────────────────────────────────────────────
//
// Eight statuses used to mean eight colours — amber, blue, indigo, purple, green, red and
// two greys — none of which appear anywhere else on the site, and none of which told the
// worker the one thing that matters here: whether the next move is theirs. There are four
// tones now, read from the provider's seat. `action` is "you are holding this up".
const STATUS_CONFIG: Record<string, { label: string; cls: string; note: string }> = {
    awaiting_payment: {
        label: 'Venter på betaling',
        cls: 'bg-[#F4F6F0] text-[#63665F]',
        note: 'Oppdragsgiver har ikke betalt ennå. Du får beskjed så snart pengene er sikret.',
    },
    paid: {
        label: 'Betalt — klar til å starte',
        cls: 'bg-[#122A1C] text-white',
        note: 'Pengene er sikret hos Jobblo. Start jobben når du er klar.',
    },
    in_progress: {
        label: 'Jobb pågår',
        cls: 'bg-[#EAF1E9] text-[#2E6641]',
        note: 'Last opp bilder underveis, og meld fra når du er ferdig.',
    },
    ready_for_review: {
        label: 'Meldt ferdig',
        cls: 'bg-[#F4F6F0] text-[#63665F]',
        note: 'Oppdragsgiver går gjennom arbeidet. Utbetalingen skjer etter godkjenning.',
    },
    completed: {
        label: 'Fullført',
        cls: 'bg-[#EAF1E9] text-[#2E6641]',
        note: 'Jobben er godkjent og beløpet er lagt til saldoen din.',
    },
    disputed: {
        label: 'Under tvist',
        cls: 'bg-[#122A1C] text-white',
        note: 'Utbetalingen står på vent til tvisten er avklart.',
    },
    refunded: {
        label: 'Refundert',
        cls: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
        note: 'Beløpet er tilbakeført til oppdragsgiver.',
    },
    cancelled: {
        label: 'Kansellert',
        cls: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
        note: 'Oppdraget er avlyst.',
    },
};

const ACTION_LABELS: Record<string, string> = {
    contract_created: 'Kontrakt opprettet',
    payment_confirmed: 'Betaling bekreftet',
    job_started: 'Jobb startet',
    ready_for_review: 'Klar for gjennomgang',
    work_approved: 'Jobb godkjent',
    job_completed: 'Fullført',
    evidence_uploaded: 'Bevis lastet opp',
    evidence_removed: 'Bevis fjernet',
    dispute_opened: 'Tvist åpnet',
    payout_approved: 'Utbetaling godkjent',
};

// Scoped to the provider's side — the shared list let the provider file
// "Tilbyder samarbeider ikke", i.e. a dispute accusing themselves.
const DISPUTE_REASON_OPTIONS = disputeReasonOptions('provider');

const MAX_IMAGES_PER_TYPE = 10;
const ALLOWED_MIME = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_FILE_MB = 10;

type EvidenceTab = 'before' | 'after';

interface PendingFile {
    file: File;
    preview: string;
    id: string;
}

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
                        className={s <= display ? 'text-[#2E6641] fill-[#2E6641]' : 'text-[#D4D6CD]'}
                    />
                </button>
            ))}
        </div>
    );
};

const ImageLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div
        className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
    >
        <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
            aria-label="Lukk"
        >
            <X size={20} />
        </button>
        <img
            src={url}
            alt="Forstørret bilde"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
        />
    </div>
);

const ProviderOrderDetailPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const user = useUserStore((s) => s.user);

    // ── Evidence / proof-of-work state ────────────────────────────────────────
    const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('after');
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [completionNote, setCompletionNote] = useState('');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Provider review state
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState('');

    // Dispute state — read path added with F-47; opening one used to be write-only.
    const { data: dispute, refetch: refetchDispute } = useDispute(orderId);
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
            const tabFiles = pendingFiles.filter((f) => f.file);
            tabFiles.forEach((pf) => fd.append('files', pf.file));
            if (completionNote) fd.append('completionNote', completionNote);
            fd.append('evidenceType', evidenceTab);
            return mainLink.post(`/api/safepay/orders/${orderId}/evidence`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            toast.success('Bevis lastet opp!');
            pendingFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
            setPendingFiles([]);
            setCompletionNote('');
            invalidate();
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Opplasting feilet'),
    });

    const removeUploadedMutation = useMutation({
        mutationFn: async ({ url, evidenceType }: { url: string; evidenceType: EvidenceTab }) =>
            mainLink.delete(`/api/safepay/orders/${orderId}/evidence`, { data: { url, evidenceType } }),
        onSuccess: () => {
            toast.success('Bilde fjernet');
            invalidate();
        },
        onError: (e: any) => toast.error(e.response?.data?.error || 'Kunne ikke fjerne bildet'),
    });

    // Dispute mutation
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
            toast.success('Tvisten er opprettet. Du finner status og meldinger på denne siden.');
            refetchDispute();
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

    // ── Evidence helpers ───────────────────────────────────────────────────────
    const addPendingFiles = (fl: FileList | File[]) => {
        const list = Array.from(fl);
        const tabUploadedCount = data?.order
            ? (evidenceTab === 'before' ? (data.order.beforeImages?.length || 0) : (data.order.afterImages?.length || 0))
            : 0;
        const allowedSlots = MAX_IMAGES_PER_TYPE - tabUploadedCount - pendingFiles.length;
        if (allowedSlots <= 0) {
            toast.error(`Maks ${MAX_IMAGES_PER_TYPE} bilder i kategorien "${evidenceTab === 'before' ? 'Før arbeid' : 'Etter arbeid'}"`);
            return;
        }
        const accepted: PendingFile[] = [];
        for (const f of list) {
            if (accepted.length >= allowedSlots) break;
            // Frontend validation mirrors backend — user gets fast feedback
            const okMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type);
            if (!okMime) { toast.error(`Ugyldig filtype: ${f.name}. Tillatt: JPEG, PNG, WebP, PDF.`); continue; }
            if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`Fil for stor (maks ${MAX_FILE_MB} MB): ${f.name}`); continue; }
            accepted.push({
                file: f,
                preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
                id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
            });
        }
        setPendingFiles((prev) => [...prev, ...accepted]);
    };

    const removePendingFile = (id: string) => {
        setPendingFiles((prev) => {
            const found = prev.find((p) => p.id === id);
            if (found?.preview) URL.revokeObjectURL(found.preview);
            return prev.filter((p) => p.id !== id);
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#EFF0EA]">
                <div className="mx-auto w-full max-w-3xl px-4 py-8">
                    <div className="jb-skeleton h-4 w-20 rounded" />
                    <div className="jb-skeleton mt-6 h-28 w-full rounded-2xl" />
                    <div className="jb-skeleton mt-4 h-24 w-full rounded-2xl" />
                    <div className="jb-skeleton mt-4 h-56 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error || !data?.order) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] p-4">
                <div className="w-full max-w-md rounded-3xl border border-[#E6E7E1] bg-white p-10 text-center">
                    <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
                        <AlertTriangle size={20} strokeWidth={2} />
                    </span>
                    <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
                        Kunne ikke laste oppdraget
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
                        Sjekk internettforbindelsen din og prøv igjen.
                    </p>
                    <button
                        onClick={() => invalidate()}
                        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
                    >
                        Prøv igjen
                    </button>
                </div>
            </div>
        );
    }

    const { order, calculation, isProvider, isCustomer, activeDispute } = data;
    const status = order.status as string;
    const statusConf = STATUS_CONFIG[status] || {
        label: status,
        cls: 'bg-[#F4F6F0] text-[#63665F]',
        note: '',
    };

    const canStart = isProvider && status === 'paid' && order.paymentStatus === 'paid' && !activeDispute;
    const canUpload = isProvider && ['paid', 'in_progress'].includes(status);
    const canMarkReady = isProvider && status === 'in_progress' && !activeDispute;
    const canApprove = isCustomer && status === 'ready_for_review' && !activeDispute;
    const canRaiseDispute =
        isProvider &&
        !activeDispute &&
        ['paid', 'in_progress', 'ready_for_review'].includes(status);

    const beforeImgs: string[] = order.beforeImages || [];
    const afterImgs: string[] = order.afterImages || [];
    const tabUploadedUrls = evidenceTab === 'before' ? beforeImgs : afterImgs;
    const tabTotalUsed = tabUploadedUrls.length + pendingFiles.length;

    // ponytail: show evidence section whenever there's anything uploaded OR user can upload;
    // otherwise it collapses for statuses outside the provider's active-work window
    const showEvidenceSection = canUpload || beforeImgs.length > 0 || afterImgs.length > 0;
    const evidenceLocked = !canUpload;

    return (
        <div className="min-h-screen bg-[#EFF0EA] pb-16">
            <div className="max-w-3xl mx-auto px-4 py-8">

                {/* Back + contract view */}
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800">
                        <ArrowLeft size={15} /> Tilbake
                    </button>
                    <ContractViewModal
                        orderId={orderId!}
                        trigger={
                            <span className="flex items-center gap-1.5 text-[13px] text-[#122A1C] font-semibold hover:underline cursor-pointer">
                                <FileText size={14} /> Se kontrakt
                            </span>
                        }
                    />
                </div>

                <DisputePanel orderId={orderId} dispute={dispute} viewerRole="provider" />

                {/* Header card */}
                <div className="bg-[#122A1C] rounded-2xl p-5 mb-4 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-[18px] font-bold mb-1">{order.serviceId?.title}</h1>
                            <p className="text-white/60 text-[12px]">
                                Kontrakt #JB-{order._id?.substring(0, 8).toUpperCase()}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[22px] font-bold text-[#8FBF9A]">{order.agreedPrice} kr</div>
                            <div className="text-white/50 text-[11px]">Du mottar: {calculation?.providerNet} kr</div>
                        </div>
                    </div>
                </div>

                {/* Status banner. The badge says where the job is; the line under it says
                    what that means for the person reading, which the colour alone never did. */}
                <div className="mb-4 rounded-2xl border border-[#E6E7E1] bg-white p-5">
                    <span
                        className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-semibold ${statusConf.cls}`}
                    >
                        <ShieldCheck size={13} strokeWidth={2.2} />
                        {statusConf.label}
                    </span>
                    {statusConf.note && (
                        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-[#63665F]">
                            {statusConf.note}
                        </p>
                    )}
                    {activeDispute && (
                        <p className="mt-2.5 flex items-center gap-1.5 text-[0.8125rem] font-medium text-[#B4453A]">
                            <AlertTriangle size={13} /> Tvist er åpnet — utbetalingen er fryst.
                        </p>
                    )}
                </div>

                {/* Parties */}
                <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                    <h2 className="font-semibold text-[14px] text-gray-800 mb-3">Avtale mellom</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Oppdragsgiver', u: order.customerId },
                            { label: 'Utfører', u: order.providerId },
                        ].map(({ label, u }) => (
                            <div key={label} className="bg-[#F4F6F0] rounded-xl p-3 text-center">
                                <div className="w-10 h-10 rounded-full bg-[#EAF1E9] mx-auto mb-2 overflow-hidden flex items-center justify-center text-[#122A1C] font-bold">
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
                                            checklistMutation.mutate({ itemId: item.id, val: !completed });
                                        }}
                                        onKeyDown={(e) => {
                                            if (!canToggle) return;
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                checklistMutation.mutate({ itemId: item.id, val: !completed });
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all select-none ${completed ? 'bg-[#EAF1E9] border-[#c6f0d8]' : 'bg-[#F4F6F0] border-transparent'
                                            } ${canToggle ? 'cursor-pointer hover:border-black/10 hover:bg-[#EAF1E9]/50' : 'cursor-default opacity-90'}`}
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

                {/* ── Proof of work / Arbeidsbevis (Step 3 — PERMANENT section) ────── */}
                {showEvidenceSection && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-[14px] text-gray-800 flex items-center gap-2">
                                <Camera size={15} className="text-custom-green" /> Arbeidsbevis / Proof of work
                            </h2>
                            {evidenceLocked && (
                                <span className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
                                    Låst for gjennomgang
                                </span>
                            )}
                        </div>

                        {/* Before / After selector */}
                        <div className="flex gap-2 mb-3">
                            {(['after', 'before'] as EvidenceTab[]).map((tab) => {
                                const count = (tab === 'before' ? beforeImgs : afterImgs).length
                                    + (evidenceTab === tab ? pendingFiles.length : 0);
                                const active = evidenceTab === tab;
                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setEvidenceTab(tab)}
                                        className={`flex-1 py-2 px-3 rounded-xl text-[13px] font-medium transition-colors ${active
                                            ? 'bg-custom-green text-white shadow-sm'
                                            : 'bg-[#F4F6F0] text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {tab === 'before' ? 'Før arbeid' : 'Etter arbeid'}
                                        <span className={`ml-1.5 text-[11px] ${active ? 'text-white/80' : 'text-gray-400'}`}>
                                            ({count})
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Completion note — only on "after" tab, as it's final completion text */}
                        {evidenceTab === 'after' && !evidenceLocked && (
                            <textarea
                                value={completionNote}
                                onChange={(e) => setCompletionNote(e.target.value)}
                                placeholder="Ferdigstillingsnotat (valgfritt) — beskriv hva som ble gjort..."
                                className="w-full border border-black/10 rounded-xl p-3 text-[13px] min-h-[70px] outline-none focus:border-custom-green mb-3 resize-none"
                            />
                        )}
                        {evidenceTab === 'after' && order.completionNote && (
                            <p className="mb-3 text-[13px] text-gray-600 bg-[#F4F6F0] p-3 rounded-xl border border-black/5">
                                <span className="font-medium text-gray-700">Notat: </span>
                                {order.completionNote}
                            </p>
                        )}

                        {/* Already-uploaded images for active tab */}
                        {tabUploadedUrls.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">
                                    Lastet opp ({tabUploadedUrls.length}/{MAX_IMAGES_PER_TYPE})
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {tabUploadedUrls.map((url, i) => (
                                        <div
                                            key={url}
                                            className="relative aspect-square rounded-xl overflow-hidden bg-[#F4F6F0] group"
                                        >
                                            {url.toLowerCase().endsWith('.pdf') ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                                    <FileText size={28} />
                                                    <span className="text-[10px] mt-1 truncate px-1">PDF</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={url}
                                                    alt={`${evidenceTab} ${i + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            <button
                                                onClick={() => setLightboxUrl(url)}
                                                className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                aria-label="Forstørr"
                                            >
                                                <ZoomIn size={14} />
                                            </button>
                                            {!evidenceLocked && (
                                                <button
                                                    onClick={() => removeUploadedMutation.mutate({ url, evidenceType: evidenceTab })}
                                                    disabled={removeUploadedMutation.isPending}
                                                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500/90 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-50"
                                                    aria-label="Fjern bilde"
                                                >
                                                    {removeUploadedMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending / not-yet-uploaded previews */}
                        {pendingFiles.length > 0 && (
                            <div className="mb-3">
                                <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">
                                    Klare for opplasting ({pendingFiles.length})
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {pendingFiles.map((pf) => (
                                        <div
                                            key={pf.id}
                                            className="relative aspect-square rounded-xl overflow-hidden bg-[#EAF1E9] border border-dashed border-[#c6f0d8]"
                                        >
                                            {pf.preview ? (
                                                <img src={pf.preview} alt="Forhåndsvisning" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                                    <FileText size={24} />
                                                    <span className="text-[10px] mt-1 truncate px-2">{pf.file.name}</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removePendingFile(pf.id)}
                                                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500/90 text-white hover:bg-red-600 flex items-center justify-center"
                                                aria-label="Fjern"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty state (when upload is allowed but nothing in tab yet) */}
                        {!evidenceLocked && tabUploadedUrls.length === 0 && pendingFiles.length === 0 && (
                            <div className="mb-3 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-[#fafaf8]">
                                <ImageIcon size={32} className="mx-auto text-gray-300 mb-2" />
                                <p className="text-[13px] text-gray-500">Ingen bilder lastet opp i denne kategorien enda.</p>
                            </div>
                        )}

                        {/* Upload controls — only when not locked */}
                        {!evidenceLocked && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] text-gray-400">
                                        Tillatt: JPEG / PNG / WebP / PDF — maks {MAX_FILE_MB} MB, {MAX_IMAGES_PER_TYPE} bilder per kategori.
                                        {tabTotalUsed > 0 && <span className="ml-1">({tabTotalUsed}/{MAX_IMAGES_PER_TYPE} brukt)</span>}
                                    </p>
                                </div>
                                <label
                                    className={`block w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${tabTotalUsed >= MAX_IMAGES_PER_TYPE
                                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                        : 'border-gray-200 hover:border-custom-green bg-[#fafaf8] hover:bg-[#EAF1E9]/40'
                                        }`}
                                >
                                    <input
                                        type="file"
                                        multiple
                                        accept={ALLOWED_MIME}
                                        disabled={tabTotalUsed >= MAX_IMAGES_PER_TYPE || evidenceMutation.isPending}
                                        onChange={(e) => e.target.files && addPendingFiles(e.target.files)}
                                        className="hidden"
                                    />
                                    <Upload size={18} className="mx-auto mb-1.5 text-custom-green" />
                                    <p className="text-[13px] text-gray-600 font-medium">
                                        {tabTotalUsed >= MAX_IMAGES_PER_TYPE
                                            ? `Maks ${MAX_IMAGES_PER_TYPE} nådd`
                                            : 'Klikk for å velge filer, eller dra-slipp (støtter bilder + PDF)'}
                                    </p>
                                </label>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => evidenceMutation.mutate()}
                                        loading={evidenceMutation.isPending}
                                        disabled={pendingFiles.length === 0 && evidenceTab === 'after' ? !completionNote : pendingFiles.length === 0}
                                        label={evidenceMutation.isPending ? 'Laster opp...' : `Last opp (${pendingFiles.length})${evidenceTab === 'after' && completionNote ? ' + notat' : ''}`}
                                        className="bg-custom-green text-white rounded-full px-5 py-2.5 text-[13px] font-medium flex-1"
                                    />
                                    {pendingFiles.length > 0 && (
                                        <button
                                            onClick={() => {
                                                pendingFiles.forEach((pf) => pf.preview && URL.revokeObjectURL(pf.preview));
                                                setPendingFiles([]);
                                            }}
                                            className="rounded-full px-5 py-2.5 text-[13px] border border-gray-200 text-gray-600 hover:bg-gray-50"
                                        >
                                            Tøm
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {evidenceLocked && (
                            <p className="text-[12px] text-purple-700 bg-purple-50 rounded-xl p-3 mt-1">
                                Bilder er låst. Jobben har blitt sendt til gjennomgang. Hvis du trenger å endre noe, vennligst kontakt oppdragsgiver.
                            </p>
                        )}
                    </div>
                )}

                {/* Evidence images (legacy compact view — summary of both types if any exist) */}
                {((beforeImgs.length > 0 || afterImgs.length > 0) && !showEvidenceSection) && (
                    <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                        <h2 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                            <Camera size={15} className="text-custom-green" /> Arbeidsbevis
                        </h2>
                        {beforeImgs.length > 0 && (
                            <>
                                <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">Før arbeid ({beforeImgs.length})</p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {beforeImgs.map((url, i) => (
                                        <img key={`b-${i}`} src={url} alt={`før ${i + 1}`} className="w-full aspect-square object-cover rounded-xl cursor-pointer" onClick={() => setLightboxUrl(url)} />
                                    ))}
                                </div>
                            </>
                        )}
                        {afterImgs.length > 0 && (
                            <>
                                <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">Etter arbeid ({afterImgs.length})</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {afterImgs.map((url, i) => (
                                        <img key={`a-${i}`} src={url} alt={`etter ${i + 1}`} className="w-full aspect-square object-cover rounded-xl cursor-pointer" onClick={() => setLightboxUrl(url)} />
                                    ))}
                                </div>
                            </>
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
                            <p className="text-[13px] text-indigo-700 font-medium">Jobb pågår — last opp arbeidsbevis over, eller meld ferdig nedenfor.</p>
                        </div>
                    )}

                    {/* Mark ready for review */}
                    {canMarkReady && (
                        <Button
                            onClick={() => readyMutation.mutate()}
                            loading={readyMutation.isPending}
                            className="w-full bg-[#122A1C] text-white rounded-full py-3.5 text-[15px] font-bold flex items-center justify-center gap-2"
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
                            <Star size={17} className="text-[#2E6641]" /> Vurder oppdragsgiver
                        </Button>
                    )}
                    {status === 'completed' && isProvider && providerHasReviewed && (
                        <div className="bg-[#F4F6F0] border border-black/5 rounded-xl p-4 text-center text-[13px] text-gray-500">
                            ✓ Du har vurdert oppdragsgiver
                        </div>
                    )}

                    {/* Provider review form */}
                    {showReviewForm && (
                        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-black/5">
                            <h3 className="font-semibold text-[14px] text-gray-800 mb-3 flex items-center gap-2">
                                <Star size={15} className="text-[#2E6641]" /> Vurder oppdragsgiver
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

                    {/* Dispute — applicant side */}
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

            {/* Lightbox */}
            {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

            {/* Dispute dialog */}
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
