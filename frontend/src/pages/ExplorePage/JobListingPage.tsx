import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
// import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";
import Jobimg from "../../assets/images/job-listing/job-img.png"

export default function JobListingPage() {
  const location = useLocation();
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
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, []);

  return <>
    <div className="max-w-300 mx-auto flex gap-10 pt-15">
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