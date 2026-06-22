const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true }, // only used for group chats
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // group admins
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

// Speeds up "find the 1-1 conversation between these two users" lookups
conversationSchema.index({ members: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
