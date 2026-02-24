import { useState, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
// import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/Explore/jobs/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";
import Jobimg from "../../assets/images/job-listing/job-img.png"

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
    <div className="max-w-300 mx-auto flex gap-10 pt-15 overflow-hidden">
      {/* <Search onSearchChange={setSearchQuery} value={searchQuery} /> */}
      <div>

        <div className="text-[40px] font-bold pb-10">
          <h1>Finn ditt neste oppdrag</h1>
        </div>

        <Categories
          showTitle={false}
          allowMultiSelect={true}
          onCategoriesChange={setSelectedCategories}
          searchQuery={searchQuery}
          onSearchClear={() => setSearchQuery("")}
        />
        <Jobs selectedCategories={selectedCategories} searchQuery={searchQuery} />
      </div>

      <div className="hidden lg:block">
        <img src={Jobimg} alt="" />
      </div>
    </div>

  </>
}