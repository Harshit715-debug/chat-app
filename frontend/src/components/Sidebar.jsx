import React, { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import NewChatModal from './NewChatModal';

function conversationLabel(conv, currentUserId) {
  if (conv.isGroup) return conv.name;
  const other = conv.members.find((m) => m.id !== currentUserId && m._id !== currentUserId);
  return other?.username || 'Unknown user';
}

function conversationAvatarColor(conv, currentUserId) {
  if (conv.isGroup) return '#6c5ce7';
  const other = conv.members.find((m) => m.id !== currentUserId && m._id !== currentUserId);
  return other?.avatarColor || '#999';
}

export default function Sidebar({ activeId, onSelect }) {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [presence, setPresence] = useState({}); // userId -> isOnline

  async function loadConversations() {
    const { data } = await api.get('/conversations');
    setConversations(data.conversations);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => loadConversations();
    const handlePresence = ({ userId, isOnline }) =>
      setPresence((prev) => ({ ...prev, [userId]: isOnline }));

    socket.on('message:new', handleNewMessage);
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('presence:update', handlePresence);
    };
  }, [socket]);

  function isConvOnline(conv) {
    if (conv.isGroup) return false;
    const other = conv.members.find((m) => (m.id || m._id) !== user.id);
    if (!other) return false;
    const id = other.id || other._id;
    return presence[id] ?? other.isOnline;
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="me">
          <span className="avatar" style={{ background: user.avatarColor }}>
            {user.username[0].toUpperCase()}
          </span>
          <span>{user.username}</span>
        </div>
        <button onClick={logout} title="Log out">⏻</button>
      </div>

      <button className="new-chat-btn" onClick={() => setShowModal(true)}>+ New chat</button>

      <ul className="conversation-list">
        {conversations.map((conv) => (
          <li
            key={conv.id}
            className={conv.id === activeId ? 'active' : ''}
            onClick={() => onSelect(conv)}
          >
            <span className="avatar" style={{ background: conversationAvatarColor(conv, user.id) }}>
              {conversationLabel(conv, user.id)[0]?.toUpperCase()}
            </span>
            <div className="conv-meta">
              <div className="conv-name">
                {conversationLabel(conv, user.id)}
                {!conv.isGroup && <span className={`dot ${isConvOnline(conv) ? 'online' : 'offline'}`} />}
              </div>
              <div className="conv-preview">{conv.lastMessage?.content || 'No messages yet'}</div>
            </div>
          </li>
        ))}
        {conversations.length === 0 && <li className="empty-state">No conversations yet — start one!</li>}
      </ul>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onCreated={(conv) => {
            setShowModal(false);
            loadConversations();
            onSelect(conv);
          }}
        />
      )}
    </div>
  );
}
