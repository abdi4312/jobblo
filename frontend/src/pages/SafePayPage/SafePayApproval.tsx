import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Wrench,
  User,
  ListChecks,
  Star,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Wallet,
  Camera,
  X,
  ZoomIn,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/Ui/button/Button';
import SafePaySteps from '../../components/SafePay/SafePaySteps';
import { ContractViewModal } from '../../components/SafePay/ContractViewModal';
import { useUserStore } from '../../stores/userStore';
import { DisputePanel } from '../../components/SafePay/DisputePanel';
import { useDispute } from '../../features/disputes/hooks';
import { disputeReasonOptions } from '../../constants/disputes';
import { statusLabel } from '../../constants/statuses';
import { compressImages } from '../../utils/compressImage';

/** Matches MAX_REVIEW_PHOTOS in backend/utils/reviewPhotos.js. */
const MAX_REVIEW_PHOTOS = 6;

/**
 * What the customer is actually looking at, per order status.
 *
 * The "Jobbstatus" banner was a fixed string — "<utfører> melder jobben som ferdig" —
 * rendered at every status this page can be reached in. A customer who arrived while
 * the order was still `paid` or `in_progress` was therefore told the provider had
 * reported the work finished, when the provider had not pressed "Meld jobb som ferdig"
 * at all (that button is the only thing that writes `ready_for_review`, see
 * providerWorkController.markReadyForReview). Every status states its own truth now,
 * and `approvable` is what decides whether the approve action is live — matching the
 * backend, which refuses approval from anything but `ready_for_review`.
 */
type JobStatusView = {
  title: (providerName: string) => string;
  body: string;
  step: number;
  approvable: boolean;
};

const JOB_STATUS_VIEW: Record<string, JobStatusView> = {
  awaiting_payment: {
    title: () => 'Venter på betaling',
    body: 'Oppdraget starter når betalingen er gjennomført og beløpet er sikret hos Jobblo.',
    step: 2,
    approvable: false,
  },
  paid: {
    title: (name) => `${name} har ikke startet jobben ennå`,
    body: 'Beløpet er sikret hos Jobblo. Du får varsel så snart arbeidet er meldt ferdig.',
    step: 3,
    approvable: false,
  },
  in_progress: {
    title: (name) => `${name} jobber med oppdraget nå`,
    body: 'Du kan godkjenne og utbetale når utfører har meldt jobben som ferdig.',
    step: 3,
    approvable: false,
  },
  ready_for_review: {
    title: (name) => `${name} melder jobben som ferdig`,
    body: 'Se over arbeidet under. Godkjenner du, utbetales beløpet til utfører.',
    step: 4,
    approvable: true,
  },
  completed: {
    title: () => 'Jobben er godkjent',
    body: 'Beløpet er frigitt til utfører. Oppdraget er avsluttet.',
    step: 4,
    approvable: false,
  },
  disputed: {
    title: () => 'Oppdraget er under tvist',
    body: 'Utbetalingen står på vent til tvisten er avklart.',
    step: 4,
    approvable: false,
  },
  cancelled: {
    title: () => 'Oppdraget er kansellert',
    body: 'Det er ingenting å godkjenne på dette oppdraget.',
    step: 2,
    approvable: false,
  },
};

const FALLBACK_STATUS_VIEW: JobStatusView = {
  title: () => 'Oppdraget er underveis',
  body: 'Du kan godkjenne og utbetale når utfører har meldt jobben som ferdig.',
  step: 3,
  approvable: false,
};

// Reusable Star Rating Component
interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
  showLabel?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  disabled = false,
  size = 32,
  showLabel = true,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [lastTappedStar, setLastTappedStar] = useState<number | null>(null);
  const starContainerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const labels = {
    1: 'Svært misfornøyd',
    2: 'Misfornøyd',
    3: 'Greit',
    4: 'Fornøyd',
    5: 'Svært fornøyd',
  };

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleStarClick = (starValue: number) => {
    if (disabled) return;
    if (lastTappedStar === starValue) {
      onChange(0);
      setLastTappedStar(null);
    } else {
      onChange(starValue);
      setLastTappedStar(starValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, starValue: number) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        onChange(Math.max(1, value - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        onChange(Math.min(5, value + 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleStarClick(starValue);
        break;
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div aria-live="polite" className="sr-only">
        {displayValue > 0 ? labels[displayValue as keyof typeof labels] : 'Ingen vurdering valgt'}
      </div>

      <div ref={starContainerRef} className="flex gap-1.5" role="radiogroup" aria-label="Vurdering">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayValue;
          const isHovered = hoverValue !== null && star <= hoverValue && !disabled;
          const isEmpty = !isFilled && !isHovered;

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`Gi ${star} av 5 stjerner - ${labels[star as keyof typeof labels]}`}
              tabIndex={disabled ? -1 : 0}
              onMouseEnter={() => !disabled && setHoverValue(star)}
              onMouseLeave={() => !disabled && setHoverValue(null)}
              onClick={() => handleStarClick(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              onFocus={() => setFocusedIndex(star)}
              onBlur={() => setFocusedIndex(null)}
              className={`
                transition-all duration-200
                ${!disabled ? 'cursor-pointer' : 'cursor-default'}
                ${!disabled ? 'hover:scale-115' : ''}
                ${focusedIndex === star ? 'outline-none ring-2 ring-[#2E6641] rounded-full' : ''}
              `}
            >
              <Star
                size={size}
                className={`
                  transition-all duration-200
                  ${isFilled ? 'text-[#2E6641] fill-[#2E6641]' : ''}
                  ${isHovered && !disabled ? 'text-[#2E6641] fill-[#2E6641]/50' : ''}
                  ${isEmpty ? 'text-[#D4D6CD] stroke-[#D4D6CD] fill-none' : ''}
                `}
              />
            </button>
          );
        })}
      </div>

      {showLabel && displayValue > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-sm font-medium text-gray-700">
            {labels[displayValue as keyof typeof labels]}
          </p>
        </div>
      )}
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

/** The full-page states this screen falls back to: load failure, wrong viewer. */
const ApprovalNotice = ({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) => (
  <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] p-4">
    <div className="w-full max-w-md rounded-3xl border border-[#E6E7E1] bg-white p-10 text-center">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
        <ShieldCheck size={20} strokeWidth={2} />
      </span>
      <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">{body}</p>
      <button
        onClick={onAction}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#2E6641] px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
      >
        {actionLabel}
      </button>
    </div>
  </div>
);

const SafePayApproval: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [isSuccess, setIsSuccess] = useState(false);
  // Set when the approval succeeded but the Stripe transfer to the provider did not.
  // The backend returns HTTP 200 in that case (the approval itself is valid), so this
  // must be read from the response body — otherwise we tell the customer the provider
  // was paid when no money moved.
  const [payoutWarning, setPayoutWarning] = useState<string | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Dispute state ────────────────────────────────────────────────────────
  // Read path (F-47): opening a dispute used to produce a toast and nothing else.
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
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // Validation rules
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

  // Scoped to the customer's side. The list used to offer both
  // "Kunde samarbeider ikke" and "Tilbyder samarbeider ikke" to everyone, so each
  // party could file a dispute accusing themselves.
  const DISPUTE_REASON_OPTIONS = disputeReasonOptions('customer');

  const handleOpenDispute = async () => {
    setDisputeTouched({ reasonCategory: true, title: true, description: true });
    if (!disputeIsValid) return;
    setDisputeSubmitting(true);
    try {
      await mainLink.post(`/api/safepay/contract/${orderId}/dispute`, {
        reasonCategory: disputeForm.reasonCategory,
        title: disputeForm.title.trim(),
        description: disputeForm.description.trim(),
      });
      toast.success('Tvisten er opprettet. Du finner status og meldinger på denne siden.');
      refetchDispute();
      setShowDisputeDialog(false);
      setDisputeForm({ reasonCategory: '', title: '', description: '' });
      setDisputeTouched({ reasonCategory: false, title: false, description: false });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Noe gikk galt. Prøv igjen.';
      toast.error(msg);
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const [ratings, setRatings] = useState({
    overall: 0,
    punctuality: 0,
    quality: 0,
    communication: 0,
    tidiness: 0,
  });

  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [recommendWorker, setRecommendWorker] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch Order Details
  const {
    data: checkoutData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['safepay-checkout', orderId],
    queryFn: async () => {
      const res = await mainLink.get(`/api/safepay-checkout/details/${orderId}`);
      return res.data;
    },
    enabled: !!orderId,
  });

  // Initialize checklist from order data
  const [checklist, setChecklist] = useState<{ id: string; text: string; checked: boolean }[]>([]);

  useEffect(() => {
    if (checkoutData?.order?.checklist) {
      setChecklist(checkoutData.order.checklist);
    }
    if (checkoutData?.order?.review) {
      setRatings({
        overall: checkoutData.order.review.overall || 0,
        punctuality: checkoutData.order.review.punctuality || 0,
        quality: checkoutData.order.review.quality || 0,
        communication: checkoutData.order.review.communication || 0,
        tidiness: checkoutData.order.review.tidiness || 0,
      });
      setComment(checkoutData.order.review.comment || '');
      setPhotos(checkoutData.order.review.photos || []);
      setRecommendWorker(checkoutData.order.review.recommendWorker || false);
    }
  }, [checkoutData]);

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      // client-side validation: overall must be present
      if (!ratings || typeof ratings.overall !== 'number' || ratings.overall < 1) {
        throw new Error('Vennligst gi en helhetlig vurdering (1-5 stjerner)');
      }

      // construct payload ratings with only provided optional fields
      const payloadRatings: any = { overall: ratings.overall };
      if (ratings.punctuality && ratings.punctuality > 0) payloadRatings.punctuality = ratings.punctuality;
      if (ratings.quality && ratings.quality > 0) payloadRatings.quality = ratings.quality;
      if (ratings.communication && ratings.communication > 0) payloadRatings.communication = ratings.communication;
      if (ratings.tidiness && ratings.tidiness > 0) payloadRatings.tidiness = ratings.tidiness;

      const res = await mainLink.post('/api/safepay-checkout/approve', {
        orderId,
        ratings: payloadRatings,
        comment,
        photos,
        recommendWorker,
      });
      return res.data;
    },
    onSuccess: (data: { payoutWarning?: string; payoutErrorCode?: string } | undefined) => {
      setIsSuccess(true);
      if (data?.payoutWarning) {
        setPayoutWarning(data.payoutWarning);
        // Not a success toast: the money did not reach the provider.
        toast('Jobb godkjent, men utbetalingen er ikke fullført.', { icon: '⚠️' });
      } else {
        setPayoutWarning(null);
        toast.success('Jobb godkjent!');
      }
    },
    onError: (err: any) => {
      const status = err.response?.status;
      // `mutationFn` throws a plain Error for the missing-rating case, which has no
      // `response` at all. Reading only `response.data.error` turned that specific,
      // actionable message into the generic "Kunne ikke godkjenne jobben" — and the
      // skip-checklist path calls `mutate()` directly, so it was the message that path
      // actually produced.
      const message =
        err?.response?.data?.error || err?.message || 'Kunne ikke godkjenne jobben';
      if (status === 403) {
        toast.error('Ikke tilgang. Kun oppdragsgiver kan godkjenne jobben.');
      } else if (status === 400 && message.includes('ready_for_review')) {
        toast.error('Utfører har ikke meldt jobben som ferdig ennå.');
      } else {
        toast.error(message);
      }
    },
  });

  // Mutation to update checklist items
  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const res = await mainLink.put(
        `/api/safepay-checkout/contract/${orderId}/checklist/${itemId}`,
        { checked }
      );
      return res.data;
    },
    onSuccess: () => {
      refetch();
    },
  });

  /**
   * Review photos go to Cloudinary and only their URLs travel with `approve`.
   *
   * They used to be read with `FileReader.readAsDataURL` and posted inline as base64 in the
   * approve request. Base64 adds ~33 %, so two ordinary phone photos pushed the JSON body
   * past the server's 12 MB limit and the approval failed with "Innholdet er for stort" —
   * at the one point in the flow where failing costs the provider their payout. The bytes
   * also ended up stored in the Review document itself.
   */
  const handlePhotoSelect = async (files: File[]) => {
    if (!files.length || !orderId) return;

    const room = MAX_REVIEW_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Maks ${MAX_REVIEW_PHOTOS} bilder.`);
      return;
    }
    if (files.length > room) {
      toast.error(`Maks ${MAX_REVIEW_PHOTOS} bilder — de første ${room} ble lagt til.`);
    }

    setIsUploadingPhotos(true);
    try {
      // Compress first: a phone photo is 3–8 MB and comes out a few hundred KB, which is
      // what keeps this well under every limit between here and Cloudinary.
      const compressed = await compressImages(files.slice(0, room));

      const body = new FormData();
      compressed.forEach((file) => body.append('photos', file));

      // The header override is required, not decorative: `mainLink` defaults to
      // `Content-Type: application/json`, and axios 1.x serialises a FormData body to JSON
      // when it sees a JSON content type — the files would arrive as `{}`. The browser
      // adapter replaces this with the real boundary before sending.
      const res = await mainLink.post(`/api/safepay-checkout/review-photos/${orderId}`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const urls: string[] = res.data?.urls ?? [];
      if (!urls.length) throw new Error('Ingen bilder ble lastet opp.');

      setPhotos((prev) => [...prev, ...urls]);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as Error)?.message ||
        'Kunne ikke laste opp bildene. Prøv igjen.';
      toast.error(message);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleApprove = () => {
    const allChecked = checklist.every((item) => item.checked);
    if (!allChecked && !showSkipDialog) {
      toast.error('Merk av alle sjekklistepunktene, eller hopp over sjekklisten.');
      return;
    }
    // Ensure overall rating exists
    if (!ratings || typeof ratings.overall !== 'number' || ratings.overall < 1) {
      toast.error('Vennligst gi en helhetlig vurdering (1-5 stjerner)');
      return;
    }
    approveMutation.mutate();
  };

  const handleSkipConfirm = () => {
    setShowSkipDialog(false);
    approveMutation.mutate();
  };

  // Update toggleCheck to call the mutation
  const toggleCheck = (id: string) => {
    const item = checklist.find((i) => i.id === id);
    if (!item) return;

    const newChecked = !item.checked;
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, checked: newChecked } : i)));
    updateChecklistItemMutation.mutate({ itemId: id, checked: newChecked });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EFF0EA]">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="jb-skeleton h-4 w-24 rounded" />
          <div className="jb-skeleton mt-8 h-14 w-full rounded-2xl" />
          <div className="jb-skeleton mt-4 h-64 w-full rounded-3xl" />
          <div className="jb-skeleton mt-4 h-80 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !checkoutData?.order || !checkoutData?.calculation) {
    return (
      <ApprovalNotice
        title="Kunne ikke laste oppdraget"
        body="Sjekk internettforbindelsen din og prøv igjen."
        actionLabel="Prøv igjen"
        onAction={() => refetch()}
      />
    );
  }

  const { order: orderData, calculation } = checkoutData;

  // Check if current user is the customer (order owner)
  const isCustomer = String(orderData.customerId?._id) === String(user?._id);

  if (!isCustomer) {
    return (
      <ApprovalNotice
        title="Ikke tilgang"
        body="Kun oppdragsgiver kan godkjenne en jobb og frigi betalingen."
        actionLabel="Tilbake til forsiden"
        onAction={() => navigate('/home')}
      />
    );
  }

  const isOrderCompleted = orderData.status === 'completed';

  // The single source of truth for what this page is allowed to claim and offer.
  const statusView = JOB_STATUS_VIEW[orderData.status] || FALLBACK_STATUS_VIEW;
  // Approval is live only from `ready_for_review` — the same rule the backend enforces
  // in SafePayCheckoutController.approveAndPayout.
  const canApproveNow = statusView.approvable && !isSuccess;
  // Mirrors safepayController.updateChecklistItem's EDITABLE_ORDER_STATUSES, so the
  // customer can tick items off while the work is still running without the request
  // coming back 409.
  const canEditChecklist =
    !isSuccess && !dispute && ['paid', 'in_progress', 'ready_for_review'].includes(orderData.status);

  // ── Proof-of-work evidence from the provider ─────────────────────────────
  const beforeImages: string[] = orderData.beforeImages || [];
  const afterImages: string[] = orderData.afterImages || [];
  const completionNote: string | undefined = orderData.completionNote;
  const hasAnyEvidence = beforeImages.length > 0 || afterImages.length > 0 || !!completionNote;

  if (isSuccess) {
    // Two genuinely different outcomes, so they are not dressed the same. When the
    // transfer failed the headline said "Jobb godkjent!" over the payout amount set in
    // big green type — the one number on screen, rendered as if it had been paid.
    const paidOut = !payoutWarning;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFF0EA] px-4 py-12">
        <div
          className={`w-full max-w-125 rounded-3xl p-8 text-center sm:p-10 ${
            paidOut ? 'bg-[#122A1C]' : 'border border-[#E6E7E1] bg-white'
          }`}
        >
          <span
            className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-full ${
              paidOut ? 'bg-[#8FBF9A] text-[#122A1C]' : 'bg-[#F4F6F0] text-[#63665F]'
            }`}
          >
            {paidOut ? (
              <Check size={26} strokeWidth={2.6} />
            ) : (
              <AlertTriangle size={24} strokeWidth={2} />
            )}
          </span>

          <h1
            className={`text-[1.5rem] font-bold tracking-[-0.035em] ${
              paidOut ? 'text-white' : 'text-[#0B0B0B]'
            }`}
          >
            {paidOut ? 'Jobben er godkjent' : 'Godkjent — men utbetalingen stoppet'}
          </h1>
          <p
            className={`mx-auto mt-2.5 max-w-sm text-[0.875rem] leading-relaxed ${
              paidOut ? 'text-white/65' : 'text-[#63665F]'
            }`}
          >
            {paidOut
              ? `Beløpet er lagt til saldoen til ${orderData.providerId?.name || 'utføreren'} ${
                  orderData.providerId?.lastName || ''
                }.`.trim()
              : payoutWarning}
          </p>

          <div
            className={`mt-8 rounded-2xl px-4 py-5 ${paidOut ? 'bg-white/8' : 'bg-[#F4F6F0]'}`}
          >
            <p
              className={`text-[2rem] font-bold tabular-nums tracking-[-0.04em] ${
                paidOut ? 'text-[#8FBF9A]' : 'text-[#63665F]'
              }`}
            >
              {Number(calculation.providerNet).toLocaleString('nb-NO')} kr
            </p>
            <p
              className={`mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${
                paidOut ? 'text-white/40' : 'text-[#9B9E96]'
              }`}
            >
              {paidOut ? 'Tilgjengelig innen 1–2 virkedager' : 'Ikke utbetalt ennå'}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2.5">
            {!paidOut && (
              <button
                onClick={() => navigate('/support')}
                className="flex h-12 w-full items-center justify-center rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335]"
              >
                Kontakt support
              </button>
            )}
            <button
              onClick={() => navigate('/my-applicants')}
              className={`flex h-12 w-full items-center justify-center rounded-full text-[0.9375rem] font-semibold transition-colors ${
                paidOut
                  ? 'bg-[#8FBF9A] text-[#122A1C] hover:bg-[#a3cbac]'
                  : 'border border-[#E6E7E1] bg-white text-[#0B0B0B] hover:border-[#2E6641]/45'
              }`}
            >
              Mine oppdrag
            </button>
            <button
              onClick={() => navigate('/home')}
              className={`flex h-12 w-full items-center justify-center rounded-full text-[0.9375rem] font-medium transition-colors ${
                paidOut
                  ? 'border border-white/20 text-white hover:bg-white/10'
                  : 'text-[#63665F] hover:text-[#0B0B0B]'
              }`}
            >
              Tilbake til forsiden
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFF0EA] pb-16">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="group -ml-1 mb-6 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[0.875rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B]"
        >
          <ArrowLeft size={16} /> Tilbake
        </button>

        <SafePaySteps
          currentStep={statusView.step}
          orderId={orderId}
          serviceId={orderData.serviceId._id}
        />

        <DisputePanel orderId={orderId} dispute={dispute} viewerRole="customer" />

        {/* Contract view link */}
        <div className="flex justify-end mb-2">
          <ContractViewModal
            orderId={orderId!}
            trigger={
              <span className="flex items-center gap-1.5 text-[13px] text-[#122A1C] font-semibold hover:underline cursor-pointer">
                <FileText size={14} /> Se kontrakt
              </span>
            }
          />
        </div>

        {/* Job Status Banner */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <CircleCheck size={18} className="text-custom-green" /> Jobbstatus
          </div>
          <div
            className={`rounded-xl p-4 flex items-center gap-4 border ${
              canApproveNow
                ? 'bg-[#EAF1E9] border-[#EAF1E9]'
                : 'bg-[#F4F6F0] border-[#E6E7E1]'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                canApproveNow ? 'bg-custom-green text-white' : 'bg-white text-[#63665F]'
              }`}
            >
              <Wrench size={24} />
            </div>
            <div>
              <h3
                className={`text-[15px] font-bold mb-0.5 ${
                  canApproveNow ? 'text-[#2E6641]' : 'text-[#0B0B0B]'
                }`}
              >
                {statusView.title(orderData.providerId.name)}
              </h3>
              <p
                className={`text-[12px] ${
                  canApproveNow ? 'text-custom-green/80' : 'text-[#63665F]'
                }`}
              >
                {new Date(orderData.updatedAt).toLocaleDateString('no-NO')} •{' '}
                {orderData.serviceId.title} • {orderData.serviceId.location?.city || 'Oslo'}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#63665F]">
                {statusView.body}
              </p>
            </div>
          </div>
        </div>

        {/* Worker Summary */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <User size={18} className="text-custom-green" /> Oppdragstaker
          </div>
          <div className="bg-[#F4F6F0] rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#EAF1E9] text-[#122A1C] font-bold flex items-center justify-center text-lg overflow-hidden">
              {orderData.providerId.avatarUrl ? (
                <img
                  src={orderData.providerId.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                orderData.providerId.name[0]
              )}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-gray-900">
                {orderData.providerId.name} {orderData.providerId.lastName}
              </div>
              <div className="text-[12px] text-gray-500">
                {orderData.providerId.averageRating
                  ? `${orderData.providerId.averageRating.toFixed(1)} av 5 stjerner`
                  : 'Ingen vurderinger enda'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Proof of work / Arbeidsbevis (CRITICAL — BEFORE approval) ─────── */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Camera size={18} className="text-custom-green" /> Arbeidsbevis / Proof of work
            <span className="text-[11px] text-gray-400 ml-auto font-normal">Levert av utfører</span>
          </div>

          {hasAnyEvidence ? (
            <div className="space-y-4">
              {/* Completion note first */}
              {completionNote && (
                <div className="bg-[#F4F6F0] rounded-xl p-4 border border-black/5">
                  <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">
                    Ferdigstillingsnotat fra utfører
                  </p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{completionNote}</p>
                </div>
              )}

              {/* Before images */}
              {beforeImages.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">
                    Før arbeid ({beforeImages.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {beforeImages.map((url, i) => (
                      <div
                        key={`b-${i}`}
                        className="relative aspect-square rounded-xl overflow-hidden bg-[#F4F6F0] group cursor-zoom-in"
                        onClick={() => setLightboxUrl(url)}
                      >
                        {url.toLowerCase().endsWith('.pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                            <FileText size={28} />
                            <span className="text-[10px] mt-1 truncate px-1">PDF #{i + 1}</span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Før arbeid ${i + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                        <button
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxUrl(url);
                          }}
                          aria-label="Forstørr bilde"
                        >
                          <ZoomIn size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* After images */}
              {afterImages.length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-2">
                    Etter arbeid ({afterImages.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {afterImages.map((url, i) => (
                      <div
                        key={`a-${i}`}
                        className="relative aspect-square rounded-xl overflow-hidden bg-[#F4F6F0] group cursor-zoom-in"
                        onClick={() => setLightboxUrl(url)}
                      >
                        {url.toLowerCase().endsWith('.pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                            <FileText size={28} />
                            <span className="text-[10px] mt-1 truncate px-1">PDF #{i + 1}</span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Etter arbeid ${i + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                        <button
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxUrl(url);
                          }}
                          aria-label="Forstørr bilde"
                        >
                          <ZoomIn size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Neutral empty state for zero photos ── */
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-[#fafaf8]">
              <ImageIcon size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-[14px] font-medium text-gray-600 mb-1">
                Ingen arbeidsbevis lastet opp
              </p>
              <p className="text-[12px] text-gray-400 max-w-md mx-auto">
                {canApproveNow
                  ? 'Utfører har ikke lastet opp bilder eller dokumentasjon for denne jobben. Du kan fortsatt godkjenne jobben nedenfor hvis alt er i orden, eller åpne en tvist hvis du forventet visuelt bevis.'
                  : 'Utfører har ikke lastet opp bilder eller dokumentasjon ennå. Bevis lastes opp underveis i arbeidet.'}
              </p>
              {canApproveNow && (
                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-400">
                  <ShieldCheck size={14} className="text-custom-green" />
                  <span>Du kan likevel vurdere jobben nedenfor basert på samtale og resultat.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
              <ListChecks size={18} className="text-custom-green" /> Sjekkliste — ble jobben gjort
              riktig?
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {checklist.map((item) => {
                const canToggle = canEditChecklist;
                return (
                  <label
                    key={item.id}
                    htmlFor={`checklist-${item.id}`}
                    role="button"
                    tabIndex={canToggle ? 0 : -1}
                    aria-checked={!!item.checked}
                    aria-disabled={!canToggle}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!canToggle) return;
                      toggleCheck(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (!canToggle) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCheck(item.id);
                      }
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all select-none ${
                      item.checked
                        ? 'bg-[#EAF1E9] border-[#EAF1E9]'
                        : 'bg-[#F4F6F0] border-transparent'
                    } ${canToggle ? 'cursor-pointer hover:border-black/10 hover:bg-[#EAF1E9]/50' : 'cursor-not-allowed opacity-90'}`}
                  >
                    <input
                      id={`checklist-${item.id}`}
                      type="checkbox"
                      checked={!!item.checked}
                      disabled={!canToggle}
                      onChange={() => {
                        if (canToggle) toggleCheck(item.id);
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`w-5.5 h-5.5 rounded-md border-2 flex items-center justify-center transition-all ${
                        item.checked
                          ? 'bg-custom-green border-custom-green'
                          : 'bg-white border-[#EAF1E9]'
                      }`}
                    >
                      {item.checked && <Check size={14} className="text-white" strokeWidth={3} />}
                    </span>
                    <span
                      className={`text-[13px] font-medium ${
                        item.checked ? 'text-[#2E6641]' : 'text-gray-600'
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Skip option — only meaningful when approving is actually possible. */}
            {canApproveNow && checklist.some((item) => !item.checked) && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowSkipDialog(true)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Hopp over sjekklisten og godkjenn uansett
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rating Section — a review belongs to finished work, so the form only appears
            once the provider has actually reported the job done. Before that the same
            card shows the provider's existing ratings instead. */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          {canApproveNow ? (
            <>
              <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
                <Star size={18} className="text-custom-green" /> Gi {orderData.providerId.name} en
                vurdering
              </div>

              <div className="mb-6">
                <p className="text-[13px] text-gray-500 mb-2">Helhetlig opplevelse</p>
                <StarRating
                  value={ratings.overall}
                  onChange={(val) => setRatings((prev) => ({ ...prev, overall: val }))}
                  disabled={isOrderCompleted}
                />
              </div>

              <div className="mb-4">
                {!showDetails ? (
                  <button
                    type="button"
                    onClick={() => setShowDetails(true)}
                    className="text-sm text-gray-600 underline"
                  >
                    Gi mer detaljert vurdering (valgfritt)
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {[
                        { id: 'punctuality', label: 'Punktlighet' },
                        { id: 'quality', label: 'Kvalitet' },
                        { id: 'communication', label: 'Kommunikasjon' },
                        { id: 'tidiness', label: 'Ryddighet' },
                      ].map((cat) => (
                        <div key={cat.id} className="bg-[#F4F6F0] rounded-xl p-3">
                          <div className="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-wider">
                            {cat.label}
                          </div>
                          <StarRating
                            value={(ratings as any)[cat.id]}
                            onChange={(val) => setRatings((prev) => ({ ...prev, [cat.id]: val }))}
                            disabled={isOrderCompleted}
                            size={14}
                            showLabel={false}
                          />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowDetails(false)} className="text-sm text-gray-500 underline">
                      Skjul detaljert vurdering
                    </button>
                  </>
                )}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isOrderCompleted}
                className={`w-full bg-white border border-black/10 rounded-xl p-4 text-[13px] text-gray-800 outline-none focus:border-custom-green min-h-[100px] ${
                  isOrderCompleted ? 'cursor-not-allowed bg-gray-50' : ''
                }`}
                placeholder="Skriv en anmeldelse..."
              />

              {/* Photos Upload — Customer's own photos for review */}
              <div className="mt-6">
                <p className="text-[13px] text-gray-500 mb-2">
                  Legg til dine egne bilder (frivillig)
                </p>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {photos.map((photo, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-xl overflow-hidden"
                      >
                        <img
                          src={photo}
                          alt={`Bilde ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {!isOrderCompleted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotos(photos.filter((_, i) => i !== index));
                            }}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!isOrderCompleted && (
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isUploadingPhotos}
                    onChange={(e) => {
                      void handlePhotoSelect(Array.from(e.target.files || []));
                      // Let the same file be picked again after a failed upload.
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                )}
                {!isOrderCompleted && (
                  <label
                    htmlFor="photo-upload"
                    aria-busy={isUploadingPhotos}
                    className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-xl transition-colors ${
                      isUploadingPhotos
                        ? 'border-gray-200 cursor-wait'
                        : 'border-gray-300 cursor-pointer hover:border-custom-green'
                    }`}
                  >
                    {isUploadingPhotos ? (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    ) : (
                      <FileText size={18} className="text-gray-400" />
                    )}
                    <span className="text-[13px] text-gray-500">
                      {isUploadingPhotos
                        ? 'Laster opp…'
                        : `Last opp dine egne bilder (maks ${MAX_REVIEW_PHOTOS})`}
                    </span>
                  </label>
                )}
              </div>

              {/* Recommend Worker Checkbox */}
              <div className="mt-6">
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    recommendWorker
                      ? 'bg-[#EAF1E9] border-[#EAF1E9]'
                      : 'bg-[#F4F6F0] border-transparent hover:border-black/10'
                  } ${isOrderCompleted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !isOrderCompleted && setRecommendWorker(!recommendWorker)}
                >
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      recommendWorker
                        ? 'bg-custom-green border-custom-green'
                        : 'bg-white border-[#EAF1E9]'
                    }`}
                  >
                    {recommendWorker && <Check size={16} className="text-white" strokeWidth={3} />}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">
                      Anbefal denne arbeideren
                    </p>
                    <p className="text-[12px] text-gray-500">
                      Andre brukere vil se at du anbefaler denne personen
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
                <Star size={18} className="text-[#2E6641]" /> Vurderinger for{' '}
                {orderData.providerId.name}
              </div>

              {/* Average Rating Summary */}
              <div className="bg-[#F4F6F0] rounded-xl p-4 mb-6 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-[#2E6641]">
                    {orderData.providerId.averageRating
                      ? orderData.providerId.averageRating.toFixed(1)
                      : '4.7'}
                  </div>
                  <div className="text-sm text-gray-500">av 5</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={20}
                        className={
                          star <=
                          (orderData.providerId.averageRating
                            ? Math.round(orderData.providerId.averageRating)
                            : 5)
                            ? 'text-[#2E6641] fill-[#2E6641]'
                            : 'text-[#D4D6CD]'
                        }
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600">
                    {orderData.providerId.averageRating
                      ? `${orderData.providerId.averageRating.toFixed(1)} av 5 • ${
                          orderData.providerId.completedJobs || 0
                        } fullførte jobber`
                      : '4.7 av 5 · 12 vurderinger'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Transaction Details Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Wallet size={18} className="text-custom-green" /> Transaksjonsdetaljer
          </div>

          <div className="space-y-4">
            {/* Transaction Info */}
            <div className="bg-[#F4F6F0] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Transaksjons-ID
                </span>
                <span className="text-sm font-medium text-gray-700">
                  #JB-{orderData._id?.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Dato
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {new Date(orderData.createdAt).toLocaleDateString('no-NO')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Status
                </span>
                {/* Was a three-way guess that collapsed every status except `completed`
                    and `paid` into "Venter" — including `in_progress` and
                    `ready_for_review`, the two this page most needs to tell apart. */}
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-full ${
                    orderData.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : orderData.status === 'ready_for_review'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {statusLabel(orderData.status)}
                </span>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="bg-[#EAF1E9] border border-[#EAF1E9] rounded-2xl p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                  <span className="text-gray-500">Oppdragsbeløp</span>
                  <span className="text-gray-900 font-bold">{calculation.basePrice} kr</span>
                </div>
                <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                  <span className="text-gray-500">SafePay-gebyr (3%)</span>
                  <span className="text-gray-900 font-bold">- {calculation.fee} kr</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-gray-900 font-bold">
                    {orderData.providerId.name} mottar
                  </span>
                  <span className="text-[22px] font-bold text-custom-green">
                    {calculation.providerNet} kr
                  </span>
                </div>
              </div>

              <div className="flex gap-2 text-[11px] text-[#2E6641] leading-relaxed">
                <Clock size={14} className="shrink-0 mt-0.5" />
                <p>
                  Pengene utbetales til {orderData.providerId.name} innen 1–2 virkedager etter
                  godkjenning.
                </p>
              </div>
            </div>
          </div>

          {/* The button used to be live at every status but `completed`, so a customer
              who believed the banner pressed it and got "Utfører har ikke meldt jobben
              som ferdig ennå" back from the server. Nothing to press until there is. */}
          {canApproveNow ? (
            <Button
              onClick={handleApprove}
              loading={approveMutation.isPending}
              disabled={!checklist.every((item) => item.checked) && !showSkipDialog}
              className="w-full bg-custom-green text-white rounded-full py-4 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#255335] transition-all shadow-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CircleCheck size={20} /> Godkjenn jobb og utbetal {calculation.providerNet} kr
            </Button>
          ) : (
            <div className="mt-6 flex gap-3 rounded-2xl bg-[#F4F6F0] p-4 text-left">
              <Clock size={16} className="mt-0.5 shrink-0 text-[#63665F]" />
              <p className="text-[13px] leading-relaxed text-[#63665F]">
                {isOrderCompleted
                  ? `Jobben er godkjent og ${calculation.providerNet} kr er utbetalt til ${orderData.providerId.name}.`
                  : statusView.body}
              </p>
            </div>
          )}

          {/* Skip Confirmation Dialog */}
          {showSkipDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Er du sikker?</h3>
                <p className="text-gray-600 mb-6">
                  Du har ikke merket av alle sjekklisteelementer. Vil du fortsatt godkjenne jobben?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSkipDialog(false)}
                    className="flex-1 py-3 border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleSkipConfirm}
                    className="flex-1 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600"
                  >
                    Ja, hopp over
                  </button>
                </div>
              </div>
            </div>
          )}

          {!dispute && (
            <div className="text-center mt-5">
              <button
                type="button"
                onClick={() => setShowDisputeDialog(true)}
                className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <AlertTriangle size={14} /> Ikke fornøyd? Opprett en tvist
              </button>
            </div>
          )}

          {/* ── Dispute dialog ──────────────────────────────────────────── */}
          {showDisputeDialog && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dispute-dialog-title"
            >
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 id="dispute-dialog-title" className="text-lg font-bold text-gray-900">
                  Opprett en tvist
                </h3>
                <p className="text-sm text-gray-500">
                  Fyll ut alle feltene. Admin vil gjennomgå saken og kontakte deg.
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
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${
                      disputeTouched.reasonCategory && disputeErrors.reasonCategory
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
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 ${
                      disputeTouched.title && disputeErrors.title
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
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 resize-none ${
                      disputeTouched.description && disputeErrors.description
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  />
                  {disputeTouched.description && disputeErrors.description && (
                    <p className="mt-1 text-xs text-red-500">{disputeErrors.description}</p>
                  )}
                </div>

                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                  ⚠️ Utbetaling til tilbyder fryses mens tvisten behandles.
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisputeDialog(false);
                      setDisputeForm({ reasonCategory: '', title: '', description: '' });
                      setDisputeTouched({
                        reasonCategory: false,
                        title: false,
                        description: false,
                      });
                    }}
                    className="flex-1 py-3 border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenDispute}
                    disabled={disputeSubmitting}
                    className="flex-1 py-3 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {disputeSubmitting ? 'Sender…' : 'Send tvist'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for evidence images */}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
};

export default SafePayApproval;
