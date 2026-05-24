const Order = require("../models/Order");
const Service = require("../models/Service");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * GET /api/safepay-checkout/details/:orderId
 * Fetch all details needed for the SafePay Checkout page
 */
exports.getCheckoutDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate({
        path: "serviceId",
        select: "title location price duration equipment userId",
      })
      .populate("customerId", "name lastName avatarUrl")
      .populate("providerId", "name lastName avatarUrl averageRating");

    if (!order) {
      return res.status(404).json({ error: "Kontrakten ble ikke funnet" });
    }

    // Authorization check: Only customer or provider should see details
    if (
      order.customerId._id.toString() !== req.userId &&
      order.providerId?._id.toString() !== req.userId &&
      order.serviceId.userId.toString() !== req.userId
    ) {
      return res
        .status(403)
        .json({ error: "Ikke autorisert til å se denne kontrakten" });
    }

    // Calculate fee (3%)
    const fee = Math.round(order.agreedPrice * 0.03);
    const total = order.agreedPrice + fee;
    const providerNet = Math.round(order.agreedPrice * 0.97);

    res.json({
      order,
      calculation: {
        basePrice: order.agreedPrice,
        fee,
        total,
        providerNet,
      },
    });
  } catch (err) {
    console.error("Error fetching checkout details:", err);
    res
      .status(500)
      .json({ error: "Serverfeil ved henting av betalingsinformasjon" });
  }
};

/**
 * POST /api/safepay-checkout/create-session
 * Create a Stripe checkout session for the SafePay payment
 */
exports.createSafePaySession = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.userId;

    const order = await Order.findById(orderId).populate("serviceId");
    if (!order) {
      return res.status(404).json({ error: "Kontrakten ble ikke funnet" });
    }

    if (["paid", "in_progress", "completed"].includes(order.status)) {
      return res
        .status(400)
        .json({ error: "Denne kontrakten er allerede betalt" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Bruker ble ikke funnet" });
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user._id) },
      });
      stripeCustomerId = customer.id;
      await User.findByIdAndUpdate(user._id, { stripeCustomerId });
    }

    const fee = Math.round(order.agreedPrice * 0.03);
    const total = order.agreedPrice + fee;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: {
              name: `SafePay: ${order.serviceId.title}`,
              description: `Kontrakt #${order._id.toString().substring(0, 8).toUpperCase()}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}safepay/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL}safepay/checkout/${orderId}`,
      metadata: {
        userId: String(user._id),
        orderId: orderId.toString(),
        type: "safepay_payment",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Error creating Stripe session:", err);
    res.status(500).json({ error: "Kunne ikke starte betalingen" });
  }
};

/**
 * POST /api/safepay-checkout/approve
 * Complete the SafePay flow: update order status, release payment (mock), and create review
 */
exports.approveAndPayout = async (req, res) => {
  try {
    const { orderId, ratings, comment } = req.body;
    const userId = req.userId;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Kontrakten ble ikke funnet" });
    }

    if (order.customerId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Ikke autorisert til å godkjenne denne kontrakten" });
    }

    // 1. Update Order Status
    order.status = "completed";
    order.history.push({
      action: "payout_approved",
      userId: userId,
      timestamp: new Date(),
      data: { ratings, comment },
    });
    await order.save();

    // 2. Update Service Status
    await Service.findByIdAndUpdate(order.serviceId, { status: "completed" });

    // 3. Update Provider Stats (Mock - in real app would be a separate Review model)
    const provider = await User.findById(order.providerId);
    if (provider) {
      const currentCompleted = provider.completedJobs || 0;
      const currentRating = provider.averageRating || 0;

      // Basic moving average for rating
      const newRating =
        (currentRating * currentCompleted + ratings.overall) /
        (currentCompleted + 1);

      provider.completedJobs = currentCompleted + 1;
      provider.averageRating = parseFloat(newRating.toFixed(1));
      await provider.save();
    }

    res.json({ message: "Jobb godkjent og utbetaling satt i gang", orderId });
  } catch (err) {
    console.error("Error approving payout:", err);
    res.status(500).json({ error: "Serverfeil ved godkjenning av utbetaling" });
  }
};
