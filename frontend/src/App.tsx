import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { ScrollToTop } from "./components/shared/ScrollToTop.tsx";
import { App as AntApp } from "antd";
import { useAuth } from "./features/auth/hook/useAuth.ts";
import { Toaster } from "react-hot-toast";
import MainLoading from "./assets/loading/main-loading.gif";

export default function App() {
  const { isLoadingUser } = useAuth();
  const location = useLocation();

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <img src={MainLoading} alt="Loading..." className="w-36 h-36" />
      </div>
    );
  }

  const isMessagesPage = location.pathname.startsWith("/messages");

  return (
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#333", // Thora dark gray/black
            color: "#fff",
            zIndex: 99999, // Max z-index
            borderRadius: "12px",
          },
        }}
      />
      <AntApp>
        <ScrollToTop />
        <Header />
        <Outlet />
        {!isMessagesPage && <Footer />}
      </AntApp>
    </>
  );
}
