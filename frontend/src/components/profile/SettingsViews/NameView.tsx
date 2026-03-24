import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const NameView = () => {
  const { form, handleChange, handleUpdate } = useOutletContext<SettingsContextType>();

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative group">
          <label htmlFor="firstName" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">First Name</label>
          <input
            id="firstName"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
          />
        </div>
        <div className="relative group">
          <label htmlFor="lastName" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">Last Name</label>
          <input
            id="lastName"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.lastName}
            onChange={(event) => handleChange("lastName", event.target.value)}
          />
        </div>
      </div>
      <button type="button" onClick={handleUpdate} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4.5 rounded-2xl shadow-sm transition-all">Save changes</button>
    </section>
  );
};
