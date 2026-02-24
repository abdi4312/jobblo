import { useNavigate } from "react-router-dom";
import { useCategories } from "../../features/categories/hooks";
import { LandingCategoriesSkeleton } from "../Loading/LandingCategoriesSkeketon";


export function Info() {

  const { data: category = [], isLoading } = useCategories();
  const navigate = useNavigate();

  interface categoryImage {
    Image: string;
    color: string;
    active: string;
  }

  // FIXED: Har category ke liye aapka bataya hua custom icon aur color config
  const categoryImage: Record<string, categoryImage> = {
    "Rengjøring": { Image: "src/assets/images/cleaning.jpg", color: "#EF7909", active: "#EF790933" },
    "Hagearbeid": { Image: "src/assets/images/woman-full-gardening.png", color: "#2F7E47", active: "#2F7E4733" },
    "Flytting": { Image: "src/assets/images/courier-moving-out.png", color: "#238CEB", active: "#238CEB33" },
    "Rørlegger": { Image: "src/assets/images/male-constructionworker.png", color: "#EF7909", active: "#EF790933" },
    "Maling": { Image: "src/assets/images/painting-wall.jpg", color: "#2F7E47", active: "#2F7E4733" },
  };

  // Click handler function
  const handleCategoryClick = (categoryName: string) => {
    // Navigate karein aur URL mein category name bhejein
    // Example: /jobs?category=Maling
    navigate(`/job-listing?category=${encodeURIComponent(categoryName)}`);
  };

  if (isLoading) {
    return <LandingCategoriesSkeleton />
  }

  return (
    <section className="bg-white">
      <div className="mx-auto px-4 py-15 font-sans max-w-7xl">
        <h2 className="text-3xl md:text-[40px] text-[#0A0A0A] font-bold text-center mb-10">
          Populære <span className="text-[#2F7E47]">kategorier</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
          {category.map((cat, index) => {
            const categoryStyle = categoryImage[cat.name] || categoryImage["Rengjøring"];
            return (

              <div
                key={index}
                onClick={() => handleCategoryClick(cat.name)}
                className={`relative overflow-hidden rounded-2xl shadow-lg h-60 cursor-pointer ${index === 2 ? "md:row-span-2 md:h-full" : ""
                  }`}
              >
                <img
                  src={categoryStyle.Image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />

                <div className="absolute bottom-0 p-6 text-white">
                  <h3 className="text-xl font-bold">{cat.name}</h3>
                  {/* <p className="text-sm opacity-80">{cat.description}</p> */}
                </div>
              </div>
            )
          }
          )}
        </div>
      </div>
    </section>
  );
}
