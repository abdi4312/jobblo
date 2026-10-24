import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles/index.css';
import 'leaflet/dist/leaflet.css';
import { ConfigProvider } from 'antd';
import '@ant-design/v5-patch-for-react-19';
import { routes } from './routing/Routes.tsx';

// TanStack Query Imports
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { initCookieConsent } from './utils/cookieConsent';
import { startRum, trackView } from './lib/rum';
import { useUserStore } from './stores/userStore';

// Re-inject the ad script for a returning visitor who already accepted.
initCookieConsent();

// Auth lives in memory only: ask the server (refresh cookie) who is signed in. Started
// before render so it runs once even under StrictMode; route guards wait on authReady.
void useUserStore.getState().bootstrap();
// Dev server only (e2e tests read in-memory auth state); never in a production bundle.
if (import.meta.env.DEV) Object.assign(window, { __jobbloUserStore: useUserStore });

// 1. QueryClient ka instance create kiya
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter(routes);

// Real-user monitoring (anonymous; see lib/rum.ts): landing view + one view per route change.
startRum();
trackView();
let lastPath = window.location.pathname;
router.subscribe((state) => {
  if (state.location.pathname === lastPath) return;
  lastPath = state.location.pathname;
  trackView();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          components: {
            Button: {
              fontWeight: 700,
            },
          },
          token: {
            colorPrimary: '#ea7e15',
            fontFamily: 'nunito',
          },
        }}
      >
        <RouterProvider router={router} />
      </ConfigProvider>

      {/* Dev only. This shipped to production unguarded, putting a floating
          logo on every page that let any visitor inspect the whole query
          cache — profile, orders, chats. */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
);
