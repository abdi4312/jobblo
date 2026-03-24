import { Eye } from "lucide-react";

export const VisibilityView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-gray-50 p-6 rounded-3xl border border-gray-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
        <Eye size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Search engine visibility</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Control whether your profile and listings are visible to search engines like Google.
        </p>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="visibility" className="w-5 h-5 accent-rose-500" defaultChecked />
          <label htmlFor="visibility" className="text-sm font-medium text-gray-700">Allow search engines to index my profile</label>
        </div>
      </div>
    </div>
  </section>
);
