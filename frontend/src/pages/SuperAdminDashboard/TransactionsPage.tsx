import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import mainLink from "../../api/mainURLs";
import TransactionTable from "../../components/SuperAdminDashboard/Transcaction/TransactionTable";
import Swal from "sweetalert2";

const TransactionPage: React.FC = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/transactions?page=${currentPage}&limit=10&search=${searchQuery}&type=${selectedType}`,
      );
      setTransactions(response.data?.transactions || []);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error("Fetch error:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Status update karne wala function
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const confirmMessage =
      newStatus === "refunded"
        ? "Are you sure? This will also mark the transaction as refunded in the system."
        : `Change status to ${newStatus}?`;

    const result = await Swal.fire({
      title: "Confirm Status Update",
      text: confirmMessage,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2d4a3e",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, update it!",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        await mainLink.patch(`/api/admin/transactions/${id}/status`, {
          status: newStatus,
        });

        // Refresh the list
        fetchTransactions();

        Swal.fire({
          title: "Updated!",
          text: `Transaction status changed to ${newStatus}`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error: any) {
        console.error("Update failed:", error);
        Swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to update status.",
          icon: "error",
        });
      }
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchTransactions();
    }, 500);

    return () => clearTimeout(handler);
  }, [searchQuery, selectedType, currentPage]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "succeeded":
        return {
          label: "Succeeded",
          color: "bg-emerald-100 text-emerald-600",
          icon: <CheckCircle2 size={14} />,
        };
      case "failed":
        return {
          label: "Failed",
          color: "bg-rose-100 text-rose-600",
          icon: <XCircle size={14} />,
        };
      case "refunded":
        return {
          label: "Refunded",
          color: "bg-gray-100 text-gray-600",
          icon: <RotateCcw size={14} />,
        };
      default:
        return {
          label: "Pending",
          color: "bg-amber-100 text-amber-600",
          icon: <Clock size={14} />,
        };
    }
  };

  return (
    <div className="animate-in fade-in duration-500 p-6 font-sans max-w-[1600px] mx-auto bg-[#f8fafc] min-h-screen">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Transactions
          </h1>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Manage and track all customer payments
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-80 group">
            <Search
              className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2d4a3e]"
              size={20}
            />
            <input
              type="text"
              placeholder="Search ID or Email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-14 pr-6 py-3.5 bg-white border border-slate-200 rounded-full shadow-sm focus:outline-none focus:ring-4 focus:ring-[#2d4a3e]/5 focus:border-[#2d4a3e]/20 transition-all text-sm"
            />
          </div>

          <div className="relative w-full sm:w-60">
            <Filter
              className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={18}
            />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-14 pr-12 py-3.5 bg-white border border-slate-200 rounded-full appearance-none outline-none focus:ring-4 focus:ring-[#2d4a3e]/5 shadow-sm text-sm font-bold text-slate-600 cursor-pointer"
            >
              <option value="">All Transactions</option>
              <option value="subscription">Subscriptions</option>
              <option value="extra_contact">Extra Contacts</option>
            </select>
            <ChevronDown
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={16}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-slate-100 flex flex-col min-h-[600px]">
        <TransactionTable
          transactions={transactions}
          loading={loading}
          getStatusConfig={getStatusConfig}
          onUpdateStatus={handleUpdateStatus}
        />

        {totalPages > 1 && (
          <div className="flex justify-center items-center py-10 gap-4 border-t border-slate-50 mt-auto">
            <button
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-3 disabled:opacity-20 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all text-slate-600"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-[0.15em]">
                Page
              </span>
              <span className="bg-[#2d4a3e] text-white min-w-[42px] h-10 flex items-center justify-center rounded-xl font-bold">
                {currentPage}
              </span>
              <span className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-[0.15em]">
                of {totalPages}
              </span>
            </div>
            <button
              disabled={currentPage === totalPages || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-3 disabled:opacity-20 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all text-slate-600"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionPage;
