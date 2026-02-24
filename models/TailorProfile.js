const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number }, // in days
    category: { type: String },
    description: { type: String },
});

const portfolioSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    uploadedAt: { type: Date, default: Date.now },
});

const slotSchema = new mongoose.Schema({
    start: { type: String },
    end: { type: String },
    isBooked: { type: Boolean, default: false },
});

const availabilitySchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    slots: [slotSchema],
});

const tailorProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        shopName: {
            type: String,
            trim: true,
        },
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot be more than 500 characters'],
        },
        experience: {
            type: Number, // years of experience
            default: 0,
        },
        specialties: {
            type: [String], // e.g., ['Kurta', 'Suit', 'Sherwani', 'Lehenga']
            default: [],
        },
        services: [serviceSchema],
        portfolio: [portfolioSchema],
        availability: [availabilitySchema],
        availabilityData: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
            address: { type: String },
        },
        verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'verified',
        },
        completedOrders: {
            type: Number,
            default: 0,
        },
        responseRate: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Geospatial index for location-based queries
tailorProfileSchema.index({ location: '2dsphere' });
tailorProfileSchema.index({ userId: 1 });
tailorProfileSchema.index({ rating: -1 });
tailorProfileSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('TailorProfile', tailorProfileSchema);
