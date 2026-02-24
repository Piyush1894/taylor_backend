const User = require('../models/User');
const TailorProfile = require('../models/TailorProfile');
const multer = require('multer');
const path = require('path');

// Multer config for profile image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// @desc    Get own profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        let tailorProfile = null;
        if (user.role === 'tailor') {
            tailorProfile = await TailorProfile.findOne({ userId: user._id });
        }
        res.status(200).json({ success: true, user, tailorProfile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update own profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (address) updateData.address = address;
        if (req.file) updateData.profileImage = `/uploads/${req.file.filename}`;

        const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
        res.status(200).json({ success: true, message: 'Profile updated successfully.', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all tailors with filters
// @route   GET /api/users/tailors
// @access  Public
const getAllTailors = async (req, res) => {
    try {
        const { city, specialty, minRating, maxPrice, search, page = 1, limit = 10, lat, lng, radius } = req.query;

        let tailorProfileQuery = {};

        if (specialty) {
            tailorProfileQuery.specialties = { $in: [specialty] };
        }
        if (minRating) {
            tailorProfileQuery.rating = { $gte: parseFloat(minRating) };
        }
        tailorProfileQuery.verificationStatus = 'verified';

        // Geo-based query
        if (lat && lng && radius) {
            tailorProfileQuery.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: parseFloat(radius) * 1000, // convert km to meters
                },
            };
        }

        console.log(tailorProfileQuery);

        let tailorProfiles = await TailorProfile.find(tailorProfileQuery)
            .populate({
                path: 'userId',
                select: 'name email profileImage isOnline address',
                match: {
                    isActive: true,
                    ...(city && { 'address.city': { $regex: city, $options: 'i' } }),
                    ...(search && { name: { $regex: search, $options: 'i' } }),
                },
            })
            .sort({ rating: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        console.log(tailorProfiles)

        // Filter out profiles where user didn't match
        tailorProfiles = tailorProfiles.filter((p) => p.userId !== null);

        res.status(200).json({
            success: true,
            count: tailorProfiles.length,
            page: parseInt(page),
            tailors: tailorProfiles,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single tailor details
// @route   GET /api/users/tailors/:id
// @access  Public
const getTailorById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'tailor') {
            return res.status(404).json({ success: false, message: 'Tailor not found.' });
        }
        const profile = await TailorProfile.findOne({ userId: req.params.id });
        res.status(200).json({ success: true, user, profile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getProfile, updateProfile, getAllTailors, getTailorById, upload };
