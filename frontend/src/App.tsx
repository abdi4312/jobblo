import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";

export default function App() {
  return (
    <>
      <Header />
      <Outlet />

      <Footer />
    </>
  );
}
