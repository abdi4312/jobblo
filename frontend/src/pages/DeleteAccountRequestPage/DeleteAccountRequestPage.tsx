import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import mainLink from '../../api/mainURLs';
import { getErrorMessage } from '../../utils/getErrorMessage';

const MAX_MESSAGE_LENGTH = 2000;
const DELETION_SUBJECT = 'Sletting av Jobblo-konto';

export default function DeleteAccountRequestPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const validate = () => {
    const trimmedEmail = normalizedEmail;
    if (!trimmedEmail) {
      return 'E-postadressen til Jobblo-kontoen er påkrevd.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return 'Oppgi en gyldig e-postadresse.';
    }

    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      return 'Kommentar må være kortere enn 2000 tegn.';
    }

    if (!confirmed) {
      return 'Du må bekrefte at du ber om sletting av Jobblo-kontoen.';
    }

    return '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = validate();
    if (validationMessage) {
      setFieldError(validationMessage);
      return;
    }

    setSending(true);
    setFieldError('');

    try {
      const safeMessage = message.trim();
      const payloadMessage = [
        'Jeg ber om sletting av Jobblo-kontoen min.',
        '',
        `Konto-e-post: ${normalizedEmail}`,
        '',
        'Tilleggsmelding:',
        safeMessage || 'Ingen tilleggsmelding.',
      ].join('\n');

      await mainLink.post('/api/support/tickets', {
        email: normalizedEmail,
        subject: DELETION_SUBJECT,
        message: payloadMessage,
      });

      setSubmitted(true);
      setEmail('');
      setMessage('');
      setConfirmed(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Kunne ikke sende forespørselen. Prøv igjen senere.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#e6e7e1] bg-white p-5 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3 text-[#1a3a1a]">
          <ShieldAlert className="h-7 w-7" />
          <p className="text-xs font-bold uppercase tracking-[0.12em]">Jobblo</p>
        </div>

        {!submitted ? (
          <>
            <div className="space-y-4">
              <h1 className="text-3xl font-black tracking-tight text-[#0b0b0b] md:text-4xl">
                Slett Jobblo-kontoen din
              </h1>
              <p className="text-base leading-relaxed text-[#4a4d46]">
                Du kan be om å få Jobblo-kontoen din og tilknyttede personopplysninger slettet,
                også dersom du ikke lenger har tilgang til appen.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e6e7e1] bg-[#f7f8f3] p-4 text-sm leading-relaxed text-[#2a2d28]">
              <p>
                Hvis du fortsatt kan logge inn, er sletting også tilgjengelig i{' '}
                <span className="font-semibold">Profil → Innstillinger → Slett profilen min</span>.
              </p>
              <p className="mt-2">
                Denne nettformen er et eksternt alternativ når du trenger å be om sletting uten å
                bruke appen.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#1c1d1a]">
                  E-postadressen til Jobblo-kontoen
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="din@epost.no"
                  className="w-full rounded-xl border border-[#dfe1db] bg-white px-3.5 py-3 text-base text-[#111827] outline-none transition focus:border-[#2e6641] focus:ring-4 focus:ring-[#2e6641]/10"
                />
              </div>

              <div>
                <label htmlFor="comment" className="mb-2 block text-sm font-semibold text-[#1c1d1a]">
                  Kommentar (valgfritt)
                </label>
                <textarea
                  id="comment"
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Legg inn eventuelle detaljer som kan være nyttige for verifisering eller oppfølging."
                  maxLength={MAX_MESSAGE_LENGTH}
                  className="w-full resize-y rounded-xl border border-[#dfe1db] bg-white px-3.5 py-3 text-base text-[#111827] outline-none transition focus:border-[#2e6641] focus:ring-4 focus:ring-[#2e6641]/10"
                />
                <div className="mt-1 text-right text-xs text-[#5a5d57]">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-[#dfe1db] bg-[#fbfbf9] p-3 text-sm leading-relaxed text-[#2a2d28]">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#c7c9c3] text-[#2e6641] focus:ring-[#2e6641]"
                />
                <span>
                  Jeg ber om at Jobblo-kontoen knyttet til denne e-postadressen slettes.
                </span>
              </label>

              {fieldError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {fieldError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-[#1a3a1a] px-4 py-3 text-base font-bold text-white transition hover:bg-[#254d25] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? 'Sender forespørsel...' : 'Send forespørsel om sletting'}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-[#e6e7e1] bg-[#f7f8f3] p-4 text-sm leading-relaxed text-[#2a2d28]">
              <p>
                Personopplysninger knyttet til profilen slettes når forespørselen er bekreftet og
                kan gjennomføres. Enkelte opplysninger kan beholdes når Jobblo er rettslig
                forpliktet til det, for eksempel bokførings- eller sikkerhetsdokumentasjon.
              </p>
              <p className="mt-3">
                Hvis kontoen har en aktiv transaksjon, ordre eller annen rettslig oppbevaringsplikt,
                kan support måtte fullføre eller avklare den før final sletting.
              </p>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf4ee] text-[#1a3a1a]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-[#0b0b0b]">Forespørselen er mottatt</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#4a4d46]">
              Forespørselen er registrert. Hvis e-postadressen er knyttet til en Jobblo-konto,
              følger vi opp slettingen via en sikker bekreftelsesprosess. Du trenger ikke å ha appen
              installert for å få dette behandlet.
            </p>
            <div className="mt-6">
              <Link to="/support" className="inline-block rounded-xl border border-[#dfe1db] px-4 py-2 text-sm font-semibold text-[#1a3a1a] transition hover:border-[#2e6641] hover:bg-[#f5faf7]">
                Tilbake til kundesenter
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
