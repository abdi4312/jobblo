const mongoose = require('mongoose');

const upcomingFeatureSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['planned', 'in-progress', 'completed'],
        default: 'planned'
    },
    tag: {
        type: String,
        enum: ['feature', 'bugfix', 'improvement', 'security'],
        default: 'feature'
    },
    releaseDate: {
        type: Date
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    }
}, { timestamps: true });

module.exports = mongoose.model('UpcomingFeature', upcomingFeatureSchema);
