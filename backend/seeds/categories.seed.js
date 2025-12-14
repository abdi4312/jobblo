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
        'Rengjøring',
        'Rørlegger',
        'Maling',
        'Flytting',
        'Hagearbeid'
    ];

    return await Category.insertMany(
        categories.map((name, index) => ({
            name,
            slug: slugify(name),     
            sortOrder: index,
            isActive: true
        }))
    );
};
