# Frontend Environment Behavior Matrix

**Audience:** Frontend Engineers  
**Status:** Binding (Post-Stage-6)

---

## Overview

Backend behavior varies based on environment and feature flags. Frontend MUST adapt to these variations without hard-coding assumptions.

This matrix documents **exactly** what Frontend should expect in each environment.

---

## Environment Modes

### Local Development (`ENV=local`)

**When:** Developer running backend locally with `npm run dev` + `python main.py`

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=false` by default → all endpoints succeed without token |
| **RBAC** | `RBAC_ENABLED=false` → all users treated as admin |
| **Rate Limiting** | `ENABLE_RATE_LIMIT=false` → no limits |
| **Semantic Cache** | `ENABLE_SEMANTIC_CACHE=false` → every query re-executes |
| **Training Pilot** | `ENABLE_TRAINING_PILOT=true` → `/admin/sandbox` available |
| **Error Detail** | Full stack traces in error responses (for debugging) |
| **CORS** | Permissive (typically `*` or `localhost:5173`) |

**Frontend Adaptation:**
```typescript
if (ENV === 'local') {
  // Skip login screen, use dummy token
  const token = localStorage.getItem('dev_token') || 'local_dev_token';
  
  // Show all admin panels
  showAdminUI = true;
  
  // No rate limit warning
  showRateLimitWarning = false;
}
```

**Typical .env:**
```
ENV=local
AUTH_ENABLED=false
RBAC_ENABLED=false
DEBUG=true
ENABLE_TRAINING_PILOT=true
```

---

### CI/Testing (`ENV=ci`)

**When:** Running in CI pipeline or automated tests

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=true` → tokens required |
| **RBAC** | `RBAC_ENABLED=true` → enforced per role |
| **Semantic Cache** | `ENABLE_SEMANTIC_CACHE=false` → consistent results |
| **Training Pilot** | `ENABLE_TRAINING_PILOT=false` → `/admin/sandbox` unavailable |
| **Error Detail** | Minimal (no internal details) |
| **CORS** | Restricted to known CI domains |
| **Database** | Test/fixture database (often in-memory SQLite) |

**Frontend Adaptation:**
```typescript
if (ENV === 'ci') {
  // Require login (use test credentials)
  loginForm.show();
  
  // Hide experimental features
  showAdminUI = false;
  
  // Expect errors to be concise
}
```

**Typical .env:**
```
ENV=ci
AUTH_ENABLED=true
RBAC_ENABLED=true
DEBUG=false
DB_PROVIDER=sqlite  # or test fixtures
```

---

### Production (`ENV=production`)

**When:** Running in production environment

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=true` → JWT validation strict |
| **RBAC** | `RBAC_ENABLED=true` → enforced per role |
| **RLS** | `RLS_ENABLED=true` → row-level security enforced |
| **Rate Limiting** | `ENABLE_RATE_LIMIT=true` → 60 req/min per user |
| **Semantic Cache** | `ENABLE_SEMANTIC_CACHE=true` → cached results |
| **Training Pilot** | `ENABLE_TRAINING_PILOT=false` → `/admin/sandbox` unavailable |
| **Error Detail** | Minimal (no internal details, generic messages) |
| **CORS** | Whitelist only approved domains |
| **Debug** | `DEBUG=false` → no stack traces |

**Frontend Adaptation:**
```typescript
if (ENV === 'production') {
  // Require login with real credentials
  enforceLogin();
  
  // Hide debug panels
  showDebugInfo = false;
  
  // Implement exponential backoff on rate limit (429)
  implementRateLimitBackoff();
  
  // Cache responses locally (respects cache headers)
  enableClientSideCache();
}
```

**Typical .env:**
```
ENV=production
AUTH_ENABLED=true
RBAC_ENABLED=true
RLS_ENABLED=true
DEBUG=false
ENABLE_SEMANTIC_CACHE=true
```

---

## Key Feature Flags & Frontend Impact

### `AUTH_ENABLED`

**If `true`:**
- Login screen required
- Token stored in localStorage
- Token sent in all requests: `Authorization: Bearer <token>`
- `/auth/me` returns actual user info

**If `false`:**
- Login screen skipped
- Dummy token used (`local_dev_token`)
- All endpoints accept requests without auth header
- `/auth/me` returns fixture user (admin)

**Frontend Code:**
```typescript
const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (settings.AUTH_ENABLED) {
      checkToken(); // Must be valid
    } else {
      setIsAuthenticated(true); // Pretend logged in
    }
  }, []);
};
```

---

### `RBAC_ENABLED`

**If `true`:**
- `/auth/me` returns user roles and permissions
- Endpoints check `x-permissions` header (from OpenAPI spec)
- Admin endpoints return 403 if user lacks permission

**If `false`:**
- All users treated as super-admin
- No permission checks
- All endpoints succeed

**Frontend Code:**
```typescript
const canAccess = (permission: string) => {
  if (!settings.RBAC_ENABLED) return true; // Always allowed
  return user.permissions.includes(permission);
};

// In components:
{canAccess('admin.settings.write') && <AdminPanel />}
```

---

### `ENABLE_TRAINING_PILOT`

**If `true`:**
- Admin panel shows "Training Items" tab
- `/admin/training` returns data
- `/admin/training/{id}/approve` endpoint works
- `/admin/sandbox` available for test queries

**If `false`:**
- Training UI is hidden
- All `/admin/training` endpoints return 404
- Feedback endpoint still works (for logging)

**Frontend Code:**
```typescript
{settings.ENABLE_TRAINING_PILOT && (
  <Tab label="Training" value="training">
    <TrainingPanel />
  </Tab>
)}
```

---

### `ENABLE_SEMANTIC_CACHE`

**If `true`:**
- Same query may return cached result (faster, but potentially stale)
- Response includes `X-Cache: HIT` header if served from cache
- Policy hash may be from previous validation

**If `false`:**
- Every query re-executes (always fresh)
- No caching headers

**Frontend Code:**
```typescript
const isCachedResult = response.headers.get('X-Cache') === 'HIT';
if (isCachedResult) {
  showNotice('This result is cached from a previous query. Data may not be current.');
}
```

---

### `ENABLE_RATE_LIMIT`

**If `true`:**
- `/ask` returns 429 after 60 requests/minute
- Response includes `Retry-After` header
- Frontend should implement exponential backoff

**If `false`:**
- No rate limiting
- No 429 responses

**Frontend Code:**
```typescript
const handleRateLimit = (error: APIError) => {
  if (error.status === 429) {
    const retryAfter = parseInt(error.headers['Retry-After'] || '60');
    setTimeout(() => retryQuery(), retryAfter * 1000);
  }
};
```

---

### `ENABLE_GZIP_COMPRESSION`

**If `true`:**
- Streaming responses are gzip-compressed
- Automatically decompressed by browser

**If `false`:**
- Uncompressed responses (larger payloads)

**Frontend:** No code change needed (browser handles automatically).

---

## Behavior Matrix (Quick Reference)

| Flag | Local | CI | Prod | Frontend Impact |
|------|-------|----|----|-----------------|
| `AUTH_ENABLED` | ❌ | ✅ | ✅ | Show/hide login |
| `RBAC_ENABLED` | ❌ | ✅ | ✅ | Show/hide admin |
| `RLS_ENABLED` | ❌ | ❌ | ✅ | N/A (backend) |
| `ENABLE_TRAINING_PILOT` | ✅ | ❌ | ❌ | Show/hide training UI |
| `ENABLE_SEMANTIC_CACHE` | ❌ | ❌ | ✅ | Show cache notice |
| `ENABLE_RATE_LIMIT` | ❌ | ❌ | ✅ | Implement backoff |
| `DEBUG` | ✅ | ❌ | ❌ | Show error details |

---

## How to Detect Environment at Runtime

**Option 1: GET /health**

```typescript
const detectEnvironment = async () => {
  const response = await fetch('/api/v1/health');
  const health = await response.json();
  
  // Infer from component status:
  // - If all components degraded: likely local
  // - If auth present: ci or prod
  // - Production flag in response: prod
};
```

**Option 2: Check Settings Endpoint**

```typescript
const detectEnvironment = async () => {
  try {
    // This succeeds in all environments
    const settings = await fetch('/api/v1/settings'); // Hypothetical
    const config = await settings.json();
    
    return {
      authEnabled: config.AUTH_ENABLED,
      trainingPilot: config.ENABLE_TRAINING_PILOT,
      ...
    };
  } catch {
    // Endpoint not available = prod (security)
  }
};
```

**Option 3: Attempt Login with No Credentials**

```typescript
const detectEnvironment = async () => {
  try {
    // This succeeds if AUTH_ENABLED=false (local)
    const response = await fetch('/api/v1/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'test' })
    });
    
    if (response.ok) {
      return 'local'; // No auth required
    }
  } catch {
    // Timeout or error
  }
};
```

---

## Conditional UI Rendering

**Pattern:**
```typescript
import { useSettings } from '@/hooks/useSettings';

export function AdminPanel() {
  const { settings } = useSettings();

  if (!settings.RBAC_ENABLED) {
    return <AdminUI showAllFeatures />;
  }

  return <AdminUI restricted />;
}

export function TrainingTab() {
  const { settings } = useSettings();

  if (!settings.ENABLE_TRAINING_PILOT) {
    return <Locked reason="Training pilot disabled" />;
  }

  return <TrainingUI />;
}
```

---

## Error Messages by Environment

### Local
```
Database Connection Failed: Could not connect to oracle+oracledb://...
  Stack trace: ...
  Suggestion: Check ORACLE_CONNECTION_STRING in .env
```

### CI / Production
```
Service Error: Unable to execute query

Error Code: SERVICE_UNAVAILABLE
Correlation ID: 550e8400-e29b-41d4-a716-446655440000

[Retry] [Contact Support]
```

---

## Summary

**Frontend must:**
1. ✅ Detect environment/flags at startup
2. ✅ Conditionally render UI based on settings
3. ✅ Handle missing features gracefully
4. ✅ Implement backoff for rate limiting (prod only)
5. ✅ Show appropriate error messages per environment
6. ✅ Never hard-code environment assumptions

