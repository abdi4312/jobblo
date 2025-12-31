const mongoose = require('mongoose');



const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    lastName: { type: String, trim: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    bio: { type: String },
    role: { type: String, enum: ['user', 'admin', 'provider'], default: 'user' },
    birthDate:{type:String},
    gender:{type:String},
    address:{type: String},
    postNumber:{type:String},
    postSted:{type:String},
    country:{type:String},
    subscription: { type: String, enum: ['free', 'basic', 'plus', 'premium'], default: 'free' },
    verified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    availability: [{ start: Date, end: Date }],
    earnings: { type: Number, default: 0 },
    spending: { type: Number, default: 0 },
    oauthProviders: [{
        provider: { type: String },
        providerId: { type: String }
    }],
    accountStatus: {
        type: String,
        enum: ['active', 'inactive', 'verified'],
        default: 'active'
    },

    averageRating: {
        type: Number,
        default: 0
    },

    reviewCount: {
        type: Number,
        default: 0
    },

    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }]
}, { timestamps: true });

// Add index to prevent duplicate OAuth providers
userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 });

module.exports = mongoose.model('User', userSchema);
