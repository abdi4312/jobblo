import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const EmailView = () => {
  const { form, handleChange, handleUpdate } = useOutletContext<SettingsContextType>();

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      <div className="relative group">
        <label htmlFor="email" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">Email Address</label>
        <input
          id="email"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
          value={form.email}
          onChange={(event) => handleChange("email", event.target.value)}
        />
      </div>
      <button type="button" onClick={handleUpdate} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4.5 rounded-2xl shadow-sm transition-all">Update email</button>
    </section>
  );
};
