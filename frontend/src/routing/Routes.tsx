import React, { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import App from "../App.tsx";
import MainLoading from "../assets/loading/main-loading.gif";
import { ProtectedRoute } from "../components/shared/ProtectedRoute.tsx";
import { PublicRoute } from "../components/shared/PublicRoute.tsx";
import { AdminProtectedRoute } from "../components/shared/AdminProtectedRoute.tsx";
import { SettingsLayout } from "../components/layout/SettingsLayout/SettingsLayout.tsx";
import Lottie from "lottie-react";
import Loging from "../assets/animations/loading.json";

import {
  UsernameView,
  NameView,
  BioView,
  PictureView,
  BannerView,
  EmailView,
  PhoneView,
  AddressesView,
  PasswordView,
  DeleteAccountView,
  LocationView,
  UpcomingPreviewView,
  VisibilityView,
  BlockedUsersView,
  CookiesView,
  SessionsView,
  AboutView,
  SubscriptionView,
  NotificationsView,
  SeekerSettingsView,
} from "../components/profile/SettingsViews";

import OAuthSuccess from "../pages/OAuthSuccess.tsx";
import SettingsPage from "../pages/SettingsPage.tsx";

// =======================
// Loading
// =======================

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    {/* <div className="w-10 h-10 border-4 border-custom-green/30 border-t-custom-green rounded-full animate-spin" /> */}
    <Lottie animationData={Loging} loop autoplay />
  </div>
);

// =======================
// Helpers
// =======================

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
);

// =======================
// Pages
// =======================

const LandingPage = lazy(() => import("../pages/LandingPage/LandingPage.tsx"));
const JobListingPage = lazy(() => import("../pages/ExplorePage/JobListingPage.tsx"));
const ProfilePage = lazy(() => import("../pages/ProfilePage/ProfilePage.tsx"));

const LeggUtOppdrag = lazy(
  () => import("../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx"),
);
const Alert = lazy(() => import("../pages/AlertPage/Alert.tsx"));
const LoginPage = lazy(() => import("../pages/LoginPage/LoginPage.tsx"));
const RegisterPage = lazy(
  () => import("../pages/RegisterPage/RegisterPage.tsx"),
);
const AnmeldelserPage = lazy(
  () => import("../pages/AnmeldelserPage/AnmeldelserPage.tsx"),
);

const ContractsPage = lazy(() =>
  import("../pages/ContractsPage/ContractsPage.tsx").then((m) => ({
    default: m.ContractsPage,
  })),
);
const ContractDetailPage = lazy(() =>
  import("../pages/ContractsPage/ContractDetailPage.tsx").then((m) => ({
    default: m.ContractDetailPage,
  })),
);
const ListDetailPage = lazy(() =>
  import("../pages/FavoritesPage/ListDetail/ListDetailPage.tsx").then((m) => ({
    default: m.ListDetailPage,
  })),
);

const TeamPage = lazy(() => import("../pages/TeamPage/TeamPage.tsx"));
const SupportPage = lazy(() => import("../pages/SupportPage/SupportPage.tsx"));
const MineAnnonser = lazy(() => import("../pages/MyJobsPage/MineAnnonser.tsx"));
const JobListingDetailPage = lazy(
  () => import("../pages/JobListingDetailPage/JobListingDetailPage.tsx"),
);
const CoinsPage = lazy(() => import("../pages/CoinsPage/CoinsPage.tsx"));
const MessagesPageSplit = lazy(() =>
  import("../pages/MessagesPage/MessagesPageSplit.tsx").then((m) => ({
    default: m.MessagesPageSplit,
  })),
);

const SaleSubscriptionTermsPage = lazy(
  () =>
    import("../pages/SaleSubscriptionTermsPage/SaleSubscriptionTermsPage.tsx"),
);
const JobbloUserTerm = lazy(() => import("../pages/UserTerm/UserTerm.tsx"));
const SuccessPage = lazy(
  () => import("../components/subscription/success.tsx"),
);
const ContactSuccessPage = lazy(
  () => import("../pages/ContactSuccessPage.tsx"),
);
const ServiceListingPage = lazy(
  () => import("../pages/ServiceListingPage/ServiceListing.tsx"),
);
const UpcomingFeatures = lazy(
  () => import("../pages/UpcomingFeaturesPage/UpcomingFeatures.tsx"),
);
const PricingPage = lazy(() => import("../pages/PricingPage/PricingPage.tsx"));
const NotFoundPage = lazy(
  () => import("../pages/NotFoundPage/NotFoundPage.tsx"),
);

// =======================
// Admin Pages
// =======================

const DashboardLayout = lazy(
  () => import("../pages/SuperAdminDashboard/DashboardLayout.tsx"),
);
const UsersPage = lazy(
  () => import("../pages/SuperAdminDashboard/UsersPage.tsx"),
);
const ServicesPage = lazy(
  () => import("../pages/SuperAdminDashboard/ServicesPage.tsx"),
);
const VoucherPage = lazy(
  () => import("../pages/SuperAdminDashboard/VoucherPage.tsx"),
);
const CarouselPage = lazy(
  () => import("../pages/SuperAdminDashboard/CarouselPage.tsx"),
);
const NotificationsPage = lazy(
  () => import("../pages/SuperAdminDashboard/NotificationsPage.tsx"),
);
const TransactionsPage = lazy(
  () => import("../pages/SuperAdminDashboard/TransactionsPage.tsx"),
);
const RoadmapAdminPage = lazy(
  () => import("../pages/SuperAdminDashboard/RoadmapAdminPage.tsx"),
);

// =======================
// Routes
// =======================

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: withSuspense(LandingPage),
      },

      {
        path: "oauth-success",
        element: <OAuthSuccess />,
      },

      {
        path: "home",
        element: withSuspense(JobListingPage),
      },

      {
        path: "search/job/:categoryName",
        element: withSuspense(ServiceListingPage),
      },

      {
        path: "job-listing/:id",
        element: withSuspense(JobListingDetailPage),
      },

      {
        path: "profile",
        element: <ProtectedRoute>{withSuspense(ProfilePage)}</ProtectedRoute>,
      },

      {
        path: "profile/:userId",
        element: withSuspense(ProfilePage),
      },

      {
        path: "mine-annonser",
        element: <ProtectedRoute>{withSuspense(MineAnnonser)}</ProtectedRoute>,
      },

      {
        path: "Publish-job",
        element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute>,
      },

      {
        path: "Publish-job/:id",
        element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute>,
      },

      {
        path: "alerts",
        element: <ProtectedRoute>{withSuspense(Alert)}</ProtectedRoute>,
      },

      {
        path: "settings",
        element: (
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        ),

        children: [
          {
            path: "",
            element: <SettingsPage />,
            children: [
              { index: true, element: <UsernameView /> },
              { path: "name", element: <NameView /> },
              { path: "bio", element: <BioView /> },
              { path: "picture", element: <PictureView /> },
              { path: "banner", element: <BannerView /> },
              { path: "email", element: <EmailView /> },
              { path: "phone", element: <PhoneView /> },
              { path: "addresses", element: <AddressesView /> },
              { path: "password", element: <PasswordView /> },
              { path: "delete-account", element: <DeleteAccountView /> },
              { path: "location", element: <LocationView /> },
              { path: "upcoming", element: <UpcomingPreviewView /> },
              { path: "visibility", element: <VisibilityView /> },
              { path: "blocked", element: <BlockedUsersView /> },
              { path: "cookies", element: <CookiesView /> },
              { path: "sessions", element: <SessionsView /> },
              { path: "about", element: <AboutView /> },
              { path: "notifications", element: <NotificationsView /> },
              { path: "subscriptions", element: <SubscriptionView /> },
              { path: "seeker", element: <SeekerSettingsView /> },
            ],
          },
        ],
      },

      {
        path: "Anmeldelser",
        element: withSuspense(AnmeldelserPage),
      },

      {
        path: "contracts",
        element: <ProtectedRoute>{withSuspense(ContractsPage)}</ProtectedRoute>,
      },

      {
        path: "contracts/:id",
        element: (
          <ProtectedRoute>{withSuspense(ContractDetailPage)}</ProtectedRoute>
        ),
      },

      {
        path: "favorites/list/:listId",
        element: (
          <ProtectedRoute>{withSuspense(ListDetailPage)}</ProtectedRoute>
        ),
      },

      {
        path: "subscription/success",
        element: withSuspense(SuccessPage),
      },

      {
        path: "coins",
        element: <ProtectedRoute>{withSuspense(CoinsPage)}</ProtectedRoute>,
      },

      {
        path: "team",
        element: withSuspense(TeamPage),
      },

      {
        path: "contact/success",
        element: withSuspense(ContactSuccessPage),
      },

      {
        path: "support",
        element: withSuspense(SupportPage),
      },

      {
        path: "messages",
        element: (
          <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute>
        ),
      },

      {
        path: "messages/:conversationId",
        element: (
          <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute>
        ),
      },

      {
        path: "sale-subscription-terms",
        element: withSuspense(SaleSubscriptionTermsPage),
      },

      {
        path: "user-term",
        element: withSuspense(JobbloUserTerm),
      },

      {
        path: "membership",
        element: <ProtectedRoute>{withSuspense(PricingPage)}</ProtectedRoute>,
      },

      {
        path: "upcoming",
        element: withSuspense(UpcomingFeatures),
      },

      {
        path: "*",
        element: withSuspense(NotFoundPage),
      },
    ],
  },

  {
    path: "login",
    element: <PublicRoute>{withSuspense(LoginPage)}</PublicRoute>,
  },

  {
    path: "register",
    element: <PublicRoute>{withSuspense(RegisterPage)}</PublicRoute>,
  },

  {
    path: "dashboard",
    element: (
      <AdminProtectedRoute>{withSuspense(DashboardLayout)}</AdminProtectedRoute>
    ),

    children: [
      {
        index: true,
        element: withSuspense(UsersPage),
      },

      {
        path: "users",
        element: withSuspense(UsersPage),
      },

      {
        path: "services",
        element: withSuspense(ServicesPage),
      },

      {
        path: "voucher",
        element: withSuspense(VoucherPage),
      },

      {
        path: "carousel",
        element: withSuspense(CarouselPage),
      },

      {
        path: "transactions",
        element: withSuspense(TransactionsPage),
      },

      {
        path: "notifications",
        element: withSuspense(NotificationsPage),
      },

      {
        path: "roadmap",
        element: withSuspense(RoadmapAdminPage),
      },

      {
        path: "*",
        element: withSuspense(NotFoundPage),
      },
    ],
  },
];
