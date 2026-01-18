const stripe = require("../config/stripe");

exports.createCheckoutSession = async (req, res) => {
  try {
    const { items } = req.body; // items from frontend
    const userId = req.user._id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items provided" });
    }

    // Map items to Stripe line_items
    const line_items = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100, // amount in cents
      },
      quantity: item.quantity,
    }));

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items, // this was missing
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: userId.toString(),
      },
    });
    console.log("Stripe session created:", session);
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

exports.checkoutSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Stripe session:", session);
    res.json({ payment_status: session.payment_status });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve checkout session status",
      error: error.message,
    });
  }
};
