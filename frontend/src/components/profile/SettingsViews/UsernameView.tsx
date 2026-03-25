import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";

export const UsernameView = () => {
  // Farz karein aapke context mein 'user' data bhi aa raha hai comparison ke liye
  const { form, updateUser, handleChange, handleUpdate, user } = useOutletContext<SettingsContextType>();

  const usernameLength = form.name.trim().length;

  // Logic: Agar name change nahi hua ya phir length requirements poori nahi hain
  const isUnchanged = form.name === user?.name;
  const isInvalid = usernameLength < 4 || usernameLength > 30;
  const isDisabled = isUnchanged || updateUser.isPending || isInvalid;

  return (
    <section className="flex flex-col gap-8 max-w-2xl">
      <p className="text-gray-600 text-[15px] leading-relaxed">
        You can only change your username once every 30 days. This means you may not be able to get your current username back if you decide to change it.
      </p>

      <div className="flex flex-col gap-2">
        <div className="relative group">
          <label htmlFor="username" className="absolute left-4 top-2 text-[11px] font-bold text-gray-500 uppercase tracking-tight">
            Username
          </label>
          <input
            id="username"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
          />
        </div>
        <p className="text-[13px] text-gray-500 px-1 leading-tight">
          {usernameLength}/30 characters - Username must be between 4–30 characters, and can only contain letters (a-z), numbers, and underscores (_)
        </p>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled || updateUser.isPending}
        style={{
          backgroundColor: isDisabled ? "#EF790993" : "#E08835",
          cursor: isDisabled ? "not-allowed" : "pointer"
        }}
        className={`w-full text-[#ffffff] font-bold text-lg py-3.5 rounded-2xl shadow-sm transition-all mt-2 
          ${!isDisabled ? "hover:bg-[#E08835]" : "opacity-80"}`}
      >
        {updateUser.isPending ? "Updating..." : "Update username"}
      </button>
    </section>
  );
};