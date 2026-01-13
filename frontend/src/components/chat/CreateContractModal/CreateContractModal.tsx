import { useState } from "react";
import styles from "./CreateContractModal.module.css";
import { createContract } from "../../../api/contractAPI";
import { createOrder } from "../../../api/orderAPI";
import { toast } from "react-toastify";

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceTitle: string;
  otherUserId: string;
  currentUserId: string;
  onContractCreated: () => void;
}

export function CreateContractModal({
  isOpen,
  onClose,
  serviceId,
  serviceTitle,
  onContractCreated
}: CreateContractModalProps) {
  const [content, setContent] = useState("");
  const [price, setPrice] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Contract terms are required");
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error("Valid price is required");
      return;
    }

    try {
      setCreating(true);

      // First create the order
      // const order = await createOrder({
      //   serviceId,
      //   price: parseFloat(price),
      //   scheduledDate: scheduledDate || undefined,
      //   address: address || undefined
      // });

      // Then create the contract for the order
      await createContract({
        serviceId,
        content: content.trim(),
        price: parseFloat(price),
        scheduledDate: scheduledDate || undefined,
        address: address || undefined

      });

      toast.success("Contract sent successfully!");
      onContractCreated();
      onClose();
      
      // Reset form
      setContent("");
      setPrice("");
      setScheduledDate("");
      setAddress("");
    } catch (error: any) {
      console.error("Create contract error:", error);
      toast.error(error.response?.data?.error || "Failed to create contract");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Send Contract</h3>
          <button className={styles.closeButton} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.serviceInfo}>
            <span className="material-symbols-outlined">work</span>
            <strong>{serviceTitle}</strong>
          </div>

          <div className={styles.formGroup}>
            <label>Contract Terms *</label>
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the terms and conditions of this contract..."
              rows={6}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Agreed Price (kr) *</label>
            <input
              type="number"
              className={styles.input}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1500"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Scheduled Date</label>
            <input
              type="date"
              className={styles.input}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Address</label>
            <input
              type="text"
              className={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Service location address"
            />
          </div>

          <div className={styles.actions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={creating}
            >
              {creating ? "Sending..." : "Send Contract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
