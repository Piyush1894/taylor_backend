const express = require('express');
const router = express.Router();
const {
    createProfile, updateProfile, addPortfolio, deletePortfolioItem, updateAvailability,
    getTailorBookings, respondToReview, portfolioUpload,
} = require('../controllers/tailorController');
const { protect } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

router.post('/profile', protect, roleCheck('tailor'), createProfile);
router.put('/profile', protect, roleCheck('tailor'), updateProfile);
router.post('/portfolio', protect, roleCheck('tailor'), portfolioUpload.single('image'), addPortfolio);
router.delete('/portfolio/:itemId', protect, roleCheck('tailor'), deletePortfolioItem);
router.put('/availability', protect, roleCheck('tailor'), updateAvailability);
router.get('/bookings', protect, roleCheck('tailor'), getTailorBookings);
router.post('/reviews/:reviewId/respond', protect, roleCheck('tailor'), respondToReview);

module.exports = router;
