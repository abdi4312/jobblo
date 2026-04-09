import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCategories } from "../../features/categories/hooks";
import { LandingCategoriesSkeleton } from "../Loading/LandingCategoriesSkeketon";
import * as Icons from "lucide-react";

export function Info() {
  const { data: category = [], isLoading } = useCategories();
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categoryStyles: Record<string, { color: string; active: string }> = {
    "Rengjøring": { color: "#EF7909", active: "#EF790915" },
    "Rørlegger": { color: "#2F7E47", active: "#2F7E4715" },
    "Maling": { color: "#238CEB", active: "#238CEB15" },
    "Flytting": { color: "#EF7909", active: "#EF790915" },
    "Hagearbeid": { color: "#2F7E47", active: "#2F7E4715" },
    "Oppussing": { color: "#2F7E47", active: "#2F7E4715" },
    "Transport": { color: "#2F7E47", active: "#2F7E4715" },
    "Småjobber": { color: "#2F7E47", active: "#2F7E4715" },
  };

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
    navigate(`/search/job/${categoryName}`);
  };

  if (isLoading) {
    return <LandingCategoriesSkeleton />;
  }

  return (
    <section className="bg-white">
      <div className="mx-auto px-4 py-15 font-sans max-w-7xl">
        <h2 className="text-3xl md:text-[40px] text-[#0A0A0A] font-bold text-center mb-10">
          Populære <span className="text-[#2F7E47]">kategorier</span>
        </h2>

        {/* Exact same structure as Explore/jobs/Categories.tsx */}
        <div className="pb-6 overflow-auto custom-scrollbar px-0.5">
          <div className="flex gap-2 max-w-[1050px] mx-auto">
            {category.map((item) => {
              const style = categoryStyles[item.name] || { color: "#000", active: "#F3F4F6" };
              const isSelected = selectedCategories.includes(item.name);
              const LucideIcon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[item.icon] || Icons.HelpCircle;

              return (
                <div
                  key={item._id}
                  className="min-w-30.75 p-6.5 flex items-center shadow rounded-[20px] bg-[rgb(255,255,255)]"
                  style={{
                    backgroundColor: isSelected ? style.active : "rgb(255,255,255)",
                    border: `1px solid ${isSelected ? style.color : "transparent"}`,
                  }}
                  onClick={() => handleCategoryClick(item.name)}
                >
                  <div className="flex flex-col gap-2 w-full py-2 items-center">
                    <div>
                      <span className="">
                        <LucideIcon size={42} strokeWidth={1} />
                      </span>
                    </div>
                    <div>
                      <span className="text-[12px] sm:text-[14px] font-medium text-center text-[#0A0A0A] block">
                        {item.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
