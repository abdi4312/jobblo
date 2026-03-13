import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { ToastContainer } from 'react-toastify';
import { Toaster } from 'react-hot-toast';
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
    <>
      {/* 1. Toaster ko yahan sabse upar le aayein */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#333', // Thora dark gray/black
            color: '#fff',
            zIndex: 99999, // Max z-index
            borderRadius: '12px',
          },
        }}
      />

      <AntApp>
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
      </AntApp>
    </>
  );
}