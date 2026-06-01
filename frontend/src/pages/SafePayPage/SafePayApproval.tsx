import React, { useState } from "react";
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
    overall: 5,
    punctuality: 5,
    quality: 4,
    communication: 5,
    tidiness: 4,
  });

  const [comment, setComment] = useState(
    "Veldig fornøyd! Kristoffer møtte opp presis og gjorde en grundig jobb. Hagen ser fantastisk ut.",
  );

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
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Star size={18} className="text-custom-green" /> Gi{" "}
            {orderData.providerId.name} en vurdering
          </div>

          <div className="mb-6">
            <p className="text-[13px] text-gray-500 mb-2">
              Helhetlig opplevelse
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={32}
                  onClick={
                    !isOrderCompleted
                      ? () => setRatings((prev) => ({ ...prev, overall: star }))
                      : undefined
                  }
                  className={`${isOrderCompleted ? "cursor-not-allowed" : "cursor-pointer"} transition-all ${star <= ratings.overall ? "text-[#ca8a04] fill-[#ca8a04]" : "text-[#e8e0d0]"}`}
                />
              ))}
            </div>
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
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      onClick={
                        !isOrderCompleted
                          ? () =>
                              setRatings((prev) => ({
                                ...prev,
                                [cat.id]: star,
                              }))
                          : undefined
                      }
                      className={`${isOrderCompleted ? "cursor-not-allowed" : "cursor-pointer"} ${star <= (ratings as any)[cat.id] ? "text-[#ca8a04] fill-[#ca8a04]" : "text-[#e8e0d0]"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isOrderCompleted}
            className={`w-full bg-white border border-black/10 rounded-xl p-4 text-[13px] text-gray-800 outline-none focus:border-custom-green min-h-[100px] ${isOrderCompleted ? "cursor-not-allowed bg-gray-50" : ""}`}
            placeholder="Skriv en kort kommentar om oppdraget... (valgfritt)"
          />
        </div>

        {/* Payout Panel */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[15px] font-medium text-gray-900 mb-4.5">
            <Wallet size={18} className="text-custom-green" /> Utbetaling til{" "}
            {orderData.providerId.name}
          </div>

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
