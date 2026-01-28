import type { RouteObject } from "react-router-dom";
import App from "../App.tsx";
import { JobListingPage, LandingPage, ProfilePage } from "../pages";
import LeggUtOppdrag from "../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx";
import Alert from "../pages/AlertPage/Alert.tsx";
import MinProfil from "../pages/MinProfil/MinProfil.tsx";
import LoginPage from "../pages/LoginPage/LoginPage.tsx";
import RegisterPage from "../pages/RegisterPage/RegisterPage.tsx";
import { ProtectedRoute } from "../components/shared/ProtectedRoute.tsx";
import InstillingerPage from "../pages/InstillingerPage/InstillingerPage.tsx";
import AnmeldelserPage from "../pages/AnmeldelserPage/AnmeldelserPage.tsx";
import { FavoritesPage } from "../pages/FavoritesPage/FavoritesPage.tsx";
import OmOssPage from "../pages/OmOssPage/OmOssPage.tsx";
import TjenesterPage from "../pages/TjenesterPage/TjenesterPage.tsx";
import TeamPage from "../pages/TeamPage/TeamPage.tsx";
import SupportPage from "../pages/SupportPage/SupportPage.tsx";
import AnnonsereglerPage from "../pages/AnnonsereglerPage/AnnonsereglerPage.tsx";
import MineAnnonser from "../pages/MyJobsPage/MineAnnonser.tsx";
import JobListingDetailPage from "../pages/JobListingDetailPage/JobListingDetailPage.tsx";
import CoinsPage from "../pages/CoinsPage/CoinsPage.tsx";
import { MessagesPageSplit } from "../pages/MessagesPage/MessagesPageSplit.tsx";
import MinInntekt from "../pages/MinInntekt/MinInntekt.tsx";
import OAuthSuccess from "../pages/OAuthSuccess.tsx";
import { PublicRoute } from "../components/shared/PublicRoute.tsx";
import SaleSubscriptionTermsPage from "../pages/SaleSubscriptionTermsPage/SaleSubscriptionTermsPage.tsx";
import JobbloUserTerm from "../pages/UserTerm/UserTerm.tsx";
import SuccessPage from "../components/subscription/success.tsx";
import ContactSuccessPage from "../pages/ContactSuccessPage.tsx";
import UrgentPaymentSuccess from "../pages/UrgentPaymentSuccess/UrgentPaymentSuccess.tsx";
import DashboardLayout from "../pages/SuperAdminDashboard/DashboardLayout.tsx";
import UsersPage from "../pages/SuperAdminDashboard/UsersPage.tsx";
import ServicesPage from "../pages/SuperAdminDashboard/ServicesPage.tsx";
import VoucherPage from "../pages/SuperAdminDashboard/VoucherPage.tsx";
import CarouselPage from "../pages/SuperAdminDashboard/CarouselPage.tsx";
import NotificationsPage from "../pages/SuperAdminDashboard/NotificationsPage.tsx";
import { AdminProtectedRoute } from "../components/shared/AdminProtectedRoute.tsx";

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
        path: "oauth-success",
        element: <OAuthSuccess />,
      },
      {
        path: "job-listing",
        element: <JobListingPage />,
      },
      {
        path: "job-listing/:id",
        element: <JobListingDetailPage />,
      },
      {
        path: "profile",

        element: (
          <ProtectedRoute>
            <ProfilePage />,
          </ProtectedRoute>
        ),
      },
      {
        path: "mine-annonser",

        element: (
          <ProtectedRoute>
            <MineAnnonser />,
          </ProtectedRoute>
        ),
      },
      {
        path: "Publish-job",
        element: (
          <ProtectedRoute>
            <LeggUtOppdrag />,
          </ProtectedRoute>
        ),
      },
      {
        path: "Alert",
        element: (
          <ProtectedRoute>
            <Alert />,
          </ProtectedRoute>
        ),
      },
      {
        path: "Min-profil",
        element: <MinProfil />,
      },
      {
        path: "min-inntekt",
        element: (
          <ProtectedRoute>
            <MinInntekt />
          </ProtectedRoute>
        ),
      },
      {
        path: "login",
        element: (
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        ),
      },
      {
        path: "register",
        element: (
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        ),
      },
      {
        path: "Innstillinger",
        element: <InstillingerPage />,
      },
      {
        path: "Anmeldelser",
        element: <AnmeldelserPage />,
      },
      {
        path: "favoritter",
        element: <FavoritesPage />,
      },
      {
        path: "/subscription/success",
        element: <SuccessPage />,
      },
      {
        path: "coins",
        element: (
          <ProtectedRoute>
            <CoinsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "om-oss",
        element: <OmOssPage />,
      },
      {
        path: "tjenester",
        element: <TjenesterPage />,
      },
      {
        path: "team",
        element: <TeamPage />,
      },
      {
        path: "contact/success",
        element: <ContactSuccessPage />,
      },
      {
        path: "service/urgent/success",
        element: <UrgentPaymentSuccess />,
      },
      {
        path: "support",
        element: <SupportPage />,
      },
      {
        path: "annonseregler",
        element: <AnnonsereglerPage />,
      },
      {
        path: "messages",
        element: (
          <ProtectedRoute>
            <MessagesPageSplit />
          </ProtectedRoute>
        ),
      },
      {
        path: "messages/:conversationId",
        element: (
          <ProtectedRoute>
            <MessagesPageSplit />
          </ProtectedRoute>
        ),
      },

      {
        path: "sale-subscription-terms",
        element: <SaleSubscriptionTermsPage />,
      },
      {
        path: "user-term",
        element: <JobbloUserTerm />,
      },
    ],
  },
  {
    path: "dashboard",
    element: (
      <AdminProtectedRoute>
        <DashboardLayout />
      </AdminProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <AdminProtectedRoute>
            <UsersPage />
          </AdminProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <AdminProtectedRoute>
            <UsersPage />
          </AdminProtectedRoute>
        ),
      },
      {
        path: "services",
        element: (
          <AdminProtectedRoute>
            <ServicesPage />
          </AdminProtectedRoute>
        ),
      },
      {
        path: "voucher",
        element: (
          <AdminProtectedRoute>
            <VoucherPage />
          </AdminProtectedRoute>
        ),
      },
      {
        path: "carousel",
        element: (
          <AdminProtectedRoute>
            <CarouselPage />
          </AdminProtectedRoute>
        ),
      },
      {
        path: "notifications",
        element: (
          <AdminProtectedRoute>
            <NotificationsPage />
          </AdminProtectedRoute>
        ),
      },
    ],
  },
];
