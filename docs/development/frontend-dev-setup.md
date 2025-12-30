# Frontend Local Development Setup & Testing

**Audience:** Frontend Engineers  
**Status:** Complete Setup Guide (Post-Stage-6)

---

## Prerequisites

- **Node.js** 16+ (check: `node --version`)
- **npm** 8+ (check: `npm --version`)
- **Backend running locally** on `http://localhost:8000` (or configured via `.env`)
- **Git** (for version control)

---

## Setup Steps

### 1. Install Dependencies

```bash
cd frontend/

npm install

# Or with yarn
yarn install
```

**What gets installed:**
- React 18+
- TypeScript
- Vite (dev server)
- Chart.js, Axios, other UI libraries
- Testing libraries (Jest, React Testing Library)

---

### 2. Create `.env.local`

Copy the example and customize:

```bash
cp .env.example .env.local
```

**Sample `.env.local`:**
```env
# ============================================================================
# Backend Configuration
# ============================================================================

# Backend URL (where FastAPI is running)
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Enable mock mode (ignores real backend if true)
VITE_USE_MOCK_API=false

# ============================================================================
# Application Settings
# ============================================================================

# App name (appears in UI)
VITE_APP_NAME=EasyData

# App version
VITE_APP_VERSION=16.7.x

# Frontend environment
# Allowed: development | staging | production
VITE_ENV=development

# Enable debug logging
VITE_DEBUG=true

# ============================================================================
# Feature Flags
# ============================================================================

# Show admin panels (overrides backend if true)
VITE_SHOW_ADMIN_UI=true

# Show training tab (overrides backend if true)
VITE_SHOW_TRAINING_UI=true

# Show error details in development
VITE_SHOW_ERROR_DETAILS=true

# ============================================================================
# Analytics & Monitoring
# ============================================================================

# Sentry DSN (error tracking)
# VITE_SENTRY_DSN=https://...

# Google Analytics ID
# VITE_GA_ID=G-...
```

---

### 3. Start Development Server

```bash
npm run dev

# Output:
# VITE v4.0.0 build preview server running at:
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

**Access at:** `http://localhost:5173`

---

### 4. Verify Backend Connection

Open browser console and test:

```javascript
// In browser DevTools console:

const response = await fetch('http://localhost:8000/api/v1/health');
console.log(await response.json());

// Should return:
// {
//   "status": "healthy",
//   "components": { ... }
// }
```

---

## Backend Configuration for Frontend Development

The **backend** must be running locally with these settings for development:

```env
# .env (in backend root)

# Development mode
ENV=local
APP_ENV=development
DEBUG=true

# Security: disable for local development
AUTH_ENABLED=false
RBAC_ENABLED=false
RLS_ENABLED=false

# Feature flags
ENABLE_TRAINING_PILOT=true
ENABLE_RATE_LIMIT=false
ENABLE_LOGGING=true

# CORS: allow frontend dev server
CORS_ORIGINS=http://localhost:5173 http://localhost:3000

# Database (use your test DB)
DB_PROVIDER=oracle
ORACLE_CONNECTION_STRING=...

# LLM Provider
LLM_PROVIDER=groq
GROQ_API_KEY=...

# Vector DB (local for dev)
VECTOR_DB=chromadb
VECTOR_STORE_PATH=./data/vectorstore

# Port
BACKEND_PORT=8000
```

**Start backend:**
```bash
# In backend root
source .venv/bin/activate
python main.py
# Or with Uvicorn:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Testing

### Unit Tests

```bash
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Integration Tests (Full Stack)

Requires both backend and frontend running:

```bash
npm run test:integration

# Or with Playwright (E2E)
npm run test:e2e
```

**Typical E2E test:**
```typescript
import { test, expect } from '@playwright/test';

test('ask query and see results', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Fill question
  await page.fill('[placeholder="Ask your question..."]', 'How many users?');

  // Submit
  await page.click('button:has-text("Ask")');

  // Wait for technical_view
  await page.waitForSelector('[data-test="technical-view"]');
  const sql = await page.textContent('[data-test="sql"]');

  expect(sql).toContain('SELECT');

  // Wait for data
  await page.waitForSelector('[data-test="data-table"]');
  const rows = await page.$$('[data-test="data-row"]');

  expect(rows.length).toBeGreaterThan(0);
});
```

---

## Mock API Mode

For frontend-only development (no backend needed):

```bash
# Set in .env.local
VITE_USE_MOCK_API=true
```

**Mock responses are in `/src/mocks/`:**

```typescript
// src/mocks/handlers.ts

import { rest } from 'msw';

export const handlers = [
  rest.post('/api/v1/ask', (req, res, ctx) => {
    // Stream mock chunks
    return ctx.status(200);
  }),

  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        access_token: 'mock_token_12345',
        token_type: 'bearer',
        expires_in: 3600
      })
    );
  }),

  // ... other endpoints
];
```

**Start server with mocks:**
```bash
npm run dev:mock
```

---

## Debugging

### 1. Browser DevTools

Open Chrome DevTools (`F12`):

**Network tab:**
- Monitor `/api/v1/*` requests
- Check status codes, response bodies
- View streaming responses (NDJSON)

**Console tab:**
- Check for errors
- Log API calls: `console.log(response)`
- Test fetch manually

### 2. VS Code Debugging

Launch debugger in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend",
      "sourceMapPathPrefix": "webpack:///"
    }
  ]
}
```

Set breakpoints in VS Code and inspect state.

### 3. Environment Variable Debugging

Log all environment variables:

```typescript
// In App.tsx or main.tsx
if (import.meta.env.DEV) {
  console.log('Frontend Environment:', {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    USE_MOCK_API: import.meta.env.VITE_USE_MOCK_API,
    DEBUG: import.meta.env.VITE_DEBUG,
    ENV: import.meta.env.VITE_ENV
  });
}
```

---

## Common Issues & Solutions

### Issue 1: CORS Error

**Error:**
```
Access to XMLHttpRequest at 'http://localhost:8000/api/v1/ask' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
- Ensure backend `.env` includes frontend origin in `CORS_ORIGINS`
- Restart backend
- Check that `http://localhost:5173` (exact URL) is listed

```env
# In backend .env
CORS_ORIGINS=http://localhost:5173
```

---

### Issue 2: 401 Unauthorized (But AUTH_ENABLED=false)

**Error:**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired JWT token"
}
```

**Solution:**
- Verify `AUTH_ENABLED=false` in backend `.env`
- Clear browser cache: `Ctrl+Shift+Del`
- Restart backend
- Check if middleware is enforcing auth despite the flag

```bash
# In backend, grep for auth enforcement
grep -r "require_auth" app/
```

---

### Issue 3: Streaming Response Not Consumed

**Error:**
```
Unhandled promise rejection: Incomplete streaming response
```

**Solution:**
- Ensure NDJSON response is being read correctly
- Check if Response.body is being consumed in order
- Validate chunk parsing:

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const line = decoder.decode(value);
  const chunk = JSON.parse(line);
  
  console.log('Received chunk:', chunk.type);
}
```

---

### Issue 4: Database Connection Failed (Backend)

**Error:**
```
ORA-12514: TNS:listener does not currently know of service requested in connect descriptor
```

**Solution:**
- Verify Oracle/MSSQL server is running
- Check connection string in `.env`
- Test connection manually:

```bash
sqlplus user/password@host:port/service
```

---

### Issue 5: Token Expiration During Development

**Issue:** Token expires after `JWT_EXPIRATION_MINUTES` (default 60).

**Solution:**
- Increase expiration in backend `.env`:
  ```env
  JWT_EXPIRATION_MINUTES=1440  # 24 hours for dev
  ```
- Or implement token refresh in frontend:
  ```typescript
  if (tokenExpiringIn < 5 * 60) { // Less than 5 min
    await refreshToken();
  }
  ```

---

## Sample API Calls

### 1. Login (if AUTH_ENABLED=true)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'

# Response:
# {
#   "access_token": "eyJhbGc...",
#   "token_type": "bearer",
#   "expires_in": 3600
# }
```

### 2. Get Current Session

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# {
#   "user_id": "uuid",
#   "username": "user",
#   "roles": ["admin"],
#   "permissions": ["*"]
# }
```

### 3. Submit Query (Streaming)

```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"question":"How many users?","stream":true}' \
  --http2

# Response (NDJSON):
# {"type":"thinking","trace_id":"...","status":"..."}
# {"type":"technical_view","trace_id":"...","sql":"SELECT COUNT(*)..."}
# {"type":"data","trace_id":"...","rows":[[150]]}
# {"type":"end","trace_id":"...","duration_ms":245}
```

### 4. List Feature Toggles (Admin)

```bash
curl -X GET http://localhost:8000/api/v1/admin/settings/feature-toggles \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Response:
# {
#   "toggles": [
#     {
#       "feature": "ENABLE_SEMANTIC_CACHE",
#       "enabled": true,
#       "mutable": true
#     }
#   ]
# }
```

---

## Build for Production

```bash
npm run build

# Output: frontend/dist/
# Then deploy dist/ to web server
```

**Optimize:**
```bash
# Analyze bundle
npm run build:analyze

# Output shows largest modules (optimize before deploy)
```

---

## Hot Module Replacement (HMR)

Changes auto-reload in dev mode:

```bash
# While running: npm run dev
# Edit a component and save
# Browser hot-reloads (preserves state if possible)
```

To disable HMR:
```bash
VITE_HMR_PROTOCOL=ws npm run dev
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/user-panel

# Make changes, test locally
npm run test
npm run lint

# Commit
git add .
git commit -m "feat: add user panel with RBAC"

# Push and create PR
git push origin feature/user-panel

# In PR:
# - Describe feature
# - Link to backend changes
# - Note breaking changes
# - Request architecture review if governance-related
```

---

## Deployment Checklist

Before deploying frontend:

- [ ] All tests pass: `npm run test`
- [ ] No lint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in DevTools
- [ ] No hardcoded URLs (use `VITE_API_BASE_URL`)
- [ ] Environment variables documented
- [ ] No secrets in code (use `.env.local`)
- [ ] Governance rules followed (see `frontend-rules.md`)
- [ ] Streaming response handling verified
- [ ] Error handling tested with offline backend
- [ ] Accessibility audit passed (axe DevTools)

---

## Summary

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server | `npm run dev` |
| Tests | `npm run test` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Type check | `npm run type-check` |
| Debug | Chrome DevTools or VS Code |

**When stuck:** Check browser console, backend logs, CORS headers, environment variables (in that order).

