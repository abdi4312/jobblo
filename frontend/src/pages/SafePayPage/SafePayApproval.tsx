import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Home,
  MessageCircle,
  Bell,
  Wallet,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import mainLink from "../../api/mainURLs";
import { toast } from "react-hot-toast";
import { Button } from "../../components/Ui/button/Button";
import SafePaySteps from "../../components/SafePay/SafePaySteps";

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
    1: "Svært misfornøyd",
    2: "Misfornøyd",
    3: "Greit",
    4: "Fornøyd",
    5: "Svært fornøyd",
  };

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleStarClick = (starValue: number) => {
    if (disabled) return;
    // Mobile behavior: tap same star to deselect
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
      case "ArrowLeft":
        e.preventDefault();
        onChange(Math.max(1, value - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        onChange(Math.min(5, value + 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleStarClick(starValue);
        break;
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Aria-live region for screen readers */}
      <div aria-live="polite" className="sr-only">
        {displayValue > 0
          ? labels[displayValue as keyof typeof labels]
          : "Ingen vurdering valgt"}
      </div>

      <div
        ref={starContainerRef}
        className="flex gap-1.5"
        role="radiogroup"
        aria-label="Vurdering"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayValue;
          const isHovered =
            hoverValue !== null && star <= hoverValue && !disabled;
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
                ${!disabled ? "cursor-pointer" : "cursor-default"}
                ${!disabled ? "hover:scale-115" : ""}
                ${focusedIndex === star ? "outline-none ring-2 ring-[#F59E0B] rounded-full" : ""}
              `}
            >
              <Star
                size={size}
                className={`
                  transition-all duration-200
                  ${isFilled ? "text-[#F59E0B] fill-[#F59E0B]" : ""}
                  ${isHovered && !disabled ? "text-[#F59E0B] fill-[#F59E0B]/50" : ""}
                  ${isEmpty ? "text-[#d1d5db] stroke-[#d1d5db] fill-none" : ""}
                `}
              />
            </button>
          );
        })}
      </div>

      {/* Contextual Label */}
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

const SafePayApproval: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [isSuccess, setIsSuccess] = useState(false);

  // Interactive states
  const [checklist, setChecklist] = useState([
    { id: 1, label: "Plenen er klippet", checked: true },
    { id: 2, label: "Hagen er ryddet", checked: true },
    { id: 3, label: "Klipper ble ryddet etter bruk", checked: false },
    { id: 4, label: "Alt søppel er fjernet", checked: true },
  ]);

  const [ratings, setRatings] = useState({
    overall: 0,
    punctuality: 0,
    quality: 0,
    communication: 0,
    tidiness: 0,
  });

  const [comment, setComment] = useState("");

  // Mock reviews data for post-submission state
  const mockReviews = [
    {
      id: "1",
      reviewerName: "Ola Nordmann",
      rating: 5,
      date: "15. mai 2026",
      comment: "Fantastisk jobb! Veldig fornøyd med resultatet.",
    },
    {
      id: "2",
      reviewerName: "Kari Hansen",
      rating: 4,
      date: "20. april 2026",
      comment: "God jobb, men kunne vært litt mer grundig.",
    },
  ];

  // Fetch Order Details
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["safepay-approval", orderId],
    queryFn: async () => {
      const res = await mainLink.get(
        `/api/safepay-checkout/details/${orderId}`,
      );
      return res.data;
    },
    enabled: !!orderId,
  });

  const toggleCheck = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await mainLink.post("/api/safepay-checkout/approve", {
        orderId,
        ratings,
        comment,
      });
      return res.data;
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast.success("Jobb godkjent!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Kunne ikke godkjenne jobben");
    },
  });

  const handleApprove = () => {
    approveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f0e8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Kunne ikke laste oppdraget
        </h2>
        <Button onClick={() => navigate(-1)} label="Gå tilbake" />
      </div>
    );
  }

  const { order: orderData, calculation } = order;
  const isOrderCompleted = orderData.status === "completed";

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center px-6">
        <div className="max-w-[500px] w-full bg-[#1a3a1a] rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-16 h-16 bg-[#4ade80] rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-[#1a3a1a]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Jobb godkjent!</h1>
          <p className="text-white/60 mb-8">
            Utbetaling er satt i gang til {orderData.providerId.name}{" "}
            {orderData.providerId.lastName}
          </p>

          <div className="text-[42px] font-bold text-[#4ade80] mb-1">
            {calculation.providerNet} kr
          </div>
          <div className="text-[12px] text-white/40 uppercase tracking-widest mb-10">
            Utbetales innen 1–2 virkedager
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/profile")}
              label="Se kontrakt"
              className="w-full bg-[#4ade80] text-[#1a3a1a] rounded-full py-3.5 font-bold"
            />
            <Button
              variant="outline"
              onClick={() => navigate("/home")}
              label="Tilbake til hjem"
              className="w-full border-white/20 text-white rounded-full py-3.5 font-bold"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-sans pb-12">
      <div className="max-w-[1024px] mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Tilbake
        </button>

        <SafePaySteps
          currentStep={isSuccess ? 4 : 4}
          orderId={orderId}
          serviceId={orderData.serviceId._id}
        />

        {/* Job Status Banner */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <CircleCheck size={18} className="text-custom-green" /> Jobbstatus
          </div>
          <div className="bg-[#f0faf0] border border-[#c6f0d8] rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-custom-green rounded-full flex items-center justify-center shrink-0">
              <Wrench size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#166534] mb-0.5">
                {orderData.providerId.name} melder jobben som ferdig
              </h3>
              <p className="text-[12px] text-custom-green/80">
                Lørdag 24. mai kl. 14:32 · {orderData.serviceId.title} ·{" "}
                {orderData.serviceId.location?.city || "Oslo"}
              </p>
            </div>
          </div>
        </div>

        {/* Worker Summary */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <User size={18} className="text-custom-green" /> Oppdragstaker
          </div>
          <div className="bg-[#f9f9f7] rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#c8d8c8] text-[#1a3a1a] font-bold flex items-center justify-center text-lg overflow-hidden">
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
                Fullførte oppdraget på ca. 1 time 45 min
              </div>
              <div className="flex gap-2 mt-1.5">
                <span className="text-[10px] bg-[#f0faf0] text-[#166534] border border-[#c6f0d8] rounded-full px-2 py-0.5 font-medium uppercase tracking-wider">
                  SafePay-bruker
                </span>
                <span className="text-[10px] bg-[#f0faf0] text-[#166534] border border-[#c6f0d8] rounded-full px-2 py-0.5 font-medium uppercase tracking-wider">
                  BankID verifisert
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <ListChecks size={18} className="text-custom-green" /> Sjekkliste —
            ble jobben gjort riktig?
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={
                  !isOrderCompleted ? () => toggleCheck(item.id) : undefined
                }
                className={`flex items-center gap-3 p-3.5 rounded-xl ${isOrderCompleted ? "cursor-not-allowed" : "cursor-pointer"} border transition-all ${item.checked ? "bg-[#f0faf0] border-[#c6f0d8]" : "bg-[#f9f9f7] border-transparent hover:border-black/10"}`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-md border-2 flex items-center justify-center transition-all ${item.checked ? "bg-custom-green border-custom-green" : "bg-white border-[#c8d8c8]"}`}
                >
                  {item.checked && (
                    <Check size={14} className="text-white" strokeWidth={3} />
                  )}
                </div>
                <span
                  className={`text-[13px] font-medium ${item.checked ? "text-[#166534]" : "text-gray-600"}`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rating Section */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 mb-4 shadow-sm">
          {!isSuccess ? (
            <>
              <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
                <Star size={18} className="text-custom-green" /> Gi{" "}
                {orderData.providerId.name} en vurdering
              </div>

              <div className="mb-6">
                <p className="text-[13px] text-gray-500 mb-2">
                  Helhetlig opplevelse
                </p>
                <StarRating
                  value={ratings.overall}
                  onChange={(val) =>
                    setRatings((prev) => ({ ...prev, overall: val }))
                  }
                  disabled={isOrderCompleted}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { id: "punctuality", label: "Punktlighet" },
                  { id: "quality", label: "Kvalitet" },
                  { id: "communication", label: "Kommunikasjon" },
                  { id: "tidiness", label: "Ryddighet" },
                ].map((cat) => (
                  <div key={cat.id} className="bg-[#f9f9f7] rounded-xl p-3">
                    <div className="text-[11px] text-gray-400 uppercase font-bold mb-2 tracking-wider">
                      {cat.label}
                    </div>
                    <StarRating
                      value={(ratings as any)[cat.id]}
                      onChange={(val) =>
                        setRatings((prev) => ({ ...prev, [cat.id]: val }))
                      }
                      disabled={isOrderCompleted}
                      size={14}
                      showLabel={false}
                    />
                  </div>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isOrderCompleted}
                className={`w-full bg-white border border-black/10 rounded-xl p-4 text-[13px] text-gray-800 outline-none focus:border-custom-green min-h-[100px] ${isOrderCompleted ? "cursor-not-allowed bg-gray-50" : ""}`}
                placeholder="Skriv en anmeldelse..."
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
                <Star size={18} className="text-[#F59E0B]" /> Vurderinger for{" "}
                {orderData.providerId.name}
              </div>

              {/* Average Rating Summary */}
              <div className="bg-[#f9f9f7] rounded-xl p-4 mb-6 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-[#F59E0B]">4.7</div>
                  <div className="text-sm text-gray-500">av 5</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={20}
                        className={
                          star <= 5
                            ? "text-[#F59E0B] fill-[#F59E0B]"
                            : "text-[#d1d5db]"
                        }
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600">
                    4.7 / 5 · 12 vurderinger
                  </div>
                </div>
              </div>

              {/* Individual Reviews */}
              <div className="max-h-[300px] overflow-y-auto space-y-4">
                {mockReviews.map((review) => (
                  <div key={review.id} className="bg-[#f9f9f7] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">
                        {review.reviewerName}
                      </div>
                      <div className="text-xs text-gray-500">{review.date}</div>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          className={
                            star <= review.rating
                              ? "text-[#F59E0B] fill-[#F59E0B]"
                              : "text-[#d1d5db]"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Transaction Details Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Wallet size={18} className="text-custom-green" />{" "}
            Transaksjonsdetaljer
          </div>

          <div className="space-y-4">
            {/* Transaction Info */}
            <div className="bg-[#f9f9f7] rounded-xl p-4">
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
                  {new Date(
                    orderData.createdAt || Date.now(),
                  ).toLocaleDateString("no-NO")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Status
                </span>
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-full ${
                    orderData.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : orderData.status === "paid"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {orderData.status === "completed"
                    ? "Fullført"
                    : orderData.status === "paid"
                      ? "Betalt"
                      : "Venter"}
                </span>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="bg-[#f0faf0] border border-[#c6f0d8] rounded-2xl p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                  <span className="text-gray-500">Oppdragsbeløp</span>
                  <span className="text-gray-900 font-bold">
                    {calculation.basePrice} kr
                  </span>
                </div>
                <div className="flex justify-between text-[13px] border-b border-black/5 pb-2">
                  <span className="text-gray-500">SafePay-gebyr (3%)</span>
                  <span className="text-gray-900 font-bold">
                    - {calculation.fee} kr
                  </span>
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

              <div className="flex gap-2 text-[11px] text-[#166534] leading-relaxed">
                <Clock size={14} className="shrink-0 mt-0.5" />
                <p>
                  Pengene utbetales til {orderData.providerId.name} innen 1–2
                  virkedager etter godkjenning.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleApprove}
            loading={approveMutation.isPending}
            disabled={isOrderCompleted}
            className={
              isOrderCompleted
                ? "w-full bg-gray-300 text-gray-500 rounded-full py-4 text-[15px] font-bold flex items-center justify-center gap-2 shadow-lg mt-6 cursor-not-allowed"
                : "w-full bg-custom-green text-white rounded-full py-4 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#14532d] transition-all shadow-lg mt-6"
            }
          >
            {isOrderCompleted ? (
              "Jobb allerede godkjent!"
            ) : (
              <>
                <CircleCheck size={20} /> Godkjenn jobb og utbetal{" "}
                {calculation.providerNet} kr
              </>
            )}
          </Button>

          <div className="text-center mt-5">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-red-500 transition-colors"
            >
              <AlertTriangle size={14} /> Ikke fornøyd? Opprett en tvist
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafePayApproval;
