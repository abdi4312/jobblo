const Transaction = require("../models/Transaction");
const User = require("../models/User");
// GET ALL TRANSACTIONS (FOR ADMIN)
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, type } = req.query;
    let query = {};

    // 1. Type Filter (subscription / extra_contact)
    if (type) {
      query.type = type;
    }

    // 2. Search Logic (Email + Transaction ID)
    if (search) {
      // Pehle Users collection mein search karein ke kya koi user is email se match karta hai
      const matchedUsers = await User.find({
        email: { $regex: search, $options: "i" }
      }).select("_id");

      const userIds = matchedUsers.map(user => user._id);

      // Ab Transaction query mein check karein
      query.$or = [
        { stripeSessionId: { $regex: search, $options: "i" } }, // Search by ID
        { planName: { $regex: search, $options: "i" } },        // Search by Plan
        { userId: { $in: userIds } }                           // Search by matched User IDs
      ];
    }

    const transactions = await Transaction.find(query)
      .populate("userId", "email name") // Email populate karna zaroori hai table ke liye
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      transactions,
      totalPages: Math.ceil(total / limit),
      totalTransactions: total
    });
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// GET USER TRANSACTIONS (FOR USER DASHBOARD)
exports.getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET SINGLE TRANSACTION
exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("userId serviceId coupon");
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    res.status(200).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Example: { "status": "refunded" }

    // Check karein ke status valid hai ya nahi (enum ke mutabiq)
    const validStatuses = ["pending", "succeeded", "failed", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Transaction dhoondo aur update karo
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id,
      { 
        status: status,
        refunded: status === "refunded" ? true : false // Agar status refunded hai to boolean bhi true kar do
      },
      { new: true } // Updated document wapis mangwao
    );

    if (!updatedTransaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.status(200).json({
      message: `Transaction status updated to ${status}`,
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};