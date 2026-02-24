const TailorProfile = require('../models/TailorProfile');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const multer = require('multer');
const path = require('path');

const portfolioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `portfolio-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`),
});
const portfolioUpload = multer({ storage: portfolioStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// @desc    Create tailor profile
// @route   POST /api/tailors/profile
// @access  Private (tailor only)
const createProfile = async (req, res) => {
    try {
        const existing = await TailorProfile.findOne({ userId: req.user._id });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Profile already exists. Use PUT to update.' });
        }
        const profile = await TailorProfile.create({ userId: req.user._id, ...req.body });
        res.status(201).json({ success: true, message: 'Profile created.', profile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update tailor profile
// @route   PUT /api/tailors/profile
// @access  Private (tailor only)
const updateProfile = async (req, res) => {
    try {
        const { shopName, bio, experience, specialties, services, location, verificationStatus, availabilityData } = req.body;
        const updateData = {};
        if (shopName !== undefined) updateData.shopName = shopName;
        if (bio !== undefined) updateData.bio = bio;
        if (experience !== undefined) updateData.experience = experience;
        if (specialties !== undefined) updateData.specialties = specialties;
        if (services !== undefined) updateData.services = services;

        if (location !== undefined) {
            if (location.address) updateData['location.address'] = location.address;
            if (location.coordinates) updateData['location.coordinates'] = location.coordinates;
            updateData['location.type'] = 'Point'; // Ensure GeoJSON type is always set
        }

        // Allow setting verificationStatus to 'verified' for development/demo purposes if needed, 
        // or just ensure it stays 'pending' for new profiles.
        if (verificationStatus !== undefined) updateData.verificationStatus = verificationStatus;
        if (availabilityData !== undefined) updateData.availabilityData = availabilityData;

        const profile = await TailorProfile.findOneAndUpdate(
            { userId: req.user._id },
            updateData,
            { new: true, upsert: true, runValidators: true }
        );
        res.status(200).json({ success: true, message: 'Profile updated.', profile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add portfolio image
// @route   POST /api/tailors/portfolio
// @access  Private (tailor only)
const addPortfolio = async (req, res) => {
    try {
        const { description, category } = req.body;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded.' });
        }
        const imageUrl = `/uploads/${req.file.filename}`;
        const profile = await TailorProfile.findOneAndUpdate(
            { userId: req.user._id },
            {
                $push: {
                    portfolio: { imageUrl, description, category, uploadedAt: new Date() },
                },
            },
            { new: true }
        );
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Tailor profile not found.' });
        }
        res.status(200).json({ success: true, message: 'Portfolio image added.', portfolio: profile.portfolio });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete portfolio image
// @route   DELETE /api/tailors/portfolio/:itemId
// @access  Private (tailor only)
const deletePortfolioItem = async (req, res) => {
    try {
        const profile = await TailorProfile.findOneAndUpdate(
            { userId: req.user._id },
            {
                $pull: {
                    portfolio: { _id: req.params.itemId },
                },
            },
            { new: true }
        );
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Tailor profile not found.' });
        }
        res.status(200).json({ success: true, message: 'Portfolio item deleted.', portfolio: profile.portfolio });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update availability
// @route   PUT /api/tailors/availability
// @access  Private (tailor only)
const updateAvailability = async (req, res) => {
    try {
        const { availability } = req.body;
        const profile = await TailorProfile.findOneAndUpdate(
            { userId: req.user._id },
            { availability },
            { new: true }
        );
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Tailor profile not found.' });
        }
        res.status(200).json({ success: true, message: 'Availability updated.', availability: profile.availability });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get tailor's bookings
// @route   GET /api/tailors/bookings
// @access  Private (tailor only)
const getTailorBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { tailorId: req.user._id };
        if (status) query.status = status;
        const bookings = await Booking.find(query)
            .populate('customerId', 'name email phone profileImage')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        const total = await Booking.countDocuments(query);
        res.status(200).json({ success: true, total, page: parseInt(page), bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Respond to a review
// @route   POST /api/tailors/reviews/:reviewId/respond
// @access  Private (tailor only)
const respondToReview = async (req, res) => {
    try {
        const { comment } = req.body;
        const review = await Review.findById(req.params.reviewId);
        if (!review || String(review.tailorId) !== String(req.user._id)) {
            return res.status(404).json({ success: false, message: 'Review not found or unauthorized.' });
        }
        review.response = { comment, respondedAt: new Date() };
        await review.save();
        res.status(200).json({ success: true, message: 'Response added.', review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createProfile,
    updateProfile,
    addPortfolio,
    deletePortfolioItem,
    updateAvailability,
    getTailorBookings,
    respondToReview,
    portfolioUpload,
};
