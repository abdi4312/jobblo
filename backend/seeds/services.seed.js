const Service = require('../models/Service');
const { services: images } = require('./constants/images');

module.exports = async (users, categories) => {
    await Service.deleteMany();

    const providers = users.filter(u => u.role === 'provider');
    const services = [];

    for (let i = 0; i < 40; i++) {
        services.push({
            title: `Tjeneste ${i + 1}`,
            description: 'Dette er en testtjeneste lagt inn som demo',
            price: Math.floor(Math.random() * 500) + 200,
            pricingType: 'fixed',
            images,
            tags: ['rask', 'pålitelig'],
            userId: providers[i % providers.length]._id,
            categoryId: categories[i % categories.length]._id,
            status: 'open',

            location: {
                type: 'Point',
                coordinates: [
                    10.7 + Math.random() * 0.1, 
                    59.9 + Math.random() * 0.1   
                ],
                address: 'Oslo sentrum',
                city: 'Oslo'
            },

            urgent: false,
            equipment: 'utstyrfri'
        });

    }

    return await Service.insertMany(services);
};
