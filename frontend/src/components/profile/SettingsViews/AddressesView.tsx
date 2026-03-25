import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const AddressesView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } = useOutletContext<SettingsContextType>();

  // Logic: Check agar teeno fields mein se kisi ek mein bhi change hua hai ya nahi
  const isUnchanged =
    form.address === user?.address &&
    form.postNumber === user?.postNumber &&
    form.postSted === user?.postSted;

  const isDisabled = isUnchanged || updateUser?.isPending;

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Street Address */}
      <div className="relative group">
        <label htmlFor="address" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
          Street Address
        </label>
        <input
          id="address"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.address}
          onChange={(event) => handleChange("address", event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Post Number */}
        <div className="relative group">
          <label htmlFor="postNumber" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
            Post Number
          </label>
          <input
            id="postNumber"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.postNumber}
            onChange={(event) => handleChange("postNumber", event.target.value)}
          />
        </div>

        {/* City (Post Sted) */}
        <div className="relative group">
          <label htmlFor="postSted" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
            City
          </label>
          <input
            id="postSted"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.postSted}
            onChange={(event) => handleChange("postSted", event.target.value)}
          />
        </div>
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
        {updateUser?.isPending ? "Saving..." : "Save addresses"}
      </button>
    </section>
  );
};