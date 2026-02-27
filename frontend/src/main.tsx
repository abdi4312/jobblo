import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/index.css";
import "leaflet/dist/leaflet.css";
import { ConfigProvider } from "antd";
import "@ant-design/v5-patch-for-react-19";
import { routes } from "./routing/Routes.tsx";

// TanStack Query Imports
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

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

createRoot(document.getElementById("root")!).render(
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
            colorPrimary: "#ea7e15",
            fontFamily: "nunito",
          },
        }}
      >
        <RouterProvider router={router} />
      </ConfigProvider>
      
      {/* Devtools debugging ke liye best hain */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);