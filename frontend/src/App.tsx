import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { ScrollToTop } from "./components/shared/ScrollToTop.tsx";
import { App as AntApp } from 'antd';
import { useAuth } from "./features/auth/hook/useAuth.ts";
import { Toaster } from "react-hot-toast";

export default function App() {
  const { user, isLoadingUser } = useAuth();

  if (isLoadingUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <>
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
      </AntApp>
    </>
  );
}