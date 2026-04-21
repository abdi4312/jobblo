import { useNavigate } from "react-router-dom";
import { useCategories } from "../../../features/categories/hooks";
import * as Icons from "lucide-react";
import { useState } from "react";

export function Category() {
  const { data: category = [] } = useCategories();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName],
    );
    navigate(`/search/job/${categoryName}`);
  };
  return (
    <section className="">
      <div className="mx-auto sm:px-4 max-w-300">
        <div className="pb-6 overflow-auto custom-scrollbar px-0.5">
          <div className="flex gap-2 max-w-282.5 mx-auto">
            <div
              className="min-w-30.75 p-6.5 flex items-center rounded-[20px] bg-white/60
              shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white cursor-pointer hover:bg-white transition-all duration-300"
              onClick={() => navigate("/search/job/all")}
            >
              <div className="flex flex-col gap-2 w-full py-2 items-center">
                <div>
                  <span className="">
                    <Icons.LayoutGrid size={42} strokeWidth={1} />
                  </span>
                </div>
                <div>
                  <span className="text-[12px] sm:text-[14px] font-medium text-center text-[#0A0A0A] block">
                    Alle
                  </span>
                </div>
              </div>
            </div>
            {category.map((item) => {
              const LucideIcon =
                (
                  Icons as Record<
                    string,
                    React.ComponentType<{ size?: number; className?: string }>
                  >
                )[item.icon] || Icons.HelpCircle;
              return (
                <div
                  key={item._id}
                  className="min-w-30.75 p-6.5 flex items-center rounded-[20px] bg-white/60
                  shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white cursor-pointer hover:bg-white transition-all duration-300"
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
