# Backend → Frontend Handoff (Complete)

**Status:** ✅ READY FOR FRONTEND DEVELOPMENT  
**Authority:** Architecture Post-Stage-6  
**Version:** 16.7.9  
**Date:** 2025-01-01

---

## Executive Summary

Frontend development can now begin **independently and safely**.

This document consolidates the **binding contracts** between Backend and Frontend.

**Frontend engineers must treat these documents as authoritative.** Violating them requires architecture review.

---

## What You're Getting

### ✅ API Contract (Definitive)

**File:** `docs/api/endpoints.md`

Complete specification of:
- All 9+ endpoints (auth, query, admin, feedback)
- Request/response schemas
- HTTP status codes
- Permission requirements
- Local dev behavior (AUTH_ENABLED=false)

**Key Endpoints:**
| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /auth/login` | Get JWT | No |
| `POST /ask` | Execute query (**NDJSON**) | Conditional |
| `GET /admin/settings/feature-toggles` | List toggles | Admin |
| `POST /admin/training/{id}/approve` | Approve item | Admin |
| `POST /feedback` | Submit feedback | Yes |

---

### ✅ Streaming Protocol (Rigid Order)

**File:** `docs/api/streaming.md`

NDJSON streaming specification with **immutable chunk order**:

```
1. thinking          (always first, always 1)
2. technical_view    (always second, always 1)
3. data              (optional, always after technical_view)
4. business_view     (optional, after data)
5. end               (always last, always 1)
```

On error:
```
1. thinking
2. error
3. end
```

**Critical:** Frontend MUST NOT reorder chunks or skip validation.

---

### ✅ Environment Matrix (Auto-Detect)

**File:** `docs/environment/frontend-behavior.md`

How backend behaves in each environment:

| Flag | Local | CI | Prod | Action |
|------|-------|----|----|--------|
| `AUTH_ENABLED` | ❌ | ✅ | ✅ | Show/hide login |
| `RBAC_ENABLED` | ❌ | ✅ | ✅ | Show/hide admin |
| `ENABLE_TRAINING_PILOT` | ✅ | ❌ | ❌ | Show/hide training |
| `ENABLE_RATE_LIMIT` | ❌ | ❌ | ✅ | Implement backoff |
| `ENABLE_SEMANTIC_CACHE` | ❌ | ❌ | ✅ | Show cache notice |

**Frontend must detect at runtime** (not hardcode assumptions).

---

### ✅ Error Handling (Comprehensive)

**File:** `docs/api/errors.md`

Error codes, status codes, retry logic:

| Code | Status | Meaning | Retry |
|------|--------|---------|-------|
| `POLICY_VIOLATION` | 403 | Out-of-scope question | ❌ |
| `UNAUTHORIZED` | 401 | No/expired token | ❌ (redirect login) |
| `RATE_LIMIT_EXCEEDED` | 429 | 60 req/min exceeded | ✅ (exponential backoff) |
| `SQL_EXECUTION_FAILED` | 500 | DB error | Maybe |
| `SERVICE_UNAVAILABLE` | 503 | Backend down | ✅ |

**All errors include `error_code`, `message`, and `details`.**

---

### ✅ Governance Rules (Hard Constraints)

**File:** `docs/governance/frontend-rules.md`

**10 HARD RULES** (violating = PR blocked):

1. ❌ **No SQL generation** — Display only
2. ❌ **No permission inference** — Trust backend 403
3. ❌ **No RLS logic** — Backend filters
4. ❌ **No caching logic** — Backend handles
5. ❌ **No assumption modification** — Backend generates
6. ❌ **No secret storage** — Use sessionStorage/HttpOnly
7. ❌ **No response reordering** — Process chunks in order
8. ❌ **No unauthorized mutation** — Always request backend first
9. ❌ **No policy caching** — Always fetch fresh
10. ❌ **No hardcoded env assumptions** — Detect at runtime

**Golden Rule:** Frontend is a **visibility window**, not a **logic engine**.

---

### ✅ Development Setup (Complete)

**File:** `docs/development/frontend-dev-setup.md`

Step-by-step:
- Node.js, npm install, `.env.local` template
- Backend configuration for local dev
- Unit tests, E2E tests, mock API mode
- Debugging tools (DevTools, VS Code, curl examples)
- Common issues & solutions
- Deployment checklist

---

## Document Map

```
docs/
├── api/
│   ├── endpoints.md           ← All API routes + schemas
│   ├── streaming.md           ← NDJSON protocol (chunk order)
│   └── errors.md              ← Error codes + retry logic
├── environment/
│   └── frontend-behavior.md   ← Env matrix (local/ci/prod)
├── governance/
│   └── frontend-rules.md      ← 10 hard constraints
├── development/
│   └── frontend-dev-setup.md  ← Local setup + testing
└── FRONTEND_HANDOFF.md        ← This file
```

---

## What You DON'T Need

❌ **OpenAPI spec generation** — Already have `openapi/fortress.yaml`, don't reverse-engineer  
❌ **Backend assumptions** — Detect behavior at runtime  
❌ **Permission logic** — Backend returns 403, you handle it  
❌ **Error invention** — Use error codes from `errors.md`  
❌ **Custom streaming logic** — Use NDJSON library (msw, fetch, etc.)  

---

## Quick Start

### 1. Backend Running?

```bash
# In backend root
source .venv/bin/activate
python main.py

# Should say: Uvicorn running on http://0.0.0.0:8000
```

### 2. Frontend Setup

```bash
cd frontend/
npm install
cp .env.example .env.local

# Edit .env.local:
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_API=false  # Use real backend
VITE_ENV=development
```

### 3. Start Dev Server

```bash
npm run dev

# Output: Local:   http://localhost:5173/
```

### 4. Test Connection

```bash
# In browser console:
const r = await fetch('http://localhost:8000/api/v1/health');
console.log(await r.json());
```

### 5. Try First Query

- Open http://localhost:5173
- Enter: "How many users?" (or any question)
- Watch NDJSON chunks arrive in order
- Check browser Network tab for `/api/v1/ask`

---

## Key Decisions Already Made

### 1. Streaming: NDJSON (Not SSE)

**Why:** Ordered, discrete chunks. Easier to parse and validate.

**Format:** One JSON object per line.

**Order:** `thinking` → `technical_view` → `data` (optional) → `business_view` (optional) → `end`

---

### 2. Authentication: JWT (Bearer Token)

**When needed:** Only if `AUTH_ENABLED=true` (not in local dev).

**In local dev:** Auth is disabled; all endpoints succeed.

**In production:** Tokens required in `Authorization: Bearer <token>` header.

---

### 3. Admin UI: Feature-Gated

**Training Tab:** Only if `ENABLE_TRAINING_PILOT=true` (local only).

**Feature Toggles Panel:** Only if `RBAC_ENABLED=true` AND user has `admin.settings.read`.

---

### 4. Rate Limiting: Client-Side Backoff

**When:** `ENABLE_RATE_LIMIT=true` (production).

**Response:** HTTP 429 with `Retry-After` header.

**Frontend:** Exponential backoff (max 5 retries).

---

### 5. Semantic Cache: Transparent

**Indicator:** `X-Cache: HIT` header if result served from cache.

**Frontend:** Can show notice ("Result from cache, may not be current").

**Don't rely on:** Don't cache in frontend; backend handles freshness.

---

## Testing Endpoints Without Frontend

Use `curl` to validate backend:

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq -r .access_token)

# 2. Ask query (streaming NDJSON)
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"How many users?"}' \
  --http2

# 3. List toggles (admin)
curl -X GET http://localhost:8000/api/v1/admin/settings/feature-toggles \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common Questions

### Q: Can I cache API responses in frontend?

**A:** No. Use backend's semantic cache (revalidates against policy version). If you cache, you might show stale data after policy changes.

---

### Q: Should I validate the SQL?

**A:** No. Just display it (from `technical_view.sql`). SQLGuard already validated it server-side.

---

### Q: What if the user doesn't have permission?

**A:** Backend returns HTTP 403. You show "Access Denied" and suggest why (from `error_code`).

---

### Q: Can I infer what tables are in scope?

**A:** No. Request them from backend. Frontend doesn't know the active policy.

---

### Q: What if chunks arrive out of order?

**A:** Log error and fail the stream. That's a contract violation. Report to architecture team.

---

### Q: Can I skip the `technical_view` chunk?

**A:** No. It provides context for the `data` chunk (assumptions). Both are mandatory.

---

## Deployment Checklist

Before pushing to production:

- [ ] All endpoints tested with backend
- [ ] Streaming chunks validated for order
- [ ] Error handling tested (simulate 403, 429, 500)
- [ ] Environment variables templated (no secrets)
- [ ] No hardcoded API URLs (use env vars)
- [ ] No console errors in production build
- [ ] Governance rules verified (no SQL logic, no auth checks)
- [ ] CORS configured on backend
- [ ] Accessibility tested (axe DevTools)
- [ ] Architecture review passed (if governance-related)

---

## Getting Help

**If backend isn't working:**
→ Check backend logs: `python main.py` console output

**If endpoints don't match docs:**
→ Check `openapi/fortress.yaml` (is authoritative over this doc)

**If NDJSON chunks wrong:**
→ Check `docs/api/streaming.md` for exact schema

**If permission denied:**
→ Check `docs/api/errors.md` for `FORBIDDEN` / `UNAUTHORIZED` handling

**If governance rule unclear:**
→ Check `docs/governance/frontend-rules.md` for examples

---

## Summary

You now have:

✅ **API Contract** — Every endpoint, every field  
✅ **Streaming Protocol** — Chunk order, schema, error handling  
✅ **Environment Behavior** — What works where  
✅ **Error Handling** — All error codes + recovery  
✅ **Governance Rules** — What NOT to do  
✅ **Local Setup** — Step-by-step guide  

**Frontend development can begin immediately.**

**No backend assumptions needed. All contracts are written.**

---

## Next Steps (Frontend Team)

1. **Read** `docs/governance/frontend-rules.md` (10 rules)
2. **Setup** local dev per `docs/development/frontend-dev-setup.md`
3. **Test** first endpoint (`/auth/me`) per `docs/api/endpoints.md`
4. **Validate** streaming per `docs/api/streaming.md`
5. **Build** components that consume data (display only)
6. **Submit** PR with governance review tag
7. **Deploy** once all checks pass

---

**Backend is ready. Frontend has everything it needs.**

**Questions?** Check the relevant document. If it's not there, it's a backend contract gap — escalate to architecture.

