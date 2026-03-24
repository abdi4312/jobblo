import { Shield } from "lucide-react";

export const BlockedUsersView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-gray-50 p-6 rounded-3xl border border-gray-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-500">
        <Shield size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Blocked users</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Manage the users you've blocked. Blocked users cannot message you or see your listings.
        </p>
        <div className="bg-white p-4 rounded-xl shadow-sm italic text-gray-400 text-sm">
          You haven't blocked any users yet.
        </div>
      </div>
    </div>
  </section>
);
