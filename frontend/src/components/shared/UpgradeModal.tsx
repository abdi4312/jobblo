import React from "react";
import { useNavigate } from "react-router-dom";
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

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  limit?: number;
  usage?: number;
  perContactPrice?: number;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  message,
  limit,
  usage,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogOverlay onClick={onClose} />
      <AlertDialogContent className="dark bg-zinc-950 border-zinc-800 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-zinc-100 text-xl">
            Oppgrader for mer tilgang
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {message || "Du har nådd din månedlige grense for kontakter."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4">
          {limit !== undefined && (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-500 uppercase tracking-wider">
                  Din bruk
                </span>
                <span className="text-zinc-300 font-medium">
                  {usage} / {limit} kontakter
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                <div
                  className="bg-custom-green h-1.5 rounded-full transition-all duration-500"
                  style={{ width: "100%" }}
                ></div>
              </div>
            </div>
          )}

          <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-custom-green" />
              <span>Ubegrenset tilgang til alle oppdrag</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-custom-green" />
              <span>Se nøyaktig posisjon med en gang</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-custom-green" />
              <span>Prioritert synlighet for dine søknader</span>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              navigate("/pricing");
              onClose();
            }}
            className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-bold h-11 rounded-xl"
          >
            Se alle abonnementer
          </AlertDialogAction>

          <AlertDialogCancel
            onClick={onClose}
            className="w-full bg-transparent text-zinc-500 border-none hover:text-zinc-300 h-11"
          >
            Kanskje senere
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
