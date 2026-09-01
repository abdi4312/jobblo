import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../Ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../Ui/alert-dialog';
import { shareListing } from '../../utils/shareListing';
import type { ListingCapabilities } from '../../features/services/types';

/**
 * Rediger / Del annonse / Slett, behind one overflow button.
 *
 * Before this the two management actions were scattered across the card: a pencil in a
 * translucent grey pill floating over the photo, and a red circular bin sitting next to
 * the price. Both were 32 px — under the ~44 px a thumb needs — the bin's placement put
 * a destructive control a few pixels from the number people scan for, and neither was
 * labelled. Collecting them under a single `•••` gives the actions room to be legible
 * and gives the card its content back.
 *
 * **Nothing here depends on hover.** The trigger is always rendered at full opacity, so
 * the actions are exactly as discoverable on a phone as on a desktop.
 *
 * **A blocked listing is explained, not silently broken.** When the server says the
 * listing is tied to a contract, an escrowed payment, work in progress or a dispute, the
 * two mutating items are disabled and the menu carries the server's own sentence saying
 * why. Pressing a button and receiving an opaque error is the thing this replaces.
 */

interface ListingOwnerActionsProps {
  serviceId: string;
  title: string;
  capabilities?: ListingCapabilities;
  onDelete: () => void | Promise<void>;
  isDeleting?: boolean;
  /** Where "Rediger" goes. Defaults to the listing edit route. */
  editPath?: string;
  /** Rendered on a photo rather than a panel — swaps to the translucent plate. */
  onPhoto?: boolean;
  className?: string;
}

/** Matches `PHOTO_ACTION` / `FIELD_ICON_BUTTON` geometry, sized up for touch. */
const TRIGGER_BASE =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100';

export const ListingOwnerActions = ({
  serviceId,
  title,
  capabilities,
  onDelete,
  isDeleting = false,
  editPath,
  onPhoto = false,
  className = '',
}: ListingOwnerActionsProps) => {
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Absent capabilities means an endpoint that does not compute them yet (the public
  // listing shape). Allow the action and let the server be the authority — it enforces
  // the same rule and answers 409 with a readable reason.
  const canEdit = capabilities?.canEdit ?? true;
  const canDelete = capabilities?.canDelete ?? true;
  const blockedReason = capabilities?.blockedReason ?? null;

  const handleConfirmDelete = async () => {
    await onDelete();
    setConfirmOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Flere valg for ${title}`}
            // The card underneath is itself clickable, so every control on it has to
            // stop the event before the card's own navigate() runs.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className={`${TRIGGER_BASE} ${
              onPhoto
                ? 'bg-white/95 text-[#0B0B0B] shadow-sm backdrop-blur-sm hover:bg-white'
                : 'border border-[#E6E7E1] bg-white text-[#63665F] hover:border-[#D4D6CD] hover:bg-[#FAFBF7] hover:text-[#0B0B0B]'
            } ${className}`}
          >
            <MoreHorizontal size={18} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            disabled={!canEdit}
            onSelect={() => navigate(editPath ?? `/Publish-job/${serviceId}`)}
          >
            <Pencil size={15} strokeWidth={2} className="shrink-0 text-[#63665F]" />
            Rediger
          </DropdownMenuItem>

          {/* Always available. Sharing a listing changes nothing about it, so a locked
              contract is no reason to withhold the link. */}
          <DropdownMenuItem onSelect={() => void shareListing(serviceId, title)}>
            <Share2 size={15} strokeWidth={2} className="shrink-0 text-[#63665F]" />
            Del annonse
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            destructive
            disabled={!canDelete || isDeleting}
            onSelect={(e) => {
              // Radix closes the menu on select and moves focus back to the trigger.
              // Letting that race the dialog opening steals focus out of the dialog.
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 size={15} strokeWidth={2} className="shrink-0" />
            Slett annonse
          </DropdownMenuItem>

          {/* The server's own sentence. Shown only when something is actually blocked,
              so the menu stays three clean lines in the ordinary case. */}
          {blockedReason && (!canEdit || !canDelete) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex gap-2 pr-3">
                <Info size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-[#9B9E96]" />
                <span>{blockedReason}</span>
              </DropdownMenuLabel>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            {/* The endpoint removes the document and its images — it is not a
                cancellation, and the copy must not soften that into one. */}
            <AlertDialogTitle>Slette annonsen?</AlertDialogTitle>
            <AlertDialogDescription>
              «{title}» blir fjernet permanent og vil ikke lenger være synlig for andre brukere.
              Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            {/* Keeping the listing is the safe default and reads first. */}
            <AlertDialogCancel>Behold annonsen</AlertDialogCancel>
            {/* The design system's own destructive variant, not a hand-rolled red —
                same control the rest of the product confirms deletions with. */}
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Sletter …' : 'Slett annonse'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ListingOwnerActions;
