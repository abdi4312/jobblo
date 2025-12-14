const Notification = require('../models/Notification');

module.exports = async (users, orders) => {
    await Notification.deleteMany();

    const notifications = [];

    orders.forEach(order => {
        notifications.push({
            userId: order.providerId,
            type: 'order_created',
            referenceId: order._id,
            read: false
        });

        if (order.status === 'completed') {
            notifications.push({
                userId: order.customerId,
                type: 'order_completed',
                referenceId: order._id,
                read: false
            });
        }
    });

    if (notifications.length === 0) {
        console.log('🔔 Notifications: 0');
        return [];
    }

    const created = await Notification.insertMany(notifications);
    console.log(`🔔 Notifications: ${created.length}`);
    return created;
};
