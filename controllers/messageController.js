const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

const messageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `msg-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`),
});
const messageUpload = multer({ storage: messageStorage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

// @desc    Get all conversations
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate('participants', 'name profileImage isOnline lastSeen')
            .populate('bookingId', 'bookingId status totalAmount')
            .sort({ 'lastMessage.timestamp': -1 });
        res.status(200).json({ success: true, conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get messages in a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
const getMessages = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation || !conversation.participants.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }
        const messages = await Message.find({
            conversationId: req.params.conversationId,
            deletedFor: { $nin: [req.user._id] },
        })
            .populate('senderId', 'name profileImage')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Mark as delivered
        await Message.updateMany(
            { conversationId: req.params.conversationId, deliveredTo: { $nin: [req.user._id] } },
            { $addToSet: { deliveredTo: req.user._id } }
        );

        res.status(200).json({ success: true, messages: messages.reverse() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send a message
// @route   POST /api/messages/send
// @access  Private
const sendMessage = async (req, res) => {
    try {
        const io = req.app.get('io');
        const { conversationId, content, messageType = 'text' } = req.body;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        const messageData = {
            conversationId,
            senderId: req.user._id,
            content,
            messageType,
            deliveredTo: [req.user._id],
        };

        if (req.file) {
            messageData.attachmentUrl = `/uploads/${req.file.filename}`;
            messageData.messageType = req.file.mimetype.startsWith('image') ? 'image' : 'file';
        }

        const message = await Message.create(messageData);
        await message.populate('senderId', 'name profileImage');

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
                content: content || 'Attachment',
                senderId: req.user._id,
                timestamp: new Date(),
                readBy: [req.user._id],
            },
        });

        // Emit to conversation room
        if (io) {
            io.to(`conversation_${conversationId}`).emit('receive_message', { message });
        }

        res.status(201).json({ success: true, message });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark message as read
// @route   PUT /api/messages/read/:messageId
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const io = req.app.get('io');
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

        const alreadyRead = message.readBy.some((r) => String(r.userId) === String(req.user._id));
        if (!alreadyRead) {
            message.readBy.push({ userId: req.user._id, readAt: new Date() });
            await message.save();

            await Conversation.findByIdAndUpdate(message.conversationId, {
                $addToSet: { 'lastMessage.readBy': req.user._id },
            });

            if (io) {
                io.to(`conversation_${message.conversationId}`).emit('message_read', {
                    messageId: message._id,
                    userId: req.user._id,
                });
            }
        }
        res.status(200).json({ success: true, message: 'Marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete message (for self)
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message || String(message.senderId) !== String(req.user._id)) {
            return res.status(404).json({ success: false, message: 'Message not found or unauthorized.' });
        }
        message.deletedFor.push(req.user._id);
        await message.save();
        res.status(200).json({ success: true, message: 'Message deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get or create conversation between two users
// @route   POST /api/messages/conversation
// @access  Private
const getOrCreateConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user._id, participantId] },
        }).populate('participants', 'name profileImage isOnline');

        if (!conversation) {
            conversation = await Conversation.create({ participants: [req.user._id, participantId] });
            await conversation.populate('participants', 'name profileImage isOnline');
        }
        res.status(200).json({ success: true, conversation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getConversations, getMessages, sendMessage, markAsRead, deleteMessage, getOrCreateConversation, messageUpload };
