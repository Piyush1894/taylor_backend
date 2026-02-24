const authConfig = require('./auth');
const User = require('../models/User');

const configureSocket = (io) => {
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Authentication token missing'));
            }
            const decoded = authConfig.verifyToken(token);
            if (!decoded) {
                return next(new Error('Invalid or expired token'));
            }
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.user = user;
            next();
        } catch (err) {
            next(new Error('Socket authentication failed'));
        }
    });

    return io;
};

module.exports = configureSocket;
