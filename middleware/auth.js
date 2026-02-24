const authConfig = require('../config/auth');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }
        const decoded = authConfig.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        }
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'User not found or account deactivated.' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error in authentication.' });
    }
};

module.exports = { protect };
