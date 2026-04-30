import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Categories } from "../../components/Explore/jobs/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";
import { Banner } from "../../components/Explore/jobs/banners.tsx";
import { Favourites } from "../../components/Explore/jobs/Favourites.tsx";
import { AlertCircle } from "lucide-react";

export default function JobListingPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  // Initialize state directly from navigation state
  const initialState = location.state as {
    selectedCategory?: string;
    searchQuery?: string;
  } | null;
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialState?.selectedCategory ? [initialState.selectedCategory] : [],
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    initialState?.searchQuery || "",
  );
  const [isUrgentOnly, setIsUrgentOnly] = useState<boolean>(false);

  // Clear navigation state on mount
  useEffect(() => {
    if (categoryFromUrl) {
      // Agar URL mein category hai toh usay array mein daal dein
      setSelectedCategories([categoryFromUrl]);
    } else if (initialState?.selectedCategory) {
      // Fallback agar state se aa raha hai
      setSelectedCategories([initialState.selectedCategory]);
    }
  }, [categoryFromUrl, initialState?.selectedCategory]);
  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <>
      <div className="max-w-300 mx-auto px-4 pb-10">
        {/* Grid container: Mobile pe 1 column, Desktop pe 12 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT SIDE: Jobs & Categories (Takes 9 columns on desktop) */}
          <div className="lg:col-span-12 w-full order-2 lg:order-1">
            {/* <div className="text-[28px] md:text-[40px] font-bold pb-6 md:pb-10">
            <h1 className="leading-tight">Finn ditt neste oppdrag</h1>
          </div> */}

            {/* Categories Horizontal Scroll */}
            <Categories
              showTitle={false}
              allowMultiSelect={true}
              onCategoriesChange={setSelectedCategories}
              searchQuery={searchQuery}
              onSearchClear={() => setSearchQuery("")}
            />

            <Banner />
            <Favourites />

            {/* Jobs Listing */}
            <div className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-[#0A0A0A] tracking-tight">
                  Finn oppdrag
                </h2>

                <button
                  onClick={() => setIsUrgentOnly(!isUrgentOnly)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all duration-300 border-2 ${
                    isUrgentOnly
                      ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-200"
                      : "bg-white border-gray-100 text-gray-600 hover:border-red-200 hover:text-red-500"
                  }`}
                >
                  <AlertCircle
                    size={18}
                    className={isUrgentOnly ? "animate-pulse" : ""}
                  />
                  <span className="text-sm">Haster</span>
                </button>
              </div>

              <Jobs
                selectedCategories={selectedCategories}
                searchQuery={searchQuery}
                isUrgent={isUrgentOnly}
                activeTab="Discover"
              />
            </div>
          </div>

          {/* RIGHT SIDE: Sidebar (Takes 3 columns on desktop) */}
          {/* <div className="lg:col-span-3 w-full order-1 lg:order-2 hidden">
          <div className="bg-[#1b5cdd] w-full min-h-35.75 lg:h-154.5 rounded-lg border-4 border-white sticky top-24 flex items-center justify-center p-6 shadow-lg">
            <span className="text-white font-semibold text-lg text-center">
              Annonse / Sidebar
            </span>
          </div>
        </div> */}
        </div>
      </div>
    </>
  );
}
