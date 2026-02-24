const express = require('express');
const router = express.Router();
const {
    createBooking, respondToBooking, confirmBooking,
    updateBookingStatus, getMyBookings, getBookingById, addReview, getTailorReviews, upload
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const { validate, bookingSchema } = require('../utils/validation');

router.get('/tailor/:tailorId/reviews', getTailorReviews);
router.post('/request', protect, roleCheck('customer'), validate(bookingSchema), createBooking);
router.put('/:id/respond', protect, roleCheck('tailor'), respondToBooking);
router.put('/:id/confirm', protect, roleCheck('customer'), confirmBooking);
router.put('/:id/status', protect, updateBookingStatus);
router.get('/my-bookings', protect, getMyBookings);
router.get('/:id', protect, getBookingById);
router.post('/:id/review', protect, roleCheck('customer'), upload.array('images', 5), addReview);

module.exports = router;
