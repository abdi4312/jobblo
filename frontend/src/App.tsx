import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";

export default function App() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <Outlet />
      <button onClick={() => navigate("/job-listing")}>JobListingPage</button>
      <button onClick={() => navigate("/profile")}>ProfilePage</button>
      <button onClick={() => navigate("/login")}>LoginPage</button>

      <Footer />
    </>
  );
}
