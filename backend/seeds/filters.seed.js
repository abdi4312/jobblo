const Filter = require('../models/Filter');
const User = require('../models/User');

module.exports = async () => {
    await Filter.deleteMany();

    const users = await User.find();

    const filters = [];

    filters.push({
        categories: ['Rengjøring', 'Maling'],
        priceRange: { min: 200, max: 1500 },
        location: {
            city: 'Oslo',
            coordinates: { lat: 59.9139, lng: 10.7522 },
            radius: 15
        },
        urgentOnly: false,
        verifiedProvidersOnly: true,
        searchKeyword: 'hjelp',
        sortBy: 'newest'
    });

    users.slice(0, 6).forEach((user, index) => {
        filters.push({
            userId: user._id,
            categories: index % 2 === 0 ? ['Rørlegger'] : ['Flytting'],
            priceRange: {
                min: 300,
                max: 3000
            },
            location: {
                city: 'Bergen',
                coordinates: { lat: 60.3913, lng: 5.3221 },
                radius: 20
            },
            urgentOnly: index % 2 === 0,
            verifiedProvidersOnly: true,
            searchKeyword: 'jobb',
            sortBy: index % 2 === 0 ? 'price_low' : 'rating_high'
        });
    });

    const created = await Filter.insertMany(filters);

    console.log(`🔍 Filters: ${created.length}`);
    return created;
};
