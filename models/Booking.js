const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      default: () => `BK-${uuidv4().split('-')[0].toUpperCase()}`,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tailorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    services: [
      {
        serviceName: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'tailor_accepted',
        'tailor_rejected',
        'customer_confirmed',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'pending',
    },
    bookingDate: { type: Date, required: true },
    preferredTime: { type: String },
    deliveryDate: { type: Date },
    measurements: {
      chest: Number,
      waist: Number,
      hips: Number,
      length: Number,
      shoulder: Number,
      notes: String,
    },
    fabric: {
      providedBy: { type: String, enum: ['customer', 'tailor'], default: 'customer' },
      details: String,
    },
    specialInstructions: { type: String },
    paymentStatus: { type: String, enum: ['pending', 'partial', 'completed'], default: 'pending' },
    paymentMethod: { type: String },
    cancellationReason: { type: String },
    rejectionReason: { type: String },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Indexes for performance
// Remove bookingId from duplicate indexing (unique already creates an index)
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ tailorId: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);