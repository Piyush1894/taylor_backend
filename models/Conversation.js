const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },
        lastMessage: {
            content: String,
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            timestamp: Date,
            readBy: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
            ],
        },
    },
    { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ bookingId: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
