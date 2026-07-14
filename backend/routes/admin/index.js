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

// Apply auth + admin check + rate limiter to ALL routes in this router
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

// ── Activity Log ───────────────────────────────────────────────────────────
router.get('/activity', activityAdminController.getActivityLog);

module.exports = router;
