import { useState } from "react";
import styles from "./ContractMessage.module.css";
import type { Contract } from "../../../api/contractAPI";
import { signContract } from "../../../api/contractAPI";
import { toast } from "react-toastify";

interface ContractMessageProps {
  contract: Contract;
  currentUserId: string;
  onContractUpdated: () => void;
}

export function ContractMessage({ contract, currentUserId, onContractUpdated }: ContractMessageProps) {
  const [signing, setSigning] = useState(false);

  const order = typeof contract.orderId === 'object' ? contract.orderId : null;
  const isCustomer = order?.customerId?._id === currentUserId || order?.customerId === currentUserId;
  const isProvider = order?.providerId?._id === currentUserId || order?.providerId === currentUserId;
  
  const userHasSigned = isCustomer ? contract.signedByCustomer : contract.signedByProvider;
  const otherPartySigned = isCustomer ? contract.signedByProvider : contract.signedByCustomer;
  const bothSigned = contract.signedByCustomer && contract.signedByProvider;

  const handleSign = async () => {
    try {
      setSigning(true);
      await signContract(contract._id);
      toast.success("Contract signed successfully!");
      onContractUpdated();
    } catch (error: any) {
      console.error("Sign contract error:", error);
      toast.error(error.response?.data?.error || "Failed to sign contract");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className={styles.contractContainer}>
      <div className={styles.contractHeader}>
        <span className="material-symbols-outlined" style={{ color: "#ea7e15" }}>
          description
        </span>
        <h4>Contract Agreement</h4>
      </div>

      <div className={styles.contractContent}>
        <p className={styles.contractText}>{contract.content}</p>
        
        {order?.agreedPrice && (
          <div className={styles.priceSection}>
            <strong>Agreed Price:</strong> {order.agreedPrice} kr
          </div>
        )}
        
        {order?.scheduledDate && (
          <div className={styles.dateSection}>
            <strong>Scheduled:</strong> {new Date(order.scheduledDate).toLocaleDateString('nb-NO')}
          </div>
        )}
      </div>

      <div className={styles.signaturesSection}>
        <div className={styles.signature}>
          <span className={`material-symbols-outlined ${contract.signedByCustomer ? styles.signed : ''}`}>
            {contract.signedByCustomer ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          <span>Customer {contract.signedByCustomer && '✓'}</span>
        </div>
        <div className={styles.signature}>
          <span className={`material-symbols-outlined ${contract.signedByProvider ? styles.signed : ''}`}>
            {contract.signedByProvider ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          <span>Provider {contract.signedByProvider && '✓'}</span>
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
