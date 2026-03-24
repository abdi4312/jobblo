import { HelpCircle } from "lucide-react";

export const AboutView = () => (
  <section className="flex flex-col gap-6 max-w-2xl bg-gray-50 p-6 rounded-3xl border border-gray-100">
    <div className="flex gap-4 items-start">
      <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500">
        <HelpCircle size={24} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">About us</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Jobblo is a platform built for the community. We're dedicated to helping you find your next job or hire the best talent.
        </p>
        <div className="flex flex-col gap-2">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors text-left">Terms of Service</button>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors text-left">Privacy Policy</button>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors text-left">Contact Support</button>
        </div>
      </div>
    </div>
  </section>
);
