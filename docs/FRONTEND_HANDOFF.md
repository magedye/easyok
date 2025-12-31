# Frontend Architecture & Implementation Handoff

**Target Audience:** Frontend Developers, Code Reviewers, CI Governance  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 - Documentation Suite  

## 📋 Executive Summary

This document provides a comprehensive overview of the frontend architecture, implementation phases, governance compliance, and streaming contract for the EasyOK platform. The frontend has been designed to work seamlessly with the backend while maintaining strict governance compliance and robust error handling.

## 🎯 Quick Start for New Developers

### Prerequisites
- Node.js 18+ 
- npm/yarn
- Basic understanding of React 18 + TypeScript
- Familiarity with NDJSON streaming

### 5-Minute Setup
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Start development server
npm run dev

# 4. Visit http://localhost:5173
# Frontend automatically detects backend configuration
```

### Key Concepts to Understand
1. **[`ChunkType`](frontend/src/types/streaming.ts:8)** - Strict enum for NDJSON chunk types
2. **[`StreamValidator`](frontend/src/utils/streamingValidator.ts:25)** - Enforces backend streaming contract
3. **[`useFeatureFlag()`](frontend/src/hooks/useFeatureFlag.ts:139)** - Runtime feature detection
4. **[`TokenManager`](frontend/src/api/tokenManager.ts:33)** - Thread-safe token management
5. **[`GovernanceValidator`](frontend/src/utils/governanceValidator.ts:188)** - Prevents rule violations

## 🏗️ Architecture Overview

### Implementation Phases Completed

#### Phase 1: Foundation & Type Safety ✅
- **[`ChunkType`](frontend/src/types/streaming.ts:8)** enum for type-safe streaming
- **[`StreamValidator`](frontend/src/utils/streamingValidator.ts:25)** for contract enforcement
- **[`EnvironmentDetection`](frontend/src/utils/environmentDetection.ts:139)** system (hybrid build-time + runtime)
- **[`useFeatureFlag()`](frontend/src/hooks/useFeatureFlag.ts:139)** hook for centralized feature access
- **[`GovernanceValidator`](frontend/src/utils/governanceValidator.ts:188)** with override mechanism

#### Phase 2: Robust API Layer ✅
- **[`TokenManager`](frontend/src/api/tokenManager.ts:33)** with race condition prevention
- **[`ErrorHandler`](frontend/src/api/errorHandler.ts:212)** for all 25+ documented error codes
- **[`EasyStream`](frontend/src/api/easyStream.ts)** client with recovery strategy
- Retry logic with exponential backoff
- Trace ID correlation for debugging

#### Phase 3: Enhanced Components ✅
- **[`Chat`](frontend/src/components/Chat.tsx:38)** component with enhanced streaming validation
- **[`TechnicalViewPanel`](frontend/src/components/TechnicalViewPanel.tsx:30)** read-only display (Governance Rule #1)
- **[`ErrorDisplay`](frontend/src/components/ErrorDisplay.tsx)** with user-friendly messages
- Feature-flag driven rendering

### Core Architecture Principles

1. **Contract-First Development:** All components follow documented API contracts
2. **Type-Safe Streaming:** [`ChunkType`](frontend/src/types/streaming.ts:8) enum prevents string literal errors
3. **Runtime Adaptation:** Environment detection enables dynamic behavior
4. **Security-First:** Tokens in sessionStorage only, no localStorage secrets
5. **Governance Enforcement:** Automated validation prevents rule violations

## 📡 Streaming Contract Summary

### Chunk Flow
```
thinking → technical_view → data → business_view → end
   ↓           ↓           ↓           ↓          ↓
[Required]  [Optional]  [Optional]  [Optional] [Required]

Error chunks can occur at any point, followed by end
```

### Type-Safe Implementation
```typescript
// ✅ Type-safe with enum
const chunkType = ChunkType.TECHNICAL_VIEW;

// ❌ Error-prone string literals
const chunkType = "technical_view"; 
```

### Validation Example
```typescript
const validator = new StreamValidator();

for (const chunk of streamChunks) {
  const validation = validator.validateChunkOrder(chunk);
  if (!validation.valid) {
    throw new Error(`Contract violation: ${validation.error}`);
  }
}
```

## 🔐 Security & Token Management

### Thread-Safe Token Refresh
The **[`TokenManager`](frontend/src/api/tokenManager.ts:33)** prevents race conditions:

```typescript
// Multiple simultaneous calls share the same refresh promise
const token1 = await tokenManager.ensureValidToken();
const token2 = await tokenManager.ensureValidToken(); // Waits for same refresh
```

### Storage Compliance (Governance Rule #6)
```typescript
// ✅ Compliant - clears on browser close
sessionStorage.setItem('session_token', token);

// ❌ Governance violation
localStorage.setItem('token', token);
```

## 🛡️ Governance Compliance

### The 10 Hard Rules
Our frontend strictly enforces these governance rules:

1. **No SQL Generation** - Display only, never parse/modify SQL
2. **No Permission Inference** - Backend decides all permissions
3. **No RLS Logic** - Backend handles row-level security
4. **No Custom Caching** - Use documented cache patterns only
5. **No Assumption Inference** - Display assumptions read-only
6. **No Secret Storage in localStorage** - Use sessionStorage only
7. **No Response Reordering** - Process chunks in received order
8. **No Unauthorized Mutation** - Wait for backend confirmation
9. **No Policy Caching** - Fetch fresh policy data
10. **No Hardcoded Environment Assumptions** - Runtime detection

### Override Mechanism
For legitimate edge cases:
```typescript
/**
 * @governance-ignore-next-line rule=no-sql-generation reason="Display only - no parsing"
 * @approved_by="lead-developer" expires="2024-06-01"
 */
<pre>{sqlCode}</pre>
```

## 🎯 Feature Flag System

### Centralized Access Pattern
```typescript
export function TrainingPanel() {
  const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
  const canAccess = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
  
  if (!trainingEnabled) {
    return <ComingSoonBanner feature="Training Pilot" />;
  }
  
  if (!canAccess) {
    return <AccessDeniedNotice />;
  }
  
  return <TrainingUI />;
}
```

### Environment Matrix
| Feature | Local | CI | Production |
|---------|-------|----|-----------| 
| `AUTH_ENABLED` | `false` | `true` | `true` |
| `RBAC_ENABLED` | `false` | `true` | `true` |
| `ENABLE_TRAINING_PILOT` | `true` | `true` | `false` |
| `ENABLE_SEMANTIC_CACHE` | `false` | `true` | `true` |
| `ENABLE_RATE_LIMIT` | `false` | `true` | `true` |

## 🔧 Error Handling Strategy

### Complete Error Code Coverage
The **[`ErrorHandler`](frontend/src/api/errorHandler.ts:212)** handles all documented backend errors:

- **Authentication:** `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `TOKEN_EXPIRED`
- **Authorization:** `FORBIDDEN`, `TABLE_ACCESS_DENIED`, `COLUMN_ACCESS_DENIED`
- **Rate Limiting:** `RATE_LIMIT_EXCEEDED`, `CONCURRENT_REQUEST_LIMIT`
- **Execution:** `SQL_EXECUTION_FAILED`, `QUERY_TIMEOUT`, `DATABASE_CONNECTION_FAILED`
- **Infrastructure:** `SERVICE_UNAVAILABLE`, `INTERNAL_SERVER_ERROR`, `GATEWAY_TIMEOUT`
- **Streaming:** `STREAMING_INTERRUPTED`, `CHUNK_ORDER_VIOLATION`

### Retry Logic with Backoff
```typescript
const retryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  exponential: true,
  jitterMs: 500
};

// Exponential backoff: 1s → 2s → 4s → 8s → 16s (+ jitter)
```

## 📚 Reference Documentation

For detailed implementation guidance, refer to:

- **[`api/endpoints.md`](docs/api/endpoints.md)** - Complete API contract
- **[`api/streaming.md`](docs/api/streaming.md)** - NDJSON protocol specification  
- **[`api/errors.md`](docs/api/errors.md)** - Error codes & handling
- **[`environment/frontend-behavior.md`](docs/environment/frontend-behavior.md)** - Feature flag matrix
- **[`governance/frontend-rules.md`](docs/governance/frontend-rules.md)** - 10 hard governance rules
- **[`development/frontend-dev-setup.md`](docs/development/frontend-dev-setup.md)** - Local setup & debugging

## 🧪 Testing Strategy

### Critical Coverage Areas
- **[`StreamValidator`](frontend/src/utils/streamingValidator.ts:25)** - 100% coverage (contract enforcement)
- **[`ErrorHandler`](frontend/src/api/errorHandler.ts:212)** - 100% coverage (all error codes)  
- **[`TokenManager`](frontend/src/api/tokenManager.ts:33)** - 100% coverage (race conditions)
- **Components** - 80%+ coverage

### Key Test Scenarios
1. **Chunk Order Violations** - Must throw errors
2. **Trace ID Consistency** - Across all chunks
3. **Token Refresh Races** - Multiple simultaneous calls
4. **Stream Recovery** - After network interruption
5. **Error Code Handling** - All 25+ documented codes

## 🚀 CI/CD Integration

### Mandatory PR Checklist
Every Pull Request must verify:
- [ ] No SQL generation/parsing in code
- [ ] No permission inference logic
- [ ] Tokens stored in sessionStorage only  
- [ ] [`ChunkType`](frontend/src/types/streaming.ts:8) enum used (not strings)
- [ ] Stream validation with **[`StreamValidator`](frontend/src/utils/streamingValidator.ts:25)**
- [ ] All error codes handled
- [ ] Feature flags accessed via **[`useFeatureFlag()`](frontend/src/hooks/useFeatureFlag.ts:139)**

### Automated Governance Check
```bash
# Runs on every PR
npm run lint:governance
```

Fails if:
- Governance violations found without valid override
- Override missing required reason
- Override expired
- Token storage violations

## 🎯 Success Metrics

### Definition of Done
- ✅ All API calls match documented contracts
- ✅ Streaming follows [`ChunkType`](frontend/src/types/streaming.ts:8) order
- ✅ Zero governance violations
- ✅ 90%+ test coverage on critical modules
- ✅ All error codes handled
- ✅ Token refresh race conditions prevented
- ✅ Stream recovery implemented

### Quality Gates
- ✅ ESLint: 0 errors
- ✅ TypeScript: 0 errors  
- ✅ Governance linter: passing
- ✅ E2E tests: passing
- ✅ Accessibility score: 90+
- ✅ Performance: 80+ (Lighthouse)

## 🔍 Debugging Guide

### Stream Issues
```typescript
// Enable detailed logging
const debugConfig = useConfigDebug();
console.log('Stream stats:', validator.getStreamStats());
```

### Token Issues  
```typescript
// Check token state (development only)
const tokenDebug = tokenManager.getDebugInfo();
console.log('Token valid:', tokenDebug.isValid);
```

### Environment Issues
```typescript  
// Verify feature detection
const { config } = useBackendConfig();
console.log('Backend features:', config.backend);
```

## 👥 Team Onboarding

### New Developer Checklist
1. Read this handoff document
2. Review **[`governance/frontend-rules.md`](docs/governance/frontend-rules.md)**
3. Understand **[`api/streaming.md`](docs/api/streaming.md)** contract
4. Study **[`development/frontend-dev-setup.md`](docs/development/frontend-dev-setup.md)**
5. Practice with error handling examples
6. Run governance linter locally

### Code Review Guidelines
- Verify [`ChunkType`](frontend/src/types/streaming.ts:8) enum usage
- Check for sessionStorage not localStorage
- Validate error handling completeness
- Confirm feature flag usage patterns
- Review governance rule compliance

## 📞 Support & Contact

### Development Issues
- **Streaming Validation:** Check **[`StreamValidator`](frontend/src/utils/streamingValidator.ts:25)** implementation
- **Token Management:** Review **[`TokenManager`](frontend/src/api/tokenManager.ts:33)** thread safety
- **Error Handling:** Consult **[`api/errors.md`](docs/api/errors.md)** for all codes

### Governance Reviews
- **Rule Violations:** See **[`governance/frontend-rules.md`](docs/governance/frontend-rules.md)**
- **Override Requests:** Follow documented approval process
- **CI Failures:** Check PR checklist compliance

---

**Next Steps:** Proceed to individual documentation files for detailed implementation guidance. Each file is standalone and GitHub-rendering optimized.