import React, { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit3 } from "lucide-react";
import CreateCouponForm from "../../components/SuperAdminDashboard/Voucher/CreateCouponForm";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";

const VoucherPage: React.FC = () => {
  const [vouchers, setVouchers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const resp = await mainLink.get(`/api/coupons?page=${currentPage}&limit=8`);
      if (resp.data) {
        setVouchers(resp.data.coupons);
        setTotalPages(resp.data.totalPages);
      }
    } catch (error: any) {
      Swal.fire("Error", "Failed to fetch coupons", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [currentPage]);

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2d4a3e",
      cancelButtonColor: "#f87171",
      confirmButtonText: "Yes, delete it!",
      borderRadius: "20px"
    });

    if (result.isConfirmed) {
      try {
        await mainLink.delete(`/api/coupons/${id}`);
        Swal.fire({
          title: "Deleted!",
          text: "Coupon has been deleted.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        fetchCoupons();
      } catch (error: any) {
        Swal.fire("Error", "Delete failed", "error");
      }
    }
  };

  const handleSubmitCoupon = async (data: any) => {
    try {
      const payload = {
        name: data.name,
        code: data.code,
        amount: Number(data.amount),
        expiresDate: data.expiresDate,
      };

      if (editingCoupon) {
        await mainLink.put(`/api/coupons/${editingCoupon._id}`, payload);
        Swal.fire({ icon: "success", title: "Updated!", text: "Coupon updated! ✨", timer: 2000, showConfirmButton: false });
      } else {
        await mainLink.post("/api/coupons", payload);
        Swal.fire({ icon: "success", title: "Created!", text: "Coupon created! 🎉", timer: 2000, showConfirmButton: false });
      }

      setIsModalOpen(false);
      setEditingCoupon(null);
      fetchCoupons();
    } catch (error: any) {
      Swal.fire("Error", error.response?.data?.error || "Operation failed", "error");
    }
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Coupon Management</h1>
        <button
          onClick={() => { setEditingCoupon(null); setIsModalOpen(true); }}
          className="bg-[#2d4a3e] text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#233b31] transition-all font-bold text-sm shadow-md active:scale-95"
        >
          <Plus size={18} /> Add New Coupon
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-gray-50 min-h-100">
        <div className="overflow-x-auto no-scrollbar mb-8">
          <table className="w-full text-left min-w-225">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
                <th className="pb-6 px-4">Name</th>
                <th className="pb-6 px-4">Code</th>
                <th className="pb-6 px-4">UsedBy</th>
                <th className="pb-6 px-4">Price</th>
                <th className="pb-6 px-4 text-center">Status</th>
                <th className="pb-6 px-4">Expires At</th>
                <th className="pb-6 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {isLoading ? (
                <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-medium">Loading...</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-medium">No coupons found.</td></tr>
              ) : (
                vouchers.map((voucher: any) => {
                  // status check logic: agar active false ho ya date guzar chuki ho toh Expired
                  const isExpired = new Date(voucher.expiresDate) < new Date();
                  const currentStatus = !voucher.active || isExpired ? "Expired" : "Active";

                  return (
                    <tr key={voucher._id} className="group hover:bg-gray-50/30 transition-all">
                      <td className="py-5 px-4 text-gray-600 font-medium">{voucher.name}</td>
                      <td className="py-5 px-4 text-gray-400 font-medium tracking-wider">{voucher.code}</td>
                      <td className="py-5 px-4 text-gray-800 font-bold">{voucher.usedBy.length || 0}</td>
                      <td className="py-5 px-4 text-gray-800 font-bold">{voucher.amount} NOK</td>
                      <td className="py-5 px-4 text-center">
                        <StatusBadge status={currentStatus} />
                      </td>
                      <td className="py-5 px-4 text-gray-500 font-medium">{new Date(voucher.expiresDate).toLocaleDateString()}</td>
                      <td className="flex py-5 px-4 text-right space-x-2">
                        <button onClick={() => { setEditingCoupon(voucher); setIsModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 size={18} /></button>
                        <button onClick={() => handleDelete(voucher._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button disabled={currentPage === 1} className="p-2 text-gray-400 disabled:opacity-30" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}><ChevronLeft size={20} /></button>
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-full font-bold transition-all border ${currentPage === i + 1 ? "bg-white border-gray-200 shadow-sm scale-110" : "text-gray-400 border-transparent"}`}>{i + 1}</button>
            ))}
            <button disabled={currentPage === totalPages} className="p-2 text-gray-400 disabled:opacity-30" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}><ChevronRight size={20} /></button>
          </div>
        )}
      </div>

      {isModalOpen && <CreateCouponForm onClose={() => { setIsModalOpen(false); setEditingCoupon(null); }} onSubmit={handleSubmitCoupon} initialData={editingCoupon} />}
    </div>
  );
};

const StatusBadge = ({ status }: { status: "Active" | "Expired" | "InActive" }) => {
  const styles = { 
    Active: "bg-emerald-500 text-white shadow-emerald-100", 
    Expired: "bg-rose-400 text-white shadow-rose-100", 
    InActive: "bg-amber-400 text-white shadow-amber-100" 
  };
  return <span className={`${styles[status] || "bg-gray-400"} px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-block min-w-[90px] text-center shadow-md`}>{status}</span>;
};

export default VoucherPage;