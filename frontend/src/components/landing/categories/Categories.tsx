import { Category } from "../../component/category/Category.tsx";
import styles from "./Categories.module.css";
import { getCategories } from "../../../api/categoryAPI.ts";
import { useEffect, useState, useRef } from "react";
import type { CategoryType } from "../../../types/categoryTypes.ts";
import { useNavigate } from "react-router-dom";

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
  const [category, setCategory] = useState<CategoryType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getCategories();
        setCategory(data);
      } catch (err) {
        console.error("Failed to catch categories", err);
      }
    }

    void fetchCategories();
  }, []);

  // Notify parent when selected categories change
  useEffect(() => {
    if (allowMultiSelect && onCategoriesChange) {
      console.log("Selected categories (names):", selectedCategories);
      onCategoriesChange(selectedCategories);
    }
  }, [selectedCategories, allowMultiSelect, onCategoriesChange]);

  const handleCategoryClick = (categoryName: string) => {
    if (allowMultiSelect && onCategoriesChange) {
      // Multi-select mode - toggle category in selection
      setSelectedCategories((prev) =>
        prev.includes(categoryName)
          ? prev.filter((c) => c !== categoryName)
          : [...prev, categoryName],
      );
    } else {
      // Single select mode - navigate to job listing page with selected category
      navigate("/job-listing", { state: { selectedCategory: categoryName } });
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const firstChild = scrollContainerRef.current
        .firstElementChild as HTMLElement;
      if (firstChild) {
        const scrollAmount = firstChild.offsetWidth + 12; // category width + gap
        const newScrollPosition =
          scrollContainerRef.current.scrollLeft +
          (direction === "left" ? -scrollAmount : scrollAmount);
        scrollContainerRef.current.scrollTo({
          left: newScrollPosition,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <>
      <div className={styles.categoriesContainer}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {showTitle && (
            <h2
              style={{
                fontSize: "42px",
                marginBottom: "32px",
                textAlign: "center",
              }}
            >
              <style>
                {`
                  @media (max-width: 768px) {
                    h2 {
                      font-size: 28px !important;
                      margin-bottom: 20px !important;
                    }
                  }
                `}
              </style>
              Kategorier
            </h2>
          )}

          {/* Selected Categories Filter Bar */}
          {allowMultiSelect && selectedCategories.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                backgroundColor: "var(--color-surface)",
                borderRadius: "8px",
                marginBottom: "16px",
                flexWrap: "wrap",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <span style={{ fontWeight: "600", fontSize: "14px" }}>
                Filtre:
              </span>
              {selectedCategories.map((cat) => (
                <div
                  key={cat}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    backgroundColor: "var(--color-accent)",
                    color: "white",
                    borderRadius: "16px",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  <span>{cat}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryClick(cat);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      fontSize: "18px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setSelectedCategories([]);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Fjern alle
              </button>
            </div>
          )}

          <div style={{ position: "relative", padding: "0 20px" }}>
            <button
              onClick={() => scroll("left")}
              style={{
                position: "absolute",
                left: "0px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                backgroundColor: "transparent",
                border: "none",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "24px" }}
              >
                chevron_left
              </span>
            </button>

            <div ref={scrollContainerRef} className={styles.categoryContainer}>
              {category.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleCategoryClick(item.name)}
                  style={{
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity:
                      allowMultiSelect &&
                      selectedCategories.length > 0 &&
                      !selectedCategories.includes(item.name)
                        ? 0.5
                        : 1,
                    transform: selectedCategories.includes(item.name)
                      ? "scale(1.05)"
                      : "scale(1)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Category category={item.name} categoryIcon={item.icon} />
                </div>
              ))}
            </div>

            <button
              onClick={() => scroll("right")}
              style={{
                position: "absolute",
                right: "0px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                backgroundColor: "transparent",
                border: "none",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "24px" }}
              >
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
