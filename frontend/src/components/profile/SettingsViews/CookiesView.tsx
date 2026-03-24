import { Cookie } from "lucide-react";

export const CookiesView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-gray-50 p-6 rounded-3xl border border-gray-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500">
        <Cookie size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Cookie settings</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          We use cookies to improve your experience. You can choose which cookies to allow here.
        </p>
        <button className="bg-white hover:bg-gray-50 text-gray-900 font-bold px-4 py-2 rounded-xl shadow-sm border border-gray-200 transition-colors">
          Manage Preferences
        </button>
      </div>
    </div>
  </section>
);
