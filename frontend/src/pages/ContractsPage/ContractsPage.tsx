import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAllContracts, signContract } from "../../api/contractAPI";
import type { Contract } from "../../api/contractAPI";
import { getAllOrders } from "../../api/orderAPI";
import type { Order } from "../../api/orderAPI";
import { useUserStore } from "../../stores/userStore";
import { toast } from "react-hot-toast";
import { formatDistanceToNow, isPast } from "date-fns";
import { format } from "date-fns/format";
import { initSocket } from "../../socket/socket";
import {
  FileText,
  Clock,
  SearchX,
  ChevronRight,
  Briefcase,
  PenTool,
} from "lucide-react";

export function ContractsPage() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<
    "Alle" | "Sendte" | "Mottatte"
  >("Alle");

  const filteredContracts = contracts.filter((contract) => {
    if (activeFilter === "Alle") return true;
    if (activeFilter === "Sendte")
      return contract.providerId?._id === user?._id;
    if (activeFilter === "Mottatte") return contract.clientId._id === user?._id;
    return true;
  });

  useEffect(() => {
    fetchData();

    const socket = initSocket();
    if (socket) {
      socket.on("contract_updated", (data: any) => {
        // Silently re-fetch to update UI in real-time
        fetchData(false);
      });

      socket.on("new_notification", (data: any) => {
        if (data.type === "alert" || data.type === "order") {
          toast.success(data.content, {
            duration: 5000,
            icon: "🔔",
          });
          fetchData(false);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off("contract_updated");
        socket.off("new_notification");
      }
    };
  }, []);

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [fetchedContracts, fetchedOrders] = await Promise.all([
        getAllContracts(),
        getAllOrders(),
      ]);
      setContracts(fetchedContracts);
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error fetching contracts/orders:", error);
      if (showLoading) toast.error("Kunne ikke laste kontrakter.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    try {
      await signContract(contractId);
      toast.success("Kontrakt signert!");

      const socket = initSocket();
      if (socket) {
        socket.emit("contract_updated", { contractId });
      }

      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Kunne ikke signere kontrakt");
    }
  };

  const getStatusDisplay = (contract: Contract, order?: Order) => {
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

  const renderCountdown = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    if (isPast(date)) {
      return (
        <span className="text-slate-400 text-sm font-medium italic">
          Startet / Passert
        </span>
      );
    }

    return (
      <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-0.5 rounded-md">
        Starter om {formatDistanceToNow(date)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F7E47]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
              <FileText size={24} className="text-custom-green" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Aktive kontrakter
            </h1>
          </div>
          <p className="text-slate-500 text-lg ml-1">
            Administrer dine tjenesteavtaler og følg fremgangen effektivt.
          </p>
        </div>

        {/* Filters Section */}
        <div className="flex gap-2 mb-8 bg-slate-50/50 p-2 rounded-2xl w-fit border border-slate-100">
          {(["Alle", "Sendte", "Mottatte"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeFilter === filter
                  ? "bg-custom-green text-white shadow-md shadow-[#2F7E47]/20"
                  : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {filteredContracts.length === 0 ? (
          <div className="rounded-2xl p-16 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <SearchX className="text-slate-300" size={40} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {activeFilter === "Alle"
                ? "Skrivebordet ditt er tomt"
                : activeFilter === "Sendte"
                  ? "Ingen sendte kontrakter"
                  : "Ingen mottatte kontrakter"}
            </h2>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              {activeFilter === "Alle"
                ? "Du har ingen ventende eller aktive kontrakter akkurat nå."
                : activeFilter === "Sendte"
                  ? "Du har ikke sendt noen tjenesteavtaler ennå."
                  : "Du har ikke mottatt noen tjenesteavtaler ennå."}
            </p>
            {activeFilter === "Alle" && (
              <Link
                to="/home"
                className="inline-flex items-center px-6 py-3 bg-[#3F8F6B] text-white rounded-full font-semibold hover:bg-[#327a58] transition-colors shadow-md hover:shadow-lg"
              >
                Browse Services
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {filteredContracts.map((contract) => {
              const isClient = contract.clientId._id === user?._id;

              const relatedOrder = orders.find((o) =>
                typeof o.contractId === "string"
                  ? o.contractId === contract._id
                  : (o.contractId as any)?._id === contract._id,
              );

              const statusDisplay = getStatusDisplay(contract, relatedOrder);

              const isProvider = contract.providerId?._id === user?._id;
              const needsMySignature =
                (isClient && !contract.signedByCustomer) ||
                (isProvider && !contract.signedByProvider);

              return (
                <div
                  key={contract._id}
                  className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] group flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4 flex-1 w-full">
                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center shrink-0">
                      <Briefcase className="text-slate-400" size={20} />
                    </div>

                    <div className="w-full">
                      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 mb-2">
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#3F8F6B] transition-colors line-clamp-1">
                          {contract.serviceSnapshot?.title ||
                            contract.serviceId?.title ||
                            "Contract Agreement"}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-slate-900 bg-slate-50 px-3 py-1 rounded-md border border-slate-100 text-sm">
                            {contract.price} NOK
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-y-3 gap-x-4 text-sm mb-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                            {isClient ? "Provider" : "Client"}:
                          </span>
                          <span className="font-medium">
                            {isClient
                              ? contract.providerSnapshot?.name ||
                                contract.providerId?.name
                              : contract.customerSnapshot?.name ||
                                contract.clientId?.name}
                          </span>
                        </div>

                        <span className="hidden sm:inline text-slate-200">
                          |
                        </span>

                        {contract.scheduledDate && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Clock size={14} className="text-[#3F8F6B]" />
                            <span className="font-medium">
                              {format(
                                new Date(contract.scheduledDate),
                                "MMM dd, yyyy - HH:mm",
                              )}
                            </span>
                          </div>
                        )}

                        <span className="hidden sm:inline text-slate-200">
                          |
                        </span>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusDisplay.color}`}
                        >
                          {statusDisplay.label}
                        </span>

                        {renderCountdown(contract.scheduledDate)}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {needsMySignature &&
                          contract.status !== "cancelled" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSignContract(contract._id);
                              }}
                              className="px-5 py-2 bg-[#3F8F6B] text-white rounded-lg font-bold text-sm hover:bg-[#327a58] transition-colors flex items-center gap-2 shadow-sm"
                            >
                              <PenTool size={16} /> Signer Kontrakt
                            </button>
                          )}

                        {contract.status === "signed" &&
                          relatedOrder &&
                          relatedOrder.status !== "completed" &&
                          isProvider && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Oppdater Status:
                              </span>
                              <select
                                title="Velg oppdater status"
                                id="status-select"
                                className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg focus:ring-2 focus:ring-[#3F8F6B]/20 focus:border-[#3F8F6B] block p-2 shadow-sm transition-all outline-none"
                                value={relatedOrder.status}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleUpdateOrderStatus(
                                    relatedOrder._id,
                                    e.target.value,
                                  );
                                }}
                              >
                                <option value="pending">Venter...</option>
                                <option value="accepted">Aksepter</option>
                                <option value="in_progress">
                                  Start Arbeid
                                </option>
                                <option value="completed">Fullført</option>
                                <option value="declined">Avslå</option>
                              </select>
                            </div>
                          )}

                        <button
                          onClick={() => navigate(`/contracts/${contract._id}`)}
                          className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors"
                        >
                          Se Detaljer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => navigate(`/contracts/${contract._id}`)}
                    className="hidden md:flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[#3F8F6B] group-hover:text-white text-slate-300 transition-colors cursor-pointer"
                  >
                    <ChevronRight size={20} className="ml-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractsPage;
