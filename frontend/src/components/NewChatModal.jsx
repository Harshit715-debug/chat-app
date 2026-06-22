import React, { useEffect, useState } from 'react';
import api from '../api/api';

export default function NewChatModal({ onClose, onCreated }) {
  const [mode, setMode] = useState('direct'); // 'direct' | 'group'
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const { data } = await api.get('/users', { params: { search } });
      setResults(data.users);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  function toggleSelect(user) {
    if (mode === 'direct') {
      setSelected([user]);
      return;
    }
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function handleCreate() {
    if (mode === 'direct') {
      const { data } = await api.post('/conversations/direct', { userId: selected[0].id });
      onCreated(data.conversation);
    } else {
      if (!groupName.trim() || selected.length === 0) return;
      const { data } = await api.post('/conversations/group', {
        name: groupName,
        memberIds: selected.map((u) => u.id),
      });
      onCreated(data.conversation);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <button className={mode === 'direct' ? 'active' : ''} onClick={() => { setMode('direct'); setSelected([]); }}>
            Direct message
          </button>
          <button className={mode === 'group' ? 'active' : ''} onClick={() => { setMode('group'); setSelected([]); }}>
            Group chat
          </button>
        </div>

        {mode === 'group' && (
          <input
            className="group-name-input"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <input
          placeholder="Search users by username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <ul className="user-results">
          {results.map((u) => (
            <li
              key={u.id}
              className={selected.some((s) => s.id === u.id) ? 'selected' : ''}
              onClick={() => toggleSelect(u)}
            >
              <span className="avatar" style={{ background: u.avatarColor }}>{u.username[0].toUpperCase()}</span>
              {u.username}
              <span className={`dot ${u.isOnline ? 'online' : 'offline'}`} />
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={selected.length === 0 || (mode === 'group' && !groupName.trim())}
            onClick={handleCreate}
          >
            {mode === 'direct' ? 'Start chat' : 'Create group'}
          </button>
        </div>
      </div>
    </div>
  );
}
