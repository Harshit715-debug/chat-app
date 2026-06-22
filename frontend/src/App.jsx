import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './components/Login';
import Register from './components/Register';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

function AuthGate() {
  const { user, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) return <div className="centered">Loading…</div>;

  if (!user) {
    return (
      <div className="auth-page">
        {showRegister ? (
          <Register onSwitch={() => setShowRegister(false)} />
        ) : (
          <Login onSwitch={() => setShowRegister(true)} />
        )}
      </div>
    );
  }

  return (
    <SocketProvider>
      <MainLayout />
    </SocketProvider>
  );
}

function MainLayout() {
  const [activeConversation, setActiveConversation] = useState(null);

  return (
    <div className="app-shell">
      <Sidebar activeId={activeConversation?.id} onSelect={setActiveConversation} />
      {activeConversation ? (
        <ChatWindow conversation={activeConversation} />
      ) : (
        <div className="centered empty-chat">Select a conversation or start a new one</div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
