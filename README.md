# Gupshup

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## Backend

The backend is built with Node.js, Express, TypeScript, Socket.io, Prisma ORM, PostgreSQL (Supabase), and Redis (Upstash).

### Running Both Frontend and Backend

1. **Start Backend** (Port 3000):
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   npm run dev
   ```

2. **Start Frontend** (Port 4200):
   ```bash
   cd frontend
   npm start
   ```

The frontend runs on `http://localhost:4200` and proxies or connects directly to the backend API on `http://localhost:3000`.

---

## Deployment on Render

### 1. Backend (Render Web Service)
- **Type**: Web Service
- **Root Directory**: `backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npx prisma migrate deploy && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000` (Render will assign automatically)
  - `DATABASE_URL`: Supabase PostgreSQL connection string
  - `REDIS_URL`: Upstash Redis TLS connection string (`rediss://...`)
  - `JWT_ACCESS_SECRET`: Secret key for access token signing
  - `JWT_REFRESH_SECRET`: Secret key for refresh token signing
  - `JWT_ACCESS_EXPIRES`: `15m`
  - `JWT_REFRESH_EXPIRES`: `7d`
  - `CLIENT_ORIGINS`: Frontend URL(s) comma-separated (e.g. `https://gupshup-app.onrender.com,http://localhost:4200`)
  - `COOKIE_SAMESITE`: `lax` (keeps refresh token first-party via static-site rewrite proxy)
  - `RESEND_API_KEY`: Resend API key (avoids blocked SMTP ports on Render free tier)
  - `MAIL_FROM`: `Gupshup <onboarding@resend.dev>`
  - `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
  - `CLOUDINARY_API_KEY`: Cloudinary API key
  - `CLOUDINARY_API_SECRET`: Cloudinary API secret
  - `OTP_TTL_SECONDS`: `600`

### 2. Frontend (Render Static Site)
- **Type**: Static Site
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist/gupshup/browser`
- **Redirects / Rewrites** (in order):
  1. Source: `/api/*`  
     Destination: `https://<backend-url>/api/*`  
     Action: `Rewrite`
  2. Source: `/*`  
     Destination: `/index.html`  
     Action: `Rewrite` (enables Angular HTML5 pushState routing)


