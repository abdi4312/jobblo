import type { RouteObject } from "react-router-dom";
import App from "../App.tsx";
import {
  JobListingPage,
  LandingPage,
  ProfilePage,
  SettingsPage,
} from "../pages";
import { SettingsLayout } from "../components/layout/SettingsLayout/SettingsLayout.tsx";
import LeggUtOppdrag from "../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx";
import Alert from "../pages/AlertPage/Alert.tsx";
import LoginPage from "../pages/LoginPage/LoginPage.tsx";
import RegisterPage from "../pages/RegisterPage/RegisterPage.tsx";
import { ProtectedRoute } from "../components/shared/ProtectedRoute.tsx";
import AnmeldelserPage from "../pages/AnmeldelserPage/AnmeldelserPage.tsx";
import { ContractsPage } from "../pages/ContractsPage/ContractsPage.tsx";
import { ContractDetailPage } from "../pages/ContractsPage/ContractDetailPage.tsx";
import { ListDetailPage } from "../pages/FavoritesPage/ListDetail/ListDetailPage.tsx";
import TeamPage from "../pages/TeamPage/TeamPage.tsx";
import SupportPage from "../pages/SupportPage/SupportPage.tsx";
import MineAnnonser from "../pages/MyJobsPage/MineAnnonser.tsx";
import JobListingDetailPage from "../pages/JobListingDetailPage/JobListingDetailPage.tsx";
import CoinsPage from "../pages/CoinsPage/CoinsPage.tsx";
import { MessagesPageSplit } from "../pages/MessagesPage/MessagesPageSplit.tsx";
import OAuthSuccess from "../pages/OAuthSuccess.tsx";
import { PublicRoute } from "../components/shared/PublicRoute.tsx";
import SaleSubscriptionTermsPage from "../pages/SaleSubscriptionTermsPage/SaleSubscriptionTermsPage.tsx";
import JobbloUserTerm from "../pages/UserTerm/UserTerm.tsx";
import SuccessPage from "../components/subscription/success.tsx";
import ContactSuccessPage from "../pages/ContactSuccessPage.tsx";
import DashboardLayout from "../pages/SuperAdminDashboard/DashboardLayout.tsx";
import UsersPage from "../pages/SuperAdminDashboard/UsersPage.tsx";
import ServicesPage from "../pages/SuperAdminDashboard/ServicesPage.tsx";
import VoucherPage from "../pages/SuperAdminDashboard/VoucherPage.tsx";
import CarouselPage from "../pages/SuperAdminDashboard/CarouselPage.tsx";
import NotificationsPage from "../pages/SuperAdminDashboard/NotificationsPage.tsx";
import { AdminProtectedRoute } from "../components/shared/AdminProtectedRoute.tsx";
import TransactionsPage from "../pages/SuperAdminDashboard/TransactionsPage.tsx";
import ServiceListingPage from "../pages/ServiceListingPage/ServiceListing.tsx";
import UpcomingFeatures from "../pages/UpcomingFeaturesPage/UpcomingFeatures.tsx";
import RoadmapAdminPage from "../pages/SuperAdminDashboard/RoadmapAdminPage.tsx";
import PricingPage from "../pages/PricingPage/PricingPage.tsx";
import {
  UsernameView,
  NameView,
  BioView,
  PictureView,
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
} from "../components/profile/SettingsViews";

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
        path: "home",
        element: <JobListingPage />,
      },
      {
        path: "/search/job/:categoryName",
        element: <ServiceListingPage />,
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
        path: "profile/:userId",
        element: <ProfilePage />,
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
        path: "Publish-job/:id",
        element: (
          <ProtectedRoute>
            <LeggUtOppdrag />,
          </ProtectedRoute>
        ),
      },
      {
        path: "alerts",
        element: (
          <ProtectedRoute>
            <Alert />
          </ProtectedRoute>
        ),
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
            ],
          },
        ],
      },
      {
        path: "Anmeldelser",
        element: <AnmeldelserPage />,
      },
      {
        path: "contracts",
        element: (
          <ProtectedRoute>
            <ContractsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "contracts/:id",
        element: (
          <ProtectedRoute>
            <ContractDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "favorites/list/:listId",
        element: (
          <ProtectedRoute>
            <ListDetailPage />
          </ProtectedRoute>
        ),
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
        path: "team",
        element: <TeamPage />,
      },
      {
        path: "contact/success",
        element: <ContactSuccessPage />,
      },
      {
        path: "support",
        element: <SupportPage />,
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
      {
        path: "membership",
        element: (
          <ProtectedRoute>
            <PricingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "upcoming",
        element: <UpcomingFeatures />,
      },
    ],
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
        path: "transactions",
        element: (
          <AdminProtectedRoute>
            <TransactionsPage />
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
      {
        path: "roadmap",
        element: (
          <AdminProtectedRoute>
            <RoadmapAdminPage />
          </AdminProtectedRoute>
        ),
      },
    ],
  },
];
