import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import App from '../App.tsx';
import { ProtectedRoute } from '../components/shared/ProtectedRoute.tsx';
import { PublicRoute } from '../components/shared/PublicRoute.tsx';
import { AdminProtectedRoute } from '../components/shared/AdminProtectedRoute.tsx';
import { SettingsLayout } from '../components/layout/SettingsLayout/SettingsLayout.tsx';
import Lottie from 'lottie-react';
import Loging from '../assets/animations/loading.json';

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
  SafePayHistoryView,
} from '../components/profile/SettingsViews';

import OAuthSuccess from '../pages/OAuthSuccess.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';

// =======================
// Loading
// =======================

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
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
// User Pages
// =======================

const LandingPage = lazy(() => import('../pages/LandingPage/LandingPage.tsx'));
const JobListingPage = lazy(() => import('../pages/ExplorePage/JobListingPage.tsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage/ProfilePage.tsx'));
const LeggUtOppdrag = lazy(() => import('../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx'));
const Alert = lazy(() => import('../pages/AlertPage/Alert.tsx'));
const LoginPage = lazy(() => import('../pages/LoginPage/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage/RegisterPage.tsx'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage/ForgotPasswordPage.tsx'));
const AnmeldelserPage = lazy(() => import('../pages/AnmeldelserPage/AnmeldelserPage.tsx'));
const ListDetailPage = lazy(() =>
  import('../pages/FavoritesPage/ListDetail/ListDetailPage.tsx').then((m) => ({
    default: m.ListDetailPage,
  }))
);
const TeamPage = lazy(() => import('../pages/TeamPage/TeamPage.tsx'));
const SupportPage = lazy(() => import('../pages/SupportPage/SupportPage.tsx'));
const MineAnnonser = lazy(() => import('../pages/MyJobsPage/MineAnnonser.tsx'));
const JobListingDetailPage = lazy(() => import('../pages/JobListingDetailPage/JobListingDetailPage.tsx'));
const ApplicantsPage = lazy(() => import('../pages/ApplicantsPage/ApplicantsPage.tsx'));
const MyApplicantsOverview = lazy(() => import('../pages/ApplicantsPage/MyApplicantsOverview.tsx'));
const MyApplicationsPage = lazy(() => import('../pages/MyApplicationsPage/MyApplicationsPage.tsx'));
const ProviderOrderDetailPage = lazy(() => import('../pages/ProviderWorkPage/ProviderOrderDetailPage.tsx'));
const SafePayCheckout = lazy(() => import('../pages/SafePayPage/SafePayCheckout.tsx'));
const SafePaySuccess = lazy(() => import('../pages/SafePayPage/SafePaySuccess.tsx'));
const SafePayApproval = lazy(() => import('../pages/SafePayPage/SafePayApproval.tsx'));
const CoinsPage = lazy(() => import('../pages/CoinsPage/CoinsPage.tsx'));
const MessagesPageSplit = lazy(() =>
  import('../pages/MessagesPage/MessagesPageSplit.tsx').then((m) => ({
    default: m.MessagesPageSplit,
  }))
);
const SaleSubscriptionTermsPage = lazy(() => import('../pages/SaleSubscriptionTermsPage/SaleSubscriptionTermsPage.tsx'));
const JobbloUserTerm = lazy(() => import('../pages/UserTerm/UserTerm.tsx'));
const SuccessPage = lazy(() => import('../components/subscription/success.tsx'));
const ContactSuccessPage = lazy(() => import('../pages/ContactSuccessPage.tsx'));
const ServiceListingPage = lazy(() => import('../pages/ServiceListingPage/ServiceListing.tsx'));
const UpcomingFeatures = lazy(() => import('../pages/UpcomingFeaturesPage/UpcomingFeatures.tsx'));
const PricingPage = lazy(() => import('../pages/PricingPage/PricingPage.tsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage/NotFoundPage.tsx'));
const CompletedJobPage = lazy(() => import('../pages/CompletedJobPage.tsx'));

// =======================
// Admin Pages
// =======================

const DashboardLayout = lazy(() => import('../pages/SuperAdminDashboard/DashboardLayout.tsx'));
const DashboardOverviewPage = lazy(() => import('../pages/SuperAdminDashboard/DashboardOverviewPage.tsx'));
const UsersPage = lazy(() => import('../pages/SuperAdminDashboard/UsersPage.tsx'));
const ServicesPage = lazy(() => import('../pages/SuperAdminDashboard/ServicesPage.tsx'));
const OrdersPage = lazy(() => import('../pages/SuperAdminDashboard/OrdersPage.tsx'));
const ReviewsPage = lazy(() => import('../pages/SuperAdminDashboard/ReviewsPage.tsx'));
const CategoriesPage = lazy(() => import('../pages/SuperAdminDashboard/CategoriesPage.tsx'));
const VoucherPage = lazy(() => import('../pages/SuperAdminDashboard/VoucherPage.tsx'));
const CarouselPage = lazy(() => import('../pages/SuperAdminDashboard/CarouselPage.tsx'));
const HomeHeroPage = lazy(() => import('../pages/SuperAdminDashboard/HomeHeroPage.tsx'));
const NotificationsPage = lazy(() => import('../pages/SuperAdminDashboard/NotificationsPage.tsx'));
const TransactionsPage = lazy(() => import('../pages/SuperAdminDashboard/TransactionsPage.tsx'));
const RoadmapAdminPage = lazy(() => import('../pages/SuperAdminDashboard/RoadmapAdminPage.tsx'));
const PlansAdminPage = lazy(() => import('../pages/SuperAdminDashboard/PlansAdminPage.tsx'));
const ActivityLogPage = lazy(() => import('../pages/SuperAdminDashboard/ActivityLogPage.tsx'));
const SafePayAdminPage = lazy(() => import('../pages/SuperAdminDashboard/SafePayPage.tsx'));
const SafePayDetailPage = lazy(() => import('../pages/SuperAdminDashboard/SafePayDetailPage.tsx'));
const DisputesPage = lazy(() => import('../pages/SuperAdminDashboard/DisputesPage.tsx'));
const DisputeDetailPage = lazy(() => import('../pages/SuperAdminDashboard/DisputeDetailPage.tsx'));

// ── Chat System Admin Pages (new) ──────────────────────────────────────────────
const ChatReviewPage = lazy(() => import('../pages/SuperAdminDashboard/ChatReviewPage.tsx'));
const AdminChatsPage = lazy(() => import('../pages/SuperAdminDashboard/AdminChatsPage.tsx'));
const AdminChatDetailsPage = lazy(() => import('../pages/SuperAdminDashboard/AdminChatDetailsPage.tsx'));
const ChatReportsPage = lazy(() => import('../pages/SuperAdminDashboard/ChatReportsPage.tsx'));
const AdminChatReportDetailPage = lazy(() => import('../pages/SuperAdminDashboard/AdminChatReportDetailPage.tsx'));

// ── New System & Content Pages ────────────────────────────────────────────────
const SystemHealthPage = lazy(() => import('../pages/SuperAdminDashboard/SystemHealthPage.tsx'));
const FeatureFlagsPage = lazy(() => import('../pages/SuperAdminDashboard/FeatureFlagsPage.tsx'));
const HomepageCMSPage = lazy(() => import('../pages/SuperAdminDashboard/HomepageCMSPage.tsx'));
const GlobalSettingsPage = lazy(() => import('../pages/SuperAdminDashboard/GlobalSettingsPage.tsx'));
const NavigationFooterPage = lazy(() => import('../pages/SuperAdminDashboard/NavigationFooterPage.tsx'));
const AnnouncementsPage = lazy(() => import('../pages/SuperAdminDashboard/AnnouncementsPage.tsx'));
const MaintenanceModePage = lazy(() => import('../pages/SuperAdminDashboard/MaintenanceModePage.tsx'));
const ErrorLogsPage = lazy(() => import('../pages/SuperAdminDashboard/ErrorLogsPage.tsx'));
const ShopAdminPage = lazy(() => import('../pages/SuperAdminDashboard/ShopAdminPage.tsx'));

// =======================
// Routes
// =======================

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: withSuspense(LandingPage) },
      { path: 'oauth-success', element: <OAuthSuccess /> },
      { path: 'home', element: withSuspense(JobListingPage) },
      { path: 'search/job/:categoryName', element: withSuspense(ServiceListingPage) },
      { path: 'job-listing/:id', element: withSuspense(JobListingDetailPage) },
      { path: 'completed-job/:orderId?', element: <ProtectedRoute>{withSuspense(CompletedJobPage)}</ProtectedRoute> },
      { path: 'job-applicants/:serviceId', element: <ProtectedRoute>{withSuspense(ApplicantsPage)}</ProtectedRoute> },
      { path: 'my-applicants', element: <ProtectedRoute>{withSuspense(MyApplicantsOverview)}</ProtectedRoute> },
      { path: 'my-applications', element: <ProtectedRoute>{withSuspense(MyApplicationsPage)}</ProtectedRoute> },
      { path: 'provider/orders/:orderId', element: <ProtectedRoute>{withSuspense(ProviderOrderDetailPage)}</ProtectedRoute> },
      { path: 'safepay/checkout/:orderId', element: <ProtectedRoute>{withSuspense(SafePayCheckout)}</ProtectedRoute> },
      { path: 'safepay/success', element: <ProtectedRoute>{withSuspense(SafePaySuccess)}</ProtectedRoute> },
      { path: 'safepay/approval/:orderId', element: <ProtectedRoute>{withSuspense(SafePayApproval)}</ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute>{withSuspense(ProfilePage)}</ProtectedRoute> },
      { path: 'profile/:userId', element: withSuspense(ProfilePage) },
      { path: 'mine-annonser', element: <ProtectedRoute>{withSuspense(MineAnnonser)}</ProtectedRoute> },
      { path: 'Publish-job', element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute> },
      { path: 'Publish-job/:id', element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute> },
      { path: 'alerts', element: <ProtectedRoute>{withSuspense(Alert)}</ProtectedRoute> },

      {
        path: 'settings',
        element: <ProtectedRoute><SettingsLayout /></ProtectedRoute>,
        children: [
          {
            path: '',
            element: <SettingsPage />,
            children: [
              { index: true, element: <UsernameView /> },
              { path: 'name', element: <NameView /> },
              { path: 'bio', element: <BioView /> },
              { path: 'picture', element: <PictureView /> },
              { path: 'banner', element: <BannerView /> },
              { path: 'email', element: <EmailView /> },
              { path: 'phone', element: <PhoneView /> },
              { path: 'addresses', element: <AddressesView /> },
              { path: 'safepay', element: <SafePayHistoryView /> },
              { path: 'password', element: <PasswordView /> },
              { path: 'delete-account', element: <DeleteAccountView /> },
              { path: 'location', element: <LocationView /> },
              { path: 'upcoming', element: <UpcomingPreviewView /> },
              { path: 'visibility', element: <VisibilityView /> },
              { path: 'blocked', element: <BlockedUsersView /> },
              { path: 'cookies', element: <CookiesView /> },
              { path: 'sessions', element: <SessionsView /> },
              { path: 'about', element: <AboutView /> },
              { path: 'notifications', element: <NotificationsView /> },
              { path: 'subscriptions', element: <SubscriptionView /> },
              { path: 'seeker', element: <SeekerSettingsView /> },
            ],
          },
        ],
      },

      { path: 'Anmeldelser', element: withSuspense(AnmeldelserPage) },
      { path: 'favorites/list/:listId', element: <ProtectedRoute>{withSuspense(ListDetailPage)}</ProtectedRoute> },
      { path: 'subscription/success', element: withSuspense(SuccessPage) },
      { path: 'coins', element: <ProtectedRoute>{withSuspense(CoinsPage)}</ProtectedRoute> },
      { path: 'team', element: withSuspense(TeamPage) },
      { path: 'contact/success', element: withSuspense(ContactSuccessPage) },
      { path: 'support', element: withSuspense(SupportPage) },
      { path: 'messages', element: <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute> },
      { path: 'messages/:conversationId', element: <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute> },
      { path: 'sale-subscription-terms', element: withSuspense(SaleSubscriptionTermsPage) },
      { path: 'user-term', element: withSuspense(JobbloUserTerm) },
      { path: 'membership', element: <ProtectedRoute>{withSuspense(PricingPage)}</ProtectedRoute> },
      { path: 'upcoming', element: withSuspense(UpcomingFeatures) },
      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },

  {
    path: 'login',
    element: <PublicRoute>{withSuspense(LoginPage)}</PublicRoute>,
  },

  {
    path: 'register',
    element: <PublicRoute>{withSuspense(RegisterPage)}</PublicRoute>,
  },

  {
    path: 'forgot-password',
    element: <PublicRoute>{withSuspense(ForgotPasswordPage)}</PublicRoute>,
  },

  {
    path: 'dashboard',
    element: <AdminProtectedRoute>{withSuspense(DashboardLayout)}</AdminProtectedRoute>,
    children: [
      { index: true, element: withSuspense(DashboardOverviewPage) },
      { path: 'users', element: withSuspense(UsersPage) },
      { path: 'services', element: withSuspense(ServicesPage) },
      { path: 'orders', element: withSuspense(OrdersPage) },
      { path: 'reviews', element: withSuspense(ReviewsPage) },
      { path: 'categories', element: withSuspense(CategoriesPage) },
      { path: 'voucher', element: withSuspense(VoucherPage) },
      { path: 'carousel', element: withSuspense(CarouselPage) },
      { path: 'home-hero', element: withSuspense(HomeHeroPage) },
      { path: 'transactions', element: withSuspense(TransactionsPage) },
      { path: 'notifications', element: withSuspense(NotificationsPage) },
      { path: 'roadmap', element: withSuspense(RoadmapAdminPage) },
      { path: 'plans', element: withSuspense(PlansAdminPage) },
      { path: 'activity', element: withSuspense(ActivityLogPage) },
      { path: 'safepay', element: withSuspense(SafePayAdminPage) },
      { path: 'safepay/:orderId', element: withSuspense(SafePayDetailPage) },
      { path: 'disputes', element: withSuspense(DisputesPage) },
      { path: 'disputes/:disputeId', element: withSuspense(DisputeDetailPage) },

      // ── Chat System (new) ───────────────────────────────────────────────
      { path: 'chat-review', element: withSuspense(ChatReviewPage) },
      { path: 'chats', element: withSuspense(AdminChatsPage) },
      { path: 'chats/:chatId', element: withSuspense(AdminChatDetailsPage) },
      { path: 'chat-reports', element: withSuspense(ChatReportsPage) },
      { path: 'chat-reports/:reportId', element: withSuspense(AdminChatReportDetailPage) },

      // ── System & Content Pages (new) ──────────────────────────────────
      { path: 'system-health', element: withSuspense(SystemHealthPage) },
      { path: 'feature-flags', element: withSuspense(FeatureFlagsPage) },
      { path: 'homepage-cms', element: withSuspense(HomepageCMSPage) },
      { path: 'settings', element: withSuspense(GlobalSettingsPage) },
      { path: 'navigation-footer', element: withSuspense(NavigationFooterPage) },
      { path: 'announcements', element: withSuspense(AnnouncementsPage) },
      { path: 'maintenance', element: withSuspense(MaintenanceModePage) },
      { path: 'error-logs', element: withSuspense(ErrorLogsPage) },
      { path: 'shop', element: withSuspense(ShopAdminPage) },

      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },
];
