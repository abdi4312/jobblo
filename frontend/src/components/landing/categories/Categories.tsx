import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories } from "../../../api/categoryAPI.ts";
import type { CategoryType } from "../../../types/categoryTypes.ts";

export function Categories({
  showTitle = true,
  onCategoriesChange,
  allowMultiSelect = false,
}: any) {
  const [category, setCategory] = useState<CategoryType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getItemsPerView = useCallback(() => {
    if (windowWidth >= 1200) return 5;
    if (windowWidth >= 1042) return 4;
    if (windowWidth >= 962) return 3;
    if (windowWidth >= 717) return 2;
    return 1;
  }, [windowWidth]);

  const itemsPerView = getItemsPerView();
  const totalPages = Math.ceil(category.length / itemsPerView);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getCategories();
        setCategory(data);
      } catch (err) {
        console.error("Failed to fetch", err);
      }
    }
    fetchCategories();

    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const categoryImages: Record<string, string> = {
    Rengjøring: "src/assets/images/cleaning.jpg",
    Hagearbeid: "src/assets/images/woman-full-gardening.png",
    Flytting: "src/assets/images/courier-moving-out.png",
    Rørlegger: "src/assets/images/male-constructionworker.png",
    Maling: "src/assets/images/painting-wall.jpg",
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, offsetWidth } = scrollContainerRef.current;
      const index = Math.round(scrollLeft / (offsetWidth / itemsPerView));
      const currentPage = Math.floor(index / itemsPerView);
      if (activeSlide !== currentPage) {
        setActiveSlide(currentPage);
      }
    }
  };

  const scrollToSlide = (pageIndex: number) => {
    if (scrollContainerRef.current) {
      const containerWidth = scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: containerWidth * pageIndex,
        behavior: "smooth",
      });
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    if (allowMultiSelect) {
      setSelectedCategories(prev =>
        prev.includes(categoryName) ? prev.filter(c => c !== categoryName) : [...prev, categoryName]
      );
    } else {
      navigate("/job-listing", { state: { selectedCategory: categoryName } });
    }
  };

  return (
    <div className="w-full py-10 px-4 overflow-hidden bg-white">
      {/* Set exactly to 1000px as requested */}
      <div className="max-w-[1000px] mx-auto">
        
        {showTitle && (
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-[#183A1D] tracking-tight">
              Oppgaver nær deg.
            </h2>
            <p className="text-gray-500 mt-2 font-medium">Finn din neste jobb i dag</p>
          </div>
        )}

        <div className="relative">
          {/* Added pt-4 to prevent hover scale from cutting at the top */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 no-scrollbar pb-8 pt-4"
          >
            {category.map((item) => {
              const isSelected = selectedCategories.includes(item.name);
              const bgImg = categoryImages[item.name] || '/images/default.jpg';
              
              return (
                <div
                  key={item._id}
                  onClick={() => handleCategoryClick(item.name)}
                  style={{
                    minWidth: `calc(${100 / itemsPerView}% - ${(16 * (itemsPerView - 1)) / itemsPerView}px)`,
                  }}
                  className="snap-start shrink-0"
                >
                  <div 
                    className={`group relative h-60 md:h-64 rounded-[2rem] overflow-visible cursor-pointer shadow-lg transition-all duration-300 transform-gpu hover:z-50 ${
                      isSelected ? 'ring-4 ring-orange-500 scale-95 shadow-inner' : 'hover:-translate-y-1 hover:scale-[1.03]'
                    }`}
                  >
                    {/* Inner wrapper for overflow control (so zoom effect works inside rounded corners) */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                        <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                        style={{ 
                            backgroundImage: `linear-gradient(to top, rgba(24, 58, 29, 0.95) 0%, rgba(0,0,0,0) 60%), url(${bgImg})`,
                        }}
                        />

                        <div className="absolute bottom-5 inset-x-4">
                            <div className={`w-full py-3 rounded-2xl text-center text-xs font-black uppercase tracking-widest text-white transition-all duration-300 ${
                                isSelected ? 'bg-orange-500' : 'bg-[#183A1D]/90 backdrop-blur-sm group-hover:bg-[#EA7E15]'
                            }`}>
                                {item.name}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dots */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-2">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToSlide(index)}
                  className={`transition-all duration-300 rounded-full h-2 ${
                    index === activeSlide
                      ? "w-8 bg-orange-500"
                      : "w-2 bg-gray-200"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}