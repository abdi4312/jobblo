import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Search, Mail, Send, ChevronDown, CheckCircle2, ShieldCheck,
} from 'lucide-react';

type FAQ = { id: number; question: string; answer: string; search: string };

const FAQ_ITEMS: FAQ[] = [
  { id: 1, question: 'Hvordan registrerer jeg meg?', answer: 'Klikk på «Registrer deg», fyll inn nødvendig informasjon og bekreft e-postadressen din. Deretter kan du fullføre profilen og begynne å bruke Jobblo.', search: 'registrere konto opprette bruker' },
  { id: 2, question: 'Hvordan publiserer jeg et oppdrag?', answer: 'Trykk på «Legg ut oppdrag», velg oppdragstype og legg inn beskrivelse, budsjett og ønsket tidsplan før du publiserer.', search: 'publisere oppdrag legge ut jobb' },
  { id: 3, question: 'Er det trygt å betale gjennom Jobblo?', answer: 'Ja. Betalinger håndteres via SafePay og Stripe. Pengene holdes i escrow til jobben er godkjent — du betaler aldri for noe du ikke er fornøyd med.', search: 'betaling trygt sikker safepay stripe' },
  { id: 4, question: 'Hvordan fungerer vurderingssystemet?', answer: 'Etter et fullført oppdrag kan begge parter legge igjen en vurdering. Dette bidrar til trygghet og bedre valg for hele Jobblo-fellesskapet.', search: 'anmeldelser vurderinger review' },
  { id: 5, question: 'Hva koster det å bruke Jobblo?', answer: 'Det er gratis å komme i gang. Du kan oppgradere til et medlemskap for flere kontakter, bedre synlighet og ekstra funksjoner.', search: 'pris koste medlemskap planer' },
  { id: 6, question: 'Hvordan sier jeg opp abonnementet?', answer: 'Gå til Innstillinger → Abonnementer, og velg «Si opp». Tilgangen varer ut inneværende periode.', search: 'si opp abonnement kansellere' },
];

type FormState = { subject: string; message: string };

const SUPPORT_EMAIL = 'support@jobblo.no';

export default function SupportPage() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>({ subject: '', message: '' });
  const [sent, setSent] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((f) =>
      (f.question + ' ' + f.answer + ' ' + f.search).toLowerCase().includes(q)
    );
  }, [search]);

  // There is no support-ticket endpoint in the API. This form previously called
  // nothing at all and then reported "Saken din er sendt", so customers with a
  // payment or dispute problem believed they had contacted support and waited.
  // Handing the message to the user's mail client actually delivers it.
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Fyll ut alle feltene.');
      return;
    }
    const mailto =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(form.subject.trim())}` +
      `&body=${encodeURIComponent(form.message.trim())}`;
    window.location.href = mailto;
    setSent(true);
    setForm({ subject: '', message: '' });
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#1a3a1a] focus:ring-2 focus:ring-[#1a3a1a]/10 transition-all disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400';

  return (
    <div className="min-h-screen bg-[#f5f0e8]">

      {/* Header — identical to MembershipPage */}
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-gray-900">Kundesenter</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-start">

          {/* LEFT */}
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-0.5">Hva kan vi hjelpe med?</h2>
              <p className="text-sm text-gray-400 mb-5">Vi svarer normalt innen 24 timer på hverdager.</p>

              {/* Contact cards */}
              <div className="space-y-3">
                {/* "Live Chat" opened a toast saying it doesn't exist, and the
                    phone number was the placeholder +47 123 45 678. Both removed:
                    e-mail is the only channel that actually reaches anyone. */}
                {[
                  { icon: Mail, label: 'E-post', sub: SUPPORT_EMAIL, action: 'Send e-post', href: `mailto:${SUPPORT_EMAIL}` },
                ].map(({ icon: Icon, label, sub, action, href }) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 bg-white rounded-2xl border-2 border-gray-100 hover:border-gray-200 p-5 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#f0f7f2] flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#1a3a1a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                    <a
                      href={href}
                      className="shrink-0 px-4 py-2 rounded-xl border-2 border-gray-200 text-xs font-bold hover:border-[#1a3a1a] hover:text-[#1a3a1a] transition-all"
                    >
                      {action}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Search */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-50">
                <p className="text-sm font-black text-gray-900 mb-3">Ofte stilte spørsmål</p>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-[#1a3a1a] transition-colors">
                  <Search size={14} className="text-gray-300 shrink-0" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Søk i FAQ..."
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {filtered.length > 0 ? filtered.map((faq) => {
                  const open = openId === faq.id;
                  return (
                    <div key={faq.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : faq.id)}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-900">{faq.question}</span>
                        <ChevronDown size={15} className={`text-gray-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-[#1a3a1a]' : ''}`} />
                      </button>
                      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                          <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center py-8 text-sm text-gray-400">Ingen treff for «{search}».</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — sticky form */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-5">
                Send en sak
              </h3>

              {sent ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={36} className="text-[#1a3a1a] mx-auto mb-3" />
                  {/* Only claim what actually happened: we handed the message to
                      the user's mail client. Whether they pressed send is up to them. */}
                  <p className="font-bold text-gray-900 text-sm mb-1">E-posten er klargjort</p>
                  <p className="text-xs text-gray-400 mb-5">
                    Vi har åpnet e-postprogrammet ditt med meldingen. Send den, så svarer vi
                    normalt innen 24 timer. Fungerer det ikke, skriv til {SUPPORT_EMAIL}.
                  </p>
                  <button type="button" onClick={() => setSent(false)} className="text-xs font-bold text-[#1a3a1a] hover:underline">
                    Send en ny sak
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Emne</label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Kort beskrivelse av problemet"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Melding</label>
                    <textarea
                      rows={7}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Beskriv problemet ditt i detalj..."
                      className={inputCls}
                      style={{ resize: 'vertical', minHeight: 150 }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#1a3a1a] text-white font-bold py-3.5 rounded-xl hover:bg-[#254d25] transition-colors text-sm"
                  >
                    <Send size={15} /> Send sak
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-1 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={12} className="text-[#1a3a1a]" />
                    Gjennomsnittlig svartid: 2–4 timer
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
