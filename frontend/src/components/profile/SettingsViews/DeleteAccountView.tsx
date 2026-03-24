import { UserX } from "lucide-react";

export const DeleteAccountView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-rose-50 p-6 rounded-3xl border border-rose-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-500">
        <UserX size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Delete profile</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          Deleting your profile will remove all your data, including your listings, messages, and favorites. This action cannot be undone.
        </p>
      </div>
    </div>
    <button type="button" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4.5 rounded-2xl shadow-md transition-all">
      Permanently delete my profile
    </button>
  </section>
);
