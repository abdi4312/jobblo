import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Plus, Settings2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUpdateUser } from '../../features/profile/hooks';
import type { User } from '../../types/userTypes';
import { DEFAULT_AVATAR } from '../../constants/assets';

/**
 * Editing your profile, without leaving your profile.
 *
 * Changing your bio used to be: profile → "Rediger" → a full settings page with a
 * twenty-one item sidebar → find the right entry → edit → save → navigate back. Changing
 * your name was the same trip, except the profile's "Rediger" button dropped you on
 * `/settings/bio` and you had to find "Fornavn og etternavn" yourself. Six screens for a
 * one-word change.
 *
 * This is one sheet over the profile you are already looking at. Everything that is
 * *visible on the profile* is editable here, and nothing else — account matters (e-post,
 * passord, utbetalinger, økter, sletting) stay in `/settings`, because those need
 * verification steps a quick-edit sheet should not pretend to own. The link at the foot
 * goes there.
 *
 * Saves send only the fields you actually touched. The old settings page posted all
 * twenty-one every time, so editing your bio also re-submitted a stale e-mail and address
 * from whenever the tab was opened.
 */

const SKILL_SUGGESTIONS = [
  'Rengjøring',
  'Hagearbeid',
  'Flytting',
  'Montering',
  'Maling',
  'Transport',
  'Snekkering',
  'Rørlegger',
];

const BIO_LIMIT = 600;

/** The shape the sheet edits. Everything is a string or a string list — no nesting. */
interface Draft {
  name: string;
  lastName: string;
  bio: string;
  skills: string[];
  availabilityText: string;
  address: string;
  postNumber: string;
  postSted: string;
  companyName: string;
  orgNumber: string;
  website: string;
}

/** `postSted` comes back as a string from the model but as an object on some payloads. */
const asText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const city = (value as { city?: string }).city;
    if (typeof city === 'string') return city;
  }
  return '';
};

const draftFrom = (user: User | null): Draft => ({
  name: asText(user?.name),
  lastName: asText(user?.lastName),
  bio: asText(user?.bio),
  skills: Array.isArray((user as any)?.skills) ? [...(user as any).skills] : [],
  availabilityText: asText((user as any)?.availabilityText),
  address: asText(user?.address),
  postNumber: asText(user?.postNumber),
  postSted: asText(user?.postSted),
  companyName: asText(user?.companyName),
  orgNumber: asText(user?.orgNumber),
  website: asText(user?.website),
});

/** Which section the sheet opens on — the profile passes the one you clicked. */
export type EditSection = 'identity' | 'bio' | 'skills' | 'availability' | 'place' | 'avatar';

const FIELD =
  'w-full rounded-2xl border border-[#E6E7E1] bg-white px-4 py-3 text-[0.9375rem] text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641] focus:ring-4 focus:ring-[#2E6641]/12';

const LABEL = 'mb-1.5 block text-[0.8125rem] font-semibold text-[#0B0B0B]';

/** One block in the sheet. `id` is the scroll target when the profile deep-links here. */
function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`edit-${id}`} className="scroll-mt-4 border-t border-[#E6E7E1] px-5 py-6 first:border-t-0">
      <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-[#0B0B0B]">{title}</h3>
      {hint && <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#63665F]">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function EditProfileSheet({
  user,
  open,
  section = 'identity',
  onClose,
}: {
  user: User | null;
  open: boolean;
  section?: EditSection;
  onClose: () => void;
}) {
  const updateUser = useUpdateUser();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(user));
  const [skillInput, setSkillInput] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isCompany = user?.role === 'company';

  // Reset to the server's current values every time the sheet opens, so an abandoned
  // edit from earlier in the session never reappears as if it had been saved.
  useEffect(() => {
    if (open) {
      setDraft(draftFrom(user));
      setSkillInput('');
    }
    // `user` is intentionally not a dependency: re-seeding mid-edit would wipe what the
    // person is typing every time the profile query refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll to whichever block the profile asked for.
  useEffect(() => {
    if (!open) return;
    const target = panelRef.current?.querySelector(`#edit-${section}`);
    if (target) target.scrollIntoView({ block: 'start' });
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const addSkill = (raw: string) => {
    const skill = raw.trim();
    if (!skill) return;
    // Case-insensitive, so "maling" cannot sit beside "Maling".
    if (draft.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setSkillInput('');
      return;
    }
    set('skills', [...draft.skills, skill]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) =>
    set('skills', draft.skills.filter((s) => s !== skill));

  const uploadAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?._id) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Velg en bildefil.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Bildet er større enn 5 MB.');
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    updateUser.mutate({ userId: user._id, data: formData });
  };

  const save = () => {
    if (!user?._id) return;

    const current = draftFrom(user);
    const changed: Record<string, unknown> = {};
    (Object.keys(draft) as (keyof Draft)[]).forEach((key) => {
      const next = draft[key];
      const prev = current[key];
      const same = Array.isArray(next)
        ? JSON.stringify(next) === JSON.stringify(prev)
        : next === prev;
      if (!same) changed[key] = next;
    });

    if (Object.keys(changed).length === 0) {
      toast('Ingen endringer å lagre.');
      return;
    }

    updateUser.mutate({ userId: user._id, data: changed }, { onSuccess: onClose });
  };

  const avatar = user?.avatarUrl || DEFAULT_AVATAR;

  return (
    <div className="fixed inset-0 z-1000" role="dialog" aria-modal="true" aria-label="Rediger profil">
      <button
        type="button"
        aria-label="Lukk"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[#0B0B0B]/35"
      />

      {/* Right drawer on desktop, full-height sheet on phones — the same shape as the
          listing filters, so the app has one "panel over the page" idiom. */}
      <div
        ref={panelRef}
        className="animate-in slide-in-from-right absolute right-0 top-0 flex h-full w-full max-w-125 flex-col bg-[#F4F6F0] shadow-[0_0_60px_rgba(11,11,11,0.25)] duration-200"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E6E7E1] bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
              Rediger profil
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-[#63665F]">Endringene vises med én gang.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#63665F] transition-colors hover:bg-[#F0F1EB] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <Section id="avatar" title="Profilbilde">
            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt=""
                className="size-16 shrink-0 rounded-full border border-[#E6E7E1] object-cover"
              />
              <div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={updateUser.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-50"
                >
                  <Camera size={15} strokeWidth={2.2} />
                  Bytt bilde
                </button>
                <p className="mt-1.5 text-[0.75rem] text-[#9B9E96]">JPG eller PNG, opptil 5 MB.</p>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              className="hidden"
            />
          </Section>

          <Section id="identity" title={isCompany ? 'Navn og firma' : 'Navn'}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="edit-first-name">
                  Fornavn
                </label>
                <input
                  id="edit-first-name"
                  className={FIELD}
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="edit-last-name">
                  Etternavn
                </label>
                <input
                  id="edit-last-name"
                  className={FIELD}
                  value={draft.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
              </div>
            </div>

            {isCompany && (
              <>
                <div>
                  <label className={LABEL} htmlFor="edit-company">
                    Firmanavn
                  </label>
                  <input
                    id="edit-company"
                    className={FIELD}
                    value={draft.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL} htmlFor="edit-org">
                      Org.nr
                    </label>
                    <input
                      id="edit-org"
                      inputMode="numeric"
                      className={FIELD}
                      value={draft.orgNumber}
                      onChange={(e) => set('orgNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="edit-website">
                      Nettside
                    </label>
                    <input
                      id="edit-website"
                      className={FIELD}
                      placeholder="https://"
                      value={draft.website}
                      onChange={(e) => set('website', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </Section>

          <Section
            id="bio"
            title={isCompany ? 'Om oss' : 'Om meg'}
            hint="To–tre setninger om hva du gjør og hva folk kan forvente."
          >
            <div>
              <textarea
                rows={6}
                maxLength={BIO_LIMIT}
                className={`${FIELD} resize-none leading-relaxed`}
                placeholder="Jeg har malt hus i Oslo-området i ti år …"
                value={draft.bio}
                onChange={(e) => set('bio', e.target.value)}
              />
              <p className="mt-1.5 text-right text-[0.75rem] tabular-nums text-[#9B9E96]">
                {draft.bio.length} / {BIO_LIMIT}
              </p>
            </div>
          </Section>

          <Section id="skills" title="Ferdigheter" hint="Det du kan ta oppdrag innen.">
            {draft.skills.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {draft.skills.map((skill) => (
                  <li key={skill}>
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#EAF1E9] pl-3.5 pr-1.5 text-[0.8125rem] font-medium text-[#2E6641]">
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Fjern ${skill}`}
                        className="flex size-6 items-center justify-center rounded-full text-[#2E6641] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/30"
                      >
                        <X size={13} strokeWidth={2.6} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                className={FIELD}
                placeholder="Skriv en ferdighet og trykk Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                disabled={!skillInput.trim()}
                aria-label="Legg til ferdighet"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#2E6641] text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 disabled:opacity-40"
              >
                <Plus size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.filter(
                (s) => !draft.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addSkill(suggestion)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-[#D4D6CD] px-3 text-[0.75rem] font-medium text-[#63665F] transition-colors hover:border-[#2E6641] hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
                >
                  <Plus size={12} strokeWidth={2.6} />
                  {suggestion}
                </button>
              ))}
            </div>
          </Section>

          <Section
            id="availability"
            title="Tilgjengelighet"
            hint="Når du vanligvis kan ta oppdrag. Vises på profilen din."
          >
            <input
              className={FIELD}
              placeholder="F.eks. hverdager etter 16 og helger"
              value={draft.availabilityText}
              onChange={(e) => set('availabilityText', e.target.value)}
            />
          </Section>

          <Section id="place" title="Sted" hint="Brukes for å vise deg oppdrag i nærheten.">
            <div>
              <label className={LABEL} htmlFor="edit-address">
                Adresse
              </label>
              <input
                id="edit-address"
                className={FIELD}
                value={draft.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <div>
                <label className={LABEL} htmlFor="edit-postnr">
                  Postnr.
                </label>
                <input
                  id="edit-postnr"
                  inputMode="numeric"
                  className={FIELD}
                  value={draft.postNumber}
                  onChange={(e) => set('postNumber', e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="edit-poststed">
                  Poststed
                </label>
                <input
                  id="edit-poststed"
                  className={FIELD}
                  value={draft.postSted}
                  onChange={(e) => set('postSted', e.target.value)}
                />
              </div>
            </div>
          </Section>

          <div className="border-t border-[#E6E7E1] px-5 py-5">
            <Link
              to="/settings"
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl border border-[#E6E7E1] bg-[#F4F6F0]! px-4 py-3.5 transition-colors hover:border-[#2E6641]/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2E6641]">
                <Settings2 size={16} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.875rem] font-semibold text-[#0B0B0B]">
                  Konto og innstillinger
                </span>
                <span className="block text-[0.8125rem] text-[#63665F]">
                  E-post, passord, utbetalinger og varsler
                </span>
              </span>
            </Link>
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-[#E6E7E1] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11.5 flex-1 rounded-full border border-[#E6E7E1] bg-white text-[0.9375rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#D4D6CD] hover:bg-[#FAFBF7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateUser.isPending}
            className="flex h-11.5 flex-1 items-center justify-center gap-2 rounded-full bg-[#2E6641] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20 disabled:opacity-60"
          >
            {updateUser.isPending && <Loader2 size={16} className="animate-spin" />}
            {updateUser.isPending ? 'Lagrer …' : 'Lagre'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default EditProfileSheet;
