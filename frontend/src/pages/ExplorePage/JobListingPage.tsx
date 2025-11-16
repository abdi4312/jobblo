import { Search } from "../../components/Explore/Search/search.tsx";
import { Categories } from "../../components/landing/categories/Categories.tsx";
import Jobs from "../../components/Explore/jobs/Jobs.tsx";

export default function JobListingPage() {
  return <>
  <div style={{maxWidth:"900px", margin:"0 auto", paddingBottom:"80px"}}>
        <Search />
        <div style={{paddingTop:"20px"}}/>
        <Categories />
        <Jobs />

  </div>
  </>
}