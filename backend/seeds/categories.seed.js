const Category = require('../models/Category');

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
}

module.exports = async () => {
    await Category.deleteMany();

    const categories = [
        { name: 'Rengjøring', icon: 'BrushCleaning' },
        { name: 'Rørlegger', icon: 'Wrench' },
        { name: 'Maling', icon: 'Paintbrush' },
        { name: 'Flytting', icon: 'Truck' },
        { name: 'Hagearbeid', icon: 'Flower2' },
        // { name: 'Child & baby', icon: 'Flower2' },
        { name: 'Outdoor & sports', icon: 'Mountain' },
        { name: 'Art/Painting', icon: 'Presentation' }
    ];

    return await Category.insertMany(
        categories.map(({ name, icon }, index) => ({
            name,
            icon,
            slug: slugify(name),     
            sortOrder: index,
            isActive: true
        }))
    );
};
