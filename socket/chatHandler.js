const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Track active users: Map<userId, socketId>
const activeUsers = new Map();

const chatHandler = (io) => {
    io.on('connection', async (socket) => {
        const userId = socket.user._id.toString();
        console.log(`🟢 Socket connected: ${socket.user.name} (${userId})`);

        // ─── User Online ───────────────────────────────
        activeUsers.set(userId, socket.id);
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Join personal room for direct notifications
        socket.join(`user_${userId}`);

        // Broadcast online status to all users
        socket.broadcast.emit('user_online', { userId, name: socket.user.name });

        // ─── Join Conversation Room ────────────────────
        socket.on('join_conversation', async ({ conversationId }) => {
            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.map(String).includes(userId)) {
                    return socket.emit('error', { message: 'Unauthorized conversation.' });
                }
                socket.join(`conversation_${conversationId}`);
                console.log(`💬 ${socket.user.name} joined conversation ${conversationId}`);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ─── Leave Conversation Room ───────────────────
        socket.on('leave_conversation', ({ conversationId }) => {
            socket.leave(`conversation_${conversationId}`);
        });

        // ─── Send Message ──────────────────────────────
        socket.on('send_message', async ({ conversationId, content, messageType = 'text', attachmentUrl }) => {
            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.map(String).includes(userId)) {
                    return socket.emit('error', { message: 'Unauthorized.' });
                }

                const message = await Message.create({
                    conversationId,
                    senderId: userId,
                    content,
                    messageType,
                    attachmentUrl: attachmentUrl || null,
                    deliveredTo: [userId],
                });
                await message.populate('senderId', 'name profileImage');

                // Update last message
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: {
                        content: content || 'Attachment',
                        senderId: userId,
                        timestamp: new Date(),
                        readBy: [userId],
                    },
                });

                // Emit to all participants in the room
                io.to(`conversation_${conversationId}`).emit('receive_message', { message });

                // Notify offline participants
                conversation.participants.forEach(async (participantId) => {
                    const pid = participantId.toString();
                    if (pid !== userId) {
                        // Mark delivered if online
                        if (activeUsers.has(pid)) {
                            message.deliveredTo.push(participantId);
                            await message.save();
                            io.to(`user_${pid}`).emit('message_delivered', { messageId: message._id });
                        }
                    }
                });

            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ─── Typing Indicators ─────────────────────────
        socket.on('typing_start', ({ conversationId }) => {
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId,
                name: socket.user.name,
                conversationId,
                isTyping: true,
            });
        });

        socket.on('typing_stop', ({ conversationId }) => {
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId,
                conversationId,
                isTyping: false,
            });
        });

        // ─── Read Receipt ──────────────────────────────
        socket.on('message_read', async ({ messageId, conversationId }) => {
            try {
                const message = await Message.findById(messageId);
                if (!message) return;

                const alreadyRead = message.readBy.some((r) => String(r.userId) === userId);
                if (!alreadyRead) {
                    message.readBy.push({ userId, readAt: new Date() });
                    await message.save();
                    await Conversation.findByIdAndUpdate(conversationId, {
                        $addToSet: { 'lastMessage.readBy': userId },
                    });
                    io.to(`conversation_${conversationId}`).emit('message_read', { messageId, userId });
                }
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ─── Message Delivered ─────────────────────────
        socket.on('message_delivered', async ({ messageId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, {
                    $addToSet: { deliveredTo: userId },
                });
                socket.broadcast.emit('message_delivered', { messageId, userId });
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        // ─── Booking Updates ───────────────────────────
        socket.on('booking_update', ({ bookingId, status, targetUserId }) => {
            io.to(`user_${targetUserId}`).emit('booking_notification', { bookingId, status });
        });

        // ─── Voice / Video Call ────────────────────────
        socket.on('call_initiate', ({ targetUserId, conversationId, callType }) => {
            io.to(`user_${targetUserId}`).emit('incoming_call', {
                callerId: userId,
                callerName: socket.user.name,
                callerImage: socket.user.profileImage,
                conversationId,
                callType, // 'audio' | 'video'
            });
        });

        socket.on('call_accept', ({ callerId, conversationId }) => {
            io.to(`user_${callerId}`).emit('call_answered', {
                acceptedBy: userId,
                conversationId,
            });
        });

        socket.on('call_reject', ({ callerId, reason }) => {
            io.to(`user_${callerId}`).emit('call_rejected', {
                rejectedBy: userId,
                reason: reason || 'User busy',
            });
        });

        socket.on('call_end', ({ targetUserId, conversationId }) => {
            io.to(`user_${targetUserId}`).emit('call_ended', {
                endedBy: userId,
                conversationId,
            });
        });

        // ─── Disconnect ────────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`🔴 Socket disconnected: ${socket.user.name}`);
            activeUsers.delete(userId);
            const lastSeen = new Date();
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
            socket.broadcast.emit('user_offline', { userId, lastSeen });
        });
    });
};

module.exports = chatHandler;
