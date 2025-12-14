const Review = require('../models/Review');

module.exports = async (orders) => {
    await Review.deleteMany();

    const completedOrders = orders.filter(
        o => o.status === 'completed'
    );

    const reviews = completedOrders.map(order => ({
        serviceId: order.serviceId,
        reviewerId: order.customerId,
        rating: Math.floor(Math.random() * 2) + 4, // 4–5
        comment: 'Veldig bra utført jobb. Anbefales!'
    }));

    if (reviews.length === 0) {
        console.log('⭐ Reviews: 0 (no completed orders)');
        return [];
    }

    const created = await Review.insertMany(reviews);
    console.log(`⭐ Reviews: ${created.length}`);
    return created;
};
