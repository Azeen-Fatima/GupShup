# Gupshup Backend

Production-ready real-time chat backend powering the Gupshup web application.

## Stack & Architecture
- **Runtime**: Node.js (`>= 20`), Express 4.21 with TypeScript (strict CommonJS)
- **Database**: PostgreSQL on Supabase via Prisma ORM
- **Cache & Presence**: Redis on Upstash (`ioredis` over TLS `rediss://`)
- **Real-Time Communication**: Socket.io 4.8 with WebSocket transports and room broadcasting
- **Authentication**: JWT (Access Token + Refresh Token rotation with SHA-256 DB persistence and httpOnly cookies)
- **Password Security**: `bcrypt` (12 salt rounds)
- **Validation**: Zod with typed Express middleware
- **File Uploads**: Cloudinary v2 via Multer memory storage
- **Email Delivery**: Nodemailer with in-memory test capture and console dev fallback
- **Logging**: Pino structured logger with redaction and pino-pretty
- **Testing**: Vitest + Supertest

---

## Getting Started

### 1. Environment Setup
All commands must be run inside the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

Fill in the required environment variables in `backend/.env`:
- `DATABASE_URL` (Supabase PostgreSQL connection string)
- `REDIS_URL` (Upstash Redis TLS connection string `rediss://...`)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

*Optional integrations:*
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Falls back to logging OTPs to console in dev)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Returns clean 503 if omitted)
- `GOOGLE_CLIENT_ID` (Returns clean 503 if omitted)

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate Prisma Client
```bash
npm run prisma:generate
```

### 4. Run Development Server
```bash
npm run dev
```
Server starts on `http://localhost:3000` with hot-reloading.

### 5. Run Tests
```bash
npm test
```
Runs the full Vitest integration suite across auth, users, conversations, messages, and sockets.

### 6. Build & Production Start
```bash
npm run build
npm start
```

---

## Deployment on Render (Web Service)

1. **Create Web Service on Render**:
   - **Repository**: Connect your GitHub repository
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma migrate deploy && npm run build`
   - **Start Command**: `npm start` (runs `node dist/server.js`)

2. **Environment Variables on Render**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default, Render sets `PORT` automatically)
   - `DATABASE_URL`: Supabase PostgreSQL connection string (Transaction/Session pooler)
   - `REDIS_URL`: Upstash Redis TLS connection string (`rediss://...`)
   - `JWT_ACCESS_SECRET`: 64+ char random hex string
   - `JWT_REFRESH_SECRET`: 64+ char random hex string
   - `JWT_ACCESS_EXPIRES`: `15m`
   - `JWT_REFRESH_EXPIRES`: `7d`
   - `CLIENT_ORIGINS`: Comma-separated list of allowed frontend origins (e.g. `https://gupshup-app.onrender.com,http://localhost:4200`)
   - `COOKIE_SAMESITE`: `lax` (default, recommended when using Render Static Site `/api/*` rewrite proxy) or `none` (if using separate domains without rewrite)
   - `RESEND_API_KEY`: Resend API key (recommended because Render free tier blocks outbound SMTP ports 25, 465, 587)
   - `MAIL_FROM`: `Gupshup <onboarding@resend.dev>` (or your verified domain on Resend)
   - `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
   - `CLOUDINARY_API_KEY`: Cloudinary API key
   - `CLOUDINARY_API_SECRET`: Cloudinary API secret
   - `OTP_TTL_SECONDS`: `600`

3. **Database Migrations**:
   Run schema migrations safely during deployment via:
   ```bash
   npx prisma migrate deploy
   ```
   (included in the build command above).

---

## Key Features & Business Rules

1. **Self Chat ("Notes to Self")**:
   - Created automatically upon signup.
   - Pinned conversation where user messages themselves.

2. **1-Message Pending Request Rule**:
   - When a user sends a conversation request to a new contact, the conversation is marked `pending`.
   - The requester is restricted to sending exactly **1** message until the recipient accepts the request (`MAX_PENDING_MESSAGES = 1`).
   - If the recipient replies or clicks Accept, the conversation transitions to `accepted`.

3. **Soft Clear & Hide**:
   - **Clear Chat** sets `clearedAt = now()`. Messages remain stored for the other party, but are hidden from the clearing user's view.
   - **Delete Chat** sets `hiddenAt = now()`. The conversation vanishes from the chat list until a new incoming message arrives.

4. **Presence & Heartbeat**:
   - Redis key `presence:{userId}` with a 45-second TTL.
   - Socket client sends `presence:heartbeat` every 25 seconds.
   - When the client disconnects and has no remaining active tabs, status immediately flips to offline with `last_seen` timestamp recorded.

5. **Typing Indicators**:
   - Ephemeral Redis key `typing:{convId}:{userId}` with a 4-second TTL.
   - Emits `typing:update` only to active conversation participants.

---

## API Reference
See [`API.md`](./API.md) for full endpoint and socket event documentation.  
Use [`requests.http`](./requests.http) for interactive testing via REST Client.
