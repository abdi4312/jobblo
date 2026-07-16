const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimiter');

const dashboardController = require('../../controllers/admin/dashboardController');
const usersAdminController = require('../../controllers/admin/usersAdminController');
const activityAdminController = require('../../controllers/admin/activityAdminController');
const ordersAdminController = require('../../controllers/admin/ordersAdminController');
const servicesAdminController = require('../../controllers/admin/servicesAdminController');
const reviewsAdminController = require('../../controllers/admin/reviewsAdminController');
const categoriesAdminController = require('../../controllers/admin/categoriesAdminController');
const transactionsAdminController = require('../../controllers/admin/transactionsAdminController');
const safePayAdminController = require('../../controllers/admin/safePayAdminController');
const disputesAdminController = require('../../controllers/admin/disputesAdminController');
const chatsAdminController = require('../../controllers/admin/chatsAdminController');
const chatReportsAdminController = require('../../controllers/admin/chatReportsAdminController');
const systemAdminController = require('../../controllers/admin/systemAdminController');
const contentAdminController = require('../../controllers/admin/contentAdminController');
const evidenceUploadController = require('../../controllers/admin/evidenceUploadController');
const shopAdminController = require('../../controllers/admin/shopAdminController');

// Apply auth + admin check + rate limiter to ALL routes
router.use(authenticate, requireAdmin, adminLimiter);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/overview', dashboardController.getOverview);

// ── Users ──────────────────────────────────────────────────────────────────
router.get('/users', usersAdminController.getUsers);
router.post('/users', usersAdminController.createUser);
router.get('/users/:id', usersAdminController.getUserById);
router.put('/users/:id/role', usersAdminController.changeUserRole);
router.put('/users/:id/status', usersAdminController.updateUserStatus);
router.put('/users/:id/verify', usersAdminController.verifyUser);
router.delete('/users/:id', usersAdminController.softDeleteUser);
router.put('/users/:id/restore', usersAdminController.restoreUser);
router.delete('/users/:id/sessions', usersAdminController.revokeUserSessions);

// ── Orders ─────────────────────────────────────────────────────────────────
router.get('/orders', ordersAdminController.getOrders);
router.get('/orders/:id', ordersAdminController.getOrderById);
router.put('/orders/:id/status', ordersAdminController.updateOrderStatus);

// ── Services ───────────────────────────────────────────────────────────────
router.get('/services', servicesAdminController.getServices);
router.get('/services/:id', servicesAdminController.getServiceById);
router.put('/services/:id/status', servicesAdminController.updateServiceStatus);
router.delete('/services/:id', servicesAdminController.deleteService);

// ── Reviews ────────────────────────────────────────────────────────────────
router.get('/reviews', reviewsAdminController.getReviews);
router.delete('/reviews/:id', reviewsAdminController.deleteReview);

// ── Categories ─────────────────────────────────────────────────────────────
router.get('/categories', categoriesAdminController.getCategories);
router.post('/categories', categoriesAdminController.createCategory);
router.put('/categories/:id', categoriesAdminController.updateCategory);
router.put('/categories/:id/toggle', categoriesAdminController.toggleCategory);
router.delete('/categories/:id', categoriesAdminController.deleteCategory);

// ── Transactions ───────────────────────────────────────────────────────────
router.get('/transactions', transactionsAdminController.getTransactions);
router.get('/transactions/:id', transactionsAdminController.getTransactionById);

// ── SafePay ────────────────────────────────────────────────────────────────
router.get('/safepay', safePayAdminController.getSafePayList);
router.get('/safepay/summary', safePayAdminController.getSafePaySummary);
router.get('/safepay/:orderId', safePayAdminController.getSafePayDetail);
router.get('/safepay/:orderId/timeline', safePayAdminController.getSafePayTimeline);
router.get('/safepay/:orderId/chat', safePayAdminController.getSafePayChat);

// ── Disputes ───────────────────────────────────────────────────────────────
router.get('/disputes', disputesAdminController.getDisputes);
router.get('/disputes/summary', disputesAdminController.getDisputesSummary);
router.get('/disputes/:disputeId', disputesAdminController.getDisputeById);
router.patch('/disputes/:disputeId/assign', disputesAdminController.assignDispute);
router.patch('/disputes/:disputeId/status', disputesAdminController.updateDisputeStatus);
router.post('/disputes/:disputeId/request-information', disputesAdminController.requestInformation);
router.post('/disputes/:disputeId/message', disputesAdminController.addDisputeMessage);
router.post('/disputes/:disputeId/internal-note', disputesAdminController.addInternalNote);
router.post('/disputes/:disputeId/resolve', disputesAdminController.resolveDispute);
router.post('/disputes/:disputeId/reopen', disputesAdminController.reopenDispute);

// ── Admin Chats ────────────────────────────────────────────────────────────
router.get('/chats', chatsAdminController.getChats);
router.get('/chats/:chatId', chatsAdminController.getChatById);
router.get('/chats/:chatId/messages', chatsAdminController.getChatMessages);
router.get('/chats/:chatId/reports', chatsAdminController.getChatReports);
router.post('/chats/:chatId/access-log', chatsAdminController.logChatAccess);
// ── Admin Chat Reports ─────────────────────────────────────────────────────
router.get('/chat-reports', chatReportsAdminController.getReports);
router.get('/chat-reports/:reportId', chatReportsAdminController.getReportById);
router.patch('/chat-reports/:reportId/assign', chatReportsAdminController.assignReport);
router.patch('/chat-reports/:reportId/priority', chatReportsAdminController.updatePriority);
router.patch('/chat-reports/:reportId/status', chatReportsAdminController.updateStatus);
router.post('/chat-reports/:reportId/internal-notes', chatReportsAdminController.addInternalNote);
router.post('/chat-reports/:reportId/request-information', chatReportsAdminController.requestInformation);
router.post('/chat-reports/:reportId/official-message', chatReportsAdminController.addOfficialMessage);
router.post('/chat-reports/:reportId/resolve', chatReportsAdminController.resolveReport);
router.post('/chat-reports/:reportId/dismiss', chatReportsAdminController.resolveReport); // dismiss via resolve with no_violation outcome
router.post('/chat-reports/:reportId/reopen', chatReportsAdminController.reopenReport);

// ── Activity Log ───────────────────────────────────────────────────────────
router.get('/activity', activityAdminController.getActivityLog);

// ── System Monitoring ──────────────────────────────────────────────────────
router.get('/system/health', systemAdminController.getSystemHealth);
router.get('/system/metrics', systemAdminController.getSystemMetrics);
router.get('/system/errors', systemAdminController.getSystemErrors);
router.get('/system/disk', systemAdminController.getDiskInfo);

// ── Content Management ─────────────────────────────────────────────────────
// Global Config
router.get('/config', contentAdminController.getAllConfigs);
router.get('/config/:key', contentAdminController.getConfigByKey);
router.put('/config', contentAdminController.updateConfig);
router.delete('/config/:key', contentAdminController.deleteConfig);

// Feature Flags
router.get('/feature-flags', contentAdminController.getFeatureFlags);
router.put('/feature-flags/toggle', contentAdminController.toggleFeatureFlag);

// Homepage Content
router.get('/content/homepage', contentAdminController.getHomepageContent);
router.put('/content/homepage', contentAdminController.updateHomepageContent);

// Navigation & Footer
router.get('/content/navigation', contentAdminController.getNavigation);
router.put('/content/navigation', contentAdminController.updateNavigation);
router.get('/content/footer', contentAdminController.getFooter);
router.put('/content/footer', contentAdminController.updateFooter);

// Announcements
router.get('/content/announcements', contentAdminController.getAnnouncements);
router.put('/content/announcements', contentAdminController.updateAnnouncement);

// Maintenance Mode
router.get('/maintenance', contentAdminController.getMaintenanceMode);
router.put('/maintenance', contentAdminController.toggleMaintenanceMode);

// ── Evidence Upload ────────────────────────────────────────────────────────
router.post('/chat-reports/:reportId/evidence', evidenceUploadController.uploadEvidence);

// ── Shop Management ────────────────────────────────────────────────────────
router.get('/shop', shopAdminController.getShopItems);
router.post('/shop', shopAdminController.createShopItem);
router.put('/shop/:id', shopAdminController.updateShopItem);
router.put('/shop/:id/toggle', shopAdminController.toggleShopItem);
router.delete('/shop/:id', shopAdminController.deleteShopItem);

module.exports = router;
