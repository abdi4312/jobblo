import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ban,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  MapPin,
  MoreHorizontal,
  Pencil,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../../stores/userStore';
import { useBlockUser, useUpdateUser } from '../../../features/profile/hooks';
import { BlockModal } from './BlockModal';
import ConfirmDialog from '../../Ui/ConfirmDialog';
import { DEFAULT_AVATAR } from '../../../constants/assets';
import type { User } from '../../../types/userTypes';
import type { EditSection } from '../EditProfileSheet';

/**
 * The identity card at the top of a profile.
 *
 * There were two of these — a 150-line company branch and a 155-line person branch that
 * had drifted apart: different avatar sizes, different edit targets, a "Rediger" button
 * that went to `/settings` on one and `/settings/bio` on the other, and a block modal
 * mounted in the person branch that nothing could open. They are one component now, with
 * the company-only fields behind a flag.
 *
 * The stat rail is the substantive change. The API already computes `responseRate`,
 * `averageResponseTimeMinutes`, `completionRate` and `hireRate` on every profile fetch
 * (`getUserById`) and the page threw all of it away to show three numbers, one of which
 * was a rating printed as a bare "0.0". On a marketplace those four are the only things a
 * stranger actually wants to know before hiring you.
 */

/** `postSted` is a string on the model but arrives as an object on some payloads. */
const text = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const city = (value as { city?: string; address?: string }).city;
    if (typeof city === 'string') return city;
  }
  return '';
};

/** 0–59 → "under 1 t", 60–1439 → "3 t", beyond → "2 d". */
const formatResponseTime = (minutes: number): string => {
  if (minutes < 60) return 'under 1 t';
  if (minutes < 1440) return `${Math.round(minutes / 60)} t`;
  return `${Math.round(minutes / 1440)} d`;
};

interface Fact {
  label: string;
  value: string;
  icon: typeof Star;
  /** The rating is the one figure people look for; it gets the green. */
  accent?: boolean;
}

export function ProfileHeader({
  user,
  handlelogout,
  isOwnProfile = true,
  profileType = 'seeker',
  onEdit,
}: {
  user: (User & Record<string, any>) | null;
  handlelogout: () => void;
  isOwnProfile?: boolean;
  profileType?: 'seeker' | 'poster';
  onEdit?: (section?: EditSection) => void;
}) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const blockMutation = useBlockUser();
  const updateUser = useUpdateUser();
  const currentUser = useUserStore((state) => state.user);

  const isCompany = user?.role === 'company';
  const isBlockedByMe = currentUser?.blockedUsers?.some(
    (id) => (typeof id === 'string' ? id : id._id)?.toString() === user?._id
  );

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isMenuOpen]);

  const handleUnblock = () => {
    if (!user?._id) return;
    blockMutation.mutate(user._id, {
      onSuccess: () => {
        setIsUnblockModalOpen(false);
        toast.success('Bruker opphevet blokkering');
      },
    });
  };

  /** Changing your picture is a file picker, not a trip to `/settings/picture`. */
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

  const fullName = isCompany
    ? user?.companyName || user?.name
    : `${user?.name || ''} ${user?.lastName || ''}`.trim();

  const place = text(user?.postSted) || text(user?.address);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
    : null;

  /**
   * The fact row.
   *
   * This was a four-column grid with hairline dividers, and it was almost always wrong.
   * A profile with one figure to its name drew that figure and three empty white cells —
   * a grey-ruled strip with nothing in it, which is what it looked like. And the one
   * figure a new account *did* have was "Svarprosent 100 %", because the API returns 100
   * when nobody has ever sent you a request.
   *
   * Chips instead of cells: the row is as wide as it has things to say, so one fact looks
   * deliberate and five wrap cleanly. Every entry is gated on the data that would make it
   * true, and when there is genuinely nothing yet it says so rather than drawing a frame
   * around the absence.
   */
  const facts: Fact[] = [];

  if (user?.reviewCount) {
    facts.push({
      icon: Star,
      value: Number(user.averageRating ?? 0).toFixed(1),
      label: `${user.reviewCount} ${user.reviewCount === 1 ? 'vurdering' : 'vurderinger'}`,
      accent: true,
    });
  }
  if (profileType === 'seeker' && user?.completedJobs) {
    facts.push({ icon: CheckCircle2, value: String(user.completedJobs), label: 'fullførte' });
  }
  if (profileType === 'poster' && user?.postedJobsCount) {
    facts.push({ icon: Briefcase, value: String(user.postedJobsCount), label: 'lagt ut' });
  }
  // Gated on the denominator, not the rate: "answers everyone" and "has never been asked"
  // both come back as 100.
  if (user?.totalJobRequests > 0 && typeof user?.responseRate === 'number') {
    facts.push({ icon: Zap, value: `${user.responseRate} %`, label: 'svarer' });
  }
  if (typeof user?.averageResponseTimeMinutes === 'number' && user.averageResponseTimeMinutes > 0) {
    facts.push({
      icon: Clock,
      value: formatResponseTime(user.averageResponseTimeMinutes),
      label: 'svartid',
    });
  }
  if (user?.verified) {
    facts.push({ icon: ShieldCheck, value: 'Verifisert', label: '', accent: true });
  }
  if (facts.length === 0) {
    facts.push({
      icon: Sparkles,
      value: 'Ny på Jobblo',
      label: memberSince ? `siden ${memberSince}` : '',
    });
  }

  return (
    <div className="relative z-10 -mt-14 rounded-3xl border border-[#E6E7E1] bg-white shadow-[0_18px_48px_rgba(11,11,11,0.08)] sm:-mt-18">
      {isBlockedByMe && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-t-3xl border-b border-[#E6E7E1] bg-[#FBF4F2] px-5 py-3 text-center">
          <p className="text-[0.875rem] font-medium text-[#0B0B0B]">Du har blokkert denne brukeren.</p>
          <button
            type="button"
            onClick={() => setIsUnblockModalOpen(true)}
            disabled={blockMutation.isPending}
            className="text-[0.875rem] font-semibold text-[#B4544A] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {blockMutation.isPending ? 'Opphever …' : 'Opphev blokkering'}
          </button>
        </div>
      )}

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar. On your own profile the whole thing is the upload button. */}
          <div className="relative shrink-0 self-center sm:self-start">
            <div className="size-22 overflow-hidden rounded-full border-4 border-white bg-[#EAF1E9] shadow-[0_6px_20px_rgba(11,11,11,0.12)] sm:size-27">
              <img
                src={user?.avatarUrl || DEFAULT_AVATAR}
                alt=""
                className="size-full object-cover"
              />
            </div>

            {user?.verified && (
              <span
                title="Verifisert bruker"
                className="absolute bottom-0.5 right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#2E6641] text-white"
              >
                <ShieldCheck size={13} strokeWidth={2.4} />
              </span>
            )}

            {isOwnProfile && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={updateUser.isPending}
                  aria-label="Bytt profilbilde"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0B0B0B]/45 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:opacity-100"
                >
                  <Camera size={20} strokeWidth={2} />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={uploadAvatar}
                  className="hidden"
                />
              </>
            )}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 sm:justify-start">
              <h1 className="text-[1.5rem] font-bold leading-tight tracking-[-0.03em] text-[#0B0B0B] sm:text-[1.75rem]">
                {fullName || 'Bruker'}
              </h1>
              {user?.isTrusted && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#EAF1E9] px-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[#2E6641]">
                  <ShieldCheck size={11} strokeWidth={2.6} />
                  Betrodd
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.875rem] text-[#63665F] sm:justify-start">
              {place && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} strokeWidth={2} className="text-[#9B9E96]" />
                  {place}
                </span>
              )}
              {place && memberSince && <span className="text-[#D4D6CD]">·</span>}
              {memberSince && <span>Medlem siden {memberSince}</span>}
            </div>

            {isCompany && user?.orgNumber && (
              <p className="mt-1 text-[0.8125rem] text-[#9B9E96]">Org.nr {user.orgNumber}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.('identity')}
                  className="flex h-10.5 items-center gap-2 rounded-full bg-[#2E6641] px-5 text-[0.875rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
                >
                  <Pencil size={15} strokeWidth={2.4} />
                  Rediger profil
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    aria-label="Flere valg"
                    className="flex size-10.5 items-center justify-center rounded-full border border-[#E6E7E1] bg-white text-[#63665F] transition-colors hover:border-[#D4D6CD] hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                  >
                    <MoreHorizontal size={18} strokeWidth={2.2} />
                  </button>

                  {isMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-[#E6E7E1] bg-white p-1.5 shadow-[0_20px_50px_rgba(11,11,11,0.14)]"
                    >
                      {[
                        { label: 'Mine annonser', icon: FileText, to: '/mine-annonser' },
                        { label: 'Mine søkere', icon: Users, to: '/my-applicants' },
                        { label: 'SafePay', icon: ShieldCheck, to: '/settings/safepay' },
                        { label: 'Innstillinger', icon: Settings, to: '/settings' },
                      ].map((item) => (
                        <button
                          key={item.to}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsMenuOpen(false);
                            navigate(item.to);
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.875rem] font-medium text-[#0B0B0B] transition-colors hover:bg-[#F4F6F0]"
                        >
                          <item.icon size={15} strokeWidth={2} className="text-[#63665F]" />
                          {item.label}
                        </button>
                      ))}

                      <div className="my-1.5 h-px bg-[#E6E7E1]" />

                      {/* Opens the dialog and closes the menu. The dialog itself is
                          rendered OUTSIDE this block — see below for why. */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.875rem] font-medium text-[#B4544A] transition-colors hover:bg-[#FBF4F2]"
                      >
                        <LogOut size={15} strokeWidth={2} />
                        Logg ut
                      </button>
                    </div>
                  )}

                  {/**
                   * Outside `{isMenuOpen && …}` on purpose — this is what made logging
                   * out impossible.
                   *
                   * The dialog used to live inside the menu, with the menu item as its
                   * `trigger`. AlertDialog renders through a PORTAL, so its buttons are
                   * not inside `menuRef` — and the document-level `mousedown` handler
                   * above closes the menu on any click outside that ref.
                   *
                   * So pressing "Ja, logg ut" ran: mousedown → menu closes → this whole
                   * subtree unmounts → the dialog vanishes before the click completes,
                   * and `onConfirm` never fired. The dialog flashed open and shut and
                   * nothing happened.
                   *
                   * Rendered as a sibling, it survives the menu closing. `showLogoutConfirm`
                   * was already controlled state, so nothing else needed to change.
                   */}
                  <ConfirmDialog
                    title="Logg ut?"
                    description="Vil du logge ut av Jobblo?"
                    confirmText="Ja, logg ut"
                    cancelText="Avbryt"
                    isOpen={showLogoutConfirm}
                    onOpenChange={setShowLogoutConfirm}
                    onConfirm={handlelogout}
                  />
                </div>
              </>
            ) : (
              !isBlockedByMe && (
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(true)}
                  className="flex h-10.5 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-medium text-[#63665F] transition-colors hover:border-[#B4544A]/40 hover:text-[#B4544A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                >
                  <Ban size={15} strokeWidth={2} />
                  Blokker
                </button>
              )
            )}
          </div>
        </div>

        <dl className="mt-5 flex flex-wrap justify-center gap-2 border-t border-[#E6E7E1] pt-5 sm:justify-start">
          {facts.map((fact) => (
            <div
              key={fact.value + fact.label}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 ${
                fact.accent ? 'bg-[#EAF1E9]' : 'bg-[#F4F6F0]'
              }`}
            >
              <fact.icon
                size={14}
                strokeWidth={2.2}
                className={fact.accent ? 'text-[#2E6641]' : 'text-[#9B9E96]'}
              />
              <dd className="text-[0.875rem] font-semibold tabular-nums text-[#0B0B0B]">
                {fact.value}
              </dd>
              {fact.label && <dt className="text-[0.8125rem] text-[#63665F]">{fact.label}</dt>}
            </div>
          ))}
        </dl>
      </div>

      <BlockModal
        user={user}
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={() => {
          if (!user?._id) return;
          blockMutation.mutate(user._id, {
            onSuccess: (data) => {
              setIsBlockModalOpen(false);
              toast.success(data.message || `${user?.name} er blokkert`);
            },
          });
        }}
        isPending={blockMutation.isPending}
        type="block"
      />

      <BlockModal
        user={user}
        isOpen={isUnblockModalOpen}
        onClose={() => setIsUnblockModalOpen(false)}
        onConfirm={handleUnblock}
        isPending={blockMutation.isPending}
        type="unblock"
      />
    </div>
  );
}
