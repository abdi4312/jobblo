import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const PhoneView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logic: Check agar input value original phone number ke barabar hai
  const isUnchanged = form.phone === user?.phone;
  const isDisabled = isUnchanged || updateUser?.isPending;

  // Sirf numbers allow karne ka function
  const handlePhoneChange = (value: string) => {
    // 1. Sirf numbers aur shuru ka '+' allow karne ke liye logic
    const cleaned = value.replace(/[^\d+]/g, ""); // Digits aur '+' ke ilawa sab khatam

    // 2. Taake '+' sirf shuru mein hi aa sakay (beech mein nahi)
    const finalValue = cleaned.startsWith('+')
      ? '+' + cleaned.replace(/\+/g, '')
      : cleaned.replace(/\+/g, '');

    handleChange("phone", finalValue);
  };

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label
          htmlFor="phone"
          className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight"
        >
          Phone Number
        </label> {/* Label yahan band ho raha hai */}

        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.phone}
          onChange={(event) => handlePhoneChange(event.target.value)}
          placeholder="+47900000"
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
        {updateUser?.isPending ? "Updating..." : "Update phone"}
      </button>
    </section>
  );
};