import "./styles/App.css";
import "./styles/Jobblo.css";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/header/Header.tsx";
import Footer from "./components/layout/footer/Footer.tsx";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ScrollToTop } from "./components/shared/ScrollToTop.tsx";
import { App as AntApp } from 'antd';
import { useUserStore } from "./stores/userStore.ts";
import { useEffect } from "react";

const queryClient = new QueryClient();

export default function App() {
const { fetchProfile} = useUserStore((state) => state);

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
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
    <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}