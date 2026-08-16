import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { SettingsContextType } from '../../../pages/SettingsPage';
import mainLink from '../../../api/mainURLs';
import { useUserStore } from '../../../stores/userStore';
import { getErrorMessage } from '../../../utils/getErrorMessage';

const CONFIRM_WORD = 'SLETT';

/**
 * "Slett profil" used to run `toast.success('Kommer snart')` — a green success
 * toast, on a page promising irreversible deletion, for a GDPR Art. 17 right.
 * Nothing was deleted and the user had no way to know that.
 *
 * The backend now anonymises the account (it refuses outright while the user has
 * live orders or escrowed money) rather than dropping the row, because the model
 * itself says never to hard-delete a user with financial history and Norwegian
 * bookkeeping rules require transaction records to be retained. Every piece of
 * personal data is overwritten and all sessions are revoked.
 */
export const DeleteAccountView = () => {
  const { form, handleChange } = useOutletContext<SettingsContextType>();
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !isDeleting && !!user?._id;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await mainLink.delete(`/api/users/${user!._id}`, {
        data: { feedback: form.feedback?.trim() || undefined },
      });
      toast.success('Profilen din er slettet.');
      try {
        await logout();
      } finally {
        queryClient.clear();
        navigate('/', { replace: true });
      }
    } catch (err) {
      // A 409 here is the "you still have live orders" case, and its message
      // tells the user exactly what to do — so surface it rather than a generic.
      toast.error(getErrorMessage(err, 'Kunne ikke slette profilen. Prøv igjen.'));
      setIsDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-4 text-gray-700">
        <p className="text-[15px] leading-relaxed">
          Det er trist å se deg dra! Vi ønsker alltid å forbedre oss, og setter pris på en
          tilbakemelding i skjemaet nedenfor.
        </p>
        <p className="text-[15px] leading-relaxed">
          Sletting av profilen din er irreversibel. Alle personopplysningene dine blir fjernet, og
          du blir logget ut av alle enheter. Du må opprette en ny profil hvis du vil bli med senere.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-[13px] leading-relaxed">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <p>
          Har du pågående oppdrag eller betalinger, må disse fullføres først — da får du beskjed når
          du prøver å slette. Fullførte oppdrag beholdes i regnskapet uten personopplysningene dine,
          slik bokføringsloven krever.
        </p>
      </div>

      <div className="relative group">
        <textarea
          id="feedback"
          rows={5}
          placeholder="Tilbakemelding (valgfritt)"
          className="w-full border border-[#E6E7E1] bg-white outline-none focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12 rounded-2xl px-5 py-4 text-gray-900 font-medium transition-colors resize-none"
          value={form.feedback || ''}
          onChange={(event) => handleChange('feedback', event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-delete" className="text-sm font-medium text-gray-700">
          Skriv <span className="font-bold">{CONFIRM_WORD}</span> for å bekrefte
        </label>
        <input
          id="confirm-delete"
          type="text"
          autoComplete="off"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full bg-gray-100 focus:bg-white outline-none rounded-2xl px-5 py-3.5 text-gray-900 font-medium border border-transparent focus:border-red-300 transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${canDelete ? 'bg-red-600 hover:bg-red-700 active:scale-[0.98]' : 'bg-gray-300 cursor-not-allowed'}`}
      >
        {isDeleting ? 'Sletter ...' : 'Slett profilen min'}
      </button>
    </section>
  );
};
