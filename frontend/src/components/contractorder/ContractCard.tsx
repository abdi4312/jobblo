import React from "react";
import { format } from "date-fns/format";
import { formatDistanceToNow, isPast } from "date-fns";
import { Clock, Briefcase, PenTool, ChevronRight } from "lucide-react";
import type { Contract } from "../../../api/contractAPI";
import type { Order } from "../../../api/orderAPI";
import { Button } from "../Ui/button/Button";

interface ContractCardProps {
  contract: Contract;
  order?: Order;
  user: any;
  navigate: (path: string) => void;
  handleSignContract: (contractId: string) => void;
  handleUpdateOrderStatus: (orderId: string, status: string) => void;
}

export const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  order,
  user,
  navigate,
  handleSignContract,
  handleUpdateOrderStatus,
}) => {
  const isClient = contract.clientId._id === user?._id;
  const isProvider = contract.providerId?._id === user?._id;
  const needsMySignature =
    (isClient && !contract.signedByCustomer) ||
    (isProvider && !contract.signedByProvider);

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

  const statusDisplay = getStatusDisplay(contract, order);

  return (
    <div className="box-card-custom p-5 md:p-6 group flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="flex items-start gap-4 flex-1 w-full">
        <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center shrink-0">
          <Briefcase className="text-custom-green" size={20} />
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
                  ? contract.providerSnapshot?.name || contract.providerId?.name
                  : contract.customerSnapshot?.name || contract.clientId?.name}
              </span>
            </div>

            <span className="hidden sm:inline text-slate-200">|</span>

            {contract.scheduledDate && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock size={14} className="text-[#3F8F6B]" />
                <span className="font-medium">
                  {format(new Date(contract.scheduledDate), "MMM dd, yyyy - HH:mm")}
                </span>
              </div>
            )}

            <span className="hidden sm:inline text-slate-200">|</span>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>

            {renderCountdown(contract.scheduledDate)}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {needsMySignature && contract.status !== "cancelled" && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignContract(contract._id);
                }}
                variant="default"
                size="sm"
                label="Signer Kontrakt"
                icon={<PenTool size={16} />}
                className="w-43"
              />
            )}

            {contract.status === "signed" &&
              order &&
              order.status !== "completed" &&
              isProvider && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Oppdater Status:
                  </span>
                  <select
                    title="Velg oppdater status"
                    id="status-select"
                    className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg focus:ring-2 focus:ring-[#3F8F6B]/20 focus:border-[#3F8F6B] block p-2 shadow-sm transition-all outline-none"
                    value={order.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleUpdateOrderStatus(order._id, e.target.value);
                    }}
                  >
                    <option value="pending">Venter...</option>
                    <option value="accepted">Aksepter</option>
                    <option value="in_progress">Start Arbeid</option>
                    <option value="completed">Fullført</option>
                    <option value="declined">Avslå</option>
                  </select>
                </div>
              )}

            <Button
              onClick={() => navigate(`/contracts/${contract._id}`)}
              label="Se Detaljer"
              variant="default"
              size="sm"
              className="w-30"
            />
          </div>
        </div>
      </div>

      <div
        onClick={() => navigate(`/contracts/${contract._id}`)}
        className="hidden md:flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-custom-green-light group-hover:bg-custom-green text-white transition-colors cursor-pointer"
      >
        <ChevronRight size={20} className="ml-0.5" />
      </div>
    </div>
  );
};
