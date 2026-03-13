import { useEffect, useState, useRef } from "react";
import { useCategories } from "../../../features/categories/hooks.ts";
import { useNavigate } from "react-router-dom";
import { CategoriesSkeleton } from "../../Loading/CategoriesSkeleton.tsx";
import * as Icons from "lucide-react";
interface CategoriesProps {
  showTitle?: boolean;
  onCategoriesChange?: (categories: string[]) => void;
  allowMultiSelect?: boolean;
  searchQuery?: string;
  onSearchClear?: () => void;
}

export function Categories({
  showTitle = true,
  onCategoriesChange,
  allowMultiSelect = false,
}: CategoriesProps) {
  const { data: category = [], isLoading, error } = useCategories();

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  // const scrollContainerRef = useRef<HTMLDivElement>(null);

  // FIXED: Har category ke liye aapka bataya hua custom icon aur color config
  const categoryStyles: Record<string, { color: string; active: string }> = {
    "Rengjøring": { color: "#EF7909", active: "#EF790915" },
    "Rørlegger": { color: "#2F7E47", active: "#2F7E4715" },
    "Maling": { color: "#238CEB", active: "#238CEB15" },
    "Flytting": { color: "#EF7909", active: "#EF790915" },
    "Hagearbeid": { color: "#2F7E47", active: "#2F7E4715" },
    "Outdoor & sports": { color: "#2F7E47", active: "#2F7E4715" },
    "Art/Painting": { color: "#2F7E47", active: "#2F7E4715" },
  };

  useEffect(() => {
    if (allowMultiSelect && onCategoriesChange) {
      onCategoriesChange(selectedCategories);
    }
  }, [selectedCategories, allowMultiSelect, onCategoriesChange]);

  const handleCategoryClick = (categoryName: string) => {
    if (allowMultiSelect) {
      setSelectedCategories((prev) =>
        prev.includes(categoryName)
          ? prev.filter((c) => c !== categoryName)
          : [...prev, categoryName],
      );
    } else {
      navigate("/job-listing", { state: { selectedCategory: categoryName } });
    }
  };

  return (
    <>
      <div className="max-w-[1200px] mx-auto">
        {/* <div className="text-[23px] sm:text-[28px] md:text-[32px] font-bold text-[#0A0A0A] mb-10">
          Categories
        </div> */}
        <div className="pb-6 overflow-auto custom-scrollbar">
          {/* FIXED: added flex-wrap or overflow handling for clean look */}
          <div className="flex gap-2 max-w-4xl mx-auto">
            {isLoading ? (
              // Jab data load ho raha ho, InfinitySpin dikhao
              Array.from({ length: 4 }).map((_, index) => (
                <CategoriesSkeleton key={index} />
              ))
            ) :
              (
                category.map((item) => {
                  // FIXED: Fetching style from config with a fallback
                  const style = categoryStyles[item.name] || {
                    icon: "help_outline",
                    color: "#000",
                    active: "#F3F4F6"
                  };

                  // Check if currently selected (for active state)
                  const isSelected = selectedCategories.includes(item.name);
                  const LucideIcon = (Icons as any)[item.icon] || Icons.HelpCircle;

                  return (
                    <div
                      key={item._id}
                      className="min-w-30.75 p-6.5 flex items-center shadow rounded-[20px] bg-[rgb(255,255,255)]"
                      style={{
                        // Agar select ho to active color dikhe, warna white/default
                        backgroundColor: isSelected || !allowMultiSelect ? style.active : "rgb(255,255,255)",
                        border: `1px solid ${isSelected ? style.color : "transparent"}`
                      }}
                      onClick={() => handleCategoryClick(item.name)}
                    >
                      <div className="flex flex-col gap-2 w-full py-2 items-center">
                        <div>
                          {/* Icon with Dynamic Color */}
                          <span className="">
                            <LucideIcon
                              size={42}
                              strokeWidth={1}
                            />
                          </span>
                        </div>
                        <div>
                          {/* Category Name */}
                          <span className="text-[12px] sm:text-[14px] font-medium text-center text-[#0A0A0A] block">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
          </div>
        </div>
      </div>
    </>
  );
}