const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getAllTailors, getTailorById, upload } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('profileImage'), updateProfile);
router.get('/tailors', getAllTailors);
router.get('/tailors/:id', getTailorById);

module.exports = router;
