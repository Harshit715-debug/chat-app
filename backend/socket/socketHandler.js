const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// userId -> Set of active socket ids (a user can have multiple tabs/devices)
const onlineUsers = new Map();

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
  return onlineUsers.get(userId).size === 1; // true if this is the user's first connection
}

function removeOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) return true;
  const sockets = onlineUsers.get(userId);
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true; // true if the user has no more active connections
  }
  return false;
}

function initSocket(io) {
  // Authenticate every socket connection using the JWT issued at login
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    const isFirstConnection = addOnlineSocket(userId, socket.id);

    // Join a personal room (for direct notifications) and every conversation room the user belongs to
    socket.join(`user:${userId}`);
    const conversations = await Conversation.find({ members: userId }).select('_id');
    conversations.forEach((c) => socket.join(`conversation:${c._id}`));

    if (isFirstConnection) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('presence:update', { userId, isOnline: true });
    }

    // ---- Messaging ----
    socket.on('message:send', async ({ conversationId, content }, callback) => {
      try {
        const conversation = await Conversation.findOne({ _id: conversationId, members: userId });
        if (!conversation) return callback?.({ error: 'Conversation not found' });
        if (!content || !content.trim()) return callback?.({ error: 'Message content required' });

        const message = new Message({ conversation: conversationId, sender: userId, deliveredTo: [userId] });
        message.content = content; // triggers AES-256-GCM encryption via the virtual setter
        await message.save();

        conversation.lastMessage = message._id;
        await conversation.save();

        const payload = message.toClient();
        io.to(`conversation:${conversationId}`).emit('message:new', payload);
        callback?.({ success: true, message: payload });
      } catch (err) {
        callback?.({ error: 'Failed to send message', details: err.message });
      }
    });

    // ---- Typing indicators ----
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', { conversationId, userId, isTyping: true });
    });
    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', { conversationId, userId, isTyping: false });
    });

    // ---- Read receipts ----
    socket.on('message:read', async ({ conversationId }) => {
      await Message.updateMany(
        { conversation: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      io.to(`conversation:${conversationId}`).emit('message:read', { conversationId, userId, readAt: new Date() });
    });

    // ---- Joining a newly-created conversation without reconnecting ----
    socket.on('conversation:join', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    // ---- Disconnect / presence ----
    socket.on('disconnect', async () => {
      const wasLastConnection = removeOnlineSocket(userId, socket.id);
      if (wasLastConnection) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
        io.emit('presence:update', { userId, isOnline: false, lastSeen });
      }
    });
  });
}

module.exports = { initSocket, onlineUsers };
