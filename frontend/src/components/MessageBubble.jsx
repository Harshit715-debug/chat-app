import React from 'react';

export default function MessageBubble({ message, isMine, senderName, showReadReceipt }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className="message-bubble">
        {!isMine && senderName && <div className="sender-name">{senderName}</div>}
        <div className="message-text">{message.content}</div>
        <div className="message-meta">
          <span>{time}</span>
          {isMine && (
            <span className={`read-tick ${showReadReceipt ? 'read' : ''}`}>
              {showReadReceipt ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
