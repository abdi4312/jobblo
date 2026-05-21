import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogOverlay,
} from "../Ui/alert-dialog";
import { ShoppingBag, CheckCircle2, CreditCard } from "lucide-react";

interface BuyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  price: number;
  isLoading?: boolean;
}

export const BuyContactModal: React.FC<BuyContactModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  price,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="dark bg-zinc-950 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-zinc-100">
              Kjøp kontakt
            </h2>
            <p className="text-zinc-400">
              Du har brukt opp dine gratis kontakter. Du kan kjøpe 1 kontakt for{" "}
              <span className="font-bold text-zinc-100">{price} kr</span> for å
              sende denne forespørselen.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              disabled={isLoading}
              onClick={onConfirm}
              className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 transition-colors font-bold disabled:opacity-50"
            >
              {isLoading ? "Vennligst vent..." : "Fortsett"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
