import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { CheckCheck } from "lucide-react";

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
import { NotificationItem } from "../../components/Notifications/NotificationItem";
import { NotificationTabs } from "../../components/Notifications/NotificationTabs";

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

  const tabs = [
    { id: "Alle", label: "Alle" },
    {
      id: "Uleste",
      label: `Uleste${unreadCountData?.count ? ` (${unreadCountData.count})` : ""}`,
    },
  ];

  // --- Handlers ---

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync(id);
      toast.success("Markert som lest");
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

  return (
    <div className="max-w-300 mx-auto px-4 md:px-0 pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-[#101828] text-3xl md:text-[40px] font-bold">
          Varsler
        </h1>

        {unreadCountData?.count !== undefined && unreadCountData.count >= 5 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 text-[16px] text-[#2F7E47] font-bold hover:opacity-70 transition-opacity"
          >
            <CheckCheck size={20} />
            Mark alle som lest
          </button>
        )}
      </div>

      {/* Tabs Section */}
      <NotificationTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content Section */}
      {isNotificationsLoading ? (
        <NotificationSkeleton />
      ) : (
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-20 bg-white/50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">
                {activeTab === "Alle"
                  ? "Ingen nyheter ennå"
                  : "Ingen uleste varsler"}
              </p>
            </div>
          ) : (
            <div className="bg-[#FFFFFF1A] shadow-sm p-2 md:p-6 rounded-2xl border border-gray-100/50">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  alert={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  onNavigate={navigate}
                />
              ))}
            </div>
          )}

          {/* Pagination Section */}
          {hasNextPage && (
            <div className="flex justify-center w-full mt-10">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-10 py-3.5 border-2 border-[#2F7E47] text-[#2F7E47] rounded-2xl font-bold hover:bg-[#2F7E47] hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingNextPage ? "Laster..." : "Se mer"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
