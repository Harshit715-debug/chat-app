# Real-Time Chat Application

A full-stack chat platform with one-on-one and group messaging, JWT authentication,
message encryption at rest, read receipts, and live online/offline presence.

**Stack:** React (Vite) · Node.js/Express · Socket.io · MongoDB (Mongoose)

## Project structure

```
chat-app/
├── backend/
│   ├── config/db.js              MongoDB connection
│   ├── models/                   User, Conversation, Message (Mongoose schemas)
│   ├── routes/                   REST API: auth, users, conversations/messages
│   ├── middleware/auth.js        JWT verification middleware
│   ├── socket/socketHandler.js   Socket.io: auth, presence, messaging, typing, read receipts
│   ├── utils/encryption.js       AES-256-GCM message encryption
│   ├── server.js                 App entry point
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/api.js            Axios client (attaches JWT)
    │   ├── context/               AuthContext, SocketContext
    │   ├── components/            Login, Register, Sidebar, ChatWindow, MessageBubble, NewChatModal
    │   ├── styles/index.css
    │   ├── App.jsx
    │   └── main.jsx
    └── .env.example
```

## Features

- **Authentication** — JWT-based register/login, bcrypt-hashed passwords, protected REST routes and protected socket connections.
- **1-on-1 and group chat** — start a direct message or create a named group with multiple members.
- **Message encryption** — every message is encrypted with AES-256-GCM before being stored in MongoDB (see "Security notes" below for what this does and doesn't cover).
- **Read receipts** — double-check marks turn blue once the recipient(s) have read a message, synced in real time.
- **Online status** — green/gray presence dot per user, updated instantly across all open sessions via Socket.io.
- **Typing indicators** — "typing…" shown live while the other person composes a reply.

## Prerequisites

- Node.js 18+
- A running MongoDB instance (local `mongod`, Docker, or MongoDB Atlas)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` — your MongoDB connection string.
- `JWT_SECRET` — any long random string.
- `MESSAGE_ENCRYPTION_KEY` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Start the server:
```bash
npm run dev      # with nodemon (auto-restart)
# or
npm start
```
The API + Socket.io server runs on `http://localhost:5000` by default.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # defaults already point at localhost:5000
npm run dev
```
Open `http://localhost:5173`. Register two different users (e.g. in two browser
windows/incognito tabs) to try real-time messaging, typing indicators, presence
and read receipts between them.

## How the real-time layer works

- The client connects to Socket.io with the JWT in `socket.handshake.auth.token`; the server verifies it before allowing the connection (`socket/socketHandler.js`).
- Each user joins a room per conversation they belong to, plus a personal `user:<id>` room.
- Sending a message emits `message:send` over the socket; the server persists it (encrypted) and broadcasts `message:new` to everyone in that conversation's room.
- `typing:start` / `typing:stop` and `message:read` are broadcast the same way, so all tabs/devices stay in sync without polling.
- Presence (`isOnline` / `lastSeen`) is tracked per-user across possibly multiple sockets (multiple tabs/devices), and only flips to "offline" once the user's *last* socket disconnects.

## Security notes

- **Passwords** are hashed with bcrypt and never stored or returned in plaintext.
- **Messages at rest** are encrypted with AES-256-GCM using a server-held key (`MESSAGE_ENCRYPTION_KEY`), so a raw database dump/leak does not expose message content. Combined with HTTPS/WSS in production, this covers both "in transit" and "at rest" encryption.
- This is **not end-to-end encryption**: the server holds the key and can decrypt messages to serve them to authenticated conversation members (needed for group chats, search, etc.). True E2EE would require per-conversation keys generated and held only on clients — a reasonable next step if that's a requirement.
- For production: serve behind HTTPS/WSS, add rate limiting on auth routes, add input validation/sanitization, and store secrets in a secrets manager rather than `.env`.

## Possible next steps

- File/image attachments
- Message editing/deletion and reactions
- Push notifications for offline users
- Pagination/infinite scroll on message history (the `before` query param on `GET /api/conversations/:id/messages` already supports this)
- Redis adapter for Socket.io to scale across multiple server instances
