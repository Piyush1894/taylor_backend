const User = require('../models/User');
const Booking = require('../models/Booking');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const TailorProfile = require('../models/TailorProfile');
const Review = require('../models/Review');
const { sendBookingRequestEmail, sendBookingStatusEmail } = require('../utils/emailService');
const multer = require('multer');
const path = require('path');

// Multer config for review images
const reviewStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `rev-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: reviewStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Helper to create a notification and emit via socket
const createNotification = async (io, userId, type, title, message, data = {}) => {
    const notification = await Notification.create({ userId, type, title, message, data });
    if (io) {
        io.to(`user_${userId}`).emit('booking_notification', { notification });
    }
    return notification;
};

// Helper to create a system message in a conversation
const createSystemMessage = async (io, conversationId, content) => {
    const Message = require('../models/Message');
    const message = await Message.create({
        conversationId,
        senderId: '000000000000000000000000', // Virtual System ID
        content,
        messageType: 'system',
        deliveredTo: [],
    });

    const Conversation = require('../models/Conversation');
    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
            content,
            senderId: '000000000000000000000000',
            timestamp: new Date(),
        }
    });

    if (io) {
        io.to(`conversation_${conversationId}`).emit('receive_message', { message });
    }
    return message;
};

// @desc    Send booking request
// @route   POST /api/bookings/request
// @access  Private (customer only)
const createBooking = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { tailorId, services, totalAmount, bookingDate, preferredTime, deliveryDate, measurements, fabric, specialInstructions } = req.body;

        const tailor = await User.findById(tailorId);
        if (!tailor || tailor.role !== 'tailor') {
            return res.status(404).json({ success: false, message: 'Tailor not found.' });
        }

        const booking = await Booking.create({
            customerId: req.user._id,
            tailorId,
            services,
            totalAmount,
            bookingDate,
            preferredTime,
            deliveryDate,
            measurements,
            fabric,
            specialInstructions,
        });

        // Create or get conversation
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user._id, tailorId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user._id, tailorId],
                bookingId: booking._id,
            });
        }
        booking.conversationId = conversation._id;
        await booking.save();

        // System message in chat
        const serviceNames = services.map(s => s.serviceName).join(', ');
        await createSystemMessage(io, conversation._id,
            `📅 New Booking Request: ${serviceNames}. Amount: $${totalAmount}. Status: Pending.`
        );

        // Notify tailor
        await createNotification(io, tailorId, 'booking_request',
            'New Booking Request',
            `You have a new booking request from ${req.user.name}`,
            { bookingId: booking._id }
        );

        // Real-time socket event
        if (io) {
            io.to(`user_${tailorId}`).emit('new_booking_request', {
                booking: await booking.populate('customerId', 'name profileImage phone'),
            });
        }

        // Email notification (non-blocking)
        sendBookingRequestEmail(tailor.email, req.user.name, booking.bookingId).catch(console.error);

        res.status(201).json({ success: true, message: 'Booking request sent.', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Tailor accepts or rejects booking
// @route   PUT /api/bookings/:id/respond
// @access  Private (tailor only)
const respondToBooking = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { action, reason } = req.body; // action: 'accept' | 'reject'
        const booking = await Booking.findById(req.params.id);

        if (!booking || String(booking.tailorId) !== String(req.user._id)) {
            return res.status(404).json({ success: false, message: 'Booking not found or unauthorized.' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Booking is not in pending state.' });
        }

        if (action === 'accept') {
            booking.status = 'tailor_accepted';

            // Create conversation for this booking
            const conversation = await Conversation.create({
                participants: [booking.customerId, booking.tailorId],
                bookingId: booking._id,
            });
            booking.conversationId = conversation._id;

        } else if (action === 'reject') {
            booking.status = 'tailor_rejected';
            booking.rejectionReason = reason;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action. Use "accept" or "reject".' });
        }

        await booking.save();

        const customer = await User.findById(booking.customerId);
        await createNotification(io, booking.customerId, 'booking_update',
            action === 'accept' ? 'Booking Accepted!' : 'Booking Rejected',
            action === 'accept'
                ? `${req.user.name} accepted your booking request. You can now chat!`
                : `${req.user.name} rejected your booking request. Reason: ${reason || 'Not specified'}`,
            { bookingId: booking._id }
        );

        if (io) {
            io.to(`user_${booking.customerId}`).emit('booking_update', { booking });
        }

        // System message
        if (booking.conversationId) {
            const statusMsg = action === 'accept'
                ? '✅ Tailor accepted the request. You can now discuss design and measurements.'
                : `❌ Tailor rejected the request. Reason: ${reason || 'Not specified'}`;
            await createSystemMessage(io, booking.conversationId, statusMsg);
        }

        sendBookingStatusEmail(customer?.email, customer?.name, booking.status, booking.bookingId).catch(console.error);

        res.status(200).json({ success: true, message: `Booking ${action}ed.`, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Customer confirms booking after chat
// @route   PUT /api/bookings/:id/confirm
// @access  Private (customer only)
const confirmBooking = async (req, res) => {
    try {
        const io = req.app.get('io');
        const booking = await Booking.findById(req.params.id);
        if (!booking || String(booking.customerId) !== String(req.user._id)) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }
        if (booking.status !== 'tailor_accepted') {
            return res.status(400).json({ success: false, message: 'Cannot confirm at this stage.' });
        }
        booking.status = 'customer_confirmed';
        await booking.save();

        await createNotification(io, booking.tailorId, 'booking_update',
            'Booking Confirmed!',
            `${req.user.name} confirmed the booking. You can start working!`,
            { bookingId: booking._id }
        );

        if (io) io.to(`user_${booking.tailorId}`).emit('booking_update', { booking });

        // System message
        if (booking.conversationId) {
            await createSystemMessage(io, booking.conversationId, '🎉 Customer has confirmed the booking! Work can begin.');
        }

        res.status(200).json({ success: true, message: 'Booking confirmed.', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update booking status (in_progress, completed, cancelled)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { status, cancellationReason, deliveryDate } = req.body;
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        const isTailor = String(booking.tailorId) === String(req.user._id);
        const isCustomer = String(booking.customerId) === String(req.user._id);

        // Validate transitions
        const allowedTransitions = {
            customer_confirmed: { tailor: ['in_progress', 'cancelled'] },
            in_progress: { tailor: ['completed', 'cancelled'] },
            completed: { customer: ['cancelled'] },
        };

        const role = isTailor ? 'tailor' : isCustomer ? 'customer' : null;
        if (!role) return res.status(403).json({ success: false, message: 'Unauthorized.' });

        const allowed = allowedTransitions[booking.status]?.[role] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: `Cannot transition from "${booking.status}" to "${status}" as ${role}.` });
        }

        booking.status = status;
        if (cancellationReason) booking.cancellationReason = cancellationReason;
        if (deliveryDate) booking.deliveryDate = deliveryDate;

        // Update tailor completed orders count
        if (status === 'completed' && isTailor) {
            await TailorProfile.findOneAndUpdate({ userId: req.user._id }, { $inc: { completedOrders: 1 } });
        }

        await booking.save();

        const targetUserId = isTailor ? booking.customerId : booking.tailorId;
        await createNotification(io, targetUserId, 'booking_update',
            'Booking Update',
            `Booking #${booking.bookingId} is now "${status.replace(/_/g, ' ')}"`,
            { bookingId: booking._id, status }
        );

        if (io) io.to(`user_${targetUserId}`).emit('booking_update', { booking });

        // System message
        if (booking.conversationId) {
            const statusLabels = {
                in_progress: '🚜 Work in progress. Tailor has started working on your order.',
                completed: '✨ Order completed! Delivery coordination started.',
                cancelled: `🚫 Booking cancelled by ${role}.`
            };
            if (statusLabels[status]) {
                await createSystemMessage(io, booking.conversationId, statusLabels[status]);
            }
        }

        res.status(200).json({ success: true, message: 'Status updated.', booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user's bookings
// @route   GET /api/bookings/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const isCustomer = req.user.role === 'customer';
        const query = isCustomer ? { customerId: req.user._id } : { tailorId: req.user._id };
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate(isCustomer ? 'tailorId' : 'customerId', 'name email phone profileImage')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Booking.countDocuments(query);
        res.status(200).json({ success: true, total, page: parseInt(page), bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single booking details
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email phone profileImage')
            .populate('tailorId', 'name email phone profileImage');
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        const isAuthorized =
            String(booking.customerId._id) === String(req.user._id) ||
            String(booking.tailorId._id) === String(req.user._id) ||
            req.user.role === 'admin';
        if (!isAuthorized) return res.status(403).json({ success: false, message: 'Unauthorized.' });

        res.status(200).json({ success: true, booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add review after completed booking
// @route   POST /api/bookings/:id/review
// @access  Private (customer only)
const addReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const booking = await Booking.findById(req.params.id);
        if (!booking || String(booking.customerId) !== String(req.user._id)) {
            return res.status(404).json({ success: false, message: 'Booking not found or unauthorized.' });
        }
        if (booking.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Can only review completed bookings.' });
        }
        const existingReview = await Review.findOne({ bookingId: booking._id });
        if (existingReview) {
            return res.status(400).json({ success: false, message: 'Review already submitted for this booking.' });
        }

        // Handle images if uploaded
        let uploadedImages = [];
        if (req.files && req.files.length > 0) {
            uploadedImages = req.files.map(f => `/uploads/${f.filename}`);
        }

        const review = await Review.create({
            bookingId: booking._id,
            customerId: req.user._id,
            tailorId: booking.tailorId,
            rating: Number(rating),
            comment,
            images: uploadedImages,
        });

        // Update booking status to reviewed
        booking.isReviewed = true;
        await booking.save();

        // Update tailor profile rating
        const allReviews = await Review.find({ tailorId: booking.tailorId });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await TailorProfile.findOneAndUpdate(
            { userId: booking.tailorId },
            { rating: Math.round(avgRating * 10) / 10, totalReviews: allReviews.length }
        );

        res.status(201).json({ success: true, message: 'Review submitted.', review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getTailorReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ tailorId: req.params.tailorId })
            .populate('customerId', 'name profileImage')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createBooking, respondToBooking, confirmBooking, updateBookingStatus, getMyBookings, getBookingById, addReview, getTailorReviews, upload };
