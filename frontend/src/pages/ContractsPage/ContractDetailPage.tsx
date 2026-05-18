import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getAllContracts,
  signContract,
  updateContract,
} from "../../api/contractAPI";
import type { Contract } from "../../api/contractAPI";
import { getAllOrders, updateOrderStatus } from "../../api/orderAPI";
import type { Order } from "../../api/orderAPI";
import { createReview, getReviewByOrder } from "../../api/reviewsAPI";
import type { Review } from "../../api/reviewsAPI";
import { useUserStore } from "../../stores/userStore";
import { toast } from "react-hot-toast";
import { format } from "date-fns/format";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  ArrowLeft,
  PenTool,
  CheckCircle,
  Star,
  Send,
  Shield,
  Edit3,
  Save,
  X,
  History,
} from "lucide-react";
import { Button } from "../../components/Ui/button/Button";

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [contract, setContract] = useState<Contract | null>(null);
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [useSafePay, setUseSafePay] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editAddress, setEditAddress] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [existingReview, setExistingReview] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [id, user?._id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedContracts, fetchedOrders] = await Promise.all([
        getAllContracts(),
        getAllOrders(),
      ]);
      const currentContract = fetchedContracts.find((c) => c._id === id);
      if (currentContract) {
        setContract(currentContract);
        setUseSafePay(currentContract.useSafePay || false);
        setEditContent(currentContract.content);
        setEditPrice(currentContract.price);
        setEditAddress(currentContract.address || "");
        const relatedOrder = fetchedOrders.find((o) =>
          typeof o.contractId === "string"
            ? o.contractId === currentContract._id
            : (o.contractId as any)?._id === currentContract._id,
        );
        setOrder(relatedOrder);

        // Check for existing review if order is completed
        if (relatedOrder?.status === "completed" && user?._id) {
          const isClient = currentContract.clientId._id === user?._id;
          const role = isClient ? "seeker" : "poster";
          const review = await getReviewByOrder(relatedOrder._id, role);
          if (review) {
            setExistingReview(review);
            setHasReviewed(true);
          }
        }
      } else {
        toast.error("Kontrakt ikke funnet.");
        navigate("/contracts");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Kunne ikke laste detaljer.");
      navigate("/contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContract = async () => {
    if (!contract) return;
    try {
      setIsUpdating(true);
      await updateContract(contract._id, {
        content: editContent,
        price: editPrice,
        address: editAddress,
      });
      toast.success("Kontrakt oppdatert! Begge må signere na nytt.");
      setIsEditing(false);
      fetchData();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Kunne ikke oppdatere kontrakt",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignContract = async () => {
    if (!contract) return;
    try {
      await signContract(contract._id, useSafePay);
      toast.success("Kontrakt signert!");
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke signere kontrakt");
    }
  };

  const handleUpdateOrderStatus = async (newStatus: string) => {
    if (!order) return;
    try {
      await updateOrderStatus(order._id, newStatus);
      toast.success("Bestillingsstatus oppdatert!");
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke oppdatere status");
    }
  };

  const handleSubmitReview = async () => {
    if (!order || !contract) return;
    try {
      setIsSubmittingReview(true);
      const revieweeId = isClient
        ? contract.providerId._id
        : contract.clientId._id;
      const revieweeRole = isClient ? "seeker" : "poster";

      await createReview({
        orderId: order._id,
        serviceId:
          typeof order.serviceId === "string"
            ? order.serviceId
            : order.serviceId?._id,
        revieweeId,
        revieweeRole,
        rating,
        comment,
      });

      toast.success("Vurdering sendt!");
      setHasReviewed(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke sende vurdering");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F7E47]"></div>
      </div>
    );
  }

  if (!contract) return null;

  const isClient = contract.clientId._id === user?._id;
  const isProvider = contract.providerId._id === user?._id;

  const needsMySignature =
    (isClient && !contract.signedByCustomer) ||
    (isProvider && !contract.signedByProvider);

  const canEdit = (contract.editCount || 0) < 3 && contract.status !== "signed";

  // Statusvisning
  const getStatusDisplay = () => {
    if (order && contract.status === "signed") {
      const statusMap: Record<string, { label: string; color: string }> = {
        pending: {
          label: "Bestilling venter",
          color: "bg-amber-100 text-amber-800 border-amber-200",
        },
        accepted: {
          label: "Bestilling akseptert",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        },
        declined: {
          label: "Bestilling avvist",
          color: "bg-rose-100 text-rose-800 border-rose-200",
        },
        in_progress: {
          label: "I arbeid",
          color: "bg-indigo-100 text-indigo-800 border-indigo-200",
        },
        completed: {
          label: "Fullført",
          color: "bg-emerald-100 text-emerald-800 border-emerald-200",
        },
        cancelled: {
          label: "Bestilling kansellert",
          color: "bg-slate-100 text-slate-800 border-slate-200",
        },
      };
      return (
        statusMap[order.status] || {
          label: order.status,
          color: "bg-slate-100 text-slate-800 border-slate-200",
        }
      );
    }
    switch (contract.status) {
      case "draft":
        return {
          label: "Utkast",
          color: "bg-slate-50 text-slate-600 border-slate-200",
        };
      case "pending_signatures":
        return {
          label: "Venter på signering",
          color: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "signed":
        return {
          label: "Signert",
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "cancelled":
        return {
          label: "Kansellert",
          color: "bg-rose-50 text-rose-700 border-rose-200",
        };
      default:
        return {
          label: contract.status,
          color: "bg-slate-50 text-slate-600 border-slate-200",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Navigasjon tilbake */}
        <Link
          to="/contracts"
          className="inline-flex items-center gap-2 text-black! font-semibold mb-8 group transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:bg-slate-50 shadow-sm transition-colors">
            <ArrowLeft size={16} />
          </div>
          Tilbake til kontrakter
        </Link>

        {/* Helte-seksjon for kontraktsdetaljer */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="p-8 md:p-10 border-b border-slate-50 relative overflow-hidden">
            {/* Gradient-bakgrunn øverst til høyre */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-bl from-emerald-100/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${statusDisplay.color}`}
                  >
                    {statusDisplay.label}
                  </span>

                  {contract.useSafePay && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm bg-blue-50 text-blue-700 border-blue-100">
                      <Shield size={12} fill="currentColor" fillOpacity={0.2} />
                      SafePay Aktiv
                    </span>
                  )}

                  {(contract.editCount || 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm bg-amber-50 text-amber-700 border-amber-100">
                      <History size={12} />
                      Endret {contract.editCount}/3
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-custom-black leading-tight mb-2">
                  {contract.serviceSnapshot?.title ||
                    contract.serviceId?.title ||
                    "Oppdragskontrakt"}
                </h1>
                <p className="text-slate-500 font-medium flex items-center gap-2">
                  <FileText size={16} />
                  Opprettet{" "}
                  {format(new Date(contract.createdAt), "dd. MMMM yyyy")}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {canEdit && !isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl border-slate-200 font-bold flex items-center gap-2 px-6"
                  >
                    <Edit3 size={18} />
                    Rediger kontrakt
                  </Button>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="rounded-xl border-slate-200 font-bold flex items-center gap-2 px-6 text-red-500"
                    >
                      <X size={18} />
                      Avbryt
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleUpdateContract}
                      disabled={isUpdating}
                      className="bg-custom-green hover:bg-custom-green/90 text-white rounded-xl font-bold flex items-center gap-2 px-6 shadow-md"
                    >
                      {isUpdating ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Save size={18} />
                      )}
                      Lagre endringer
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                {/* SafePay Info Box */}
                {contract.useSafePay && (
                  <div className="mb-8 bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      <Shield size={24} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-blue-900 mb-1">
                        SafePay Escrow Aktiv
                      </h4>
                      <p className="text-sm text-blue-700 leading-relaxed font-medium">
                        Betalingen for dette oppdraget er beskyttet av SafePay.
                        Pengene holdes trygt til oppdraget er markert som
                        fullført og godkjent av begge parter.
                      </p>
                    </div>
                  </div>
                )}

                {/* Kontraktsinnhold Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-custom-green"></div>
                    Kontraktsvilkår
                  </h3>

                  {isEditing ? (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                          Avtalt Pris (NOK)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) =>
                              setEditPrice(Number(e.target.value))
                            }
                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-bold focus:border-custom-green outline-none transition-all"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                            kr
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                          Adresse
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-bold focus:border-custom-green outline-none transition-all"
                            placeholder="Skriv inn adresse..."
                          />
                          <MapPin
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                          Kontraktsinnhold
                        </label>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full min-h-[300px] bg-white border border-slate-200 rounded-2xl p-6 font-medium leading-relaxed focus:border-custom-green outline-none transition-all"
                          placeholder="Skriv inn kontraktsvilkårene her..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative group">
                      <div className="absolute top-4 right-4 text-slate-50 group-hover:text-slate-100 transition-colors">
                        <PenTool size={64} strokeWidth={1} />
                      </div>
                      <div className="relative z-10">
                        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                          {contract.content}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Høyre sidepanel */}
              <div className="space-y-8">
                {/* Partenes informasjon */}
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-custom-green"></div>
                    Partene & Detaljer
                  </h3>

                  <div className="space-y-4">
                    {/* Customer */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-50">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold">
                        {contract.customerSnapshot?.name?.[0] || "K"}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Oppdragsgiver
                        </p>
                        <h4 className="text-sm font-bold text-custom-black">
                          {contract.customerSnapshot?.name}
                        </h4>
                      </div>
                      {contract.signedByCustomer ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Clock size={16} className="text-slate-300" />
                      )}
                    </div>

                    {/* Provider */}
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-50">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold">
                        {contract.providerSnapshot?.name?.[0] || "T"}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Tilbyder
                        </p>
                        <h4 className="text-sm font-bold text-custom-black">
                          {contract.providerSnapshot?.name}
                        </h4>
                      </div>
                      {contract.signedByProvider ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Clock size={16} className="text-slate-300" />
                      )}
                    </div>

                    {/* Address Display */}
                    {(contract.address || editAddress) && (
                      <div className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-50">
                        <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
                          <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Oppdragsadresse
                          </p>
                          <h4 className="text-sm font-bold text-custom-black leading-tight">
                            {contract.address || editAddress}
                          </h4>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Avtalt Pris
                    </p>
                    <div className="text-2xl font-black text-custom-green">
                      kr {contract.price.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* SafePay Toggle for Signing */}
                  {needsMySignature && contract.status !== "cancelled" && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-800 font-bold">
                          <Shield size={18} />
                          <span>Bruk SafePay?</span>
                        </div>
                        <button
                          onClick={() => setUseSafePay(!useSafePay)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            useSafePay ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              useSafePay ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-[13px] text-blue-700 leading-relaxed font-medium">
                        Ved å aktivere SafePay vil betalingen holdes trygt i
                        escrow til oppdraget er fullført.
                      </p>
                    </div>
                  )}

                  {/* Signaturboks */}
                  {needsMySignature && contract.status !== "cancelled" ? (
                    <div className="bg-white border-2 border-emerald-50 rounded-3xl p-6 shadow-lg shadow-emerald-900/5 space-y-4">
                      <div className="text-center">
                        <h4 className="font-bold text-custom-black mb-1">
                          Klar for å signere?
                        </h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Ved å signere aksepterer du vilkårene i kontrakten.
                        </p>
                      </div>
                      <Button
                        variant="default"
                        onClick={handleSignContract}
                        className="w-full h-12 bg-custom-green hover:bg-custom-green/90 text-white rounded-xl font-bold"
                      >
                        Signer kontrakt nå
                      </Button>
                    </div>
                  ) : contract.status === "signed" ? (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-emerald-900">
                            Signert!
                          </h4>
                          <p className="text-xs text-emerald-700 font-medium">
                            Ordren er nå bindende.
                          </p>
                        </div>
                      </div>

                      {/* Review Section */}
                      {order && order.status === "completed" && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6 shadow-sm">
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Star
                              size={18}
                              className="text-amber-400 fill-amber-400"
                            />
                            {hasReviewed ? "Din vurdering" : "Gi en vurdering"}
                          </h4>

                          {hasReviewed ? (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={16}
                                    className={
                                      i < (existingReview?.rating || 0)
                                        ? "text-amber-400 fill-amber-400"
                                        : "text-slate-200"
                                    }
                                  />
                                ))}
                              </div>
                              <p className="text-sm text-slate-600 italic leading-relaxed">
                                "{existingReview?.comment || "Ingen kommentar"}"
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex justify-center gap-2 py-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="transition-transform hover:scale-110 active:scale-95"
                                  >
                                    <Star
                                      size={32}
                                      className={
                                        star <= rating
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-200"
                                      }
                                    />
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Hvordan var din opplevelse? (Valgfritt)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:border-custom-green outline-none min-h-[100px] transition-all"
                              />
                              <Button
                                variant="default"
                                onClick={handleSubmitReview}
                                disabled={isSubmittingReview}
                                className="w-full bg-custom-green hover:bg-custom-green/90 text-white rounded-xl h-12 font-bold"
                                label={
                                  isSubmittingReview
                                    ? "Sender..."
                                    : "Send vurdering"
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Order Management for Provider */}
                      {order && order.status !== "completed" && isProvider && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6 shadow-sm overflow-hidden">
                          <div className="space-y-4">
                            <div className="flex flex-col gap-4 border-b border-slate-50 pb-4">
                              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                Ordrehåndtering
                              </h4>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Status:
                                </span>
                                <div className="flex-1">
                                  <select
                                    title="Velg oppdater status"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg p-2 px-3 shadow-sm outline-none cursor-pointer hover:border-slate-300 transition-all"
                                    value={order.status}
                                    onChange={(e) =>
                                      handleUpdateOrderStatus(e.target.value)
                                    }
                                  >
                                    <option value="accepted">Akseptert</option>
                                    <option value="in_progress">
                                      I arbeid
                                    </option>
                                    <option value="completed">Fullført</option>
                                    <option value="cancelled">Avbryt</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {order.status === "accepted" && (
                                <Button
                                  variant="default"
                                  onClick={() =>
                                    handleUpdateOrderStatus("in_progress")
                                  }
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-14 font-bold shadow-lg shadow-blue-100 transition-all hover:-translate-y-0.5"
                                  label="Start Arbeid"
                                />
                              )}
                              {order.status === "in_progress" && (
                                <Button
                                  variant="default"
                                  onClick={() =>
                                    handleUpdateOrderStatus("completed")
                                  }
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-14 font-bold shadow-lg shadow-emerald-100 transition-all hover:-translate-y-0.5"
                                  label="Marker som Fullført"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Order Management for Client */}
                      {order && order.status === "in_progress" && isClient && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 text-center shadow-sm">
                          <p className="text-sm text-slate-600 font-medium">
                            Tilbyderen jobber nå med oppdraget.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractDetailPage;
