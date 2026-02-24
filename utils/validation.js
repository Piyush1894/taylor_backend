const Joi = require('joi');

// Auth validations
const registerSchema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('customer', 'tailor').default('customer'),
    phone: Joi.string().min(10).max(15).required(),
    address: Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        pincode: Joi.string(),
    }),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

// Booking validation
const bookingSchema = Joi.object({
    tailorId: Joi.string().required(),
    services: Joi.array()
        .items(
            Joi.object({
                serviceName: Joi.string().required(),
                price: Joi.number().positive().required(),
                quantity: Joi.number().positive().default(1),
            })
        )
        .min(1)
        .required(),
    totalAmount: Joi.number().positive().required(),
    bookingDate: Joi.date().required(),
    preferredTime: Joi.string(),
    deliveryDate: Joi.date(),
    measurements: Joi.object({
        chest: Joi.number(),
        waist: Joi.number(),
        hips: Joi.number(),
        length: Joi.number(),
        shoulder: Joi.number(),
        notes: Joi.string(),
    }),
    fabric: Joi.object({
        providedBy: Joi.string().valid('customer', 'tailor'),
        details: Joi.string(),
    }),
    specialInstructions: Joi.string(),
});

// Tailor profile validation
const tailorProfileSchema = Joi.object({
    shopName: Joi.string().max(100),
    bio: Joi.string().max(500),
    experience: Joi.number().min(0),
    specialties: Joi.array().items(Joi.string()),
    services: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),
            price: Joi.number().positive().required(),
            duration: Joi.number().positive(),
            category: Joi.string(),
            description: Joi.string(),
        })
    ),
});

// Review validation
const reviewSchema = Joi.object({
    bookingId: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(500),
    images: Joi.array().items(Joi.string()),
});

// Middleware to validate request body
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map((d) => d.message);
            return res.status(400).json({ success: false, message: 'Validation error', errors });
        }
        next();
    };
};

module.exports = {
    validate,
    registerSchema,
    loginSchema,
    bookingSchema,
    tailorProfileSchema,
    reviewSchema,
};
