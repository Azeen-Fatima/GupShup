# Gupshup API Documentation

- Development Base URL: `http://localhost:3000/api/v1`  
- Production Base URL: `/api/v1` (via Render Static Site rewrite proxy) or `https://<backend-service>.onrender.com/api/v1`
- WebSocket URL: `http://localhost:3000` (Dev) / `https://<backend-service>.onrender.com` (Prod)
- Reverse Proxy: Configured with `app.set('trust proxy', 1)` for Render load balancers.
- Email Provider: Resend HTTP API (Primary) with fallback to SMTP Nodemailer. Returns 503 on email delivery failure without consuming OTP cooldown.

---

## Response Envelopes

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "nextCursor": "uuid-or-null",
    "hasMore": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error description",
    "details": [ ... ]
  }
}
```

---

## 1. System & Health

### `GET /health` / `GET /api/v1/health`
Checks connectivity to PostgreSQL (Supabase) and Redis (Upstash).
- **Auth**: None
- **Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-10-03T19:00:00.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "cloudinary": "configured",
    "googleAuth": "not_configured"
  }
}
```

---

## 2. Authentication (`/api/v1/auth`)

### `POST /signup/code`
Sends 6-digit OTP to provided email for registration.
- **Body**: `{ "email": "user@example.com" }`
- **Rate Limit**: 10 requests / 15 min per IP

### `POST /signup/verify`
Verifies 6-digit OTP and generates short-lived `signupToken`.
- **Body**: `{ "email": "user@example.com", "code": "123456" }`
- **Response**: `{ "signupToken": "jwt..." }`

### `GET /signup/username?username=john_doe`
Checks if username is available.
- **Query**: `username` (3-20 lowercase alphanumeric characters, `.` or `_`)
- **Response**: `{ "available": true, "username": "john_doe" }`

### `POST /signup`
Completes account registration, creates initial "Notes to Self" conversation, and logs user in.
- **Body**:
```json
{
  "signupToken": "jwt...",
  "name": "John Doe",
  "username": "john_doe",
  "password": "Password123!"
}
```
- **Response**: Sets `refreshToken` httpOnly cookie.
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "name": "John Doe",
    "avatarUrl": null
  },
  "accessToken": "jwt..."
}
```

### `POST /login`
Logs in with email or username + password.
- **Body**: `{ "identifier": "john_doe", "password": "Password123!" }`
- **Response**: Sets `refreshToken` httpOnly cookie. Returns `user` and `accessToken`.
- **Note**: For Google-only accounts (no password set), returns `401 Unauthorized` with code `GOOGLE_ACCOUNT_ONLY` and message `"This account uses Google sign-in. Please use Continue with Google."`.

### `POST /refresh`
Rotates refresh token and issues new access token.
- **Headers/Cookies**: `refreshToken` cookie or `{ "refreshToken": "jwt..." }` in body.
- **Response**: Returns new `accessToken` and sets rotated `refreshToken` cookie.

### `POST /logout`
Revokes active refresh token and clears cookie.
- **Response**: `{ "message": "Logged out successfully" }`

### `POST /forgot-password/code`
Sends password reset OTP.
- **Body**: `{ "email": "user@example.com" }`

### `POST /forgot-password/verify`
Verifies reset code and issues `resetToken`.
- **Body**: `{ "email": "user@example.com", "code": "123456" }`
- **Response**: `{ "resetToken": "jwt..." }`

### `POST /forgot-password/reset`
Resets password and revokes all existing refresh tokens.
- **Body**: `{ "resetToken": "jwt...", "newPassword": "NewPassword123!" }`

### `POST /change-password`
Updates password for authenticated user.
- **Auth**: `Bearer <accessToken>`
- **Body**: `{ "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }`

### `POST /change-email/code`
Sends verification OTP to new email address.
- **Auth**: `Bearer <accessToken>`
- **Body**: `{ "newEmail": "new@example.com" }`

### `POST /change-email/confirm`
Confirms verification OTP and updates user's email.
- **Auth**: `Bearer <accessToken>`
- **Body**: `{ "newEmail": "new@example.com", "code": "123456" }`

### `POST /google`
Verifies Google OAuth ID token (audience must match `GOOGLE_CLIENT_ID` and `email_verified` must be `true`).
- **Body**: `{ "idToken": "google_id_token" }`
- **Response (existing user)**: Returns `{ "needsProfile": false, "user": { ... }, "accessToken": "jwt..." }` and sets `refreshToken` cookie.
- **Response (new user)**: Returns `{ "needsProfile": true, "googleToken": "jwt...", "email": "user@gmail.com", "name": "User Name", "avatarUrl": "https://..." }`.

### `POST /google/complete`
Completes registration for a first-time Google sign-in user (allows choosing unique username).
- **Body**:
```json
{
  "googleToken": "jwt...",
  "name": "User Name",
  "username": "chosen_username",
  "avatarUrl": "https://...",
  "password": "OptionalPassword123!"
}
```
- **Response**: Sets `refreshToken` httpOnly cookie. Returns `user` and `accessToken`.

---

## 3. Users & Profile (`/api/v1/users`)
*All endpoints require `Authorization: Bearer <accessToken>`.*

### `GET /me`
Returns current user's profile.
- **Response**: `{ "user": { "id", "email", "username", "name", "avatarUrl", "bio", "statusMessage", "themePreference", "createdAt" } }`

### `PATCH /me`
Updates profile fields.
- **Body**:
```json
{
  "name": "Updated Name",
  "bio": "Software Engineer",
  "statusMessage": "Working remotely",
  "themePreference": "dark"
}
```

### `POST /me/avatar`
Uploads profile photo to Cloudinary.
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (image max 2MB)
- **Response**: Updated user with `avatarUrl`.

### `DELETE /me/avatar`
Removes user avatar.
- **Response**: Updated user with `avatarUrl: null`.

### `GET /search?q=query`
Searches users by username or name.
- **Response**: Array of users with relative relationship status:
  - `relationshipStatus`: `'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined' | 'blocked_by_me' | 'blocked_by_them'`

### `GET /me/declined`
Lists user requests declined by the current user.

### `GET /me/blocked`
Lists users blocked by the current user.

---

## 4. Conversations (`/api/v1/conversations`)
*All endpoints require `Authorization: Bearer <accessToken>`.*

### `GET /`
Fetches conversation list for current user.
- **Response**:
```json
{
  "conversations": [
    {
      "id": "uuid",
      "status": "accepted",
      "state": "normal",
      "isSelf": false,
      "isBlockedByMe": false,
      "isBlockedByThem": false,
      "otherUser": {
        "id": "uuid",
        "username": "alice",
        "name": "Alice Smith",
        "avatarUrl": null,
        "isOnline": true
      },
      "lastMessage": {
        "id": "uuid",
        "body": "Hey there!",
        "type": "text",
        "senderId": "uuid",
        "createdAt": "2026-10-03T19:00:00.000Z",
        "seenAt": null
      },
      "unreadCount": 2,
      "lastMessageAt": "2026-10-03T19:00:00.000Z"
    }
  ]
}
```

### `POST /`
Starts a conversation or sends initial message.
- **Body**:
```json
{
  "recipientId": "uuid",
  "message": "Hello!"
}
```
- **Rules**:
  - If self: returns Notes to Self conversation.
  - If blocked: 403 Forbidden.
  - If pending and requester sent 1 message: 403 Forbidden (`MAX_PENDING_MESSAGES_REACHED`).

### `GET /:id`
Gets conversation details and members.

### `POST /:id/accept`
Accepts a pending conversation request.

### `POST /:id/decline`
Declines a pending conversation request.

### `POST /:id/block`
Blocks the other user in the conversation.

### `POST /:id/unblock`
Unblocks the other user.

### `POST /:id/clear`
Clears chat history for current user (sets `clearedAt`).

### `DELETE /:id`
Hides conversation from chat list (sets `hiddenAt`).

---

## 5. Messages (`/api/v1/conversations/:id/messages`)
*All endpoints require `Authorization: Bearer <accessToken>`.*

### `GET /:id/messages?cursor=<messageId>&limit=30`
Fetches paginated messages in chronological order.
- Respects `clearedAt`.
- **Response**:
```json
{
  "messages": [ ... ],
  "nextCursor": "uuid-or-null",
  "hasMore": false
}
```

### `POST /:id/messages`
Sends a message in the conversation.
- **Body**:
```json
{
  "type": "text",
  "body": "Hi there!",
  "attachmentUrl": null
}
```
- Emits real-time Socket.io event `message:new`.

### `POST /:id/seen`
Marks all unseen messages in conversation as seen.
- Emits real-time Socket.io event `message:seen`.

---

## 6. Uploads (`/api/v1/uploads`)
*Requires `Authorization: Bearer <accessToken>`.*

### `POST /image`
Uploads chat attachment image (max 5MB).
- **Content-Type**: `multipart/form-data`
- **Field**: `file` (jpeg, png, webp, gif)
- **Response**: `{ "url": "https://...", "publicId": "...", "width": 800, "height": 600 }`

---

## 7. Real-Time Socket.io Events

### Connection & Auth
Pass JWT token via auth handshake or Authorization header:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: accessToken }
});
```

### Client -> Server Events
| Event | Payload | Description |
|---|---|---|
| `presence:heartbeat` | None | Refreshes user online TTL (every 25s) |
| `typing:start` | `{ "conversationId": "uuid" }` | Sets typing status (4s TTL) and notifies other member |
| `typing:stop` | `{ "conversationId": "uuid" }` | Clears typing status |

### Server -> Client Events
| Event | Payload | Description |
|---|---|---|
| `presence:update` | `{ "userId": "uuid", "isOnline": true/false, "lastSeen": "iso" }` | Broadcasted on user connect / disconnect |
| `typing:update` | `{ "conversationId": "uuid", "userId": "uuid", "isTyping": true/false }` | Typing indicator for conversation |
| `message:new` | `{ "conversationId": "uuid", "message": { ... } }` | Delivered in real-time when new message is sent |
| `message:seen` | `{ "conversationId": "uuid", "seenBy": "uuid", "seenAt": "iso" }` | Delivered when recipient opens conversation |
| `conversation:updated`| `{ "conversationId": "uuid", ... }` | Delivered on accept, decline, block, etc. |
| `user:updated` | `{ "id": "uuid", "name": "string", "avatarUrl": "string|null", "bio": "string|null", "statusMessage": "string|null" }` | Delivered to conversation partners when a user updates profile or avatar |
