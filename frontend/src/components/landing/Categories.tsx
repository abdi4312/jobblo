import { useNavigate } from "react-router-dom";
import { useCategories } from "../../features/categories/hooks";
import * as Icons from "lucide-react";

export function Categories() {
  const { data: categories = [], isLoading } = useCategories();
  const navigate = useNavigate();

  return (
    <section className="py-15 px-12 max-w-[1100px] mx-auto">
      <div className="text-center mb-9">
        <h2 className="text-[28px] font-normal text-custom-black">
          Populære <em className="text-custom-green not-italic">kategorier</em>
        </h2>
        <p className="text-[14px] text-custom-black/50 mt-1.5">Finn akkurat den hjelpen du trenger</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
        <div 
          onClick={() => navigate("/search/job/all")}
          className="bg-white border border-black/10 rounded-[14px] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-custom-green transition-colors"
        >
          <Icons.LayoutGrid className="text-custom-green" size={24} />
          <span className="text-[11px] text-custom-black/70 text-center">Alle</span>
        </div>

        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-black/10 rounded-[14px] p-4 h-[80px] animate-pulse" />
          ))
        ) : (
          categories.map((cat) => {
            const LucideIcon = (Icons as any)[cat.icon] || Icons.HelpCircle;
            return (
              <div 
                key={cat._id}
                onClick={() => navigate(`/search/job/${cat.name}`)}
                className="bg-white border border-black/10 rounded-[14px] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-custom-green transition-colors"
              >
                <LucideIcon className="text-custom-green" size={24} />
                <span className="text-[11px] text-custom-black/70 text-center">{cat.name}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
