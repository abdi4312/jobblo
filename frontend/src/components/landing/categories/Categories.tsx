import { useEffect, useState, useRef } from "react";
import { useCategories } from "../../../features/categories/hooks.ts";
import { useNavigate } from "react-router-dom";
import { InfinitySpin } from "react-loader-spinner";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  interface CategoryStyle {
    icon: string;
    color: string;
    active: string;
  }

  // FIXED: Har category ke liye aapka bataya hua custom icon aur color config
  const categoryStyles: Record<string, CategoryStyle> = {
    "Rengjøring": { icon: "cleaning_services", color: "#EF7909", active: "#EF790933" },
    "Rørlegger": { icon: "plumbing", color: "#2F7E47", active: "#2F7E4733" },
    "Maling": { icon: "format_paint", color: "#238CEB", active: "#238CEB33" },
    "Flytting": { icon: "local_shipping", color: "#EF7909", active: "#EF790933" },
    "Hagearbeid": { icon: "yard", color: "#2F7E47", active: "#2F7E4733" },
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
      <div className="pb-6">
        <div>
          {/* FIXED: added flex-wrap or overflow handling for clean look */}
          <div className="flex gap-3.5 max-w-[896px] overflow-auto">
            {isLoading ? (
              // Jab data load ho raha ho, InfinitySpin dikhao
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="min-w-42 min-h-34.75 p-6 flex items-center justify-center rounded-xl bg-white border border-gray-100"
                >
                  <InfinitySpin
                    width="200"
                    color="#4fa94d"
                  />
                </div>
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

                  return (
                    <div
                      key={item._id}
                      className="min-w-42 min-h-34.75 p-6 flex items-center rounded-xl"
                      style={{
                        // Agar select ho to active color dikhe, warna white/default
                        backgroundColor: isSelected || !allowMultiSelect ? style.active : "#FFFFFF",
                        border: `1px solid ${isSelected ? style.color : "transparent"}`
                      }}
                      onClick={() => handleCategoryClick(item.name)}
                    >
                      <div className="flex flex-col gap-6 w-full">
                        <div>
                          {/* Icon with Dynamic Color */}
                          <span className="material-symbols-outlined text-5xl!" style={{ color: style.color }}>
                            {style.icon}
                          </span>
                        </div>
                        <div>
                          {/* Category Name */}
                          <span className="text-xl font-bold text-[#0A0A0A] block">
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