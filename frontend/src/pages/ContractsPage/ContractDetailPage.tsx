import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAllContracts, signContract } from "../../api/contractAPI";
import type { Contract } from "../../api/contractAPI";
import { getAllOrders, updateOrderStatus } from "../../api/orderAPI";
import type { Order } from "../../api/orderAPI";
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
} from "lucide-react";

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [contract, setContract] = useState<Contract | null>(null);
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

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
        const relatedOrder = fetchedOrders.find((o) =>
          typeof o.contractId === "string"
            ? o.contractId === currentContract._id
            : (o.contractId as any)?._id === currentContract._id,
        );
        setOrder(relatedOrder);
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

  const handleSignContract = async () => {
    if (!contract) return;
    try {
      await signContract(contract._id);
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
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border mb-4 shadow-sm ${statusDisplay.color}`}
                >
                  {statusDisplay.label}
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {contract.serviceSnapshot?.title ||
                    contract.serviceId?.title ||
                    "Kontraktsavtale"}
                </h1>
              </div>

              <div className="md:text-right flex flex-col md:items-end p-5 md:p-6 bg-slate-50 border border-slate-100 rounded-2xl md:min-w-[200px]">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Avtalt pris
                </span>
                <div className="text-3xl font-black text-[#2F7E47] flex items-end gap-1">
                  {contract.price}{" "}
                  <span className="text-sm font-bold text-slate-400 mb-1">
                    NOK
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-10 p-6 bg-slate-50/50 rounded-2xl border border-slate-100/60">
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Din rolle
                </span>
                <span className="font-semibold text-slate-800">
                  {isClient ? "Kunde" : "Tjenesteyter"}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Motpart
                </span>
                <span className="font-semibold text-slate-800">
                  {isClient
                    ? contract.providerSnapshot?.name ||
                      contract.providerId?.name
                    : contract.customerSnapshot?.name ||
                      contract.clientId?.name}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Planlagt dato
                </span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-500" />
                  {contract.scheduledDate
                    ? format(
                        new Date(contract.scheduledDate),
                        "dd. MMM yyyy - HH:mm",
                      )
                    : "Ikke bestemt"}
                </span>
              </div>
            </div>
          </div>

          {/* Hovedinnholdslayout */}
          <div className="grid lg:grid-cols-[1.8fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Venstre kolonne: Kontraktsvilkår */}
            <div className="p-8 md:p-10">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText size={16} /> Vilkår og innhold
              </h3>
              <div className="prose prose-slate max-w-none">
                <div className="bg-[#FCFDFD] border border-slate-100 rounded-2xl p-6 text-[15px] text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner min-h-[300px]">
                  {contract.content}
                </div>
              </div>

              {contract.address && (
                <div className="mt-6 flex items-start gap-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                    <MapPin className="text-[#2F7E47]" size={18} />
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Sted for tjenesten
                    </span>
                    <span className="text-sm font-medium text-slate-800">
                      {contract.address}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Høyre kolonne: Handlinger og statuskontroll */}
            <div className="p-8 md:p-10 bg-slate-50/30">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                Status og handlinger
              </h3>

              <div className="space-y-6">
                {/* Signaturboks */}
                {needsMySignature && contract.status !== "cancelled" ? (
                  <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 shadow-[0_8px_30px_rgb(59,130,246,0.08)] text-center relative overflow-hidden">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <PenTool size={28} strokeWidth={2} />
                    </div>
                    <p className="font-extrabold text-lg text-slate-900 mb-2">
                      Signatur kreves
                    </p>
                    <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
                      Vennligst gå gjennom vilkårene til venstre. Hvis alt ser
                      greit ut, vennligst signer for å gå videre.
                    </p>
                    <button
                      onClick={handleSignContract}
                      className="w-full py-3.5 bg-[#2F7E47] text-white font-bold rounded-xl hover:bg-[#2F7E47] hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
                    >
                      Signer kontrakt
                    </button>
                  </div>
                ) : !needsMySignature &&
                  contract.status === "pending_signatures" ? (
                  <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-sm">
                    <div className="w-16 h-16 bg-orange-50 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock size={28} strokeWidth={2} />
                    </div>
                    <p className="font-extrabold text-lg text-slate-900 mb-2">
                      Venter på motpart
                    </p>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed">
                      Du har signert denne kontrakten. Vi venter nå på at den
                      andre parten skal signere.
                    </p>
                  </div>
                ) : null}

                {/* Signed / Order Controls */}
                {contract.status === "signed" && order && (
                  <div className="bg-white border border-emerald-100 rounded-2xl p-6 md:p-8 shadow-sm">
                    {isProvider ? (
                      <div className="space-y-5">
                        <div>
                          <p className="font-extrabold text-slate-900 text-lg mb-1">
                            Manage Order
                          </p>
                          <p className="text-sm font-medium text-slate-500">
                            Update the job status to notify the client.
                          </p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Current Status
                          </label>
                          <select
                            className="w-full border-slate-200 bg-slate-50 text-slate-800 font-bold rounded-xl shadow-sm focus:ring-[#3F8F6B] focus:border-[#3F8F6B] text-sm py-3.5 px-4 border outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                            value={order.status}
                            onChange={(e) =>
                              handleUpdateOrderStatus(e.target.value)
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="declined">Declined</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle size={28} strokeWidth={2.5} />
                        </div>
                        <p className="font-extrabold text-lg text-slate-900 mb-2">
                          Contract Active
                        </p>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed">
                          The provider is currently managing this order. No
                          further action is required from you unless notified.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {contract.status === "cancelled" && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-2xl p-6 text-center">
                    This contract was cancelled.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContractDetailPage;
