import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  Check,
  Trash2,
  Bell,
  ClipboardCheck,
  MessageSquare,
  Banknote,
  Star,
  Briefcase,
  Loader2,
} from 'lucide-react';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
  useUnreadCount,
} from '../../features/notifications/hooks';
import {
  formatNotificationTime,
  notificationMeta,
  useOpenNotification,
} from '../../features/notifications/presentation';
import type { AlertType } from '../../features/notifications/types';
import { NotificationSkeleton } from '../../components/Loading/NotificationSkeleton';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { BackLink } from '../../components/Ui/BackLink';
import { MICRO_LABEL } from '../../theme/brand';

/**
 * The notifications page.
 *
 * Everything used to live inside one `<Select>`: the six category filters, the
 * unread toggle, "marker alle som lest" *and* "slett alle varsler" — filters and
 * irreversible actions in the same anonymous menu, where picking the wrong line by one
 * row wiped the lot. Filters are chips on the surface now, and the destructive action is
 * separated out where it can be seen before it is pressed.
 *
 * The icon map, the label map, the relative-time formatter and the click routing all
 * moved to `features/notifications/presentation` so this page and the header dropdown
 * cannot drift apart.
 */

const CATEGORIES = [
  { key: 'all', label: 'Alle', Icon: Bell },
  { key: 'application', label: 'Søknader', Icon: Briefcase },
  { key: 'payment', label: 'Betalinger', Icon: Banknote },
  { key: 'message', label: 'Meldinger', Icon: MessageSquare },
  { key: 'review', label: 'Anmeldelser', Icon: Star },
  { key: 'job_update', label: 'Jobber', Icon: ClipboardCheck },
];

const CHIP_BASE =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15';
const CHIP_ON = 'border-[#2E6641] bg-[#2E6641] text-white';
const CHIP_OFF = 'border-[#E6E7E1] bg-white text-[#63665F] hover:border-[#2E6641]/45 hover:text-[#2E6641]';

const ROW_ACTION =
  'flex size-8 items-center justify-center rounded-full text-[#9B9E96] transition-colors hover:bg-white hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25';

export default function Alert() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useNotifications(
    activeCategory === 'all' ? undefined : activeCategory
  );
  const { data: unreadCountData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllMutation = useMarkAllAsRead();
  const deleteMutation = useDeleteNotification();
  const deleteAllMutation = useDeleteAllNotifications();
  const openNotification = useOpenNotification();

  const all: AlertType[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p: any) => (Array.isArray(p) ? p : p?.data || []));
  }, [data]);

  const filtered = useMemo(
    () => (showUnreadOnly ? all.filter((a) => !a.read) : all),
    [all, showUnreadOnly]
  );
  const unreadCount = (unreadCountData as { count?: number } | undefined)?.count || 0;

  const handleMarkAll = () =>
    markAllMutation
      .mutateAsync()
      .then(() => toast.success('Alle varsler er merket som lest.'))
      .catch((err) => toast.error(getErrorMessage(err, 'Kunne ikke merke varslene som lest.')));

  // These two used to await with no catch: on failure the promise rejected
  // unhandled, the confirm dialog never closed, and the user saw nothing at all.
  const handleDeleteAll = async () => {
    try {
      await deleteAllMutation.mutateAsync();
      toast.success('Alle varsler er slettet.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kunne ikke slette varslene.'));
    } finally {
      setShowDeleteAllConfirm(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      toast.success('Varselet er slettet.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kunne ikke slette varselet.'));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const hasFilter = showUnreadOnly || activeCategory !== 'all';

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <BackLink fallback="/home" />

        <header className="mb-6 mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={MICRO_LABEL}>Varsler</p>
            <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
              {unreadCount > 0 ? `${unreadCount} uleste varsler` : 'Alt er lest'}
            </h1>
            <p className="mt-1.5 text-[0.9375rem] text-[#63665F]">
              Alt som skjer med oppdragene dine, samlet her.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markAllMutation.isPending}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.875rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 disabled:opacity-50"
            >
              <Check size={15} strokeWidth={2.4} />
              Merk alle som lest
            </button>
          )}
        </header>

        {/* Filters, on the surface instead of buried in a menu */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {CATEGORIES.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`${CHIP_BASE} ${activeCategory === key ? CHIP_ON : CHIP_OFF}`}
            >
              <Icon size={14} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            aria-pressed={showUnreadOnly}
            className={`${CHIP_BASE} ${showUnreadOnly ? CHIP_ON : CHIP_OFF}`}
          >
            Kun uleste
          </button>
          {hasFilter && (
            <button
              onClick={() => {
                setShowUnreadOnly(false);
                setActiveCategory('all');
              }}
              className="text-[0.8125rem] font-semibold text-[#63665F] underline-offset-[3px] transition-colors hover:text-[#0B0B0B] hover:underline"
            >
              Nullstill
            </button>
          )}
          {all.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="ml-auto text-[0.8125rem] font-medium text-[#9B9E96] transition-colors hover:text-[#B4453A]"
            >
              Slett alle
            </button>
          )}
        </div>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {isLoading ? (
          <NotificationSkeleton />
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-[#E6E7E1] bg-white p-12 text-center">
            <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
              <Bell size={20} strokeWidth={2} />
            </span>
            <p className="text-[1.0625rem] font-semibold text-[#0B0B0B]">
              {hasFilter ? 'Ingen treff' : 'Ingen varsler ennå'}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[0.875rem] leading-relaxed text-[#63665F]">
              {hasFilter
                ? 'Prøv en annen kategori, eller nullstill filtrene.'
                : 'Du får beskjed her når noen søker på oppdraget ditt, betaler eller sender melding.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((n) => {
              const { label, Icon } = notificationMeta(n.type);
              const isUnread = !n.read;

              return (
                <li key={n._id}>
                  {/* The whole row opens the notification. It used to be a 24 px "Se"
                      pill at the far end — the smallest target on a row the width of
                      the page. */}
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => openNotification(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openNotification(n);
                      }
                    }}
                    className={`group flex cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${isUnread
                      ? 'border-[#2E6641]/30 bg-white'
                      : 'border-[#E6E7E1] bg-white hover:border-[#2E6641]/30'
                      }`}
                  >
                    <span className="shrink-0">
                      {n.senderId?.avatarUrl ? (
                        <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
                          <img src={n.senderId.avatarUrl} alt="" className="size-full object-cover" />
                        </span>
                      ) : (
                        <span
                          className={`flex size-10 items-center justify-center rounded-xl ${isUnread ? 'bg-[#EAF1E9] text-[#2E6641]' : 'bg-[#F4F6F0] text-[#9B9E96]'
                            }`}
                        >
                          <Icon size={16} strokeWidth={2} />
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                          {label}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9B9E96]">
                          {formatNotificationTime(n.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-[0.875rem] leading-relaxed ${isUnread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'
                          }`}
                      >
                        {n.content}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      {isUnread && (
                        <>
                          <span
                            aria-label="Ulest"
                            className="mr-1 size-2 rounded-full bg-[#2E6641] group-hover:hidden group-focus-within:hidden"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReadMutation.mutate(n._id);
                            }}
                            title="Merk som lest"
                            aria-label="Merk som lest"
                            className={`${ROW_ACTION} hidden group-hover:flex group-focus-within:flex`}
                          >
                            <Check size={14} strokeWidth={2.4} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetId(n._id);
                        }}
                        title="Slett"
                        aria-label="Slett varselet"
                        className={`${ROW_ACTION} opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100`}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasNextPage && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-6 text-[0.9375rem] font-semibold text-[#0B0B0B] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] disabled:opacity-50"
            >
              {isFetchingNextPage && <Loader2 size={15} className="animate-spin" />}
              {isFetchingNextPage ? 'Laster…' : 'Se flere'}
            </button>
          </div>
        )}

        <ConfirmDialog
          title="Slett alle varsler?"
          description="Er du sikker på at du vil slette alle varsler? Denne handlingen kan ikke angres."
          confirmText="Ja, slett alle"
          cancelText="Avbryt"
          variant="destructive"
          onConfirm={handleDeleteAll}
          isOpen={showDeleteAllConfirm}
          onOpenChange={setShowDeleteAllConfirm}
        />

        <ConfirmDialog
          title="Slett varsel?"
          description="Er du sikker på at du vil slette dette varselet?"
          confirmText="Slett"
          cancelText="Avbryt"
          variant="destructive"
          onConfirm={handleDeleteSingle}
          isOpen={!!deleteTargetId}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
        />
      </div>
    </div>
  );
}
