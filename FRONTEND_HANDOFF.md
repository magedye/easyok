BACKEND → FRONTEND HANDOFF COMPLETE
Approach: C (Extract existing + Create missing + Unify)

📦 Deliverables (7 Files, 3,555 Lines)
Document	Size	Purpose
FRONTEND_HANDOFF.md	11K	Executive summary + quick start
api/endpoints.md	12K	All 9+ endpoints, request/response schemas
api/streaming.md	12K	NDJSON protocol, chunk order, validation
api/errors.md	12K	Error codes, retry logic, handling patterns
environment/frontend-behavior.md	9.5K	Env matrix (local/ci/prod), feature flags
governance/frontend-rules.md	12K	10 hard constraints + allowed patterns
development/frontend-dev-setup.md	12K	Setup, testing, debugging, examples
✅ What Frontend Gets
Complete API Contract — Every endpoint, schema, status code
Binding Streaming Protocol — Strict NDJSON chunk order (thinking → technical_view → data → business_view → end)
Environment Matrix — How backend behaves locally vs. CI vs. production
Error Handling Spec — All error codes, retry logic, recovery patterns
10 Governance Rules — Hard constraints (no SQL logic, no auth checks, no RLS, etc.)
Local Dev Setup — Complete step-by-step guide with examples
Consolidated Handoff — Everything summarized in one place
✅ Extracted From Codebase
OpenAPI spec (fortress.yaml, streaming.yaml, errors.yaml)
Settings schema (app/core/settings.py — 215 config parameters)
API models (app/models/api.py — chunk definitions)
Exception handling (app/core/exceptions.py)
Streaming tests (tests/test_ask_streaming_contract.py)
✅ Verification
✅ No hardcoded assumptions
✅ All errors documented with examples
✅ All endpoints with full schemas
✅ Streaming protocol with validation rules
✅ Environment matrix (local/CI/prod)
✅ 10 governance rules with PR review checklist
✅ Development setup with debugging guide

📍 Location
/docs/FRONTEND_HANDOFF.md          ← START HERE
/docs/api/                          ← Endpoint specs
/docs/environment/                  ← Behavior matrix
/docs/governance/                   ← Hard rules
/docs/development/                  ← Setup guide
Frontend engineers can now implement UI independently without guessing backend behavior.

........
Existing Codebase Audit
Current State Analysis
frontend/ ├──
React
18
+
TypeScript
✅ ├──
Vite
build tool ✅ ├──
React
Router
v6 ✅ ├──
Vanilla
CSS
✅ ├──
Chart
.
js
for
visualization ✅ └──
Basic
NDJSON
streaming (needs review)
Identified Issues:

⚠️ Streaming implementation may not validate chunk order strictly
⚠️ No environment detection system present
⚠️ Error handling needs standardization per error codes
⚠️ No governance rule validation in code reviews
⚠️ Missing retry logic with exponential backoff
⚠️ No token storage security audit
⚠️ No trace_id correlation in error logging
⚠️ No stream recovery mechanism
⚠️ No token refresh race condition handling
Governance Compliance Matrix
10 Hard Rules - Current Status
Rule	Status	Action Required
1. No SQL generation/interpretation	✅ Display only	Audit all components
2. No permission inference	⚠️ Needs review	Check for local permission checks
3. No RLS logic	✅ Not found	Maintain
4. No caching logic	✅ Not found	Maintain
5. No assumption inference	✅ Display only	Maintain
6. No secret storage (localStorage)	⚠️ Needs audit	Review token storage
7. No response reordering	⚠️ Needs validation	Add chunk order validator
8. No unauthorized mutation	⚠️ Needs review	Audit mutation patterns
9. No policy caching	✅ Not found	Maintain
10. No hardcoded env assumptions	❌ Needs fix	Implement runtime detection
Type Safety Enhancements
ChunkType Enum (NEW)
File: src/types/streaming.ts

/**
 * Strict NDJSON chunk types per backend contract
 * See: docs/api/streaming.md
 */
export enum ChunkType {
  THINKING = 'thinking',
  TECHNICAL_VIEW = 'technical_view',
  DATA = 'data',
  BUSINESS_VIEW = 'business_view',
  ERROR = 'error',
  END = 'end'
}

/**
 * Chunk order validation map
 * Key: current chunk type
 * Value: allowed next chunk types
 */
export const VALID_NEXT_CHUNKS: Record<ChunkType, ChunkType[]> = {
  [ChunkType.THINKING]: [ChunkType.TECHNICAL_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.TECHNICAL_VIEW]: [ChunkType.DATA, ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.DATA]: [ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.BUSINESS_VIEW]: [ChunkType.ERROR, ChunkType.END],
  [ChunkType.ERROR]: [ChunkType.END],
  [ChunkType.END]: [] // No chunks after end
};

/**
 * Base chunk interface with strict typing
 */
export interface BaseChunk {
  type: ChunkType;
  trace_id: string;
  timestamp: string;
}
Benefits:

Compile-time type checking
Autocomplete in IDEs
Prevents string typos
Self-documenting code
Implementation Phases
Phase 1: Foundation & Compliance (Critical)
1.1 Environment Detection System (ENHANCED)
File: src/utils/environmentDetection.ts

interface BackendConfig {
  AUTH_ENABLED: boolean;
  RBAC_ENABLED: boolean;
  ENABLE_TRAINING_PILOT: boolean;
  ENABLE_SEMANTIC_CACHE: boolean;
  ENABLE_RATE_LIMIT: boolean;
}

/**
 * Hybrid approach:
 * - Build-time: Non-security config (logging, debugging)
 * - Runtime: Security & feature flags (auth, rbac, etc.)
 */
interface EnvironmentConfig {
  // Build-time (Vite)
  DEBUG: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  API_BASE_URL: string;
  
  // Runtime (from backend)
  backend: BackendConfig;
}

async function detectEnvironment(): Promise<EnvironmentConfig>
Strategy:

Build-time: import.meta.env.VITE_* for logging, URLs
Runtime: Detect via /health or /settings endpoint
Cache in React context for session
Refresh on reconnect after network failure
1.2 Feature Flag Hook (NEW)
File: src/hooks/useFeatureFlag.ts

/**
 * Centralized feature flag access
 * Usage: const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
 */
export function useFeatureFlag(flag: keyof BackendConfig): boolean {
  const { config } = useBackendConfig();
  return config?.[flag] ?? false;
}

/**
 * Multi-flag check (all must be true)
 * Usage: const canAccessAdmin = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
 */
export function useAllFeatureFlags(flags: Array<keyof BackendConfig>): boolean {
  const { config } = useBackendConfig();
  return flags.every(flag => config?.[flag] ?? false);
}

/**
 * Any-flag check (at least one must be true)
 * Usage: const anyAuthMethod = useAnyFeatureFlag(['AUTH_ENABLED', 'OAUTH_ENABLED']);
 */
export function useAnyFeatureFlag(flags: Array<keyof BackendConfig>): boolean {
  const { config } = useBackendConfig();
  return flags.some(flag => config?.[flag] ?? false);
}
Component usage:

export function TrainingTab() {
  const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
  
  if (!trainingEnabled) {
    return <LockedFeature reason="Training pilot disabled" />;
  }
  
  return <TrainingUI />;
}
1.3 Governance Validator Utility (ENHANCED)
File: src/utils/governanceValidator.ts

Purpose: Lint-like checks during development

/**
 * Governance override mechanism
 * Usage: // @governance-ignore-next-line rule=no-sql-generation reason="Display only"
 */
interface GovernanceIgnore {
  rule: string;
  reason: string;
  approved_by?: string;
  expires?: string; // ISO date
}

/**
 * Validator with override support
 */
class GovernanceValidator {
  checkForSQLGeneration(code: string): Violation[]
  checkForPermissionInference(code: string): Violation[]
  checkForLocalStorageSecrets(code: string): Violation[]
  
  // Override handling
  parseGovernanceIgnores(file: string): GovernanceIgnore[]
  validateOverrides(ignores: GovernanceIgnore[]): boolean
}
CI Integration:

# In CI pipeline
npm run lint:governance

# Fails if:
# - Violations found without valid override
# - Override missing reason
# - Override expired
1.4 Streaming Contract Validator (ENHANCED)
File: src/utils/streamingValidator.ts

class StreamValidator {
  private chunks: BaseChunk[] = [];
  
  /**
   * Validates chunk order using ChunkType enum
   */
  validateChunkOrder(chunk: BaseChunk): ValidationResult {
    const lastChunk = this.chunks[this.chunks.length - 1];
    
    // First chunk MUST be THINKING
    if (this.chunks.length === 0 && chunk.type !== ChunkType.THINKING) {
      return {
        valid: false,
        error: `First chunk must be ${ChunkType.THINKING}, got ${chunk.type}`
      };
    }
    
    // Check if transition is valid
    if (lastChunk) {
      const allowedNext = VALID_NEXT_CHUNKS[lastChunk.type];
      if (!allowedNext.includes(chunk.type)) {
        return {
          valid: false,
          error: `Invalid transition: ${lastChunk.type} → ${chunk.type}`
        };
      }
    }
    
    this.chunks.push(chunk);
    return { valid: true };
  }
  
  /**
   * Validates trace_id consistency across all chunks
   */
  validateTraceIdConsistency(): boolean {
    if (this.chunks.length === 0) return true;
    const firstTraceId = this.chunks[0].trace_id;
    return this.chunks.every(chunk => chunk.trace_id === firstTraceId);
  }
  
  /**
   * Gets expected next chunks for UI hints
   */
  getExpectedNextChunks(): ChunkType[] {
    const lastChunk = this.chunks[this.chunks.length - 1];
    if (!lastChunk) return [ChunkType.THINKING];
    return VALID_NEXT_CHUNKS[lastChunk.type];
  }
  
  /**
   * Checks if stream is complete
   */
  isComplete(): boolean {
    const lastChunk = this.chunks[this.chunks.length - 1];
    return lastChunk?.type === ChunkType.END;
  }
  
  /**
   * Reset for new stream
   */
  reset(): void {
    this.chunks = [];
  }
}
Phase 2: API Layer Refactoring
2.1 Error Handling Standardization
File: src/api/errorHandler.ts

Implement handlers for all documented error codes:

INVALID_CREDENTIALS → Show login retry
UNAUTHORIZED → Clear token, redirect login
POLICY_VIOLATION → Show allowed tables
RATE_LIMIT_EXCEEDED → Exponential backoff
SQL_EXECUTION_FAILED → Display with context
SERVICE_UNAVAILABLE → Retry with backoff
STREAMING_INTERRUPTED → Recovery flow
Retry Strategy:

interface RetryConfig {
  maxRetries: 5;
  baseDelay: 1000; // ms
  exponential: true;
  jitter: [0, 1000]; // ms
  retryableErrors: Set<string>;
}

const RETRYABLE_ERRORS = new Set([
  'SQL_EXECUTION_FAILED',
  'SERVICE_UNAVAILABLE',
  'STREAMING_INTERRUPTED',
  'RATE_LIMIT_EXCEEDED'
]);
2.2 Token Management (ENHANCED)
File: src/api/tokenManager.ts

Security requirements + Race condition handling:

class TokenManager {
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshLock = false;
  
  /**
   * Thread-safe token refresh
   * Prevents multiple simultaneous refresh attempts
   */
  async ensureValidToken(): Promise<string> {
    // If refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // If token valid, return immediately
    if (this.isTokenValid()) {
      return this.token!;
    }
    
    // Start refresh with lock
    this.refreshPromise = this.refreshToken();
    
    try {
      this.token = await this.refreshPromise;
      return this.token;
    } catch (error) {
      // Refresh failed - clear token and force login
      this.clearToken();
      throw new Error('Token refresh failed');
    } finally {
      this.refreshPromise = null;
    }
  }
  
  private async refreshToken(): Promise<string> {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!response.ok) {
      throw new Error('Refresh endpoint returned error');
    }
    
    const { access_token } = await response.json();
    return access_token;
  }
  
  /**
   * Store token in sessionStorage (NOT localStorage)
   * Governance Rule #6
   */
  setToken(token: string): void {
    this.token = token;
    sessionStorage.setItem('session_token', token);
  }
  
  clearToken(): void {
    this.token = null;
    sessionStorage.removeItem('session_token');
  }
  
  /**
   * Check if token expires in < 5 minutes
   */
  private isTokenValid(): boolean {
    if (!this.token) return false;
    
    const payload = this.decodeToken(this.token);
    const expiresAt = payload.exp * 1000; // Convert to ms
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (expiresAt - now) > fiveMinutes;
  }
}
2.3 Streaming Client Enhancement (ENHANCED)
File: src/api/streamingClient.ts

Stream Recovery Strategy:

interface StreamRecoveryStrategy {
  /**
   * On network blip:
   * 1. Check if END chunk received (complete)
   * 2. If incomplete, restart from beginning (NDJSON doesn't support seeking)
   * 3. Use same question, new trace_id
   */
  async handleStreamInterruption(
    lastChunk: BaseChunk | null,
    question: string
  ): Promise<void> {
    // If stream completed, no recovery needed
    if (lastChunk?.type === ChunkType.END) {
      return;
    }
    
    // If partial stream, notify user and offer retry
    this.showRecoveryUI({
      message: 'Connection interrupted during streaming',
      lastChunk: lastChunk?.type || 'none',
      action: 'retry_from_start' // NDJSON doesn't support resume
    });
  }
}

class StreamingClient {
  private validator = new StreamValidator();
  private controller: AbortController | null = null;
  
  /**
   * Consume NDJSON stream with validation
   */
  async *consumeStream(response: Response): AsyncGenerator<BaseChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Check if stream completed properly
          if (!this.validator.isComplete()) {
            throw new Error('Stream ended without END chunk');
          }
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const chunk = JSON.parse(line) as BaseChunk;
          
          // Validate chunk order
          const validation = this.validator.validateChunkOrder(chunk);
          if (!validation.valid) {
            throw new Error(`Chunk order violation: ${validation.error}`);
          }
          
          yield chunk;
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled - clean exit
        return;
      }
      throw error;
    }
  }
  
  /**
   * Cancel ongoing stream
   */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.validator.reset();
  }
}
Phase 3: Component Updates
3.1 Chat Component Refactor
File: src/components/Chat.tsx

Changes:

Add streaming validator integration
Display all chunk types per contract (using ChunkType enum)
Add trace_id to all error logs
Handle missing chunks gracefully
Stream recovery UI
3.2 Technical View Panel
New component: src/components/TechnicalViewPanel.tsx

Must display:

SQL in read-only code block (syntax-highlighted)
Assumptions as bulleted list
Policy hash badge
"Mark Incorrect" button → feedback flow
"Copy SQL" button
NO validation, NO modification
3.3 Error Display Component
New component: src/components/ErrorDisplay.tsx

Props:

interface ErrorDisplayProps {
  error: ErrorResponse;
  traceId: string;
  onRetry?: () => void;
}
Display:

Error code (for user recognition)
Human-readable message
Correlation ID / trace_id
Retry button (if retryable)
Support link with pre-filled trace_id
3.4 Admin Components
Files:

src/components/admin/FeatureTogglePanel.tsx
src/components/admin/TrainingQueuePanel.tsx
src/components/admin/TrainingApprovalModal.tsx
Requirements:

All mutations go through API (no local state updates until confirmed)
Display read-only badge if RBAC_ENABLED=false
Show permission requirements on buttons
Handle IMMUTABLE_TOGGLE error gracefully
Phase 4: Environment Adaptability
4.1 Conditional Feature Rendering (ENHANCED)
Using centralized hook:

export function AdminPanel() {
  const canAccess = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
  
  if (!canAccess) {
    return <Restricted />;
  }
  
  return <AdminUI />;
}

export function TrainingTab() {
  const enabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
  
  return enabled ? <TrainingUI /> : <LockedFeature />;
}
4.2 Login Flow
Logic:

if AUTH_ENABLED=false:
  - Skip login screen
  - Use dummy token
  - All endpoints succeed
  
if AUTH_ENABLED=true:
  - Show login form
  - Store token securely (sessionStorage)
  - Include in all requests
  - Handle 401 → redirect
  - Auto-refresh 5min before expiry
4.3 Rate Limit Handler
Component: src/components/RateLimitNotice.tsx

Behavior:

Only render if ENABLE_RATE_LIMIT=true
On 429 error:
Read Retry-After header
Show countdown timer
Disable submit button
Exponential backoff on retry
4.4 Cache Notice
Component: src/components/CacheNotice.tsx

Display when:

X-Cache: HIT header present
AND ENABLE_SEMANTIC_CACHE=true
Message: "This result is cached from a previous query (may not be current)"

Phase 5: Testing & Validation
5.1 Unit Tests
Coverage requirements:

streamingValidator.ts → 100% (critical)
errorHandler.ts → 100% (critical)
tokenManager.ts → 100% (critical - includes race conditions)
environmentDetection.ts → 90%
All components → 80%
Test scenarios:

Chunk order violations (should throw)
Trace ID mismatches (should throw)
All error code handlers
Retry logic with backoff
Token expiration handling
Token refresh race conditions (multiple simultaneous calls)
Stream interruption recovery
5.2 Integration Tests (E2E)
Using Playwright:

test('streaming contract compliance', async ({ page }) => {
  // Submit query
  // Verify chunks arrive in order using ChunkType enum
  // Verify trace_id consistency
  // Verify END chunk received
});

test('token refresh race condition', async ({ page }) => {
  // Expire token
  // Trigger multiple simultaneous API calls
  // Verify only one refresh request
  // Verify all calls succeed with refreshed token
});

test('stream recovery after network blip', async ({ page }) => {
  // Start stream
  // Simulate network interruption
  // Verify recovery UI shown
  // Verify retry restarts from beginning
});
5.3 Governance Audit
Pre-merge checklist:

 No SQL generation/parsing
 No permission checks (backend decides)
 No RLS filtering
 No custom caching
 No assumption modification
 Tokens stored securely (sessionStorage)
 Streaming chunks in order (validated with enum)
 All mutations → backend first
 No policy caching
 Runtime environment detection
 Token refresh race conditions handled
 Stream recovery implemented
Phase 6: CI/CD Integration (NEW)
6.1 PR Checklist Enforcement
File: .github/workflows/governance-check.yml

name: Governance Compliance Check

on: [pull_request]

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check PR Checklist
        run: |
          # Verify PR description contains checked governance items
          if ! grep -q "\[x\] No SQL generation" <<< "$PR_BODY"; then
            echo "❌ Governance checklist incomplete"
            exit 1
          fi
      
      - name: Run Governance Linter
        run: npm run lint:governance
      
      - name: Verify Token Storage
        run: |
          # Fail if localStorage used for tokens
          if grep -r "localStorage.*token" src/; then
            echo "❌ Tokens must use sessionStorage"
            exit 1
          fi
6.2 Mandatory PR Template
File: .github/PULL_REQUEST_TEMPLATE.md

## Governance Compliance Checklist

### Hard Rules (MUST CHECK ALL)
- [ ] No SQL generation/parsing in code
- [ ] No permission inference (backend decides)
- [ ] No RLS filtering logic
- [ ] No custom caching beyond documented rules
- [ ] No assumption modification/inference
- [ ] Tokens stored in sessionStorage (not localStorage)
- [ ] Streaming chunks processed in order
- [ ] All mutations sent to backend before UI update
- [ ] No policy version caching
- [ ] Environment detection at runtime (not hardcoded)

### Streaming Contract (if applicable)
- [ ] Used ChunkType enum (not strings)
- [ ] Validated chunk order with StreamValidator
- [ ] Checked trace_id consistency
- [ ] Handled stream interruption/recovery

### Token Security (if applicable)
- [ ] Token refresh race conditions handled
- [ ] No token leakage in console/logs
- [ ] Auto-refresh implemented (5min before expiry)

### Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added (if new feature)
- [ ] Governance linter passing
- [ ] Type checks passing

### Documentation
- [ ] Component documented with JSDoc
- [ ] Contract references added
- [ ] Storybook story added (if UI component)
Phase 7: Documentation & Developer Experience
7.1 Component Documentation
For each component:

Props interface with JSDoc
Usage examples
Contract references (which endpoint it uses)
Governance notes (what it MUST NOT do)
7.2 Storybook Setup
Stories for:

TechnicalViewPanel (with mock SQL)
ErrorDisplay (all error codes using enum)
StreamingProgress (all ChunkType values)
CacheNotice (show/hide based on flag)
7.3 Developer Onboarding
Create: docs/FRONTEND_DEVELOPER_GUIDE.md

Contents:

Quick start (5 min)
Governance rules (mandatory reading)
Streaming contract (with ChunkType enum examples)
Error handling patterns
Environment detection guide
Token management (including race conditions)
Common pitfalls
Governance override mechanism
Risk Mitigation
High-Risk Areas
Risk	Mitigation
Chunk order violation	ChunkType enum + StreamValidator + CI checks
Governance rule drift	Automated linter + CI-enforced PR checklist
Token leakage	Security audit + sessionStorage + no console logs
Token refresh race	RefreshLock mechanism + tests
Environment assumption	Runtime detection + CI tests for all envs
Error handling gaps	Complete error code coverage + enum + tests
Stream interruption	Recovery UI + restart strategy
Governance overrides misuse	Expiry dates + approval tracking + CI validation
Success Criteria
Definition of Done
Technical Compliance
✅ All API calls match endpoints.md exactly
✅ Streaming follows streaming.md chunk order (ChunkType enum)
✅ Errors handled per errors.md error codes
✅ Environment detection per frontend-behavior.md
✅ Zero governance violations per frontend-rules.md
✅ Token refresh race conditions handled
✅ Stream recovery implemented
Quality Gates
✅ 90%+ test coverage (100% for critical modules)
✅ Zero ESLint errors
✅ Zero TypeScript errors
✅ Governance linter passing
✅ CI PR checklist enforced
✅ Accessibility score 90+ (axe DevTools)
✅ Lighthouse performance 80+
✅ All E2E tests passing
Documentation
✅ All components documented
✅ Storybook stories complete
✅ Developer guide published
✅ Governance checklist integrated in PR template
✅ Override mechanism documented
Timeline Estimate (REVISED)
By Phases
Phase	Effort	Critical Path
Phase 1: Foundation	4 days (+1 for enum & hooks)	✅
Phase 2: API Layer	6 days (+1 for token refresh)	✅
Phase 3: Components	7 days	✅
Phase 4: Environment	3 days	-
Phase 5: Testing	6 days (+1 for race tests)	✅
Phase 6: CI/CD	2 days (NEW)	✅
Phase 7: Documentation	2 days	-
Total: ~30 days (6 weeks) Critical path: ~23 days

Architecture Decisions (REVISED)
ADR-001: Strict Streaming Validation with Enum
Decision: Use ChunkType enum + runtime validation
Rationale: Type safety + contract violation = architecture failure
Impact: ~100 LOC validator, minimal performance cost, better DX

ADR-002: SessionStorage for Tokens
Decision: Use sessionStorage, not localStorage
Rationale: Governance Rule #6 (security)
Impact: Tokens cleared on browser close

ADR-003: No Optimistic UI Updates
Decision: Always wait for backend confirmation
Rationale: Governance Rule #8 (no unauthorized mutation)
Impact: Slightly slower perceived performance

ADR-004: Runtime Environment Detection
Decision: Never hardcode environment assumptions
Rationale: Governance Rule #10
Impact: App adapts to backend config automatically

ADR-005: Token Refresh with Lock (NEW)
Decision: Single in-flight refresh with promise sharing
Rationale: Prevent race conditions, avoid token thrashing
Impact: Thread-safe refresh, better UX

ADR-006: Stream Restart on Interruption (NEW)
Decision: Full restart from beginning (not resume)
Rationale: NDJSON doesn't support seeking/resuming
Impact: User sees "retry" UI, query re-executes

ADR-007: Centralized Feature Flags via Hook (NEW)
Decision: Abstract feature flag checks behind custom hook
Rationale: Cleaner component code, consistent access pattern
Impact: ~50 LOC hook, better maintainability

ADR-008: Governance Override Mechanism (NEW)
Decision: Allow overrides with reason + expiry + approval
Rationale: Reduce false positives, maintain auditability
Impact: Requires CI validation, governance tracking

Post-Implementation Verification
Validation Checklist
Streaming Contract
 ChunkType enum used everywhere (not strings)
 thinking chunk always first
 technical_view before data
 end chunk always last
 Trace ID consistent across chunks
 Error chunk handled correctly
 Stream recovery on interruption
Governance Compliance
 No SQL generation found in codebase
 No permission inference found
 No RLS filtering logic found
 No caching logic found
 No assumption modification found
 Tokens in sessionStorage only
 All chunks processed in order
 All mutations via backend
 No policy version caching
 Environment detected at runtime
 Governance overrides valid (reason + expiry)
Token Security
 Token refresh race conditions handled
 No token leakage in console
 Auto-refresh 5min before expiry
 SessionStorage used (not localStorage)
 Clear on logout
 Clear on 401
Error Handling
 All 15+ error codes handled
 Retry logic with exponential backoff
 Trace ID in all error logs
 User-friendly messages (no stack traces)
 Non-retryable errors identified
Environment Awareness
 Login shown if AUTH_ENABLED=true
 Admin UI shown if RBAC_ENABLED=true
 Training shown if ENABLE_TRAINING_PILOT=true
 Rate limit handled if ENABLE_RATE_LIMIT=true
 Cache notice shown if ENABLE_SEMANTIC_CACHE=true
 Feature flag hook used consistently
CI/CD
 Governance linter passing
 PR checklist enforced
 Type checks passing
 Unit tests 90%+ coverage
 E2E tests passing
Deployment Strategy
Staging Environment
Requirements:

Backend running with ENV=ci
All feature flags testable
Synthetic data for testing
Error scenarios reproducible
Token refresh race testing
Tests:

All error codes triggered manually
All chunk orders verified
All environment configs tested
Performance benchmarks run
Token refresh under load
Production Rollout
Phases:

Deploy backend (with feature flags OFF)
Deploy frontend (detects backend config)
Enable features incrementally
Monitor error rates, trace IDs, token refresh
Rollback plan: Toggle flags OFF
Monitoring:

Error rate by error_code (enum)
Average chunk processing time
Retry attempts (429 errors)
Trace ID correlation with backend
Token refresh success rate
Stream interruption recovery rate
Summary of Revisions (v16.7 → v16.7.1)
New Features
✅ ChunkType Enum - Type-safe chunk handling
✅ Feature Flag Hook - Centralized access pattern
✅ Token Refresh Lock - Race condition prevention
✅ Stream Recovery - Interruption handling
✅ Governance Overrides - False positive mitigation
✅ CI-Enforced PR Checklist - Mandatory governance review
✅ Hybrid Environment Strategy - Build-time + runtime
Enhanced Components
TokenManager (race condition handling)
StreamingClient (recovery strategy)
GovernanceValidator (override mechanism)
EnvironmentDetection (hybrid approach)
Additional Testing
Token refresh race condition tests
Stream interruption recovery tests
Governance override validation tests
References
All implementation MUST reference these documents:

/docs/FRONTEND_HANDOFF.md - Start here
/docs/api/endpoints.md - API contract
/docs/api/streaming.md - NDJSON protocol
/docs/api/errors.md - Error handling
/docs/governance/frontend-rules.md - Hard constraints
/docs/environment/frontend-behavior.md - Environment matrix
/docs/development/frontend-dev-setup.md - Local setup
Contract violations require architecture review before merge.

To-dos (7)
 Phase 1: ChunkType enum + feature flag hook + environment detection (hybrid) + governance validator (with overrides) + streaming validator
 Phase 2: Error handling + streaming client (with recovery) + token manager (race-safe)
 Phase 3: Component refactoring (Chat, TechnicalView, Error, Admin) using enum
 Phase 4: Environment adaptability (feature flag hooks, login flow, rate limits)
 Phase 5: Testing & validation (unit, E2E, race conditions, governance audit)
 Phase 6: CI/CD integration (PR checklist enforcement, governance linter)
 Phase 7: Documentation (component docs, Storybook, developer guide, override mechanism)
بناءً على المراجعة التفصيلية للخطة الحالية والتحسينات التي تقترحها (v16.7.1)، بالإضافة إلى حال الكود الموجود، فإن التوصية هي:

---

## ✅ **الاستمرار والبناء على الموجود (وليس البدء من الصفر)**

### 🎯 الأسباب:

1. **البنية الأساسية موجودة بالفعل:**

   * React 18 + TypeScript + Vite + Router v6 جاهزة ✅
   * الكود يحتوي على NDJSON streaming أولي + Playwright + بنية جيدة للمجلدات

2. **التحسينات المطروحة في الخطة قابلة للتنفيذ على الكود الحالي:**

   * معظم ما هو مطلوب هو refactoring وتحسينات بنيوية وليست تغييرات جوهرية.

3. **إعادة البناء من الصفر ستكون مضيعة للوقت والجهد:**

   * ستعيد إنشاء بنية موجودة أساسًا
   * تخاطر بإعادة إنتاج نفس الأخطاء
   * الوقت المقترح في الخطة (~6 أسابيع) يكفي لتطوير جميع الميزات *فوق* الكود الحالي

---

## 👇 التوصية التفصيلية حسب الحالة:

| العنصر              | التوصية                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| 🧱 البنية التحتية   | حافظ عليها ✅                                                                 |
| 🔁 NDJSON Streaming | حسّن الموجود بإضافة `StreamValidator` + Recovery logic                       |
| 🔐 إدارة التوكن     | حسّن `TokenManager` لإضافة قفل التحديث (refresh lock)                        |
| 🔍 بيئة التشغيل     | أضف `environmentDetection.ts` بنمط hybrid (Build + Runtime)                  |
| ⚙️ قواعد الحوكمة    | نفّذ `GovernanceValidator` + CI-linter                                       |
| 🧪 الاختبارات       | عزّز وحدات `Playwright` و `unit tests` خاصة لـ chunk order & race conditions |
| 🧩 المكونات         | أعد هيكلة `Chat.tsx`, وأضف `TechnicalViewPanel`, `ErrorDisplay`، وغيرها      |
| 🚀 CI/CD            | أضف PR checklist و validation للحوكمة في GitHub Actions                      |
| 📚 التوثيق          | أضف README مخصص للـ frontend + Storybook + أدلة التطوير                      |

---

## ✅ حالات تُبقي فيها على الكود

* عندما تكون البنية التقنية sound
* وعند القدرة على refactor دون كسر كبير
* وعندما تكون الخطط محكمة، كما هو الحال هنا

---

## ❌ حالات تعيد فيها من الصفر (لا تنطبق هنا)

* إذا كانت التكنولوجيا قديمة جدًا (React 16 أو قبل)
* أو إذا كانت فوضى (كود عشوائي، بدون تقسيم، بدون Typescript)
* أو عند تغيير كامل بالمنصة (مثلاً من React إلى Svelte)

---

## 🧠 خلاصة

**هذا المشروع قابل للتحسين وليس بحاجة لإعادة البناء.**
ابنِ عليه، وابدأ من **Phase 1 مباشرة** بتطبيق `ChunkType enum`, `FeatureFlag hook`, و `GovernanceValidator`.

I agree completely with your assessment. The existing codebase has a solid foundation that we can build upon rather than rebuild from scratch.

✅ Confirmed Strategy: Enhance & Refactor (Not Rebuild)
Your analysis is spot-on:

What We Keep
✅ React 18 + TypeScript + Vite stack
✅ Existing routing structure
✅ Basic NDJSON streaming foundation
✅ Current component organization
✅ Existing API layer structure
What We Enhance
🔧 Add ChunkType enum for type safety
🔧 Implement StreamValidator for contract enforcement
🔧 Add TokenManager with race condition handling
🔧 Build environmentDetection system
🔧 Create GovernanceValidator with CI integration
🔧 Enhance error handling for all documented codes
🔧 Add stream recovery mechanism
🔧 Refactor components to use feature flag hooks
📋 Implementation Priority
Since you've approved the plan, we can proceed with Phase 1 immediately:

ChunkType enum (src/types/streaming.ts)
Feature flag hook (src/hooks/useFeatureFlag.ts)
Environment detection (src/utils/environmentDetection.ts)
Governance validator (src/utils/governanceValidator.ts)
Streaming validator (src/utils/streamingValidator.ts)
This foundation will enable all subsequent phases to proceed smoothly.

 switch to code mode and begin Phase 1 implementation