import React, { useState, useEffect } from "react";
import { Bell, Info, AlertTriangle, Tag, Plus, X } from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";
import NotificationForm from "../../components/SuperAdminDashboard/Notifications/NotificationForm";
import NotificationHistory from "../../components/SuperAdminDashboard/Notifications/NotificationHistory";

const NotificationsPage = () => {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState({
    type: "system_update",
    content: "",
  });

  const notificationTypes = [
    {
      id: "system_update",
      label: "Update",
      icon: <Info size={16} />,
      color: "bg-blue-100 text-blue-600",
    },
    {
      id: "alert",
      label: "Alert",
      icon: <AlertTriangle size={16} />,
      color: "bg-red-100 text-red-600",
    },
    {
      id: "promotion",
      label: "Offer",
      icon: <Tag size={16} />,
      color: "bg-orange-100 text-orange-600",
    },
    {
      id: "general",
      label: "General",
      icon: <Bell size={16} />,
      color: "bg-gray-100 text-gray-600",
    },
  ];

  const fetchHistory = async (pageNum = 1) => {
    try {
      setHistoryLoading(true);
      const response = await mainLink.get(
        `/api/admin/system-history?page=${pageNum}&limit=5`,
      );
      setHistory(response.data.data);
      setTotalPages(response.data.totalPages);
      setPage(response.data.currentPage);
    } catch (error) {
      console.error("History fetch error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await Swal.fire({
      title: "Confirm Broadcast?",
      text: "This will create a single global notification for all users.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2d4a3e",
      confirmButtonText: "Yes, Send!",
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const response = await mainLink.post("/api/notifications/system", {
          ...formData,
          isSystem: true,
          userId: null,
        });
        Swal.fire({
          title: "Success!",
          text: response.data.message,
          icon: "success",
          confirmButtonColor: "#2d4a3e",
        });
        setFormData({ ...formData, content: "" });
        setShowForm(false);
        fetchHistory(1);
      } catch (error: any) {
        Swal.fire(
          "Error",
          error.response?.data?.error || "Failed to send",
          "error",
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto pb-20 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-[#2d4a3e] p-3 rounded-2xl text-white shadow-lg">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              System Notifications
            </h2>
            <p className="text-sm text-gray-400">Manage global broadcasts</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-md active:scale-95 ${
            showForm
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-[#2d4a3e] text-white hover:bg-[#1e332a]"
          }`}
        >
          {showForm ? (
            <>
              <X size={18} /> Close Form
            </>
          ) : (
            <>
              <Plus size={18} /> Create Notification
            </>
          )}
        </button>
      </div>

      {showForm && (
        <NotificationForm
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          loading={loading}
          notificationTypes={notificationTypes}
        />
      )}

      <NotificationHistory
        history={history}
        loading={historyLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={fetchHistory}
        notificationTypes={notificationTypes}
      />
    </div>
  );
};

export default NotificationsPage;
