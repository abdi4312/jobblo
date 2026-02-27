import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ScrollToTop } from "./components/shared/ScrollToTop.tsx";
import { App as AntApp } from 'antd';
import { useUserStore } from "./stores/userStore.ts";
import { useEffect } from "react";

// Note: QueryClient aur Provider yahan se hata diye gaye hain kyunki wo ab main.tsx mein hain.

export default function App() {
  const { fetchProfile } = useUserStore((state) => state);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <AntApp>
      <ScrollToTop />
      <Header />

      {/* Outlet sirf un components ko render karega jo App ke children hain */}
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
    </AntApp>
  );
}