const mongoose = require('mongoose');

/**
 * AdminActivity — audit log for all super admin actions.
 * Never stores passwords, tokens, payment card data, or secrets.
 */
const adminActivitySchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'role_change',
        'user_verified',
        'user_suspended',
        'user_deactivated',
        'user_activated',
        'user_deleted',
        'user_restored',
        'user_created',
        'service_deleted',
        'service_activated',
        'service_deactivated',
        'order_updated',
        'coupon_created',
        'coupon_updated',
        'coupon_deleted',
        'notification_broadcast',
        'hero_created',
        'hero_updated',
        'hero_deleted',
        'plan_updated',
        'settings_updated',
        'session_revoked',
        'other',
      ],
    },
    targetModel: {
      type: String,
      enum: [
        'User',
        'Service',
        'Order',
        'Transaction',
        'Coupon',
        'Notification',
        'Hero',
        'HomeHero',
        'SubscriptionPlan',
        'GlobalConfig',
        'Session',
        'other',
      ],
      default: 'other',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // Safe metadata — must not contain sensitive values
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
  },
  { timestamps: true }
);

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminActivity', adminActivitySchema);
