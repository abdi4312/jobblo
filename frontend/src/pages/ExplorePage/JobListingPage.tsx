import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
// import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/Explore/jobs/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";
import { Banner } from "../../components/Explore/jobs/banners.tsx";
import { Favourites } from "../../components/Explore/jobs/Favourites.tsx";

export default function JobListingPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get("category");
  // Initialize state directly from navigation state
  const initialState = location.state as { selectedCategory?: string; searchQuery?: string } | null;
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialState?.selectedCategory ? [initialState.selectedCategory] : []
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    initialState?.searchQuery || ""
  );

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
  }, []);

  return <>
    <div className="max-w-300 mx-auto px-4 py-10">
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
            <Jobs selectedCategories={selectedCategories} searchQuery={searchQuery} />
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
}