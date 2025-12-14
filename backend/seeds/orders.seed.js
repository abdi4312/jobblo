const Order = require('../models/Order');

module.exports = async (users, services) => {
    await Order.deleteMany();

    const orders = [];

    const customers = users.filter(u => u.role === 'user');
    const providers = users.filter(u => u.role === 'provider');

    for (let i = 0; i < 15; i++) {
        const service = services[i % services.length];

        const providerId = service.userId;

        const customer = customers.find(
            u => u._id.toString() !== providerId.toString()
        );

        orders.push({
            serviceId: service._id,
            customerId: customer._id,
            providerId: providerId,

            status: i % 3 === 0 ? 'completed' : 'pending',

            initialPrice: service.price,
            agreedPrice: service.price,

            scheduledDate: new Date(Date.now() + i * 86400000),

            location: {
                address: 'Oslo, Norge',
                lat: 59.9139,
                lng: 10.7522
            },

            paymentStatus: i % 3 === 0 ? 'paid' : 'unpaid',

            history: [
                {
                    action: 'order_created',
                    userId: customer._id,
                    timestamp: new Date(),
                    data: { price: service.price }
                }
            ]
        });
    }

    const created = await Order.insertMany(orders);
    console.log(`📦 Orders: ${created.length}`);
    return created;
};
