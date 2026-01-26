import React, { useState, useEffect } from "react";
import { X, Tag, Calendar, DollarSign, Hash } from "lucide-react";

interface CreateCouponFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any; // Edit ke liye naya prop
}

const CreateCouponForm: React.FC<CreateCouponFormProps> = ({
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    price: "",
    activeAt: "",
    expiresAt: "",
    status: "Active",
  });

  // Jab Edit button dabaen, to purana data fields mein bhar jaye
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        code: initialData.code || "",
        price: initialData.amount || "", // backend 'amount' bhejta hai
        activeAt: "", // Agar backend activeAt bhej raha hai to yahan map karein
        expiresAt: initialData.expiresDate
          ? new Date(initialData.expiresDate).toISOString().split("T")[0]
          : "",
        status: initialData.active ? "Active" : "InActive",
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      code: formData.code,
      amount: Number(formData.price),
      expiresDate: formData.expiresAt,
    });
    // Note: onClose() ab VoucherPage handle kar raha hai resp ke baad
  };

  const inputClass =
    "w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:border-[#2d4a3e] focus:ring-4 focus:ring-[#2d4a3e]/5 outline-none transition-all text-gray-700 placeholder:text-gray-400";
  const labelClass = "block text-sm font-bold text-gray-700 mb-2 ml-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-gray-50 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">
              {initialData ? "Edit Coupon" : "Create New Coupon"}
            </h2>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mt-1">
              {initialData
                ? "Update existing discount details"
                : "Add a discount for your customers"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Coupon Name */}
          <div>
            <label className={labelClass}>Coupon Name</label>
            <div className="relative">
              <Tag
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="e.g. Summer Sale"
                className={inputClass}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Coupon Code */}
            <div>
              <label className={labelClass}>Code</label>
              <div className="relative">
                <Hash
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="SUMMER26"
                  className={`${inputClass} uppercase tracking-wider font-bold text-xs`}
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  required
                />
              </div>
            </div>

            {/* Discount Price */}
            <div>
              <label className={labelClass}>Discount (EUR)</label>
              <div className="relative">
                <DollarSign
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="number"
                  placeholder="5.00"
                  className={inputClass}
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Placeholder for Active At (Optional) */}
            <div>
              <label className={labelClass}>Active From</label>
              <div className="relative">
                <Calendar
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="date"
                  className={inputClass}
                  value={formData.activeAt}
                  onChange={(e) =>
                    setFormData({ ...formData, activeAt: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Expires At */}
            <div>
              <label className={labelClass}>Expires At</label>
              <div className="relative">
                <Calendar
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="date"
                  className={inputClass}
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 rounded-2xl border border-gray-100 font-bold text-gray-400 hover:bg-gray-50 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 px-10 py-3.5 rounded-2xl bg-[#2d4a3e] text-white font-bold hover:bg-[#233b31] transition-all text-sm shadow-lg shadow-[#2d4a3e]/20 active:scale-95"
            >
              {initialData ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCouponForm;
