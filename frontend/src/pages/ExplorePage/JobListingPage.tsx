import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";

export default function JobListingPage() {
  const location = useLocation();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Check if navigated from landing page with a pre-selected category or search query
  useEffect(() => {
    const state = location.state as { selectedCategory?: string; searchQuery?: string };
    if (state?.selectedCategory) {
      setSelectedCategories([state.selectedCategory]);
    }
    if (state?.searchQuery) {
      setSearchQuery(state.searchQuery);
    }
    // Clear the state to prevent it from persisting on refresh
    if (state?.selectedCategory || state?.searchQuery) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  return <>
  <div style={{maxWidth:"900px", margin:"0 auto", paddingBottom:"80px"}}>
        <Search onSearchChange={setSearchQuery} value={searchQuery} />
        <div style={{paddingTop:"20px"}}/>
        <Categories 
          showTitle={false} 
          allowMultiSelect={true}
          onCategoriesChange={setSelectedCategories}
        />
        <Jobs selectedCategories={selectedCategories} searchQuery={searchQuery} />

  </div>
  </>
}