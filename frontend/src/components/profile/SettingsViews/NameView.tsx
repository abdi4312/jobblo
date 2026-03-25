import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const NameView = () => {
  // 'user' object context se le rahe hain comparison ke liye
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logic: Agar First Name aur Last Name dono pehle jaise hi hain
  const isUnchanged = form.name === user?.name && form.lastName === user?.lastName;
  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div className="relative group">
          <label htmlFor="firstName" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
            First Name
          </label>
          <input
            id="firstName"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
          />
        </div>

        {/* Last Name */}
        <div className="relative group">
          <label htmlFor="lastName" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
            Last Name
          </label>
          <input
            id="lastName"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.lastName}
            onChange={(event) => handleChange("lastName", event.target.value)}
          />
        </div>
      </div>

      {/* Save Changes Button */}
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled || updateUser?.isPending}
        className={`w-full font-bold text-lg py-3.5 rounded-2xl text-white shadow-sm transition-all duration-200
          ${isDisabled
            ? "bg-[#EF790993] cursor-not-allowed opacity-80"
            : "bg-[#EF7909] hover:bg-[#D66A08] active:scale-[0.98]"
          }`}
      >
        {updateUser?.isPending ? "Saving..." : "Save changes"}
      </button>
    </section>
  );
};