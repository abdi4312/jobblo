import React, { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import App from '../App.tsx';
import { ProtectedRoute } from '../components/shared/ProtectedRoute.tsx';
import { PublicRoute } from '../components/shared/PublicRoute.tsx';
import { AdminProtectedRoute } from '../components/shared/AdminProtectedRoute.tsx';
import { DeveloperProtectedRoute } from '../components/shared/DeveloperProtectedRoute.tsx';
import { SettingsLayout } from '../components/layout/SettingsLayout/SettingsLayout.tsx';
import { RouteErrorElement } from '../components/ErrorBoundary.tsx';
import { PageLoader } from '../components/Loading/PageLoader.tsx';

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
  PayoutSettingsView,
} from '../components/profile/SettingsViews';

import OAuthSuccess from '../pages/OAuthSuccess.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';

// =======================
// Helpers
// =======================

// `PageLoader` is used directly rather than through a local wrapper component: this file
// also exports the `routes` table, and a component declared alongside a non-component
// export breaks fast refresh for the whole module.
const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// =======================
// User Pages
// =======================

const LandingPage = lazy(() => import('../pages/LandingPage/LandingPage.tsx'));
const CampaignTermsPage = lazy(() => import('../pages/CampaignTermsPage.tsx'));
const JobListingPage = lazy(() => import('../pages/ExplorePage/JobListingPage.tsx'));
const RecommendedTaskersPage = lazy(
  () => import('../pages/ExplorePage/RecommendedTaskersPage.tsx')
);
const ProfilePage = lazy(() => import('../pages/ProfilePage/ProfilePage.tsx'));
const LeggUtOppdrag = lazy(() => import('../pages/LeggUtOppdragPage/LeggUtOppdrag.tsx'));
const Alert = lazy(() => import('../pages/AlertPage/Alert.tsx'));
const LoginPage = lazy(() => import('../pages/LoginPage/LoginPage.tsx'));
const MfaPage = lazy(() => import('../components/shared/MfaGate.tsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage/RegisterPage.tsx'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage/ForgotPasswordPage.tsx'));
// AnmeldelserPage intentionally not imported — see the F-36 note on the removed route.
const ListDetailPage = lazy(() =>
  import('../pages/FavoritesPage/ListDetail/ListDetailPage.tsx').then((m) => ({
    default: m.ListDetailPage,
  }))
);
const TeamPage = lazy(() => import('../pages/TeamPage/TeamPage.tsx'));
const SupportPage = lazy(() => import('../pages/SupportPage/SupportPage.tsx'));
const DeleteAccountRequestPage = lazy(
  () => import('../pages/DeleteAccountRequestPage/DeleteAccountRequestPage.tsx')
);
const MineAnnonser = lazy(() => import('../pages/MyJobsPage/MineAnnonser.tsx'));
const JobListingDetailPage = lazy(
  () => import('../pages/JobListingDetailPage/JobListingDetailPage.tsx')
);
const ApplicantsPage = lazy(() => import('../pages/ApplicantsPage/ApplicantsPage.tsx'));
const MyApplicantsOverview = lazy(() => import('../pages/ApplicantsPage/MyApplicantsOverview.tsx'));
const MyApplicationsPage = lazy(() => import('../pages/MyApplicationsPage/MyApplicationsPage.tsx'));
const ProviderOrderDetailPage = lazy(
  () => import('../pages/ProviderWorkPage/ProviderOrderDetailPage.tsx')
);
const SafePayCheckout = lazy(() => import('../pages/SafePayPage/SafePayCheckout.tsx'));
const SafePaySuccess = lazy(() => import('../pages/SafePayPage/SafePaySuccess.tsx'));
const SafePayApproval = lazy(() => import('../pages/SafePayPage/SafePayApproval.tsx'));
const CoinsPage = lazy(() => import('../pages/CoinsPage/CoinsPage.tsx'));
const MessagesPageSplit = lazy(() =>
  import('../pages/MessagesPage/MessagesPageSplit.tsx').then((m) => ({
    default: m.MessagesPageSplit,
  }))
);
const SaleSubscriptionTermsPage = lazy(
  () => import('../pages/SaleSubscriptionTermsPage/SaleSubscriptionTermsPage.tsx')
);
const CookiePolicyPage = lazy(() => import('../pages/CookiePolicyPage/CookiePolicyPage.tsx'));
const AboutPage = lazy(() => import('../pages/AboutPage/AboutPage.tsx'));
const JobbloUserTerm = lazy(() => import('../pages/UserTerm/UserTerm.tsx'));
const SuccessPage = lazy(() => import('../components/subscription/success.tsx'));
const ContactSuccessPage = lazy(() => import('../pages/ContactSuccessPage.tsx'));
const ServiceListingPage = lazy(() => import('../pages/ServiceListingPage/ServiceListing.tsx'));
const UpcomingFeatures = lazy(() => import('../pages/UpcomingFeaturesPage/UpcomingFeatures.tsx'));
const MembershipPage = lazy(() => import('../pages/MembershipPage/MembershipPage.tsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage/NotFoundPage.tsx'));
const FavoritesPage = lazy(() =>
  import('../pages/FavoritesPage/FavoritesPage.tsx').then((m) => ({
    default: m.FavoritesPage,
  }))
);
const CompletedJobPage = lazy(() => import('../pages/CompletedJobPage.tsx'));

// =======================
// Admin Pages
// =======================

const DashboardLayout = lazy(() => import('../pages/SuperAdminDashboard/DashboardLayout.tsx'));

// =======================
// Developer Pages
// =======================

const DeveloperLayout = lazy(() => import('../pages/DeveloperDashboard/DeveloperLayout.tsx'));
const DevOverviewPage = lazy(() => import('../pages/DeveloperDashboard/OverviewPage.tsx'));
const DevApiMonitoringPage = lazy(() => import('../pages/DeveloperDashboard/ApiMonitoringPage.tsx'));
const DevErrorsPage = lazy(() => import('../pages/DeveloperDashboard/ErrorsPage.tsx'));
const DevServerPage = lazy(() => import('../pages/DeveloperDashboard/ServerPage.tsx'));
const DevMongoPage = lazy(() => import('../pages/DeveloperDashboard/MongoPage.tsx'));
const DevSchedulerPage = lazy(() => import('../pages/DeveloperDashboard/SchedulerPage.tsx'));
const DevWebhooksPage = lazy(() => import('../pages/DeveloperDashboard/WebhooksPage.tsx'));
const DevAuditPage = lazy(() => import('../pages/DeveloperDashboard/AuditPage.tsx'));
const DevToolsPage = lazy(() => import('../pages/DeveloperDashboard/ToolsPage.tsx'));
const DevPlannedPage = lazy(() => import('../pages/DeveloperDashboard/PlannedPage.tsx'));
const DevPaymentsPage = lazy(() => import('../pages/DeveloperDashboard/PaymentsPage.tsx'));
const DevSafePayPage = lazy(() => import('../pages/DeveloperDashboard/SafePayPage.tsx'));
const DevSubscriptionsPage = lazy(() => import('../pages/DeveloperDashboard/SubscriptionsPage.tsx'));
const DevReconciliationPage = lazy(() => import('../pages/DeveloperDashboard/ReconciliationPage.tsx'));
const DevUserDiagnosticsPage = lazy(() => import('../pages/DeveloperDashboard/UserDiagnosticsPage.tsx'));
const DevJobDiagnosticsPage = lazy(() => import('../pages/DeveloperDashboard/JobDiagnosticsPage.tsx'));
const DevLogsExplorerPage = lazy(() => import('../pages/DeveloperDashboard/LogsExplorerPage.tsx'));
const DevLiveActivityPage = lazy(() => import('../pages/DeveloperDashboard/LiveActivityPage.tsx'));
const DevSecurityPage = lazy(() => import('../pages/DeveloperDashboard/SecurityPage.tsx'));
const DevFeatureFlagsPage = lazy(() => import('../pages/DeveloperDashboard/FeatureFlagsPage.tsx'));
const DevPerformancePage = lazy(() => import('../pages/DeveloperDashboard/PerformancePage.tsx'));
const DevNotificationsPage = lazy(() => import('../pages/DeveloperDashboard/NotificationsPage.tsx'));
const DevQueuesPage = lazy(() => import('../pages/DeveloperDashboard/QueuesPage.tsx'));
const DevRedisPage = lazy(() => import('../pages/DeveloperDashboard/redis/RedisPage.tsx'));
const DevTicketsPage = lazy(() => import('../pages/DeveloperDashboard/TicketsPage.tsx'));
const DevDeploymentsPage = lazy(() => import('../pages/DeveloperDashboard/DeploymentsPage.tsx'));
const DevIncidentsPage = lazy(() => import('../pages/DeveloperDashboard/IncidentsPage.tsx'));
const DevReportsPage = lazy(() => import('../pages/DeveloperDashboard/ReportsPage.tsx'));
const DevSettingsPage = lazy(() => import('../pages/DeveloperDashboard/SettingsPage.tsx'));
const DevIpsPage = lazy(() => import('../pages/DeveloperDashboard/IpsPage.tsx'));
const DevApprovalsPage = lazy(() => import('../pages/DeveloperDashboard/ApprovalsPage.tsx'));
const DevInvestigatePage = lazy(() => import('../pages/DeveloperDashboard/InvestigatePage.tsx'));
const DevIntegrityPage = lazy(() => import('../pages/DeveloperDashboard/IntegrityPage.tsx'));
const DevBackupsPage = lazy(() => import('../pages/DeveloperDashboard/BackupsPage.tsx'));
const DevSafePayInspectorPage = lazy(() => import('../pages/DeveloperDashboard/SafePayInspectorPage.tsx'));
const DevSyntheticPage = lazy(() => import('../pages/DeveloperDashboard/SyntheticPage.tsx'));
const DevMobilePage = lazy(() => import('../pages/DeveloperDashboard/MobilePage.tsx'));
const DevDependencyMapPage = lazy(() => import('../pages/DeveloperDashboard/DependencyMapPage.tsx'));
const DevSloPage = lazy(() => import('../pages/DeveloperDashboard/SloPage.tsx'));
const DevDeploymentImpactPage = lazy(() => import('../pages/DeveloperDashboard/DeploymentImpactPage.tsx'));
const DevCostsPage = lazy(() => import('../pages/DeveloperDashboard/CostsPage.tsx'));
const DevCapacityPage = lazy(() => import('../pages/DeveloperDashboard/CapacityPage.tsx'));
const DevConfigDriftPage = lazy(() => import('../pages/DeveloperDashboard/ConfigDriftPage.tsx'));
const DevFailureSimulatorPage = lazy(() => import('../pages/DeveloperDashboard/FailureSimulatorPage.tsx'));
const DevFraudPage = lazy(() => import('../pages/DeveloperDashboard/FraudPage.tsx'));
const DevContractsPage = lazy(() => import('../pages/DeveloperDashboard/ContractsPage.tsx'));
const DevConnectHealthPage = lazy(() => import('../pages/DeveloperDashboard/ConnectHealthPage.tsx'));
const DevLedgerPage = lazy(() => import('../pages/DeveloperDashboard/LedgerPage.tsx'));
const DevTransactionsPage = lazy(() => import('../pages/DeveloperDashboard/TransactionsPage.tsx'));
const DevImpactPage = lazy(() => import('../pages/DeveloperDashboard/ImpactPage.tsx'));
const DevMarketplacePage = lazy(() => import('../pages/DeveloperDashboard/MarketplacePage.tsx'));
const DevEventConsistencyPage = lazy(() => import('../pages/DeveloperDashboard/EventConsistencyPage.tsx'));
const DevMigrationsPage = lazy(() => import('../pages/DeveloperDashboard/MigrationsPage.tsx'));
const DevRunbooksPage = lazy(() => import('../pages/DeveloperDashboard/RunbooksPage.tsx'));
const DevPrivacyPage = lazy(() => import('../pages/DeveloperDashboard/PrivacyPage.tsx'));
const DevSearchHealthPage = lazy(() => import('../pages/DeveloperDashboard/SearchHealthPage.tsx'));
const DevSessionsPage = lazy(() => import('../pages/DeveloperDashboard/SessionsPage.tsx'));
const DevQualityPage = lazy(() => import('../pages/DeveloperDashboard/QualityPage.tsx'));
const DevChangeRiskPage = lazy(() => import('../pages/DeveloperDashboard/ChangeRiskPage.tsx'));
const DevRumPage = lazy(() => import('../pages/DeveloperDashboard/RumPage.tsx'));
const DashboardOverviewPage = lazy(
  () => import('../pages/SuperAdminDashboard/DashboardOverviewPage.tsx')
);
const UsersPage = lazy(() => import('../pages/SuperAdminDashboard/UsersPage.tsx'));
const ServicesPage = lazy(() => import('../pages/SuperAdminDashboard/ServicesPage.tsx'));
const AdminEditJobPage = lazy(() => import('../pages/SuperAdminDashboard/AdminEditJobPage.tsx'));
const OrdersPage = lazy(() => import('../pages/SuperAdminDashboard/OrdersPage.tsx'));
const OrderDetailPage = lazy(() => import('../pages/SuperAdminDashboard/OrderDetailPage.tsx'));
const UserDetailPage = lazy(() => import('../pages/SuperAdminDashboard/UserDetailPage.tsx'));
const ReviewsPage = lazy(() => import('../pages/SuperAdminDashboard/ReviewsPage.tsx'));
const CategoriesPage = lazy(() => import('../pages/SuperAdminDashboard/CategoriesPage.tsx'));
const VoucherPage = lazy(() => import('../pages/SuperAdminDashboard/VoucherPage.tsx'));
const NotificationsPage = lazy(() => import('../pages/SuperAdminDashboard/NotificationsPage.tsx'));
const TransactionsPage = lazy(() => import('../pages/SuperAdminDashboard/TransactionsPage.tsx'));
const RoadmapAdminPage = lazy(() => import('../pages/SuperAdminDashboard/RoadmapAdminPage.tsx'));
const PlansAdminPage = lazy(() => import('../pages/SuperAdminDashboard/PlansAdminPage.tsx'));
const SafePayAdminPage = lazy(() => import('../pages/SuperAdminDashboard/SafePayPage.tsx'));
const FinanceHistoryPage = lazy(
  () => import('../pages/SuperAdminDashboard/FinanceHistoryPage.tsx')
);
const SubscriptionBillingAdminPage = lazy(
  () => import('../pages/SuperAdminDashboard/SubscriptionBillingAdminPage.tsx')
);
const SafePayDetailPage = lazy(() => import('../pages/SuperAdminDashboard/SafePayDetailPage.tsx'));
const DisputesPage = lazy(() => import('../pages/SuperAdminDashboard/DisputesPage.tsx'));
const DisputeDetailPage = lazy(() => import('../pages/SuperAdminDashboard/DisputeDetailPage.tsx'));

// ── Chat System Admin Pages (new) ──────────────────────────────────────────────
const ChatReviewPage = lazy(() => import('../pages/SuperAdminDashboard/ChatReviewPage.tsx'));
const AdminChatsPage = lazy(() => import('../pages/SuperAdminDashboard/AdminChatsPage.tsx'));
const AdminChatDetailsPage = lazy(
  () => import('../pages/SuperAdminDashboard/AdminChatDetailsPage.tsx')
);
const ChatReportsPage = lazy(() => import('../pages/SuperAdminDashboard/ChatReportsPage.tsx'));
const AdminChatReportDetailPage = lazy(
  () => import('../pages/SuperAdminDashboard/AdminChatReportDetailPage.tsx')
);
const JobReportsPage = lazy(() => import('../pages/SuperAdminDashboard/JobReportsPage.tsx'));
const JobReportDetailPage = lazy(
  () => import('../pages/SuperAdminDashboard/JobReportDetailPage.tsx')
);

// ── New System & Content Pages ────────────────────────────────────────────────
const HomepageCMSPage = lazy(() => import('../pages/SuperAdminDashboard/HomepageCMSPage.tsx'));
const CampaignManagementPage = lazy(() => import('../pages/SuperAdminDashboard/CampaignManagementPage.tsx'));
const GlobalSettingsPage = lazy(
  () => import('../pages/SuperAdminDashboard/GlobalSettingsPage.tsx')
);
const NavigationFooterPage = lazy(
  () => import('../pages/SuperAdminDashboard/NavigationFooterPage.tsx')
);
const AnnouncementsPage = lazy(() => import('../pages/SuperAdminDashboard/AnnouncementsPage.tsx'));
const MaintenanceModePage = lazy(
  () => import('../pages/SuperAdminDashboard/MaintenanceModePage.tsx')
);
const ShopAdminPage = lazy(() => import('../pages/SuperAdminDashboard/ShopAdminPage.tsx'));

// =======================
// Routes
// =======================

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: withSuspense(LandingPage) },
      { path: 'oauth-success', element: <OAuthSuccess /> },
      { path: 'home', element: withSuspense(JobListingPage) },
      { path: 'oppdragstakere', element: withSuspense(RecommendedTaskersPage) },
      { path: 'search', element: withSuspense(ServiceListingPage) },
      { path: 'search/job', element: withSuspense(ServiceListingPage) },
      { path: 'search/job/:categoryName', element: withSuspense(ServiceListingPage) },
      { path: 'jobs/:id', element: withSuspense(JobListingDetailPage) },
      { path: 'job-listing/:id', element: withSuspense(JobListingDetailPage) },
      {
        path: 'completed-job/:orderId?',
        element: <ProtectedRoute>{withSuspense(CompletedJobPage)}</ProtectedRoute>,
      },
      {
        path: 'job-applicants/:serviceId',
        element: <ProtectedRoute>{withSuspense(ApplicantsPage)}</ProtectedRoute>,
      },
      {
        path: 'my-applicants',
        element: <ProtectedRoute>{withSuspense(MyApplicantsOverview)}</ProtectedRoute>,
      },
      {
        path: 'my-applications',
        element: <ProtectedRoute>{withSuspense(MyApplicationsPage)}</ProtectedRoute>,
      },
      {
        path: 'provider/orders/:orderId',
        element: <ProtectedRoute>{withSuspense(ProviderOrderDetailPage)}</ProtectedRoute>,
      },
      {
        path: 'safepay/checkout/:orderId',
        element: <ProtectedRoute>{withSuspense(SafePayCheckout)}</ProtectedRoute>,
      },
      {
        path: 'safepay/success',
        element: <ProtectedRoute>{withSuspense(SafePaySuccess)}</ProtectedRoute>,
      },
      {
        path: 'safepay/approval/:orderId',
        element: <ProtectedRoute>{withSuspense(SafePayApproval)}</ProtectedRoute>,
      },
      { path: 'profile', element: <ProtectedRoute>{withSuspense(ProfilePage)}</ProtectedRoute> },
      { path: 'profile/:userId', element: withSuspense(ProfilePage) },
      {
        path: 'mine-annonser',
        element: <ProtectedRoute>{withSuspense(MineAnnonser)}</ProtectedRoute>,
      },
      {
        path: 'Publish-job',
        element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute>,
      },
      {
        path: 'Publish-job/:id',
        element: <ProtectedRoute>{withSuspense(LeggUtOppdrag)}</ProtectedRoute>,
      },
      { path: 'alerts', element: <ProtectedRoute>{withSuspense(Alert)}</ProtectedRoute> },

      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        ),
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
              { path: 'payout', element: <PayoutSettingsView /> },
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

      // (F-36) 'Anmeldelser' route removed for launch. AnmeldelserPage renders two
      // hardcoded invented reviews ("Illyas", "Dulahi", dated 04.01.2002) with a
      // hardcoded 4.5 average and makes no API call. It was a public route that
      // nothing in the live app linked to — only the dead ProfileMenuSection — so it
      // was reachable by direct URL and indexable. Re-enable only once the page reads
      // GET /api/users/:userId/reviews; it will also need a ProtectedRoute, since it
      // shows "your" received/given reviews.
      {
        path: 'favorites',
        element: <ProtectedRoute>{withSuspense(FavoritesPage)}</ProtectedRoute>,
      },
      {
        path: 'favorites/list/:listId',
        element: <ProtectedRoute>{withSuspense(ListDetailPage)}</ProtectedRoute>,
      },
      { path: 'subscription/success', element: withSuspense(SuccessPage) },
      { path: 'coins', element: <ProtectedRoute>{withSuspense(CoinsPage)}</ProtectedRoute> },
      { path: 'team', element: withSuspense(TeamPage) },
      { path: 'contact/success', element: withSuspense(ContactSuccessPage) },
      { path: 'support', element: withSuspense(SupportPage) },
      { path: 'delete-account', element: withSuspense(DeleteAccountRequestPage) },
      {
        path: 'messages',
        element: <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute>,
      },
      {
        path: 'messages/:conversationId',
        element: <ProtectedRoute>{withSuspense(MessagesPageSplit)}</ProtectedRoute>,
      },
      { path: 'sale-subscription-terms', element: withSuspense(SaleSubscriptionTermsPage) },
      { path: 'cookies', element: withSuspense(CookiePolicyPage) },
      { path: 'about', element: withSuspense(AboutPage) },
      { path: 'user-term', element: withSuspense(JobbloUserTerm) },
      {
        path: 'membership',
        element: <ProtectedRoute>{withSuspense(MembershipPage)}</ProtectedRoute>,
      },
      // Public: reachable from the job-detail upsell CTA by logged-out visitors too.
      // The pricing page was folded into /membership; old links and bookmarks still land.
      { path: 'pricing', element: <Navigate to="/membership" replace /> },
      { path: 'kampanjevilkar', element: withSuspense(CampaignTermsPage) },
      { path: 'upcoming', element: withSuspense(UpcomingFeatures) },
      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },

  {
    path: 'login',
    element: <PublicRoute>{withSuspense(LoginPage)}</PublicRoute>,
    errorElement: <RouteErrorElement />,
  },
  {
    // Admin / developer sessions that still need their authenticator code (lib/axios.ts).
    path: 'mfa',
    element: withSuspense(MfaPage),
    errorElement: <RouteErrorElement />,
  },

  {
    path: 'register',
    element: <PublicRoute>{withSuspense(RegisterPage)}</PublicRoute>,
    errorElement: <RouteErrorElement />,
  },

  {
    path: 'forgot-password',
    element: <PublicRoute>{withSuspense(ForgotPasswordPage)}</PublicRoute>,
    errorElement: <RouteErrorElement />,
  },

  {
    path: 'dashboard',
    element: <AdminProtectedRoute>{withSuspense(DashboardLayout)}</AdminProtectedRoute>,
    children: [
      { index: true, element: withSuspense(DashboardOverviewPage) },
      { path: 'users', element: withSuspense(UsersPage) },
      { path: 'users/:id', element: withSuspense(UserDetailPage) },
      { path: 'services', element: withSuspense(ServicesPage) },
      { path: 'services/:id/edit', element: withSuspense(AdminEditJobPage) },
      { path: 'orders', element: withSuspense(OrdersPage) },
      { path: 'orders/:id', element: withSuspense(OrderDetailPage) },
      { path: 'reviews', element: withSuspense(ReviewsPage) },
      { path: 'categories', element: withSuspense(CategoriesPage) },
      { path: 'voucher', element: withSuspense(VoucherPage) },
      { path: 'transactions', element: withSuspense(TransactionsPage) },
      { path: 'notifications', element: withSuspense(NotificationsPage) },
      { path: 'roadmap', element: withSuspense(RoadmapAdminPage) },
      { path: 'plans', element: withSuspense(PlansAdminPage) },
      // Moved to the Developer Console; old links redirect.
      { path: 'activity', element: <Navigate to="/developer/audit" replace /> },
      { path: 'safepay', element: withSuspense(SafePayAdminPage) },
      { path: 'finance-history', element: withSuspense(FinanceHistoryPage) },
      { path: 'subscription-billing', element: withSuspense(SubscriptionBillingAdminPage) },
      { path: 'safepay/:orderId', element: withSuspense(SafePayDetailPage) },
      { path: 'disputes', element: withSuspense(DisputesPage) },
      { path: 'disputes/:disputeId', element: withSuspense(DisputeDetailPage) },

      // ── Chat System (new) ───────────────────────────────────────────────
      { path: 'chat-review', element: withSuspense(ChatReviewPage) },
      { path: 'chats', element: withSuspense(AdminChatsPage) },
      { path: 'chats/:chatId', element: withSuspense(AdminChatDetailsPage) },
      { path: 'chat-reports', element: withSuspense(ChatReportsPage) },
      { path: 'chat-reports/:reportId', element: withSuspense(AdminChatReportDetailPage) },
      { path: 'job-reports', element: withSuspense(JobReportsPage) },
      { path: 'job-reports/:reportId', element: withSuspense(JobReportDetailPage) },

      // ── System & Content Pages (new) ──────────────────────────────────
      // Same live server view as the Developer Console (Super Admins may read /api/developer).
      { path: 'system-health', element: withSuspense(DevServerPage) },
      { path: 'feature-flags', element: <Navigate to="/developer/flags" replace /> },
      { path: 'homepage-cms', element: withSuspense(HomepageCMSPage) },
      { path: 'campaigns', element: withSuspense(CampaignManagementPage) },
      { path: 'settings', element: withSuspense(GlobalSettingsPage) },
      { path: 'navigation-footer', element: withSuspense(NavigationFooterPage) },
      { path: 'announcements', element: withSuspense(AnnouncementsPage) },
      { path: 'maintenance', element: withSuspense(MaintenanceModePage) },
      { path: 'error-logs', element: <Navigate to="/developer/errors" replace /> },
      { path: 'shop', element: withSuspense(ShopAdminPage) },

      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },

  {
    path: 'developer',
    element: <DeveloperProtectedRoute>{withSuspense(DeveloperLayout)}</DeveloperProtectedRoute>,
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: withSuspense(DevOverviewPage) },
      { path: 'api', element: withSuspense(DevApiMonitoringPage) },
      { path: 'errors', element: withSuspense(DevErrorsPage) },
      { path: 'server', element: withSuspense(DevServerPage) },
      { path: 'mongo', element: withSuspense(DevMongoPage) },
      { path: 'scheduler', element: withSuspense(DevSchedulerPage) },
      { path: 'webhooks', element: withSuspense(DevWebhooksPage) },
      { path: 'audit', element: withSuspense(DevAuditPage) },
      { path: 'tools', element: withSuspense(DevToolsPage) },
      { path: 'payments', element: withSuspense(DevPaymentsPage) },
      { path: 'safepay', element: withSuspense(DevSafePayPage) },
      { path: 'subscriptions', element: withSuspense(DevSubscriptionsPage) },
      { path: 'reconciliation', element: withSuspense(DevReconciliationPage) },
      { path: 'users', element: withSuspense(DevUserDiagnosticsPage) },
      { path: 'jobs', element: withSuspense(DevJobDiagnosticsPage) },
      { path: 'logs', element: withSuspense(DevLogsExplorerPage) },
      { path: 'live', element: withSuspense(DevLiveActivityPage) },
      { path: 'security', element: withSuspense(DevSecurityPage) },
      { path: 'flags', element: withSuspense(DevFeatureFlagsPage) },
      { path: 'performance', element: withSuspense(DevPerformancePage) },
      { path: 'notifications', element: withSuspense(DevNotificationsPage) },
      { path: 'queues', element: withSuspense(DevQueuesPage) },
      { path: 'redis/:section?', element: withSuspense(DevRedisPage) },
      { path: 'tickets', element: withSuspense(DevTicketsPage) },
      { path: 'deployments', element: withSuspense(DevDeploymentsPage) },
      { path: 'incidents', element: withSuspense(DevIncidentsPage) },
      { path: 'reports', element: withSuspense(DevReportsPage) },
      { path: 'settings', element: withSuspense(DevSettingsPage) },
      { path: 'ips', element: withSuspense(DevIpsPage) },
      { path: 'approvals', element: withSuspense(DevApprovalsPage) },
      { path: 'investigate', element: withSuspense(DevInvestigatePage) },
      { path: 'integrity', element: withSuspense(DevIntegrityPage) },
      { path: 'backups', element: withSuspense(DevBackupsPage) },
      { path: 'safepay-machine', element: withSuspense(DevSafePayInspectorPage) },
      { path: 'synthetic', element: withSuspense(DevSyntheticPage) },
      { path: 'mobile', element: withSuspense(DevMobilePage) },
      { path: 'dependencies', element: withSuspense(DevDependencyMapPage) },
      { path: 'slo', element: withSuspense(DevSloPage) },
      { path: 'deployment-impact', element: withSuspense(DevDeploymentImpactPage) },
      { path: 'costs', element: withSuspense(DevCostsPage) },
      { path: 'capacity', element: withSuspense(DevCapacityPage) },
      { path: 'config-drift', element: withSuspense(DevConfigDriftPage) },
      { path: 'failure-simulator', element: withSuspense(DevFailureSimulatorPage) },
      { path: 'fraud', element: withSuspense(DevFraudPage) },
      { path: 'contracts', element: withSuspense(DevContractsPage) },
      { path: 'connect', element: withSuspense(DevConnectHealthPage) },
      { path: 'ledger', element: withSuspense(DevLedgerPage) },
      { path: 'transactions', element: withSuspense(DevTransactionsPage) },
      { path: 'rum', element: withSuspense(DevRumPage) },
      { path: 'risk', element: withSuspense(DevChangeRiskPage) },
      { path: 'quality', element: withSuspense(DevQualityPage) },
      { path: 'sessions', element: withSuspense(DevSessionsPage) },
      { path: 'search', element: withSuspense(DevSearchHealthPage) },
      { path: 'privacy', element: withSuspense(DevPrivacyPage) },
      { path: 'runbooks', element: withSuspense(DevRunbooksPage) },
      { path: 'migrations', element: withSuspense(DevMigrationsPage) },
      { path: 'event-consistency', element: withSuspense(DevEventConsistencyPage) },
      { path: 'marketplace', element: withSuspense(DevMarketplacePage) },
      { path: 'impact', element: withSuspense(DevImpactPage) },
      { path: '*', element: withSuspense(DevPlannedPage) },
    ],
  },
];
