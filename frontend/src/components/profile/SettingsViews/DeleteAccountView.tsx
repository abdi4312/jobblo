import { useOutletContext } from "react-router-dom";
import type { SettingsContextType } from "../../../pages/SettingsPage";
import toast from "react-hot-toast";

export const DeleteAccountView = () => {
  // const { form, handleChange, handleUpdate, updateUser } = useOutletContext<SettingsContextType>();
  const { form, handleChange, updateUser } = useOutletContext<SettingsContextType>();

  // Logic: Agar feedback khali hai to button disabled rahega
  const isDisabled = !form.feedback?.trim() || updateUser?.isPending;

  const handleUpdate = () => {
    toast.success("Coming Soon");
  };

  return (
    <section className="flex flex-col gap-6 max-w-2xl">
      {/* Upper Text from Image */}
      <div className="flex flex-col gap-4 text-gray-700">
        <p className="text-[15px] leading-relaxed">
          It's a shame to see you go! We always want to improve, and would appreciate any helpful feedback in the form below.
        </p>
        <p className="text-[15px] leading-relaxed">
          Deleting your profile is irreversible and all associated content will be deleted from Tise. You will need to create a new profile if you want to join later.
        </p>
      </div>

      {/* Feedback Field */}
      <div className="relative group">
        <textarea
          id="feedback"
          rows={5}
          placeholder="Feedback"
          className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-5 py-4 text-gray-900 font-medium transition-colors resize-none"
          value={form.feedback || ""}
          onChange={(event) => handleChange("feedback", event.target.value)}
        />
      </div>

      {/* Aapka Wala Button Style */}
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
        {updateUser?.isPending ? "Processing..." : "Delete profile"}
      </button>
    </section>
  );
};