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
        { name: 'Rengjøring', icon: 'cleaning_services' },
        { name: 'Rørlegger', icon: 'plumbing' },
        { name: 'Maling', icon: 'format_paint' },
        { name: 'Flytting', icon: 'local_shipping' },
        { name: 'Hagearbeid', icon: 'yard' }
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
