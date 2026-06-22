const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/conversations - list all conversations the current user belongs to
router.get('/', requireAuth, async (req, res) => {
  const conversations = await Conversation.find({ members: req.userId })
    .populate('members', 'username avatarColor isOnline lastSeen')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  const shaped = conversations.map((c) => ({
    id: c._id,
    isGroup: c.isGroup,
    name: c.name,
    members: c.members,
    admins: c.admins,
    lastMessage: c.lastMessage ? c.lastMessage.toClient() : null,
    updatedAt: c.updatedAt,
  }));

  res.json({ conversations: shaped });
});

// POST /api/conversations/direct - get or create a 1-on-1 conversation with another user
router.post('/direct', requireAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (userId === req.userId) return res.status(400).json({ error: 'Cannot start a chat with yourself' });

  let conversation = await Conversation.findOne({
    isGroup: false,
    members: { $all: [req.userId, userId], $size: 2 },
  }).populate('members', 'username avatarColor isOnline lastSeen');

  if (!conversation) {
    conversation = await Conversation.create({ isGroup: false, members: [req.userId, userId] });
    conversation = await conversation.populate('members', 'username avatarColor isOnline lastSeen');
  }

  res.status(201).json({
    conversation: {
      id: conversation._id,
      isGroup: conversation.isGroup,
      members: conversation.members,
      updatedAt: conversation.updatedAt,
    },
  });
});

// POST /api/conversations/group - create a group chat
router.post('/group', requireAuth, async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !Array.isArray(memberIds) || memberIds.length < 1) {
    return res.status(400).json({ error: 'name and at least one memberId are required' });
  }

  const members = Array.from(new Set([req.userId, ...memberIds]));
  const conversation = await Conversation.create({
    isGroup: true,
    name,
    members,
    admins: [req.userId],
  });
  await conversation.populate('members', 'username avatarColor isOnline lastSeen');

  res.status(201).json({
    conversation: {
      id: conversation._id,
      isGroup: true,
      name: conversation.name,
      members: conversation.members,
      admins: conversation.admins,
      updatedAt: conversation.updatedAt,
    },
  });
});

// GET /api/conversations/:id/messages?before=<messageId>&limit=30
router.get('/:id/messages', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { before, limit = 30 } = req.query;

  const conversation = await Conversation.findOne({ _id: id, members: req.userId });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const filter = { conversation: id };
  if (before) filter._id = { $lt: before };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100));

  res.json({ messages: messages.reverse().map((m) => m.toClient()) });
});

// POST /api/conversations/:id/read - mark all messages in a conversation as read by current user
router.post('/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const conversation = await Conversation.findOne({ _id: id, members: req.userId });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  await Message.updateMany(
    { conversation: id, readBy: { $ne: req.userId } },
    { $addToSet: { readBy: req.userId } }
  );

  res.json({ success: true });
});

module.exports = router;
