import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ScrollToTop } from "./components/shared/ScrollToTop.tsx";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <Outlet />
      <Footer />
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}
