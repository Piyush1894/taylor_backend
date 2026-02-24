const express = require('express');
const router = express.Router();
const { register, login, logout, verifyToken } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../utils/validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', protect, logout);
router.get('/verify', protect, verifyToken);

module.exports = router;
