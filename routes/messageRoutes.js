const express = require('express');
const router = express.Router();
const {
    getConversations, getMessages, sendMessage,
    markAsRead, deleteMessage, getOrCreateConversation, messageUpload,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.get('/conversations', protect, getConversations);
router.post('/conversation', protect, getOrCreateConversation);
router.get('/:conversationId', protect, getMessages);
router.post('/send', protect, messageUpload.single('attachment'), sendMessage);
router.put('/read/:messageId', protect, markAsRead);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;
