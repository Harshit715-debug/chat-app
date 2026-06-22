const mongoose = require('mongoose');
const { encryptMessage, decryptMessage } = require('../utils/encryption');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Encrypted ciphertext is what's actually stored in MongoDB
    ciphertext: { type: String, required: true },
    // Users who have read this message (for read receipts)
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Virtual "content" field: set plaintext -> stores ciphertext, read -> decrypts on the fly
messageSchema.virtual('content')
  .set(function setContent(plaintext) {
    this.ciphertext = encryptMessage(plaintext);
  })
  .get(function getContent() {
    try {
      return decryptMessage(this.ciphertext);
    } catch (err) {
      return '[unable to decrypt message]';
    }
  });

messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

messageSchema.methods.toClient = function toClient() {
  return {
    id: this._id,
    conversation: this.conversation,
    sender: this.sender,
    content: this.content, // decrypted plaintext, sent only to authenticated members
    readBy: this.readBy,
    deliveredTo: this.deliveredTo,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Message', messageSchema);
