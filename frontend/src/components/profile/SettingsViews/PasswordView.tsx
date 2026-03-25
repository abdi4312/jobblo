import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import toast from "react-hot-toast";

export const PasswordView = () => {
  // const { form, handleChange, handleUpdate, updateUser } = useOutletContext<SettingsContextType>();
  const { form, handleChange, updateUser } = useOutletContext<SettingsContextType>();

  // Logic: Button tabhi enable hoga jab dono fields fill hon aur request pending na ho
  // Password view mein 'isUnchanged' ki jagah hum 'isEmpty' check karte hain
  const isDisabled = !form.currentPassword || !form.newPassword || updateUser?.isPending;
  const handleUpdate = () => {
    toast.success("Coming Soon");
  }



  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Current Password */}
      <div className="relative group">
        <label htmlFor="currentPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Current Password
        </label>
        <input
          id="currentPassword"
          type="password"
          placeholder="••••••••"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.currentPassword || ""}
          onChange={(event) => handleChange("currentPassword", event.target.value)}
        />
      </div>

      {/* New Password */}
      <div className="relative group">
        <label htmlFor="newPassword" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          New Password
        </label>
        <input
          id="newPassword"
          type="password"
          placeholder="••••••••"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.newPassword || ""}
          onChange={(event) => handleChange("newPassword", event.target.value)}
        />
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${isDisabled
            ? "bg-[#EF790993] cursor-not-allowed opacity-80"
            : "bg-[#EF7909] hover:bg-[#D66A08] active:scale-[0.98]"
          }`}
      >
        {updateUser?.isPending ? "Updating..." : "Change password"}
      </button>
    </section>
  );
};