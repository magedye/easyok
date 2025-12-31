# Frontend Development Setup Guide

**Target Audience:** Frontend Developers  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document provides a complete setup guide for local frontend development, testing strategies, debugging techniques, and CI integration. Follow this guide to get productive quickly while maintaining governance compliance.

## 🚀 Quick Start (5 Minutes)

### Prerequisites
```bash
# Required software
node --version        # >= 18.0.0
npm --version         # >= 9.0.0
git --version         # >= 2.30.0

# Optional but recommended
code --version        # VS Code for best experience
```

### Setup Steps
```bash
# 1. Clone repository
git clone https://github.com/company/easyok.git
cd easyok

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local

# 4. Start development server
npm run dev

# 5. Open browser
# Frontend: http://localhost:5173
# Backend: http://localhost:8000 (if running locally)
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/                    # API layer & error handling
│   │   ├── tokenManager.ts     # Thread-safe token management
│   │   ├── errorHandler.ts     # Complete error code handling
│   │   └── easyStream.ts       # NDJSON streaming client
│   ├── components/             # React components
│   │   ├── Chat.tsx            # Main chat interface
│   │   ├── TechnicalViewPanel.tsx  # SQL display (read-only)
│   │   └── ErrorDisplay.tsx    # User-friendly error messages
│   ├── hooks/                  # Custom React hooks
│   │   └── useFeatureFlag.ts   # Centralized feature flag access
│   ├── types/                  # TypeScript interfaces
│   │   └── streaming.ts        # ChunkType enum & interfaces
│   └── utils/                  # Utility functions
│       ├── streamingValidator.ts    # Contract enforcement
│       ├── governanceValidator.ts   # Rule compliance checking
│       └── environmentDetection.ts  # Runtime configuration
├── docs/                       # Documentation (this folder)
├── tests/                      # Test suites
└── scripts/                    # Development scripts
```

## ⚙️ Environment Configuration

### Local Development (.env.local)
```bash
# Build-time configuration
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
VITE_API_BASE_URL=http://localhost:8000
VITE_SIGNOZ_DASHBOARD_URL=http://localhost:3301

# Feature overrides (optional - backend detection preferred)
# VITE_FORCE_AUTH=false
# VITE_FORCE_TRAINING=true
```

### Environment Selection
The frontend automatically detects environment based on URL:
- `localhost` → Local development mode
- `*staging*` or `*ci*` → CI/Staging mode  
- Other domains → Production mode

Use **[`environmentDetection`](../frontend/src/utils/environmentDetection.ts:139)** for runtime behavior:

```typescript
const config = await detectEnvironment();
console.log('Environment:', config.environment);
console.log('Features:', config.backend);
```

## 🛠️ Development Workflow

### 1. Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-chat-feature

# 2. Start development server with hot reload
npm run dev

# 3. Code with governance compliance
# - Use ChunkType enum for streaming
# - Access features via useFeatureFlag()
# - Handle errors with ErrorHandler
# - Validate streams with StreamValidator

# 4. Run tests continuously
npm run test:watch

# 5. Check governance compliance
npm run lint:governance
```

### 2. Code Quality Checks
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:governance    # Governance rule validation

# Formatting
npm run format

# All checks
npm run check-all
```

### 3. Testing Strategy
```bash
# Unit tests
npm run test
npm run test:coverage

# E2E tests
npm run test:e2e
npm run test:e2e:debug

# Contract testing
npm run test:streaming     # Validate chunk order
npm run test:errors        # Test error handling
```

## 🧪 Testing Error Cases Locally

### Mock Backend Errors
```typescript
// In development, mock specific errors for testing

// Mock rate limit error
await page.route('/api/v1/chat/ask', route => {
  route.fulfill({
    status: 429,
    json: {
      message: 'Rate limit exceeded',
      error_code: 'RATE_LIMIT_EXCEEDED',
      trace_id: 'mock_trace_001',
      retry_after: 5
    }
  });
});

// Mock streaming interruption
const mockStreamInterruption = async () => {
  // Send partial stream then disconnect
  const chunks = [
    { type: 'thinking', trace_id: 'test_123', payload: { content: 'Processing...' } },
    { type: 'technical_view', trace_id: 'test_123', payload: { sql: 'SELECT...' } }
    // Missing data, business_view, and end chunks
  ];
  
  // Simulate connection drop
  setTimeout(() => controller.abort(), 2000);
};
```

### Local Error Testing
```bash
# Start backend in error simulation mode
cd backend && python -m app.main --simulate-errors

# Test specific error scenarios
curl -X POST http://localhost:8000/api/v1/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "FORCE_ERROR:RATE_LIMIT_EXCEEDED"}'
```

## 🔍 Testing Streaming Locally

### Manual Stream Testing
```typescript
// Test streaming validation manually
const testStreamValidation = async () => {
  const validator = new StreamValidator();
  
  const testChunks = [
    { type: ChunkType.THINKING, trace_id: 'test_001', timestamp: new Date().toISOString(), payload: { content: 'Testing...' } },
    { type: ChunkType.TECHNICAL_VIEW, trace_id: 'test_001', timestamp: new Date().toISOString(), payload: { sql: 'SELECT 1', assumptions: [] } },
    { type: ChunkType.END, trace_id: 'test_001', timestamp: new Date().toISOString(), payload: { message: 'Done' } }
  ];
  
  for (const chunk of testChunks) {
    const result = validator.validateChunkOrder(chunk);
    console.log(`Chunk ${chunk.type}: ${result.valid ? '✅' : '❌'}`, result.error);
  }
};
```

### Backend Streaming Test Endpoint
```bash
# Use backend test endpoint for streaming validation
curl -N -H "Accept: application/x-ndjson" \
  "http://localhost:8000/api/v1/test/stream/valid-order"

curl -N -H "Accept: application/x-ndjson" \
  "http://localhost:8000/api/v1/test/stream/invalid-order"
```

## 🔧 Debugging Techniques

### Frontend Debugging
```typescript
// Enable debug mode
localStorage.setItem('debug', 'true');

// Stream debugging
const enableStreamLogging = () => {
  const originalValidate = streamValidator.validateChunkOrder;
  streamValidator.validateChunkOrder = function(chunk) {
    console.log('[Stream Debug]', {
      type: chunk.type,
      trace_id: chunk.trace_id,
      payload_keys: Object.keys(chunk.payload)
    });
    return originalValidate.call(this, chunk);
  };
};

// Token debugging (development only)
const tokenDebug = tokenManager.getDebugInfo();
console.log('Token state:', tokenDebug);

// Feature flag debugging
const flagDebug = useConfigDebug();
console.log('Feature flags:', flagDebug);
```

### Browser DevTools
```typescript
// Add global debugging helpers
window.__DEBUG__ = {
  streamValidator,
  tokenManager,
  errorHandler,
  getConfig: () => detectEnvironment(),
  testError: (code) => errorHandler.handleError({ 
    error_code: code, 
    message: 'Test error', 
    trace_id: 'debug_001' 
  })
};

// Usage in console:
// __DEBUG__.testError('RATE_LIMIT_EXCEEDED')
// __DEBUG__.getConfig().then(console.log)
```

### Network Debugging
```bash
# Monitor API calls with trace headers
# In DevTools Network tab, look for:
# - X-Trace-ID headers
# - X-Request-ID headers  
# - Authorization headers (Bearer tokens)
# - Content-Type: application/x-ndjson for streams

# Test API directly
curl -H "Authorization: Bearer $(cat tmp/token)" \
     -H "X-Request-ID: debug_$(date +%s)" \
     -X POST http://localhost:8000/api/v1/chat/ask \
     -d '{"question": "test", "stream": true}'
```

## 📝 Linting & Formatting Rules

### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended", 
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "error",
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
```

### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
```

### Governance Linter
```bash
# Custom governance rules (runs in CI)
npm run lint:governance

# Check specific rule
npx governance-lint --rule no-sql-generation src/

# Generate override template
npx governance-lint --generate-override
```

## 🔄 Commit Rules & Git Workflow

### Conventional Commits
```bash
# Format: type(scope): description

# Feature commits
git commit -m "feat(chat): add streaming validation with ChunkType enum"
git commit -m "feat(auth): implement thread-safe token refresh"

# Bug fixes  
git commit -m "fix(error): handle network interruption in stream"
git commit -m "fix(cache): correct sessionStorage usage for tokens"

# Documentation
git commit -m "docs(api): add streaming protocol specification"

# Tests
git commit -m "test(streaming): add chunk order validation tests"

# Governance
git commit -m "governance(rules): add override for legacy SQL display"
```

### Pre-commit Hooks
```bash
# Install pre-commit hooks
npm run prepare

# Hooks run automatically on commit:
# 1. ESLint check
# 2. Prettier formatting
# 3. Type checking
# 4. Governance validation
# 5. Unit tests for changed files
```

### Branch Naming
```bash
# Features
feature/add-training-pilot
feature/enhance-error-display

# Bug fixes
fix/stream-validation-race-condition
fix/token-refresh-deadlock

# Governance
governance/add-sql-display-override
governance/fix-localstorage-violation

# Hotfixes
hotfix/critical-auth-bug
```

## 🚀 CI Validation Steps

### GitHub Actions Pipeline
```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type checking
        run: npm run type-check
      
      - name: Linting
        run: npm run lint
      
      - name: Governance validation
        run: npm run lint:governance
      
      - name: Unit tests
        run: npm run test:coverage
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Build
        run: npm run build
```

### PR Validation Checklist
Every PR automatically checks:
- ✅ No TypeScript errors
- ✅ No ESLint violations
- ✅ Governance rules compliance
- ✅ Test coverage >= 80%
- ✅ E2E tests passing
- ✅ Build successful

### Manual PR Review Checklist
Reviewers must verify:
- [ ] [`ChunkType`](../frontend/src/types/streaming.ts:8) enum used (not strings)
- [ ] Feature flags accessed via [`useFeatureFlag()`](../frontend/src/hooks/useFeatureFlag.ts:139)
- [ ] Errors handled with [`ErrorHandler`](../frontend/src/api/errorHandler.ts:212)
- [ ] Streams validated with [`StreamValidator`](../frontend/src/utils/streamingValidator.ts:25)
- [ ] No localStorage usage for tokens
- [ ] All governance overrides properly documented

## 🧩 Component Development Guidelines

### Component Template
```typescript
import React from 'react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

interface MyComponentProps {
  data: unknown;
  onAction: () => void;
}

/**
 * MyComponent - Brief description
 * 
 * @param data - Data to display
 * @param onAction - Callback for user action
 * 
 * Governance compliance:
 * - Uses feature flags for conditional rendering
 * - No SQL generation or modification
 * - Follows error handling patterns
 */
export const MyComponent: React.FC<MyComponentProps> = ({ 
  data, 
  onAction 
}) => {
  const isFeatureEnabled = useFeatureFlag('ENABLE_MY_FEATURE');
  
  if (!isFeatureEnabled) {
    return <ComingSoonNotice feature="My Feature" />;
  }
  
  return (
    <div className="my-component">
      {/* Component content */}
    </div>
  );
};

export default MyComponent;
```

### Testing Template
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { jest } from '@jest/globals';
import MyComponent from './MyComponent';
import { BackendConfigProvider } from '../hooks/useFeatureFlag';

// Mock feature flag context
const mockConfig = {
  config: {
    backend: { ENABLE_MY_FEATURE: true },
    environment: 'local' as const,
    build: { DEBUG: true }
  },
  isLoading: false,
  error: null,
  refresh: jest.fn()
};

describe('MyComponent', () => {
  it('should render when feature is enabled', () => {
    render(
      <BackendConfigProvider value={mockConfig}>
        <MyComponent data="test" onAction={jest.fn()} />
      </BackendConfigProvider>
    );
    
    expect(screen.getByText('My Feature Content')).toBeInTheDocument();
  });
  
  it('should show coming soon when feature disabled', () => {
    const disabledConfig = {
      ...mockConfig,
      config: { ...mockConfig.config, backend: { ENABLE_MY_FEATURE: false } }
    };
    
    render(
      <BackendConfigProvider value={disabledConfig}>
        <MyComponent data="test" onAction={jest.fn()} />
      </BackendConfigProvider>
    );
    
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});
```

## 🔧 Troubleshooting Common Issues

### Streaming Issues
```bash
# Problem: Chunks arriving out of order
# Solution: Check backend chunk generation order
# Debug: Enable stream logging

# Problem: Missing END chunk
# Solution: Check backend stream completion
# Debug: Monitor network tab for aborted requests

# Problem: Trace ID inconsistency  
# Solution: Verify backend trace ID generation
# Debug: Log trace IDs for each chunk
```

### Authentication Issues
```bash
# Problem: Token refresh race condition
# Solution: Use TokenManager.ensureValidToken()
# Debug: Check browser network for multiple refresh calls

# Problem: Tokens in localStorage
# Solution: Use sessionStorage only
# Debug: Run governance linter

# Problem: 401 errors not handled
# Solution: Check error handler coverage
# Debug: Test with expired token
```

### Feature Flag Issues
```bash
# Problem: Features not appearing
# Solution: Check backend /health endpoint
# Debug: Verify feature flag detection

# Problem: Hardcoded environment checks
# Solution: Use runtime detection
# Debug: Run governance linter

# Problem: Build-time assumptions
# Solution: Use hybrid detection approach
# Debug: Check environment detection logic
```

### Performance Issues
```bash
# Problem: Slow initial load
# Solution: Check bundle size with npm run analyze
# Debug: Use Lighthouse performance audit

# Problem: Memory leaks
# Solution: Check React DevTools Profiler
# Debug: Monitor component unmount cleanup

# Problem: Too many re-renders
# Solution: Use React.memo and useMemo
# Debug: React DevTools highlighting
```

## 📚 Additional Resources

### Documentation Links
- **[Main Handoff](../FRONTEND_HANDOFF.md)** - Executive summary
- **[API Reference](../api/endpoints.md)** - All backend endpoints
- **[Streaming Protocol](../api/streaming.md)** - NDJSON specification
- **[Error Handling](../api/errors.md)** - All error codes
- **[Feature Flags](../environment/frontend-behavior.md)** - Environment matrix
- **[Governance Rules](../governance/frontend-rules.md)** - 10 hard rules

### Learning Resources
```bash
# TypeScript strict mode patterns
https://typescript-exercises.com/

# React 18 features and hooks
https://react.dev/learn

# NDJSON streaming concepts  
https://ndjson.org/

# JWT token management
https://jwt.io/introduction
```

### Browser Extensions
- **React DevTools** - Component debugging
- **Redux DevTools** - State management (if used)
- **Lighthouse** - Performance auditing
- **axe DevTools** - Accessibility testing

## 🎓 Onboarding Checklist

### Day 1: Environment Setup
- [ ] Clone repository and install dependencies
- [ ] Setup `.env.local` configuration
- [ ] Start development server successfully
- [ ] Run all tests and see them pass
- [ ] Verify governance linter works

### Day 2: Architecture Understanding  
- [ ] Read governance rules documentation
- [ ] Understand streaming protocol with ChunkType enum
- [ ] Study error handling patterns
- [ ] Learn feature flag system
- [ ] Review component structure

### Day 3: Development Practice
- [ ] Create a simple component using useFeatureFlag
- [ ] Write tests for the component
- [ ] Submit a PR and pass code review
- [ ] Experience CI pipeline
- [ ] Practice debugging techniques

### Week 1: Productivity
- [ ] Comfortable with development workflow
- [ ] Understand governance compliance requirements
- [ ] Can debug streaming and authentication issues
- [ ] Familiar with testing strategies
- [ ] Ready for independent feature development

---

## 🚨 Emergency Debugging

### Production Issues
```typescript
// Quick production debugging (use sparingly)
console.error('[PROD DEBUG] Stream state:', {
  chunks: streamValidator.getChunks().length,
  phase: streamValidator.getCurrentPhase(),
  traceId: streamValidator.getTraceId(),
  isComplete: streamValidator.isComplete()
});

// Token state debugging
if (window.__DEBUG__) {
  console.error('[PROD DEBUG] Token state:', {
    hasToken: tokenManager.hasToken(),
    timeUntilExpiry: tokenManager.getTimeUntilExpiry()
  });
}
```

### Contact Information
- **Frontend Issues:** frontend-team@company.com
- **API Issues:** backend-team@company.com  
- **Governance Questions:** architecture-team@company.com
- **CI/CD Issues:** devops-team@company.com

Remember: This setup guide ensures you develop efficiently while maintaining the strict governance and quality standards required for the EasyOK platform.
