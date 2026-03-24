import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const AddressesView = () => {
  const { form, handleChange, handleUpdate } = useOutletContext<SettingsContextType>();

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label htmlFor="address" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">Street Address</label>
        <input
          id="address"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.address}
          onChange={(event) => handleChange("address", event.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative group">
          <label htmlFor="postNumber" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">Post Number</label>
          <input
            id="postNumber"
            className="w-full bg-gray-100 hover:bg-gray-202 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.postNumber}
            onChange={(event) => handleChange("postNumber", event.target.value)}
          />
        </div>
        <div className="relative group">
          <label htmlFor="postSted" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">City</label>
          <input
            id="postSted"
            className="w-full bg-gray-100 hover:bg-gray-202 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.postSted}
            onChange={(event) => handleChange("postSted", event.target.value)}
          />
        </div>
      </div>
      <button type="button" onClick={handleUpdate} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4.5 rounded-2xl shadow-sm transition-all">Save addresses</button>
    </section>
  );
};
