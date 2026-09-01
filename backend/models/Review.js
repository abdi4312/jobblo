const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: false,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    revieweeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /**
     * NOTE: these two values are named backwards relative to the product.
     *
     *   'poster' is written when the PROVIDER (oppdragstaker) is reviewed
     *   'seeker' is written when the CUSTOMER (oppdragsgiver) is reviewed
     *
     * The whole system is internally consistent — SafePayCheckoutController,
     * ProviderOrderDetailPage and CompletedJobPage all agree — so the labels
     * users see are correct. Only the field values are misnamed.
     *
     * Do NOT flip one side. Correcting this means migrating every existing
     * Review document and updating all three call sites in the same change.
     */
    revieweeRole: { type: String, enum: ['seeker', 'poster'], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    photos: [{ type: String }], // Add photos array
    recommendWorker: { type: Boolean, default: false }, // Add recommend checkbox
  },
  { timestamps: true }
);

reviewSchema.index({ orderId: 1, reviewerId: 1, revieweeRole: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
