# Frontend Governance Rules — Hard Constraints

**Audience:** Frontend Engineers & Architects  
**Status:** BINDING (Architectural Enforcement)  
**Violations:** Block all PRs; escalate to architecture review

---

## Executive Mandate

**The Frontend is a visibility window, NOT a source of authority.**

Frontend provides:
- ✅ **Display** — Show data returned from backend
- ✅ **Control** — Trigger backend operations
- ✅ **Navigation** — Help users find features

Frontend does NOT provide:
- ❌ **Business Logic** — No SQL interpretation, policy logic, or assumptions
- ❌ **Security Enforcement** — No auth/permission checks (backend decides)
- ❌ **Data Transformation** — No filtering, sorting (if backend should do it)
- ❌ **Secret Storage** — No tokens, API keys in localStorage beyond lifetime
- ❌ **Inference** — No guessing about backend behavior

---

## Hard Rules (MUST)

### Rule 1: No SQL Generation or Interpretation

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Don't generate SQL
const sql = `SELECT * FROM ${tableName} WHERE ${column} = '${value}'`;

// ❌ FORBIDDEN: Don't parse SQL
const columns = sql.match(/SELECT (.+?) FROM/)[1].split(',');

// ❌ FORBIDDEN: Don't validate SQL syntax
if (!sql.startsWith('SELECT')) throw new Error('Must be SELECT');
```

**Allowed:**
```typescript
// ✅ ALLOWED: Display SQL returned by backend
<CodeBlock>{technicalView.sql}</CodeBlock>

// ✅ ALLOWED: Show SQL to user for feedback
<CopyButton text={technicalView.sql} />

// ✅ ALLOWED: Let user copy/export SQL
export function exportSQL(sql: string) {
  clipboard.copy(sql);
}
```

**Rationale:** Backend owns SQL generation (via LLM), validation (via SQLGuard), and execution (via DB driver).

---

### Rule 2: No Permission Inference

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Check if table is in allowed list locally
const canQueryTable = (table) => {
  const allowedTables = ['users', 'orders']; // Where does this come from?
  return allowedTables.includes(table);
};

// ❌ FORBIDDEN: Hide buttons based on local permission state
if (userRoles.includes('admin')) {
  showAdminPanel();
}

// ❌ FORBIDDEN: Assume permissions based on user ID
if (user.id === 1) {
  grantFullAccess();
}
```

**Allowed:**
```typescript
// ✅ ALLOWED: Display permissions from backend
const { permissions } = await fetch('/api/v1/auth/me').then(r => r.json());
userPermissions.value = permissions;

// ✅ ALLOWED: Show UI conditionally based on backend response
const showAdminUI = permissions.includes('admin.settings.write');

// ✅ ALLOWED: Let backend reject if permission missing
try {
  await toggleFeature(featureName);
} catch (error) {
  if (error.error_code === 'FORBIDDEN') {
    showError('You do not have permission');
  }
}
```

**Rationale:** Backend is authoritative on access control. Frontend just mirrors backend state.

---

### Rule 3: No RLS (Row-Level Security) Logic

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Filter rows based on local logic
const filteredRows = data.filter(row => {
  return row.tenant_id === currentUser.tenantId;
});

// ❌ FORBIDDEN: Inject WHERE clause for RLS
const baseSQL = 'SELECT * FROM orders';
const withRLS = `${baseSQL} WHERE tenant_id = ${currentUser.tenantId}`;
```

**Allowed:**
```typescript
// ✅ ALLOWED: Display rows returned by backend
// Backend already filtered via RLS (configured in DB driver)
<DataTable columns={data.columns} rows={data.rows} />

// ✅ ALLOWED: Request data with context
const response = await ask({
  question: 'Show my orders',
  context: { tenant_id: currentUser.tenantId } // Pass to backend
});
```

**Rationale:** Row-level filtering must happen in the database (RLS), not client-side. Otherwise data leaks via API inspection.

---

### Rule 4: No Semantic Cache Logic

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Implement cache yourself
const cache = new Map();
const cacheKey = md5(question);
if (cache.has(cacheKey)) {
  return cache.get(cacheKey); // Might be stale!
}

// ❌ FORBIDDEN: Check if question is "similar" to previous
if (similarity(newQuestion, lastQuestion) > 0.9) {
  return lastResult; // Wrong! Policy version changed?
}
```

**Allowed:**
```typescript
// ✅ ALLOWED: Let backend handle caching
const response = await ask({ question });

// ✅ ALLOWED: Check if response was cached
if (response.headers.get('X-Cache') === 'HIT') {
  showNotice('This result is from cache (may not be current)');
}

// ✅ ALLOWED: Clear local UI cache if needed
if (policyUpdated) {
  localStorage.removeItem('last_query_result');
}
```

**Rationale:** Semantic cache must revalidate against **current policy version** (backend does this). Frontend cannot know if policy changed.

---

### Rule 5: No Assumption Inference

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Guess assumptions
const assumptions = [
  'Column created_at exists',
  'Table has active status',
  'No deleted records are included'
];

// ❌ FORBIDDEN: Validate assumptions without backend
if (!assumptions.some(a => a.includes('created_at'))) {
  warnUser('Missing temporal data');
}

// ❌ FORBIDDEN: Auto-correct assumptions
const correctedAssumptions = assumptions.map(a =>
  a.replace('created_at', 'CreatedDate') // Wrong table!
);
```

**Allowed:**
```typescript
// ✅ ALLOWED: Display assumptions from backend
const { assumptions } = technicalView;
assumptions.forEach(assumption => {
  <AssumptionCard>{assumption}</AssumptionCard>
});

// ✅ ALLOWED: Let user mark assumptions as wrong
<button onClick={() => markIncorrect(assumption)}>
  This assumption is wrong
</button>

// ✅ ALLOWED: Show assumptions in feedback
submitFeedback({
  trace_id,
  incorrect_assumptions: [assumption]
});
```

**Rationale:** Assumptions come from backend (LLM + RAG). Frontend just displays them for user validation.

---

### Rule 6: No Token/Secret Storage Beyond Request Lifetime

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Store token indefinitely
localStorage.setItem('token', jwt);

// ❌ FORBIDDEN: Store sensitive data in localStorage
localStorage.setItem('api_key', apiKey);

// ❌ FORBIDDEN: Store unencrypted secrets
const secrets = {
  stripe_key: process.env.STRIPE_KEY,
  db_password: process.env.DB_PASSWORD
};
localStorage.setItem('secrets', JSON.stringify(secrets));

// ❌ FORBIDDEN: Reuse token across sessions
const token = localStorage.getItem('token');
if (!token || token.isExpired()) {
  redirectToLogin();
}
```

**Allowed:**
```typescript
// ✅ ALLOWED: Store token in memory during session
let sessionToken: string | null = null;

function setToken(token: string) {
  sessionToken = token;
  // Auto-clear on browser close (memory cleared)
}

// ✅ ALLOWED: Refresh token via endpoint
async function ensureValidToken() {
  if (tokenExpiringSoon()) {
    const { access_token } = await fetch('/api/v1/auth/refresh');
    setToken(access_token);
  }
}

// ✅ ALLOWED: HttpOnly cookies (set by backend)
// Browser automatically includes in requests, can't be read by JS
// (Backend sets 'Set-Cookie: token=...; HttpOnly; Secure')

// ✅ ALLOWED: Clear token on logout
function logout() {
  sessionToken = null;
  localStorage.clear();
  redirectToLogin();
}
```

**Rationale:** Tokens can be stolen if stored in localStorage. Use sessionStorage or HttpOnly cookies instead.

---

### Rule 7: No Streaming Response Reordering

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Wait for all chunks, then reorder
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}
const reordered = chunks.sort((a, b) => {
  // Reorder by type or arrival time
  return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
});

// ❌ FORBIDDEN: Skip or defer chunks
if (chunk.type === 'technical_view') {
  deferredChunks.push(chunk); // Show later!
}
```

**Allowed:**
```typescript
// ✅ ALLOWED: Process chunks in arrival order
for await (const chunk of streamResponse) {
  switch (chunk.type) {
    case 'thinking':
      setThinking(chunk.status);
      break;
    case 'technical_view':
      setTechnicalView(chunk);
      break;
    case 'data':
      setData(chunk);
      break;
    // Process in order, immediately
  }
}
```

**Rationale:** Chunk order encodes contract semantics (technical_view MUST precede data for data context).

---

### Rule 8: No Unauthorized Mutation

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Directly mutate backend state without endpoint
const user = await fetchUser();
user.role = 'admin'; // Change locally?
updateLocalState(user); // Then show as if persisted?

// ❌ FORBIDDEN: Optimistic update without rollback
users.value = users.value.map(u =>
  u.id === userId ? { ...u, status: 'active' } : u
);
// What if the endpoint fails?

// ❌ FORBIDDEN: Execute side effects without backend
trainingItems.value = trainingItems.value.filter(
  item => item.id !== approveId
); // Does backend know?
```

**Allowed:**
```typescript
// ✅ ALLOWED: Send mutation request to backend
async function approveTrainingItem(itemId: string) {
  try {
    const result = await fetch(`/api/v1/admin/training/${itemId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Approved' })
    });
    
    if (!result.ok) {
      showError('Approval failed');
      return;
    }
    
    // Only update UI after backend confirms
    trainingItems.value = trainingItems.value.map(item =>
      item.id === itemId ? { ...item, status: 'approved' } : item
    );
  } catch (error) {
    showError(error.message);
    // UI remains unchanged
  }
}

// ✅ ALLOWED: Optimistic update with proper rollback
const originalItems = [...trainingItems.value];
trainingItems.value = trainingItems.value.filter(
  item => item.id !== itemId
);

try {
  await fetch(`/api/v1/admin/training/${itemId}/approve`, {
    method: 'POST'
  });
  // Success, keep UI updated
} catch (error) {
  trainingItems.value = originalItems; // Rollback
  showError(error.message);
}
```

**Rationale:** Frontend state is local; backend is authoritative. Never assume mutation succeeded until backend confirms.

---

### Rule 9: No Policy Version Caching

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Cache policy version indefinitely
let cachedPolicyVersion = 5;

function getActivePolicy() {
  return cachedPolicyVersion; // Stale if policy updated!
}

// ❌ FORBIDDEN: Assume policy version is constant
const policyVersion = await fetch('/admin/policy').then(r => r.json());
localStorage.setItem('policy_version', policyVersion);
// Later, in another component:
const policy = JSON.parse(localStorage.getItem('policy_version')); // Outdated!
```

**Allowed:**
```typescript
// ✅ ALLOWED: Always fetch policy info from backend
async function getPolicyInfo() {
  const { policy_version } = await fetch('/api/v1/settings/policy')
    .then(r => r.json());
  
  return policy_version; // Always fresh
}

// ✅ ALLOWED: Use policy hash from response
const { policy_hash } = technicalView; // From backend, unique per query
// Store for audit linkage, not reuse
```

**Rationale:** Policy can change server-side. Frontend must always fetch fresh policy version.

---

### Rule 10: No Hardcoded Environment Assumptions

**Forbidden:**
```typescript
// ❌ FORBIDDEN: Hardcode environment behavior
if (process.env.NODE_ENV === 'production') {
  skipLogin = false;
}

// ❌ FORBIDDEN: Assume auth behavior based on env
const authRequired = !isDevelopment();

// ❌ FORBIDDEN: Branch on environment
if (isLocal) {
  mockData = true;
  skipValidation = true;
}
```

**Allowed:**
```typescript
// ✅ ALLOWED: Detect environment at runtime
async function detectBackendConfiguration() {
  const health = await fetch('/api/v1/health').then(r => r.json());
  const settings = {
    AUTH_ENABLED: await checkAuthRequired(),
    ENABLE_TRAINING_PILOT: await checkTrainingPilot(),
    ...
  };
  
  return settings;
}

// ✅ ALLOWED: Adapt UI based on backend capability
if (backendSettings.ENABLE_TRAINING_PILOT) {
  showTrainingTab = true;
}

// ✅ ALLOWED: Use feature detection
try {
  const response = await fetch('/api/v1/admin/training');
  trainingAvailable = response.ok;
} catch {
  trainingAvailable = false;
}
```

**Rationale:** Backend behavior varies; detect it at runtime, don't assume.

---

## Allowed Patterns

### Pattern: Display Data From Backend

```typescript
export function TechnicalViewPanel({ technicalView }) {
  return (
    <div>
      <CodeBlock
        language="sql"
        code={technicalView.sql}
      />
      
      <AssumptionsList assumptions={technicalView.assumptions} />
      
      <PolicyBadge hash={technicalView.policy_hash} />
    </div>
  );
}
```

### Pattern: Trigger Backend Actions

```typescript
export function ApproveTrainingButton({ itemId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/admin/training/${itemId}/approve`,
        { method: 'POST', body: JSON.stringify({ notes: 'Approved' }) }
      );
      
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }
      
      onSuccess(); // Parent refetches data
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return <button onClick={approve} disabled={loading}>Approve</button>;
}
```

### Pattern: Handle Streaming Responses

```typescript
export function AskPanel({ question }) {
  const [state, setState] = useState({ chunks: [], error: null });

  useEffect(() => {
    (async () => {
      const response = await fetch('/api/v1/ask', {
        method: 'POST',
        body: JSON.stringify({ question, stream: true })
      });

      if (!response.ok) {
        setState({ chunks: [], error: await response.json() });
        return;
      }

      // Stream chunks
      for await (const chunk of consumeNDJSON(response)) {
        setState(prev => ({
          chunks: [...prev.chunks, chunk],
          error: null
        }));
      }
    })();
  }, [question]);

  return (
    <>
      {state.error && <ErrorAlert error={state.error} />}
      {state.chunks.map((chunk, i) => (
        <ChunkRenderer key={i} chunk={chunk} />
      ))}
    </>
  );
}
```

---

## Checklist for PR Reviews

Before merging any frontend PR, verify:

- [ ] No SQL generation or parsing
- [ ] No permission checks (relying on backend 403)
- [ ] No local RLS filtering
- [ ] No custom caching logic
- [ ] No assumption modification/inference
- [ ] Tokens stored securely (not localStorage for extended periods)
- [ ] Streaming chunks processed in order
- [ ] All mutations sent to backend before UI update
- [ ] No hardcoded environment assumptions
- [ ] Backend configuration detected at runtime
- [ ] All external data from `/api/v1` endpoints
- [ ] Error handling includes trace_id logging

---

## Summary

**Frontend is:**
- ✅ Display layer
- ✅ Request router (to backend)
- ✅ State manager (local UI state only)
- ✅ Accessibility layer

**Frontend is NOT:**
- ❌ Business logic engine
- ❌ Security enforcer
- ❌ SQL generator/interpreter
- ❌ Secret store
- ❌ Policy validator

**When in doubt:** If it feels like "logic," it belongs in the backend.

