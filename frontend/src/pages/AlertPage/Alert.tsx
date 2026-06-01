import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Check, Trash2, Clock, ClipboardCheck } from "lucide-react";

import { useUserStore } from "../../stores/userStore";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useUnreadCount,
} from "../../features/notifications/hooks";
import type { AlertType } from "../../features/notifications/types";
import { NotificationSkeleton } from "../../components/Loading/NotificationSkeleton";

/**
 * Alert page component - Displays user notifications with filtering and actions
 */
export default function Alert() {
  const [activeTab, setActiveTab] = useState("Alle");
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  const navigate = useNavigate();

  // --- Notification Data Hooks ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isNotificationsLoading,
  } = useNotifications(userId);

  const { data: unreadCountData } = useUnreadCount(userId);

  // --- Action Hooks ---
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();

  /**
   * Flattening TanStack Query pages into a single array of notifications
   */
  const allNotifications: AlertType[] = useMemo(() => {
    // Debug log to check data structure
    if (!data?.pages) return [];

    return data.pages.flatMap((page) => {
      // Handle both { data: [...] } and direct array responses
      if (Array.isArray(page)) return page;
      if (page && Array.isArray(page.data)) return page.data;
      return [];
    });
  }, [data]);

  /**
   * Filtered notifications based on active tab
   */
  const filteredNotifications = useMemo(() => {
    return activeTab === "Alle"
      ? allNotifications
      : allNotifications.filter((a) => !a.read);
  }, [allNotifications, activeTab]);

  // --- Handlers ---

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync(id);
    } catch (error) {
      toast.error("Kunne ikke markere som lest");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotificationMutation.mutateAsync(id);
      toast.success("Varsel slettet");
    } catch (error) {
      toast.error("Kunne ikke slette varsel");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    try {
      await markAllAsReadMutation.mutateAsync(userId);
      toast.success("Alle markert som lest");
    } catch (error) {
      toast.error("Kunne ikke markere alle som lest");
    }
  };

  // Helper to get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ordre":
      case "order":
        return <ClipboardCheck size={18} className="text-[#16a34a]" />;
      case "favoritt":
      case "favorites":
      case "favoritter":
        return <ClipboardCheck size={18} className="text-[#16a34a]" />;
      case "følger":
      case "followers":
      default:
        return <ClipboardCheck size={18} className="text-[#16a34a]" />;
    }
  };

  // Helper to get notification title based on type
  const getNotificationTitle = (type: string, alert: AlertType) => {
    switch (type) {
      case "ordre":
      case "order":
        return "Bestilling oppdatert";
      case "favoritt":
      case "favorites":
      case "favoritter":
        return "Lagt til i liste";
      case "følger":
      case "followers":
        return "Ny følger";
      default:
        return alert.type || "Varsel";
    }
  };

  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeString = date.toLocaleTimeString("no-NO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateStringNor = date.toLocaleDateString("no-NO", {
      day: "2-digit",
      month: "short",
    });

    if (diffMinutes < 1) return "Nå nettopp";
    if (diffMinutes < 60)
      return `${diffMinutes} minutter siden · ${timeString}`;
    if (diffHours < 24) return `${diffHours} timer siden · ${timeString}`;
    if (diffDays < 7)
      return `${diffDays} dager siden · ${dateStringNor} kl. ${timeString}`;
    return `Omtrent ${Math.floor(diffDays / 30)} måned(er) siden · ${dateStringNor} kl. ${timeString}`;
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <div className="max-w-170 mx-auto px-5 py-3 sm:px-6 sm:py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-medium text-[#1a1a1a]">Varsler</h1>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-black/[0.08] rounded-full p-1 w-fit mb-6">
          <button
            onClick={() => setActiveTab("Alle")}
            className={`px-5 py-1.5 text-[13px] rounded-full cursor-pointer border-none transition-all ${
              activeTab === "Alle"
                ? "bg-[#16a34a] text-white font-medium"
                : "text-[#888] hover:text-[#666]"
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => setActiveTab("Uleste")}
            className={`px-5 py-1.5 text-[13px] rounded-full cursor-pointer border-none transition-all ${
              activeTab === "Uleste"
                ? "bg-[#16a34a] text-white font-medium"
                : "text-[#888] hover:text-[#666]"
            }`}
          >
            Uleste{" "}
            {unreadCountData?.count > 0 ? `(${unreadCountData.count})` : ""}
          </button>
        </div>

        {/* Notifications List */}
        {isNotificationsLoading ? (
          <NotificationSkeleton />
        ) : (
          <div className="flex flex-col gap-[2px] bg-white border border-black/[0.08] rounded-[16px] overflow-hidden">
            {filteredNotifications.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-[#888] text-[13px]">
                  {activeTab === "Alle"
                    ? "Ingen nyheter ennå"
                    : "Ingen uleste varsler"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center gap-3.5 px-[14px] sm:px-[18px] py-4 border-b border-black/[0.05] last:border-b-0 ${
                    !notification.read ? "bg-[#f7fdf7]" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-[#f0faf0] flex items-center justify-center flex-shrink-0">
                    {notification.senderId?.avatarUrl ? (
                      <img
                        src={notification.senderId.avatarUrl}
                        alt={notification.senderId.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : notification.senderId?.name ? (
                      <span className="text-[14px] font-medium text-[#16a34a]">
                        {notification.senderId.name.slice(0, 2).toUpperCase()}
                      </span>
                    ) : (
                      getNotificationIcon(notification.type)
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="text-[13px] font-medium text-[#1a1a1a] mb-0.5">
                      {getNotificationTitle(notification.type, notification)}
                    </div>
                    <div className="text-[12px] text-[#666] mb-1.5 leading-[1.4]">
                      {notification.content}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] bg-[#f0faf0] text-[#16a34a] rounded-full px-2 py-0.5 border border-[#c6f0d8]">
                        {notification.type}
                      </span>
                      <span className="text-[11px] text-[#aaa] flex items-center gap-1">
                        <Clock size={11} />
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start mt-2 sm:mt-0">
                    {!notification.read && (
                      <div className="w-[7px] h-[7px] bg-[#16a34a] rounded-full flex-shrink-0"></div>
                    )}
                    <button
                      className="px-[14px] py-[7px] bg-[#16a34a] text-white border-none rounded-full text-[12px] cursor-pointer hover:bg-[#14532d] transition-colors whitespace-nowrap"
                      onClick={() => {
                        // Navigate based on notification type
                        if (notification.orderId) {
                          navigate(`/order/${notification.orderId._id}`);
                        } else if (notification.senderId?._id) {
                          navigate(`/profile/${notification.senderId._id}`);
                        }
                      }}
                    >
                      {notification.type === "følger" ||
                      notification.type === "favoritt"
                        ? "Se profil"
                        : "Se søknad"}
                    </button>
                    {!notification.read && (
                      <button
                        title="Markere som lest"
                        className="w-7 h-7 rounded-full border-none bg-transparent flex items-center justify-center cursor-pointer text-[#bbb] hover:bg-[#f5f0e8] hover:text-[#555] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification._id);
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      title="Slett varsel"
                      className="w-7 h-7 rounded-full border-none bg-transparent flex items-center justify-center cursor-pointer text-[#bbb] hover:bg-[#f5f0e8] hover:text-[#dc2626] transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification._id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {hasNextPage && (
          <div className="flex justify-center w-full mt-10">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-10 py-3.5 border-2 border-[#16a34a] text-[#16a34a] rounded-[16px] font-bold hover:bg-[#16a34a] hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetchingNextPage ? "Laster..." : "Se mer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
