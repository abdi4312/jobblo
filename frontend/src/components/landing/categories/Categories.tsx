import { Category } from "../../component/category/Category.tsx";
import styles from "./Categories.module.css";
import { getCategories } from "../../../api/categoryAPI.ts";
import { useEffect, useState, useRef } from "react";
import type { CategoryType } from "../../../types/categoryTypes.ts";
import { useNavigate } from "react-router-dom";

export function Categories({ showTitle = true }: { showTitle?: boolean }) {
  const [category, setCategory] = useState<CategoryType[]>([]);
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

  useEffect(() => {
    const autoScroll = setInterval(() => {
      scroll('right');
    }, 5000);

    return () => clearInterval(autoScroll);
  }, []);

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/category/${encodeURIComponent(categoryName)}`);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const firstChild = scrollContainerRef.current.firstElementChild as HTMLElement;
      if (firstChild) {
        const scrollAmount = firstChild.offsetWidth + 12; // category width + gap
        const newScrollPosition = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
        scrollContainerRef.current.scrollTo({
          left: newScrollPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <>
      <div className={styles.categoriesContainer}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {showTitle && (
            <h2 style={{ 
              fontSize: '42px', 
              marginBottom: '32px', 
              textAlign: 'center',
            }}>
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
          <div style={{ position: 'relative', padding: '0 20px' }}>
          <button
            onClick={() => scroll('left')}
            style={{
              position: 'absolute',
              left: '0px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'transparent',
              border: 'none',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>chevron_left</span>
          </button>
          
          <div ref={scrollContainerRef} className={styles.categoryContainer}>
            {category.map((item) => (
              <div 
                key={item._id} 
                onClick={() => handleCategoryClick(item.name)} 
                style={{ cursor: 'pointer', flexShrink: 0 }}
              >
                <Category
                  category={item.name}
                  categoryIcon={item.slug}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => scroll('right')}
            style={{
              position: 'absolute',
              right: '0px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              backgroundColor: 'transparent',
              border: 'none',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>chevron_right</span>
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
