import { useState, useEffect } from "react";
import { ReceiptText, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket } from "../../../socket/socket";
import { useContractActions } from "../../../features/contracts/hooks/useContractActions";
import type { Contract } from "../../../features/contracts/types/contract.types";

interface ContractMessageProps {
  contract: Contract;
  currentUserId: string;
}

export function ContractMessage({
  contract: propContract,
  currentUserId,
}: ContractMessageProps) {
  const queryClient = useQueryClient();
  const [showContract, setShowContract] = useState(false);

  // Extract Service ID for TanStack Query
  const serviceId =
    typeof propContract.serviceId === "string"
      ? propContract.serviceId
      : propContract.serviceId?._id;

  // TanStack Action Hook
  const { signMutation } = useContractActions(serviceId);

  // Real-time socket sync
  useEffect(() => {
    if (!serviceId) return;

    const socket = initSocket();
    socket.emit("join_service", serviceId);

    const handleContractSigned = (data: { contract: Contract }) => {
      if (data.contract._id !== propContract._id) return;
      // TanStack cache update taake page refresh na karna pare
      queryClient.setQueryData(["contract", serviceId], data.contract);
    };

    socket.on("contract_signed", handleContractSigned);
    return () => {
      socket.off("contract_signed", handleContractSigned);
    };
  }, [propContract._id, serviceId, queryClient]);

  // Derived Logic (Aapka original UI logic)
  const contract = propContract;
  const isCustomer =
    contract?.customerSnapshot?.userId === currentUserId ||
    contract?.clientId?._id === currentUserId;
  const isProvider =
    contract?.providerSnapshot?.userId === currentUserId ||
    contract?.providerId?._id === currentUserId;

  const userHasSigned = isCustomer
    ? contract?.signedByCustomer
    : isProvider
      ? contract?.signedByProvider
      : false;
  const otherPartySigned = isCustomer
    ? contract?.signedByProvider
    : isProvider
      ? contract?.signedByCustomer
      : false;
  const bothSigned =
    Boolean(contract?.signedByCustomer) && Boolean(contract?.signedByProvider);

  // Sign Function
  const handleSign = () => {
    if (!contract?._id || userHasSigned || bothSigned) return;
    signMutation.mutate(contract._id);
  };

  if (!contract?._id) return null;

  return (
    <>
      {!showContract && (
        <div>
          <div className="flex justify-center -mt-3">
            <div className="w-full bg-[#E0883526] border border-[#E0883526] rounded-[6px] py-1 px-4 flex items-center justify-between">
              {/* Left Side: Icon & Text */}
              <div className="flex items-center gap-3 truncate">
                <span className="text-[#ea7e15] text-[20px] shrink-0">
                  <ReceiptText size={14} />
                </span>
                <p className="m-0 text-[13px] text-[#444] font-medium truncate">
                  Contract Agreement:{" "}
                  <span className="text-[#1a1a1a]">{"Tjenesteavtale"}</span>
                </p>
              </div>

              {/* Right Side: Detail Button */}
              <button
                onClick={() => setShowContract(true)}
                className="flex items-center gap-0.5 pl-2 py-0.5 bg-[#ea7e151a] text-[#ea7e15] border-none rounded-lg text-[12px] font-bold cursor-pointer hover:bg-[#ea7e15] hover:text-white transition-all shrink-0"
              >
                Se detaljer
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showContract && (
        <div className="bg-white border border-[#E08835] rounded-xl p-4 mb-3 max-w-106.5 ">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#e0e0e0]">
            <div className="flex items-center gap-2">
              <span className="">
                <ReceiptText size={24} />
              </span>
              <h4 className="m-0 text-base font-semibold text-[#000000]">
                Contract Agreement
              </h4>
            </div>
            <div
              className="bg-[#E0883526] p-2 rounded-[7px] cursor-pointer text-[#E08835] hover:bg-[#E08835] hover:text-white transition-colors"
              onClick={() => setShowContract(false)}
            >
              <X size={18} />
            </div>
          </div>

          {/* Content */}
          <div className="mb-4">
            <p className="text-sm leading-relaxed text-[#333] mb-3 whitespace-pre-wrap">
              {contract?.content}
            </p>

            {contract?.price && (
              <div className="text-sm p-[8px_12px] bg-[#E0883526] rounded-md mb-2">
                <strong className="text-[#E08835] mr-2">Agreed Price:</strong>{" "}
                {contract.price} kr
              </div>
            )}

            {contract?.scheduledDate && (
              <div className="text-sm p-[8px_12px] bg-[#E0883526] rounded-md mb-2">
                <strong className="text-[#E08835] mr-2">Scheduled:</strong>{" "}
                {new Date(contract.scheduledDate).toLocaleDateString("nb-NO")}
              </div>
            )}
          </div>

          {/* Signatures Section */}
          <div className="flex gap-4 mb-4 p-3 bg-[#fafafa] rounded-lg">
            <div className="flex items-center gap-2 text-sm text-[#666]">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  contract?.signedByCustomer ? "text-[#4caf50]" : "text-[#ccc]"
                }`}
              >
                {contract?.signedByCustomer
                  ? "check_circle"
                  : "radio_button_unchecked"}
              </span>
              <span>Customer {contract?.signedByCustomer && "✓"}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-[#666]">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  contract?.signedByProvider ? "text-[#4caf50]" : "text-[#ccc]"
                }`}
              >
                {contract?.signedByProvider
                  ? "check_circle"
                  : "radio_button_unchecked"}
              </span>
              <span>Provider {contract?.signedByProvider && "✓"}</span>
            </div>
          </div>

          {/* Status Banners / Buttons */}
          {bothSigned && (
            <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#4caf50] to-[#45a049] text-white rounded-lg font-semibold text-sm">
              <span className="material-symbols-outlined text-[20px]">
                verified
              </span>
              Contract Fully Signed - Order Created
            </div>
          )}

          {!userHasSigned && !bothSigned && (
            <button
              className="w-full p-3 bg-[#ea7e15] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-colors hover:bg-[#d16d0f] disabled:bg-[#ccc] disabled:cursor-not-allowed"
              onClick={handleSign}
              disabled={signMutation.isPending}
            >
              {signMutation.isPending ? "Signing..." : "Sign Contract"}
            </button>
          )}

          {userHasSigned && !otherPartySigned && (
            <div className="text-center p-3 bg-[#fff3e0] rounded-lg text-sm text-[#e65100] italic">
              Waiting for other party to sign...
            </div>
          )}
        </div>
      )}
    </>
  );
}
