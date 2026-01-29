import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/index.css";
import "leaflet/dist/leaflet.css";
import { ConfigProvider } from "antd";
import "@ant-design/v5-patch-for-react-19";
import { routes } from "./routing/Routes.tsx";

const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
  </StrictMode>,
);
