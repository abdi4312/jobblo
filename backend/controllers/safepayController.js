const Order = require("../models/Order");
const Service = require("../models/Service");
const JobRequest = require("../models/JobRequest");
const Notification = require("../models/Notification");

/**
 * POST /api/safepay/create-contract
 * Create a contract (Order) between a client and a selected applicant
 */
exports.createContract = async (req, res) => {
  try {
    const { serviceId, applicantId, requestId } = req.body;
    const userId = req.userId; // The person selecting the applicant (owner of the service)

    // 1. Verify service ownership
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Oppdraget ble ikke funnet" });
    }

    if (service.userId.toString() !== userId) {
      return res.status(403).json({
        error: "Ikke autorisert til å velge søker for dette oppdraget",
      });
    }

    // 2. Create the Order (Contract)
    // In this flow, the owner of the service is the 'Client' and the applicant is the 'Provider'
    // Wait, in Jobblo, usually Service is posted by Provider.
    // But the mockup shows "Plenklipping" posted by someone looking for help.
    // If Service is "Looking for help", then service.userId is the Client.

    const order = new Order({
      serviceId,
      customerId: userId, // The person who posted the job
      providerId: applicantId, // The person who applied
      status: "awaiting_payment",
      initialPrice: service.price,
      agreedPrice: service.price,
      history: [
        {
          action: "contract_created",
          userId: userId,
          timestamp: new Date(),
          data: { message: "SafePay kontrakt opprettet" },
        },
      ],
    });

    await order.save();

    // 3. Update JobRequest status if provided
    if (requestId) {
      await JobRequest.findByIdAndUpdate(requestId, { status: "accepted" });
    }

    // 4. Create notification for the applicant
    const notification = new Notification({
      userId: applicantId,
      type: "order",
      content: `Du har blitt valgt for oppdraget: ${service.title}. Venter på betaling.`,
      orderId: order._id,
      senderId: userId,
    });
    await notification.save();

    res.status(201).json({
      message: "Kontrakt opprettet",
      orderId: order._id,
    });
  } catch (err) {
    console.error("Error creating contract:", err);
    res.status(500).json({ error: "Serverfeil ved opprettelse av kontrakt" });
  }
};

/**
 * GET /api/safepay/contract/:orderId
 * Get contract details
 */
exports.getContract = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("serviceId")
      .populate("customerId", "name lastName avatarUrl")
      .populate("providerId", "name lastName avatarUrl");

    if (!order) {
      return res.status(404).json({ error: "Kontrakten ble ikke funnet" });
    }

    res.json(order);
  } catch (err) {
    console.error("Error fetching contract:", err);
    res.status(500).json({ error: "Serverfeil ved henting av kontrakt" });
  }
};
