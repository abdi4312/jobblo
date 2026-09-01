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

// Re-inject the ad script for a returning visitor who already accepted.
initCookieConsent();

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
