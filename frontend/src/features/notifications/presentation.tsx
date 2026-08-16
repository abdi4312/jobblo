import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Banknote,
  Briefcase,
  ClipboardCheck,
  MessageSquare,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { resolveOrderRoute } from '../../utils/orderRoute';
import { useMarkAsRead } from './hooks';
import { useUserStore } from '../../stores/userStore';
import type { AlertType } from './types';

/**
 * How a notification looks and where it goes — in one place.
 *
 * The alerts page owned all of this inline. Adding the header dropdown would have meant a
 * second copy of the icon map, the label map, the relative-time formatter *and* the
 * routing rules, which is exactly how the two end up disagreeing about what a
 * "job_update" is called or which page a payment notification opens.
 */

export interface NotificationMeta {
  label: string;
  Icon: LucideIcon;
}

const META: Record<string, NotificationMeta> = {
  ordre: { label: 'Bestilling', Icon: Banknote },
  order: { label: 'Bestilling', Icon: Banknote },
  payment: { label: 'Betaling', Icon: Banknote },
  application: { label: 'Søknad', Icon: Briefcase },
  message: { label: 'Melding', Icon: MessageSquare },
  review: { label: 'Anmeldelse', Icon: Star },
  job_update: { label: 'Jobboppdatering', Icon: ClipboardCheck },
};

export const notificationMeta = (type: string): NotificationMeta =>
  META[type] || { label: 'Varsel', Icon: ClipboardCheck };

/** "Nå", "12 min", "3 t", "2 d", then an actual date. */
export const formatNotificationTime = (date: string): string => {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Nå';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} t`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} d`;
  return new Date(date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
};

/**
 * Opening a notification: mark it read, then go where it points.
 *
 * The order branch runs through `resolveOrderRoute` rather than hard-coding a path —
 * a customer told "Din forespørsel er godkjent" belongs on their checkout, not on the
 * provider's work page.
 */
export function useOpenNotification() {
  const navigate = useNavigate();
  const markAsRead = useMarkAsRead();
  const userId = useUserStore((state) => state.user?._id);

  return (notification: AlertType, onNavigated?: () => void) => {
    if (!notification.read) {
      // Navigation matters more than the read flag, so a failure here is swallowed.
      markAsRead.mutateAsync(notification._id).catch(() => {});
    }

    const go = (path: string) => {
      navigate(path);
      onNavigated?.();
    };

    if (notification.orderId) {
      const route = resolveOrderRoute(notification.orderId, userId);
      // Null when the order was deleted (populate returns null) or when we cannot tell
      // which side the viewer is on — previously this produced `/provider/orders/null`.
      if (route) go(route);
      else toast.error('Denne ordren er ikke tilgjengelig lenger.');
      return;
    }

    if (notification.requestId) {
      const request = notification.requestId as { serviceId?: string | { _id?: string } };
      const serviceId =
        typeof request.serviceId === 'object' ? request.serviceId?._id : request.serviceId;
      if (serviceId) go(`/job-applicants/${serviceId}`);
      else onNavigated?.();
      return;
    }

    if (notification.senderId?._id) {
      go(`/profile/${notification.senderId._id}`);
      return;
    }

    onNavigated?.();
  };
}
