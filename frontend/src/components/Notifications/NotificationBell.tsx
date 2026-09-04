import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ArrowRight } from 'lucide-react';
import {
  useNotifications,
  useUnreadCount,
  useMarkAllAsRead,
} from '../../features/notifications/hooks';
import {
  formatNotificationTime,
  notificationMeta,
  useOpenNotification,
} from '../../features/notifications/presentation';
import type { AlertType } from '../../features/notifications/types';

/**
 * The bell in the header, and the panel it opens.
 *
 * The bell used to be a plain link to /alerts, so glancing at "do I have anything?" cost
 * a full page navigation away from whatever you were doing. The panel answers it in
 * place and keeps the page as the destination for actually working through them.
 *
 * Only the six most recent are shown. A dropdown that scrolls to forty items is a page
 * wearing a costume — past a handful the right answer is "Se alle varsler".
 */

/** How many notifications the panel shows before deferring to the full page. */
const PREVIEW_COUNT = 6;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadCount();
  const unreadCount: number = (unreadData as { count?: number } | undefined)?.count || 0;

  // Only fetched once the panel has been opened — the bell itself runs on the unread
  // count alone, which every page already polls.
  const [hasOpened, setHasOpened] = useState(false);
  const { data, isLoading } = useNotifications();
  const markAllAsRead = useMarkAllAsRead();
  const openNotification = useOpenNotification();

  const notifications: AlertType[] = useMemo(() => {
    if (!hasOpened || !data?.pages) return [];
    return data.pages
      .flatMap((page: any) => (Array.isArray(page) ? page : page?.data || []))
      .slice(0, PREVIEW_COUNT);
  }, [data, hasOpened]);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // 'default' means the user has neither granted nor denied. Re-asking after a denial is
  // both useless (browsers remember) and obnoxious, so the prompt only appears once.
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const canAskPermission = open && permission === 'default';

  const askPermission = async () => {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission('denied');
    }
  };

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Varsler, ${unreadCount} uleste` : 'Varsler'}
        className={`relative flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${open ? 'bg-[#F0F1EB] text-[#0B0B0B]' : 'text-[#63665F] hover:bg-[#F0F1EB] hover:text-[#0B0B0B]'
          }`}
      >
        <Bell size={19} strokeWidth={2} />
        {unreadCount > 0 && (
          // Was a red dot — the only red on the site, for something that is not an error.
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-[#2E6641] px-1 text-[0.625rem] font-bold leading-4 text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Varsler"
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-100 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white shadow-[0_24px_60px_rgba(11,11,11,0.14)] duration-150"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#E6E7E1] px-4 py-3.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
                Varsler
              </h2>
              {unreadCount > 0 && (
                <span className="text-[0.75rem] font-medium text-[#63665F]">
                  {unreadCount} {unreadCount === 1 ? 'ulest' : 'uleste'}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="inline-flex items-center gap-1 rounded-full text-[0.75rem] font-semibold text-[#2E6641] transition-colors hover:text-[#347028] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 disabled:opacity-50"
              >
                <Check size={12} strokeWidth={2.6} />
                Merk alle
              </button>
            )}
          </div>

          {/* Asking for system-notification permission, at the only moment it makes sense.
              The request lived on a settings page nobody visits, so in practice the app had
              permission from almost no one and the `document.hidden` branch that shows a
              system notification could never fire. Browsers also require a user gesture,
              which opening this panel is. Hidden on iOS Safari, where `Notification` does
              not exist outside an installed PWA — there the in-app toast is the channel. */}
          {canAskPermission && (
            <div className="flex items-center gap-3 border-b border-[#E6E7E1] bg-[#F4F6F0] px-4 py-3">
              <span className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-[#63665F]">
                Få varsler også når Jobblo ikke er åpent.
              </span>
              <button
                type="button"
                onClick={askPermission}
                className="shrink-0 rounded-full bg-[#2E6641] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25"
              >
                Slå på
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="jb-skeleton size-9 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="jb-skeleton h-3 w-3/4 rounded" />
                      <div className="jb-skeleton h-3 w-1/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
                  <Bell size={19} strokeWidth={2} />
                </span>
                <p className="text-[0.875rem] font-semibold text-[#0B0B0B]">Ingen varsler</p>
                <p className="mx-auto mt-1 max-w-56 text-[0.8125rem] leading-relaxed text-[#63665F]">
                  Du får beskjed her når noe skjer med oppdragene dine.
                </p>
              </div>
            ) : (
              <ul className="p-1.5">
                {notifications.map((notification) => {
                  const { label, Icon } = notificationMeta(notification.type);
                  const isUnread = !notification.read;

                  return (
                    <li key={notification._id}>
                      <button
                        type="button"
                        onClick={() => openNotification(notification, () => setOpen(false))}
                        className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-[#F4F6F0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isUnread
                            ? 'bg-[#EAF1E9] text-[#2E6641]'
                            : 'bg-[#F4F6F0] text-[#9B9E96]'
                            }`}
                        >
                          <Icon size={15} strokeWidth={2} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[#9B9E96]">
                              {label}
                            </span>
                            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#9B9E96]">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </span>
                          <span
                            className={`mt-0.5 line-clamp-2 block text-[0.8125rem] leading-relaxed ${isUnread ? 'font-medium text-[#0B0B0B]' : 'text-[#63665F]'
                              }`}
                          >
                            {notification.content}
                          </span>
                        </span>

                        {isUnread && (
                          <span
                            aria-label="Ulest"
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-[#2E6641]"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-[#E6E7E1] bg-[#F4F6F0]! px-4 py-3.5 text-[0.875rem] font-semibold text-[#2E6641]! transition-colors hover:bg-[#EAF1E9]! focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
          >
            Se alle varsler
            <ArrowRight size={14} strokeWidth={2.4} />
          </Link>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
