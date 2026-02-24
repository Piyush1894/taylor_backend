/**
 * Role-based access control middleware
 * Usage: roleCheck('admin', 'tailor')  — allows only admin or tailor
 */
const roleCheck = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
            });
        }
        next();
    };
};

module.exports = { roleCheck };
