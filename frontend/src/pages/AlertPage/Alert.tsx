import { useState, useEffect, useCallback, useMemo } from "react";
import { useUserStore } from "../../stores/userStore";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { getNotifications } from "../../api/notificationAPI.ts";

export default function Alert() {
  const [activeTab, setActiveTab] = useState("nyheter");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const user = useUserStore((state) => state.user);
  const userId = user?._id;

  const tabs = [
    { id: "nyheter", label: "Nyheter" },
    { id: "lagrede", label: "Lagrede" },
  ];

  const fetchAlerts = useCallback(async (pageNum: number, isInitial: boolean = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setMoreLoading(true);
      }

      const response = await getNotifications(userId, pageNum);
      
      setAlerts((prev) => (isInitial ? response.data : [...prev, ...response.data]));
      setHasMore(pageNum < response.totalPages);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setMoreLoading(false);
    }
  }, [userId]);

  // Initial Load
  useEffect(() => {
    setPage(1);
    fetchAlerts(1, true);
  }, [userId, fetchAlerts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchAlerts(nextPage, false);
  };

  // Memoized filtered data to prevent re-filtering on every render
  const filteredData = useMemo(() => {
    return activeTab === "nyheter" 
      ? alerts.filter(a => !a.read) 
      : alerts.filter(a => a.read);
  }, [alerts, activeTab]);

  return (
    <div className="py-8 px-4 md:px-8 max-w-[800px] mx-auto min-h-screen bg-[var(--color-bg)]">
      <ProfileTitleWrapper title="Varslinger" buttonText="Tilbake" />

      {/* Tabs */}
      <div className="bg-[var(--color-surface)] flex p-1.5 rounded-2xl mb-8 border border-[var(--color-muted-gray)] shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all duration-300 transform-gpu ${
              activeTab === tab.id 
                ? "bg-[var(--color-primary)] text-white shadow-md scale-[1.01]" 
                : "text-[var(--color-text)] hover:bg-white/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && page === 1 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-icon)] animate-pulse font-medium">Laster varsler...</p>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-500">
          {filteredData.length === 0 ? (
            <div className="text-center py-20 opacity-60">
              <span className="material-symbols-outlined text-5xl mb-2">notifications_off</span>
              <p className="italic">Ingen {activeTab === "nyheter" ? "nye" : "lagrede"} varsler</p>
            </div>
          ) : (
            filteredData.map((alert) => (
              <div
                key={alert._id}
                className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg transform-gpu ${
                  alert.read 
                    ? "bg-[var(--color-surface)] border-transparent opacity-75" 
                    : "bg-white border-[var(--color-muted-gray)] shadow-sm hover:border-[var(--color-primary)]"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {!alert.read && <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />}
                    <strong className="text-[var(--color-accent)] font-extrabold tracking-tight">
                      {alert.userId?.name || "📢 System"}
                    </strong>
                  </div>
                  <span className="text-[12px] font-bold text-[var(--color-icon)] opacity-60">
                    {new Date(alert.createdAt).toLocaleDateString("no-NO", {
                      day: "numeric", month: "short"
                    })}
                  </span>
                </div>
                
                <p className="text-[var(--color-text-strong)] leading-relaxed mb-3">
                  {alert.content}
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] bg-[var(--color-bg)] text-[var(--color-primary)] px-2 py-1 rounded-md border border-[var(--color-muted-gray)]">
                    {alert.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}

          {hasMore && (
            <button
              disabled={moreLoading}
              onClick={handleLoadMore}
              className="w-full py-4 mt-6 bg-transparent border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-2xl font-black transition-all hover:bg-[var(--color-primary)] hover:text-white active:scale-[0.98] disabled:opacity-50"
            >
              {moreLoading ? "Laster..." : "SE MER"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}