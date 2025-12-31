# Frontend Governance Rules

**Target Audience:** Frontend Developers, Code Reviewers, CI Systems  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document defines the 10 hard governance rules that the frontend MUST follow to maintain security, compliance, and architectural integrity. These rules are enforced through the **[`GovernanceValidator`](../frontend/src/utils/governanceValidator.ts:188)** and CI pipeline.

## 🎯 Governance Philosophy

1. **Backend Authority:** Backend makes all security and data decisions
2. **Frontend Simplicity:** UI layer focuses purely on presentation
3. **Contract Compliance:** Strict adherence to API specifications
4. **Zero Trust:** Never assume backend behavior or permissions
5. **Audit Trail:** All rule violations must be documented and justified

## ⚖️ The 10 Hard Rules

### Rule #1: No SQL Generation or Interpretation
**Foundation:** Frontend is a presentation layer, not a data layer

#### ❌ VIOLATIONS
```typescript
// Direct SQL generation
const sql = `SELECT * FROM ${tableName} WHERE id = ${userId}`;

// SQL parsing/modification
const modifiedSql = originalSql.replace('SELECT *', 'SELECT id, name');

// SQL validation
if (sql.includes('DROP TABLE')) {
  throw new Error('Dangerous SQL detected');
}

// Query building
const query = queryBuilder.select('*').from('users').where('id', userId);
```

#### ✅ ALLOWED PATTERNS
```typescript
// Read-only display of backend-provided SQL
<pre className="sql-display">
  <code>{technicalViewChunk.payload.sql}</code>
</pre>

// Copy to clipboard
const copySqlToClipboard = () => {
  navigator.clipboard.writeText(sqlFromBackend);
};

// Syntax highlighting (display only)
<SyntaxHighlighter language="sql" style={theme}>
  {sqlFromBackend}
</SyntaxHighlighter>
```

#### 🔧 ENFORCEMENT
```typescript
// GovernanceValidator pattern detection
/(?:SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/gi
/sql\s*=\s*["`'].*["`']/gi
```

#### 📝 OVERRIDE MECHANISM
```typescript
/**
 * @governance-ignore-next-line rule=no-sql-generation reason="Display only with syntax highlighting"
 * @approved_by="lead-developer" expires="2024-12-31"
 */
<SyntaxHighlighter language="sql">{sql}</SyntaxHighlighter>
```

---

### Rule #2: No Permission Inference
**Foundation:** Only backend knows user permissions and access levels

#### ❌ VIOLATIONS
```typescript
// Role-based UI decisions
if (user.role === 'admin') {
  showAdminPanel = true;
}

// Permission checking
const canAccess = hasPermission(user, 'READ_SENSITIVE_DATA');

// Local access control
const isAuthorized = checkUserAccess(resource, action);

// Department-based filtering
if (user.department !== 'HR') {
  filteredData = data.filter(item => item.department === user.department);
}
```

#### ✅ ALLOWED PATTERNS
```typescript
// Backend-driven feature flags
const canAccessAdmin = useFeatureFlag('RBAC_ENABLED');

// Backend error handling
if (error.error_code === 'FORBIDDEN') {
  showAccessDeniedMessage();
}

// Backend response-based UI
if (response.status === 403) {
  return <InsufficientPermissions />;
}
```

#### 🔧 ENFORCEMENT
```typescript
/(?:hasPermission|checkPermission|canAccess|isAllowed|authorize)/gi
/role\s*===?\s*["`']admin["`']/gi
```

---

### Rule #3: No Row-Level Security (RLS) Logic
**Foundation:** Backend handles all data filtering and security policies

#### ❌ VIOLATIONS  
```typescript
// Client-side data filtering
const userRows = allData.filter(row => row.user_id === currentUser.id);

// Tenant isolation
const tenantData = data.filter(item => item.tenant_id === user.tenant_id);

// Department filtering
const accessibleRows = rows.filter(row => 
  user.departments.includes(row.department)
);

// Security-based hiding
const sanitizedData = data.map(row => {
  if (user.clearanceLevel < 3) {
    delete row.ssn;
    delete row.salary;
  }
  return row;
});
```

#### ✅ ALLOWED PATTERNS
```typescript
// Display all backend-provided data
<DataTable rows={dataFromBackend} />

// Handle backend access errors
if (error.error_code === 'TABLE_ACCESS_DENIED') {
  return <AccessDeniedMessage table={error.details.table} />;
}

// Show backend-filtered results
const filteredResults = await fetchFilteredData(query);
```

#### 🔧 ENFORCEMENT
```typescript
/(?:row.+level|RLS|tenant.+filter|data.+filter)/gi
```

---

### Rule #4: No Custom Caching Logic
**Foundation:** Caching must follow documented backend strategy

#### ❌ VIOLATIONS
```typescript
// Manual localStorage caching
localStorage.setItem(`query_${queryHash}`, JSON.stringify(results));

// Custom cache implementation
const cache = new Map<string, QueryResult>();
cache.set(queryKey, result);

// Local data persistence
const savedQuery = localStorage.getItem('lastQuery');

// Manual cache invalidation
if (dataChanged) {
  clearQueryCache();
}
```

#### ✅ ALLOWED PATTERNS
```typescript
// Browser cache headers (automatic)
fetch(url, { 
  headers: { 'Cache-Control': 'public, max-age=300' } 
});

// SessionStorage for session data only
sessionStorage.setItem('session_token', token);

// Backend cache indicators
if (response.headers.get('X-Cache') === 'HIT') {
  showCacheNotice();
}
```

#### 🔧 ENFORCEMENT
```typescript
/(?:cache|Cache)\.(set|get|put|store)/gi
/localStorage\.setItem.*(?:query|result|data)/gi
```

---

### Rule #5: No Assumption Inference or Modification
**Foundation:** Assumptions are generated by backend and must remain read-only

#### ❌ VIOLATIONS
```typescript
// Adding assumptions
assumptions.push('Additional assumption based on user input');

// Modifying assumptions
const modifiedAssumptions = assumptions.map(a => 
  a.replace('table_x', userPreferredTableName)
);

// Hiding assumptions
const filteredAssumptions = assumptions.filter(a => 
  !a.includes('sensitive')
);

// Local assumption generation
const newAssumption = `Assuming ${tableName} contains ${columnName}`;
```

#### ✅ ALLOWED PATTERNS  
```typescript
// Read-only display
<AssumptionsList assumptions={technicalView.assumptions} readOnly />

// Copy to clipboard
const copyAssumptions = () => {
  navigator.clipboard.writeText(assumptions.join('\n'));
};

// Feedback on assumptions
const reportIncorrectAssumption = (assumption: string) => {
  submitFeedback({ type: 'incorrect_assumption', content: assumption });
};
```

#### 🔧 ENFORCEMENT
```typescript
/assumptions?\.(add|push|modify|update)/gi
```

---

### Rule #6: No Secret Storage in localStorage
**Foundation:** Sensitive data must not persist beyond browser session

#### ❌ VIOLATIONS
```typescript
// Tokens in localStorage
localStorage.setItem('auth_token', jwt);

// API keys in localStorage
localStorage.setItem('api_key', apiKey);

// User credentials
localStorage.setItem('password_hash', hashedPassword);

// Session data in localStorage
localStorage.setItem('user_session', JSON.stringify(session));
```

#### ✅ ALLOWED PATTERNS
```typescript
// SessionStorage for tokens (clears on close)
sessionStorage.setItem('session_token', token);

// Memory-only storage
class TokenManager {
  private token: string | null = null;
  
  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem('session_token', token); // sessionStorage OK
  }
}

// Secure cookies (backend-set)
// No frontend cookie management for secrets
```

#### 🔧 ENFORCEMENT
```typescript
/localStorage\.setItem.*(?:token|secret|key|password|auth)/gi
/document\.cookie.*(?:token|secret|key)/gi
```

---

### Rule #7: No Response Reordering  
**Foundation:** Backend guarantees correct chunk order, frontend must preserve it

#### ❌ VIOLATIONS
```typescript
// Sorting chunks by type
const orderedChunks = chunks.sort((a, b) => {
  const order = ['thinking', 'technical_view', 'data', 'business_view'];
  return order.indexOf(a.type) - order.indexOf(b.type);
});

// Reordering for display
const reorderedChunks = [...chunks].reverse();

// Type-based reorganization
const groupedChunks = {
  thinking: chunks.filter(c => c.type === 'thinking'),
  data: chunks.filter(c => c.type === 'data'),
  // ...
};
```

#### ✅ ALLOWED PATTERNS
```typescript
// Process chunks in received order
const processChunk = (chunk: StreamChunk) => {
  const validation = streamValidator.validateChunkOrder(chunk);
  if (!validation.valid) {
    throw new Error(`Chunk order violation: ${validation.error}`);
  }
  // Process chunk...
};

// Display in received order
{chunks.map((chunk, index) => (
  <ChunkDisplay key={index} chunk={chunk} />
))}
```

#### 🔧 ENFORCEMENT
```typescript
/chunks?\.(sort|reverse|reorder)/gi
/\.sort\(\s*\(.*chunk.*type.*\)/gi
```

---

### Rule #8: No Unauthorized Mutation
**Foundation:** All state changes must be confirmed by backend before UI update

#### ❌ VIOLATIONS
```typescript
// Optimistic UI updates
const updateUser = async (userData) => {
  setUser(userData); // ❌ Updated before backend confirms
  
  try {
    await api.updateUser(userData);
  } catch (error) {
    setUser(originalUser); // Rollback
  }
};

// Immediate state changes
const handleToggle = (toggleName, value) => {
  setToggles(prev => ({ ...prev, [toggleName]: value })); // ❌ Before API call
  updateToggle(toggleName, value);
};
```

#### ✅ ALLOWED PATTERNS
```typescript
// Wait for backend confirmation
const updateUser = async (userData) => {
  try {
    const updatedUser = await api.updateUser(userData);
    setUser(updatedUser); // ✅ Only after backend confirms
  } catch (error) {
    handleError(error);
  }
};

// Loading states during mutations
const [isUpdating, setIsUpdating] = useState(false);

const handleUpdate = async () => {
  setIsUpdating(true);
  try {
    const result = await api.updateData(newData);
    setData(result); // ✅ Backend-confirmed data
  } finally {
    setIsUpdating(false);
  }
};
```

#### 🔧 ENFORCEMENT
```typescript
/setState.*before.*fetch/gi
/(?:create|update|delete).*optimistic/gi
```

---

### Rule #9: No Policy Caching
**Foundation:** Policies change dynamically and must be fetched fresh

#### ❌ VIOLATIONS
```typescript
// Caching policy data
const cachedPolicy = localStorage.getItem('policy_data');

// Policy version storage
const storedPolicyVersion = sessionStorage.getItem('policy_version');

// Manual policy caching
const policyCache = new Map<string, PolicyData>();
```

#### ✅ ALLOWED PATTERNS
```typescript
// Fresh policy fetch for each request
const checkPolicy = async (resource: string) => {
  const policy = await api.getCurrentPolicy(resource);
  return policy.allows_access;
};

// Backend policy headers
const policyHash = response.headers.get('X-Policy-Hash');
```

#### 🔧 ENFORCEMENT
```typescript
/policy.*(?:cache|Cache|store)/gi
```

---

### Rule #10: No Hardcoded Environment Assumptions
**Foundation:** Runtime detection prevents deployment issues

#### ❌ VIOLATIONS
```typescript
// Hardcoded environment checks
const isProduction = window.location.hostname === 'app.easyok.com';

// Build-time environment assumptions
const apiUrl = process.env.NODE_ENV === 'production' 
  ? 'https://api.easyok.com'
  : 'http://localhost:8000';

// Feature assumptions based on URL
const enableAuth = location.hostname !== 'localhost';
```

#### ✅ ALLOWED PATTERNS
```typescript
// Runtime detection
const config = await detectEnvironment();
const authEnabled = config.backend.AUTH_ENABLED;

// Build-time for non-security config only
const debugMode = import.meta.env.VITE_DEBUG === 'true';
const logLevel = import.meta.env.VITE_LOG_LEVEL || 'info';

// Feature flag-based decisions
const showTraining = useFeatureFlag('ENABLE_TRAINING_PILOT');
```

#### 🔧 ENFORCEMENT
```typescript
/(?:process\.env|import\.meta\.env)\.(?!VITE_)/gi
/(?:localhost|127\.0\.0\.1|staging\.|prod\.).*hardcode/gi
```

---

## 🚨 CI Integration & Enforcement

### Automated Governance Check
```bash
# In CI pipeline (.github/workflows/governance-check.yml)
npm run lint:governance

# Fails if:
# - Violations found without valid override  
# - Override missing reason
# - Override expired
# - Token storage violations
```

### PR Checklist Template
Every Pull Request must include this checklist:

```markdown
## Governance Compliance Checklist

### Hard Rules (MUST CHECK ALL)
- [ ] No SQL generation/parsing in code
- [ ] No permission inference logic
- [ ] No RLS filtering logic  
- [ ] No custom caching beyond documented rules
- [ ] No assumption modification/inference
- [ ] Tokens stored in sessionStorage (not localStorage)
- [ ] Streaming chunks processed in order
- [ ] All mutations sent to backend before UI update
- [ ] No policy version caching
- [ ] Environment detection at runtime (not hardcoded)

### Code Quality
- [ ] Used ChunkType enum (not strings)
- [ ] Validated chunk order with StreamValidator
- [ ] All error codes handled
- [ ] Feature flags accessed via useFeatureFlag()
- [ ] Trace IDs included in error logs
```

### Governance Linter Configuration
```json
{
  "name": "governance-linter",
  "version": "1.0.0",
  "scripts": {
    "lint:governance": "node scripts/governance-lint.js"
  }
}
```

## 🔧 GovernanceValidator Implementation

### Pattern Detection Engine
```typescript
export class GovernanceValidator {
  private overrides = new Map<string, GovernanceIgnore[]>();
  
  /**
   * Validates file against all governance rules
   */
  validateFile(content: string, filename: string): GovernanceValidationResult {
    const overrides = this.parseGovernanceIgnores(content, filename);
    const violations: Violation[] = [];
    
    // Check each rule
    for (const rule of Object.values(GovernanceRule)) {
      const ruleViolations = this.validateRule(content, filename, rule);
      violations.push(...ruleViolations);
    }
    
    return {
      violations,
      overrides,
      isValid: violations.length === 0,
      errors: violations.filter(v => v.severity === 'error').map(v => v.message),
      warnings: violations.filter(v => v.severity === 'warning').map(v => v.message)
    };
  }
  
  /**
   * Check if line has valid override
   */
  private hasValidOverride(filename: string, line: number, rule: GovernanceRule): boolean {
    const fileOverrides = this.overrides.get(filename) || [];
    return fileOverrides.some(override => 
      override.line === line && 
      override.rule === rule &&
      (!override.expires || new Date(override.expires) > new Date())
    );
  }
}
```

### Override Documentation
```typescript
/**
 * Governance override examples
 */

// ✅ Valid override with expiry
/**
 * @governance-ignore-next-line rule=no-sql-generation reason="Display only with syntax highlighting for better UX"
 * @approved_by="jane.doe@company.com" expires="2024-06-01"
 */
<SyntaxHighlighter language="sql">{sql}</SyntaxHighlighter>

// ✅ Valid override for legacy code
/**
 * @governance-ignore-next-line rule=no-permission-inference reason="Legacy admin check being refactored"
 * @approved_by="tech-lead" expires="2024-03-15"
 */
const isAdmin = user.role === 'admin';

// ❌ Invalid - missing reason
/**
 * @governance-ignore-next-line rule=no-sql-generation
 */

// ❌ Invalid - expired override
/**
 * @governance-ignore-next-line rule=no-sql-generation reason="Legacy code"
 * @expires="2023-01-01"
 */
```

## 🧪 Testing Governance Compliance

### Unit Tests for Governance
```typescript
describe('Governance Rule Compliance', () => {
  let validator: GovernanceValidator;
  
  beforeEach(() => {
    validator = new GovernanceValidator();
  });
  
  test('should detect SQL generation violation', () => {
    const code = `
      const sql = \`SELECT * FROM \${tableName}\`;
      executeQuery(sql);
    `;
    
    const result = validator.checkRule(code, GovernanceRule.NO_SQL_GENERATION);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe(GovernanceRule.NO_SQL_GENERATION);
  });
  
  test('should allow valid override', () => {
    const code = `
      /**
       * @governance-ignore-next-line rule=no-sql-generation reason="Display only"
       * @approved_by="lead-dev" expires="2024-12-31"
       */
      <pre>{sql}</pre>
    `;
    
    const result = validator.validateFile(code, 'test.tsx');
    expect(result.isValid).toBe(true);
  });
});
```

### E2E Governance Testing
```typescript
test('should enforce sessionStorage token usage', async ({ page }) => {
  // Monitor localStorage usage
  await page.addInitScript(() => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      if (key.includes('token') || key.includes('auth')) {
        throw new Error(`Governance violation: Token saved to localStorage: ${key}`);
      }
      return originalSetItem.call(this, key, value);
    };
  });
  
  // Trigger login flow
  await page.goto('/login');
  await page.fill('#username', 'test@example.com');
  await page.fill('#password', 'password');
  await page.click('#submit');
  
  // Should not throw error (no localStorage token usage)
  await expect(page.locator('#dashboard')).toBeVisible();
});
```

## 📊 Governance Metrics & Monitoring

### Rule Violation Tracking
```typescript
export function trackGovernanceViolation(rule: GovernanceRule, file: string, line: number) {
  const violation = {
    rule,
    file,
    line,
    timestamp: Date.now(),
    commit_sha: process.env.GITHUB_SHA,
    build_id: process.env.BUILD_ID
  };
  
  // Send to monitoring
  fetch('/api/governance/violations', {
    method: 'POST',
    body: JSON.stringify(violation)
  });
  
  console.error(`[GOVERNANCE] Rule violation: ${rule} in ${file}:${line}`);
}
```

### Override Audit Trail
```typescript
export function auditGovernanceOverride(override: GovernanceIgnore) {
  const auditEntry = {
    rule: override.rule,
    reason: override.reason,
    approved_by: override.approved_by,
    expires: override.expires,
    file_path: override.file_path,
    created_at: new Date().toISOString(),
    pull_request: process.env.GITHUB_PR_NUMBER
  };
  
  // Log for compliance audit
  console.log(`[GOVERNANCE] Override granted: ${JSON.stringify(auditEntry)}`);
}
```

## 📚 Related Documentation

- **[`../frontend/src/utils/governanceValidator.ts`](../frontend/src/utils/governanceValidator.ts)** - Validator implementation
- **[`../api/streaming.md`](../api/streaming.md)** - Rule #7 (chunk order)
- **[`../api/errors.md`](../api/errors.md)** - Rule #8 (mutation handling)  
- **[`../environment/frontend-behavior.md`](../environment/frontend-behavior.md)** - Rule #10 (environment detection)

---

## ✅ Governance Compliance Summary

### Critical Rules (Zero Tolerance)
1. **No SQL Generation** - Security critical
2. **No localStorage Secrets** - Data protection critical
3. **No Permission Inference** - Authorization critical

### Behavioral Rules (CI Enforced)
4. **No Custom Caching** - Performance consistency
5. **No Response Reordering** - Contract compliance  
6. **No Unauthorized Mutation** - Data integrity

### Architecture Rules (Design Integrity)
7. **No RLS Logic** - Backend separation
8. **No Assumption Inference** - Read-only principle
9. **No Policy Caching** - Dynamic policy support
10. **No Environment Assumptions** - Deployment flexibility

### Override Process
1. **Document Reason:** Minimum 10 characters explaining necessity
2. **Set Expiry:** Maximum 6 months from override date  
3. **Get Approval:** Technical lead or security team approval
4. **CI Validation:** Automated override validation in pipeline
5. **Audit Trail:** All overrides logged for compliance review

**Remember:** These rules protect the application's security, maintainability, and compliance. Violations without proper overrides will fail CI and block deployments.
