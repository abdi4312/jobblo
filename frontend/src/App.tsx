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
import { PageLoader } from './components/Loading/PageLoader.tsx';

export default function App() {
  const { isLoadingUser } = useAuth();
  const user = useUserStore((state) => state.user);
  const location = useLocation();

  // Listen for order approvals globally
  useOrderApprovalSocket(user?._id);

  if (isLoadingUser) {
    return <PageLoader />;
  }

  const isMessagesPage = location.pathname.startsWith('/messages');

  // The auth screens are their own full-viewport layout with their own branding.
  // Rendering the site header and footer around them stacked three full-height
  // regions on top of each other, which is what forced the login page to scroll.
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);

  return (
    <>
      {/* Toasts were `#333` on white at a 12 px radius — a neutral grey that appears
          nowhere else on the site, in a shape that matches nothing either. They are the
          brand's near-black green now, with the pill radius the rest of the UI uses, and
          success/error keep their own icon colour so the two read apart at a glance
          rather than relying on the words alone. */}
      <Toaster
        position="bottom-center"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#122A1C',
            color: '#FFFFFF',
            zIndex: 99999,
            borderRadius: '9999px',
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: '30rem',
            boxShadow: '0 12px 32px rgba(11, 11, 11, 0.22)',
          },
          success: {
            iconTheme: { primary: '#8FBF9A', secondary: '#122A1C' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#E8A8A0', secondary: '#122A1C' },
          },
          loading: {
            iconTheme: { primary: '#8FBF9A', secondary: '#122A1C' },
          },
        }}
      />
      <AntApp>
        <ScrollToTop />
        <CookieBanner />
        {!isAuthPage && <Header />}
        <Outlet />
        {!isMessagesPage && !isAuthPage && <Footer />}
      </AntApp>
    </>
  );
}
