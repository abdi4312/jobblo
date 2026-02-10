const mongoose = require('mongoose');



const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    lastName: { type: String, trim: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    bio: { type: String },
    role: { type: String, enum: ['user', 'superAdmin', 'provider'], default: 'user' },
    birthDate:{type:String},
    gender:{type:String},
    address:{type: String},
    postNumber:{type:String},
    postSted:{type:String},
    country:{type:String},
    subscription: { type: String, enum: ["Standard", "Start", "Pro", "Premium","Fleksibel","Job Pluss"], default: 'Standard' },
    planType: {type: String, enum: ["business", "private"],default: "private",required: true},
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
    }],
    pointsBalance: {
        type: Number,
        default: 0
    },
    pointsHistory: [{
        points: Number,
        reason: String,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        shopItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobbloShop' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Add index to prevent duplicate OAuth providers
userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 });

module.exports = mongoose.model('User', userSchema);
