import { useState, useEffect } from "react";
import styles from "./ContractMessage.module.css";
import type { Contract } from "../../../api/contractAPI";
import { signContract } from "../../../api/contractAPI";
import { toast } from "react-toastify";
import { initSocket } from "../../../socket/socket";

interface ContractMessageProps {
  contract: Contract;
  currentUserId: string;
  onContractUpdated?: () => void;
}

export function ContractMessage({
  contract: propContract,
  currentUserId,
  onContractUpdated,
}: ContractMessageProps) {
  const [contract, setContract] = useState<Contract | null>(propContract);
  const [signing, setSigning] = useState(false);

  // Sync prop changes
  useEffect(() => {
    setContract(propContract);
  }, [propContract]);

  const isCustomer =
    contract?.customerSnapshot?.userId === currentUserId ||
    contract?.clientId === currentUserId;

  const isProvider =
    contract?.providerSnapshot?.userId === currentUserId ||
    contract?.providerId === currentUserId;

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

  // Real-time socket (one-time init)
  useEffect(() => {
    if (!propContract?.serviceId) return;
    const socket = initSocket();
    const serviceId =
      typeof propContract.serviceId === "string"
        ? propContract.serviceId
        : propContract.serviceId._id;

    socket.emit("join_service", serviceId);

    const handleContractSigned = (data: { contract: Contract }) => {
      if (data.contract._id !== propContract._id) return;
      setContract(data.contract); // update UI
      onContractUpdated?.();
    };

    socket.on("contract_signed", handleContractSigned);

    return () => {
      socket.off("contract_signed", handleContractSigned);
    };
  }, [propContract._id]);

  const handleSign = async () => {
    if (!contract) return;
    if (userHasSigned || bothSigned) return;

    try {
      setSigning(true);
      const { contract: updatedContract } = await signContract(contract._id); // ensure API returns updated contract
      setContract(updatedContract); // optimistic UI update
      toast.success("Contract signed successfully!");
      onContractUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to sign contract");
    } finally {
      setSigning(false);
    }
  };

  if (!contract?._id) return null;
  return (
    <div className={styles.contractContainer}>
      <div className={styles.contractHeader}>
        <span
          className="material-symbols-outlined"
          style={{ color: "#ea7e15" }}
        >
          description
        </span>
        <h4>Contract Agreement</h4>
      </div>

      <div className={styles.contractContent}>
        <p className={styles.contractText}>{contract?.content}</p>

        {contract?.price && (
          <div className={styles.priceSection}>
            <strong>Agreed Price:</strong> {contract.price} kr
          </div>
        )}

        {contract?.scheduledDate && (
          <div className={styles.dateSection}>
            <strong>Scheduled:</strong>{" "}
            {new Date(contract.scheduledDate).toLocaleDateString("nb-NO")}
          </div>
        )}
      </div>

      <div className={styles.signaturesSection}>
        <div className={styles.signature}>
          <span
            className={`material-symbols-outlined ${
              contract?.signedByCustomer ? styles.signed : ""
            }`}
          >
            {contract?.signedByCustomer
              ? "check_circle"
              : "radio_button_unchecked"}
          </span>
          <span>Customer {contract?.signedByCustomer && "✓"}</span>
        </div>
        <div className={styles.signature}>
          <span
            className={`material-symbols-outlined ${
              contract?.signedByProvider ? styles.signed : ""
            }`}
          >
            {contract?.signedByProvider
              ? "check_circle"
              : "radio_button_unchecked"}
          </span>
          <span>Provider {contract?.signedByProvider && "✓"}</span>
        </div>
      </div>

      {bothSigned && (
        <div className={styles.completedBanner}>
          <span className="material-symbols-outlined">verified</span>
          Contract Fully Signed - Order Created
        </div>
      )}

      {!userHasSigned && !bothSigned && (
        <button
          className={styles.signButton}
          onClick={handleSign}
          disabled={signing}
        >
          {signing ? "Signing..." : "Sign Contract"}
        </button>
      )}

      {userHasSigned && !otherPartySigned && (
        <div className={styles.waitingMessage}>
          Waiting for other party to sign...
        </div>
      )}
    </div>
  );
}
