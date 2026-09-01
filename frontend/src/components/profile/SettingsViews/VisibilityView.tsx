import { Eye, Info } from 'lucide-react';

/**
 * The checkbox that used to live here had no `onChange`, no state and no API
 * call — a privacy promise that did nothing whichever way the user set it.
 * Until search-engine indexing is actually controllable per profile, this view
 * states what is true instead of offering a switch that isn't wired up.
 */
export const VisibilityView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-gray-50 p-6 rounded-3xl border border-gray-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
        <Eye size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Synlighet i søkemotorer</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Oppdrag du legger ut er offentlige, slik at oppdragstakere kan finne dem. Det betyr at
          de også kan bli indeksert av søkemotorer som Google.
        </p>
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800 text-[13px]">
          <Info size={15} className="shrink-0 mt-0.5" />
          <p>
            Ønsker du at profilen din ikke skal vises i søkemotorer? Ta kontakt med kundeservice,
            så ordner vi det for deg.
          </p>
        </div>
      </div>
    </div>
  </section>
);
