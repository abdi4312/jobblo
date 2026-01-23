import { useState, useEffect } from "react";
import { useUserStore } from "../../stores/userStore";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { getNotifications } from "../../api/notificationAPI.ts";

interface Alert {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  } | null; 
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Alert() {
  const [activeTab, setActiveTab] = useState("nyheter");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const user = useUserStore((state) => state.user);
  const userId = user?._id;

  const tabs = [
    { id: "nyheter", label: "Nyheter" },
    { id: "lagrede", label: "Lagrede" },
  ];

  const fetchAlerts = async (pageNum: number, isInitial: boolean = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      if (isInitial) setLoading(true);
      
      const response = await getNotifications(userId, pageNum);
      
      // Backend ab { data: [...], totalPages: X } bhej raha hai
      const newNotifications = response.data; 
      
      if (isInitial) {
        setAlerts(newNotifications);
      } else {
        setAlerts((prev) => [...prev, ...newNotifications]);
      }

      // Check if there are more pages
      setHasMore(pageNum < response.totalPages);
    } catch (error) {
      console.error("Error fetching:", error);
      alert("Kunne ikke hente varsler");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1); // Reset page on user change
    void fetchAlerts(1, true);
  }, [userId]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchAlerts(nextPage);
  };

  const nyheter = alerts.filter((alert) => !alert.read);
  const lagrede = alerts.filter((alert) => alert.read);

  const renderAlerts = (data: Alert[]) => (
    data.map((alert) => (
      <div
        key={alert._id}
        style={{
          backgroundColor: alert.read ? "var(--color-surface)" : "var(--color-white)",
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "10px",
          border: alert.read ? "none" : "2px solid var(--color-muted-gray)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <strong style={{ color: !alert.userId ? "var(--color-primary)" : "inherit" }}>
            {alert.userId?.name || "📢 System"}
          </strong>
          <span style={{ fontSize: "12px", color: "var(--color-icon)" }}>
            {new Date(alert.createdAt).toLocaleDateString("no-NO", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p style={{ margin: 0 }}>{alert.content}</p>
        <div style={{ marginTop: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: "bold", textTransform: "uppercase" }}>
              {alert.type.replace('_', ' ')}
            </span>
        </div>
      </div>
    ))
  );

  return (
    <>
      <div style={{ padding: "20px 30px", maxWidth: "800px", margin: "0 auto" }}>
        <ProfileTitleWrapper title="Varslinger" buttonText="Tilbake" />

        {/* Tab Headers */}
        <div style={{ backgroundColor: "var(--color-surface)", display: "flex", justifyContent: "space-around", borderRadius: "16px", marginBottom: "20px" }}>
          {tabs.map((tab) => (
            <h4
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                cursor: "pointer",
                color: activeTab === tab.id ? "var(--color-white)" : "var(--color-text)",
                backgroundColor: activeTab === tab.id ? "var(--color-primary)" : "var(--color-surface)",
                padding: "10px 20px",
                borderRadius: "8px",
                margin: "8px",
                flex: 1,
                textAlign: "center",
              }}
            >
              {tab.label}
            </h4>
          ))}
        </div>

        {/* Tab Content */}
        {loading && page === 1 ? (
          <p>Laster varsler...</p>
        ) : (
          <div>
            {activeTab === "nyheter" ? (
              nyheter.length === 0 ? <p>Ingen nyheter ennå</p> : renderAlerts(nyheter)
            ) : (
              lagrede.length === 0 ? <p>Ingen lagrede varsler</p> : renderAlerts(lagrede)
            )}

            {/* LOAD MORE BUTTON */}
            {hasMore && (
              <button
                onClick={loadMore}
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "10px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-primary)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {loading ? "Laster..." : "Se mer"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}