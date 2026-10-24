import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useStripeMutation } from '../../features/jobDetail/hook';
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
} from '../Ui/alert-dialog';

/** Server answer to "can this user buy an extra contact for this job now?". */
export interface ExtraContactOffer {
  available: boolean;
  reason: 'no_period' | 'included_remaining' | 'disabled' | 'already_paid' | 'period_limit_reached' | 'cooldown' | null;
  priceNok: number;
  maxPerPeriod: number;
  usedThisPeriod: number;
  unlockAt: string | null;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  limit?: number;
  usage?: number;
  perContactPrice?: number;
  /** The job being applied to; required to buy an extra contact for it. */
  serviceId?: string;
  extraContact?: ExtraContactOffer;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('nb-NO', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  message,
  limit,
  usage,
  serviceId,
  extraContact,
}) => {
  const navigate = useNavigate();
  const [buying, setBuying] = useState(false);
  const extraContactMutation = useStripeMutation();

  if (!isOpen) return null;

  const buyExtraContact = async () => {
    if (!serviceId) return;
    setBuying(true);
    try {
      const data = await extraContactMutation.mutateAsync({ serviceId });
      window.location.assign(data.url);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Kunne ikke starte betalingen. Prøv igjen.');
      setBuying(false);
    }
  };

  const extraNote =
    extraContact?.reason === 'cooldown' && extraContact.unlockAt
      ? `Neste ekstra kontakt åpner ${formatTime(extraContact.unlockAt)}.`
      : extraContact?.reason === 'period_limit_reached'
        ? `Du har brukt alle ${extraContact.maxPerPeriod} ekstra kontakter denne perioden.`
        : null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogOverlay onClick={onClose} />
      <AlertDialogContent className="dark bg-zinc-950 border-zinc-800 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-zinc-100 text-xl">
            Oppgrader for mer tilgang
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {message || 'Du har nådd din månedlige grense for kontakter.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 my-4">
          {limit !== undefined && (
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-500 uppercase tracking-wider">Din bruk</span>
                <span className="text-zinc-300 font-medium">
                  {usage} / {limit} kontakter
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5">
                <div
                  className="bg-custom-green h-1.5 rounded-full transition-all duration-500"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
          )}

          {extraNote && (
            <p data-testid="extra-contact-note" className="text-sm text-zinc-300">{extraNote}</p>
          )}

          <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-custom-green" />
              <span>Flere kontakter hver måned</span>
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
          {extraContact?.available && serviceId && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void buyExtraContact();
              }}
              disabled={buying}
              className="w-full bg-custom-green text-white hover:opacity-90 font-bold h-11 rounded-xl"
            >
              {buying ? 'Åpner betaling…' : `Kjøp 1 ekstra kontakt – ${extraContact.priceNok} kr`}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              navigate('/membership');
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
