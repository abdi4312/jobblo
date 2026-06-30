import './styles/App.css';
import './styles/Jobblo.css';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './components/layout/header/Header.tsx';
import Footer from './components/layout/footer/Footer.tsx';
import { ScrollToTop } from './components/shared/ScrollToTop.tsx';
import { CookieBanner } from './components/shared/CookieBanner.tsx';
import { App as AntApp } from 'antd';
import { useAuth } from './features/auth/hook/useAuth.ts';
import { useOrderApprovalSocket } from './features/notifications/hooks';
import { useUserStore } from './stores/userStore';
import { Toaster } from 'react-hot-toast';
import MainLoading from './assets/loading/main-loading.gif';
import Lottie from 'lottie-react';
import Loging from './assets/animations/loading.json';

export default function App() {
  const { isLoadingUser } = useAuth();
  const user = useUserStore((state) => state.user);
  const location = useLocation();

  // Listen for order approvals globally
  useOrderApprovalSocket(user?._id);

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* <img src={MainLoading} alt="Loading..." className="w-36 h-36" /> */}
        <Lottie animationData={Loging} loop autoplay />
      </div>
    );
  }

  const isMessagesPage = location.pathname.startsWith('/messages');

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
        <CookieBanner />
        <Header />
        <Outlet />
        {!isMessagesPage && <Footer />}
      </AntApp>
    </>
  );
}
