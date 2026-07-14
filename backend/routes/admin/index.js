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

// ── Activity Log ───────────────────────────────────────────────────────────
router.get('/activity', activityAdminController.getActivityLog);

module.exports = router;
