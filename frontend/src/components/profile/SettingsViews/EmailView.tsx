import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const EmailView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logic: Check agar input email original user email ke barabar hai
  const isUnchanged = form.email === user?.email;
  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label htmlFor="email" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.email}
          onChange={(event) => handleChange("email", event.target.value)}
        />
      </div>

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
        {updateUser?.isPending ? "Updating..." : "Update email"}
      </button>
    </section>
  );
};