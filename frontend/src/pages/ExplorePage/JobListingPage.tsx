import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";

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
  <div style={{maxWidth:"1000px", margin:"0 auto", paddingBottom:"80px"}}>
        <Search onSearchChange={setSearchQuery} value={searchQuery} />
        <div style={{paddingTop:"20px"}}/>
        <Categories 
          showTitle={false} 
          allowMultiSelect={true}
          onCategoriesChange={setSelectedCategories}
          searchQuery={searchQuery}
          onSearchClear={() => setSearchQuery("")}
        />
        <Jobs selectedCategories={selectedCategories} searchQuery={searchQuery} />

  </div>
  </>
}