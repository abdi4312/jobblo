import type { RouteObject } from "react-router-dom";
import App from "../App.tsx";
import { JobListingPage, LandingPage, ProfilePage } from "../pages";
import LeggUtOppdrag from "../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx";
import Alert from "../pages/AlertPage/Alert.tsx";
import MinProfil from "../pages/ProfilePage/MinProfil.tsx";
import LoginPage from "../pages/LoginPage/LoginPage.tsx";
import RegisterPage from "../pages/RegisterPage/RegisterPage.tsx";
import { ProtectedRoute } from "../components/shared/ProtectedRoute.tsx";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "job-listing",
        element: (
          <ProtectedRoute>
            <JobListingPage />,
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "Publish-job",
        element: <LeggUtOppdrag />,
      },
      {
        path: "Alert",
        element: <Alert />,
      },
      {
        path: "Min-profil",
        element: <MinProfil />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
    ],
  },
];
