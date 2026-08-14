import { useOutletContext } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { SettingsContextType } from '../../../pages/SettingsPage';

const SUPPORT_EMAIL = 'support@jobblo.no';

/**
 * "Slett profil" used to run `toast.success('Kommer soon')` — a green success
 * toast, on a page promising irreversible deletion, for a GDPR Art. 17 right.
 * Nothing was deleted and the user had no way to know that.
 *
 * `DELETE /api/users/:id` does exist, but self-serve irreversible erasure needs a
 * confirmation flow, a decision about what happens to the user's live orders and
 * escrowed funds, and a retention policy — none of which exist yet. Until then
 * this page tells the truth and routes the request to a human.
 */
export const DeleteAccountView = () => {
  const { form, handleChange } = useOutletContext<SettingsContextType>();

  const feedback = form.feedback?.trim() || '';
  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent('Forespørsel om sletting av profil')}` +
    `&body=${encodeURIComponent(
      feedback
        ? `Jeg ønsker å slette profilen min.\n\nTilbakemelding:\n${feedback}`
        : 'Jeg ønsker å slette profilen min.'
    )}`;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-4 text-gray-700">
        <p className="text-[15px] leading-relaxed">
          Det er trist å se deg dra! Vi ønsker alltid å forbedre oss, og setter pris på en
          tilbakemelding i skjemaet nedenfor.
        </p>
        <p className="text-[15px] leading-relaxed">
          Sletting av profilen din er irreversibel, og alt tilknyttet innhold vil bli slettet fra
          Jobblo. Du må opprette en ny profil hvis du vil bli med senere.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-[13px] leading-relaxed">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <p>
          Sletting gjøres i dag manuelt av kundeservice, slik at vi rekker å avslutte eventuelle
          pågående oppdrag og utbetalinger på en trygg måte. Send oss forespørselen under, så
          bekrefter vi når profilen din er slettet.
        </p>
      </div>

      <div className="relative group">
        <textarea
          id="feedback"
          rows={5}
          placeholder="Tilbakemelding (valgfritt)"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-5 py-4 text-gray-900 font-medium transition-colors resize-none"
          value={form.feedback || ''}
          onChange={(event) => handleChange('feedback', event.target.value)}
        />
      </div>

      <a
        href={mailto}
        className="w-full text-center font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm
          bg-custom-green hover:bg-custom-green active:scale-[0.98] transition-all duration-200"
      >
        Be om sletting av profil
      </a>
    </section>
  );
};
