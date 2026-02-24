const jwt = require('jsonwebtoken');

const authConfig = {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expireTime: process.env.JWT_EXPIRE || '7d',

    generateToken: (payload) => {
        return jwt.sign(payload, authConfig.secret, {
            expiresIn: authConfig.expireTime,
        });
    },

    verifyToken: (token) => {
        try {
            return jwt.verify(token, authConfig.secret);
        } catch (error) {
            return null;
        }
    },
};

module.exports = authConfig;
