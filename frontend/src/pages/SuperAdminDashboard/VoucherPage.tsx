import React, { useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

const VoucherPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);

  // Mock Data
  const vouchers = Array(10).fill({
    name: "EID Voucher",
    code: "HAPPYEID26",
    price: "5 EUR",
    activeAt: "2026-01-12",
    expiresAt: "2026-03-12",
  });

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
          Coupon Management
        </h1>
        <button className="bg-[#2d4a3e] text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#233b31] transition-all font-bold text-sm shadow-md active:scale-95">
          <Plus size={18} /> Add New Coupon
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-gray-50">
        <div className="overflow-x-auto no-scrollbar mb-8">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
                <th className="pb-6 px-4">Name</th>
                <th className="pb-6 px-4">Code</th>
                <th className="pb-6 px-4">Price</th>
                <th className="pb-6 px-4 text-center">Status</th>
                <th className="pb-6 px-4">Active At</th>
                <th className="pb-6 px-4">Expires At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {vouchers.map((voucher, idx) => (
                <tr
                  key={idx}
                  className="group hover:bg-gray-50/30 transition-all"
                >
                  <td className="py-5 px-4 text-gray-600 font-medium">
                    {voucher.name}
                  </td>
                  <td className="py-5 px-4 text-gray-400 font-medium tracking-wider">
                    {voucher.code}
                  </td>
                  <td className="py-5 px-4 text-gray-800 font-bold">
                    {voucher.price}
                  </td>
                  <td className="py-5 px-4 text-center">
                    <StatusBadge
                      status={
                        idx === 1
                          ? "Expired"
                          : idx === 3 || idx === 5
                            ? "InActive"
                            : "Active"
                      }
                    />
                  </td>
                  <td className="py-5 px-4 text-gray-500 font-medium">
                    {voucher.activeAt}
                  </td>
                  <td className="py-5 px-4 text-gray-500 font-medium">
                    {voucher.expiresAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- Pagination Section --- */}
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            <ChevronLeft size={20} />
          </button>

          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all border
                ${
                  currentPage === num
                    ? "bg-white border-gray-200 text-gray-800 shadow-sm scale-110 z-10"
                    : "bg-transparent border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                }`}
            >
              {num}
            </button>
          ))}

          <button
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Status Badge Component ---
const StatusBadge = ({
  status,
}: {
  status: "Active" | "Expired" | "InActive";
}) => {
  const styles = {
    Active: "bg-[#4ade80] text-white", // Green
    Expired: "bg-[#f87171] text-white", // Red
    InActive: "bg-[#fb923c] text-white", // Orange
  };

  return (
    <span
      className={`${styles[status]} px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block min-w-[90px] text-center shadow-sm`}
    >
      {status}
    </span>
  );
};

export default VoucherPage;
