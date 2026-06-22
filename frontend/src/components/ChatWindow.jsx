import React, { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageBubble from './MessageBubble';

function otherMemberName(conversation, currentUserId, senderId) {
  const member = conversation.members.find((m) => (m.id || m._id) === senderId);
  return member?.username;
}

export default function ChatWindow({ conversation }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState({}); // userId -> bool
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  const title = conversation.isGroup
    ? conversation.name
    : conversation.members.find((m) => (m.id || m._id) !== user.id)?.username;

  useEffect(() => {
    async function loadMessages() {
      const { data } = await api.get(`/conversations/${conversation.id}/messages`);
      setMessages(data.messages);
      await api.post(`/conversations/${conversation.id}/read`);
      socket?.emit('message:read', { conversationId: conversation.id });
    }
    loadMessages();
    socket?.emit('conversation:join', { conversationId: conversation.id });
    setTypingUsers({});
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;

    function handleNewMessage(msg) {
      if (msg.conversation !== conversation.id && msg.conversation?.toString?.() !== conversation.id) return;
      setMessages((prev) => [...prev, msg]);
      if (msg.sender !== user.id) {
        api.post(`/conversations/${conversation.id}/read`);
        socket.emit('message:read', { conversationId: conversation.id });
      }
    }

    function handleRead({ conversationId, userId }) {
      if (conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.readBy.includes(userId) ? m : { ...m, readBy: [...m.readBy, userId] }))
      );
    }

    function handleTyping({ conversationId, userId, isTyping }) {
      if (conversationId !== conversation.id || userId === user.id) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    }

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleRead);
    socket.on('typing:update', handleTyping);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleRead);
      socket.off('typing:update', handleTyping);
    };
  }, [socket, conversation.id, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  function handleDraftChange(e) {
    setDraft(e.target.value);
    socket?.emit('typing:start', { conversationId: conversation.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit('typing:stop', { conversationId: conversation.id });
    }, 1200);
  }

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !socket) return;
    socket.emit('message:send', { conversationId: conversation.id, content: draft.trim() }, (res) => {
      if (res?.error) console.error(res.error);
    });
    setDraft('');
    socket.emit('typing:stop', { conversationId: conversation.id });
  }

  const otherMembersCount = conversation.isGroup ? conversation.members.length - 1 : 1;
  const someoneTyping = Object.values(typingUsers).some(Boolean);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">{title}</div>
        {conversation.isGroup && <div className="chat-subtitle">{otherMembersCount + 1} members</div>}
      </div>

      <div className="messages-list">
        {messages.map((msg) => {
          const senderId = msg.sender?.id || msg.sender;
          const isMine = senderId === user.id;
          const readByOthers = msg.readBy.filter((id) => id !== user.id);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={isMine}
              senderName={conversation.isGroup ? otherMemberName(conversation, user.id, senderId) : null}
              showReadReceipt={readByOthers.length > 0}
            />
          );
        })}
        {someoneTyping && <div className="typing-indicator">typing…</div>}
        <div ref={bottomRef} />
      </div>

      <form className="message-input-row" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={handleDraftChange}
          placeholder="Type a message…"
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>Send</button>
      </form>
    </div>
  );
}
