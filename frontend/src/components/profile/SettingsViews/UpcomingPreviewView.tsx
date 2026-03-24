import { useNavigate } from "react-router-dom";
import { Rocket, Info } from "lucide-react";

export const UpcomingPreviewView = () => {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col gap-6 max-w-2xl bg-blue-50 p-8 rounded-3xl border border-blue-100">
      <div className="flex gap-4 items-start">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
          <Rocket size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Upcoming Features</h3>
          <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
            We're constantly working on new features to make Jobblo even better for you. Check out what's coming soon!
          </p>
          <button 
            onClick={() => navigate("/upcoming")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all"
          >
            <Info size={18} />
            View Roadmap
          </button>
        </div>
      </div>
    </section>
  );
};
