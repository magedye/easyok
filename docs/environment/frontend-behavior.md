# Frontend Environment Behavior Matrix

**Target Audience:** Frontend Developers, DevOps, QA Engineers  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document defines how the frontend application behaves across different environments (local, CI, production) based on feature flags and configuration. The **[`environmentDetection`](../frontend/src/utils/environmentDetection.ts:139)** system automatically adapts to backend capabilities without hardcoded assumptions.

## 🎯 Environment Detection Strategy

### Hybrid Detection Approach (Governance Rule #10)
To avoid hardcoded environment assumptions, the frontend uses a hybrid detection strategy:

1. **Build-Time Config:** Non-security settings from Vite environment variables
2. **Runtime Config:** Security & feature flags from backend `/health` endpoint
3. **Automatic Adaptation:** Frontend adjusts UI based on detected capabilities

### Detection Implementation
```typescript
// ✅ Correct: Runtime detection
const config = await detectEnvironment();
const authEnabled = config.backend.AUTH_ENABLED;

// ❌ Governance violation: Hardcoded assumption
const authEnabled = process.env.NODE_ENV === 'production';
```

## 🏗️ Environment Matrix

### Feature Flag Behavior by Environment

| Feature Flag | Local | CI/Staging | Production | Description |
|--------------|-------|------------|------------|-------------|
| **`AUTH_ENABLED`** | `false` | `true` | `true` | Authentication system toggle |
| **`RBAC_ENABLED`** | `false` | `true` | `true` | Role-based access control |
| **`ENABLE_TRAINING_PILOT`** | `true` | `true` | `false` | Training/feedback features |
| **`ENABLE_SEMANTIC_CACHE`** | `false` | `true` | `true` | Query result caching |
| **`ENABLE_RATE_LIMIT`** | `false` | `true` | `true` | Request rate limiting |
| **`ENABLE_OBSERVABILITY`** | `true` | `true` | `true` | Enhanced logging/metrics |
| **`ENABLE_SENTRY_MONITORING`** | `false` | `true` | `true` | Error reporting to Sentry |

### Immutable Toggles by Environment
These toggles cannot be changed at runtime due to security requirements:

| Environment | Immutable Toggles | Reason |
|-------------|-------------------|---------|
| **Local** | None | Full flexibility for development |
| **CI/Staging** | `['AUTH_ENABLED']` | Consistent auth testing |
| **Production** | `['AUTH_ENABLED', 'RBAC_ENABLED']` | Security-critical settings |

## 🔧 Build-Time Configuration

### Vite Environment Variables
Set via `.env` files or build environment:

```bash
# .env.local (Local Development)
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
VITE_API_BASE_URL=http://localhost:8000
VITE_SIGNOZ_DASHBOARD_URL=http://localhost:3301

# .env.ci (CI/Staging) 
VITE_DEBUG=false
VITE_LOG_LEVEL=info
VITE_API_BASE_URL=https://api-staging.easyok.com
VITE_SIGNOZ_DASHBOARD_URL=https://signoz.staging.easyok.com

# .env.production (Production)
VITE_DEBUG=false
VITE_LOG_LEVEL=warn
VITE_API_BASE_URL=https://api.easyok.com
VITE_SIGNOZ_DASHBOARD_URL=https://signoz.easyok.com
```

### Build Config Interface
```typescript
interface BuildTimeConfig {
  DEBUG: boolean;                    // Debug mode toggle
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';  // Logging verbosity
  API_BASE_URL: string;             // Backend API URL
  SIGNOZ_DASHBOARD_URL: string;     // Observability dashboard
  NODE_ENV: 'development' | 'staging' | 'production';  // Build environment
}
```

## 🚀 Runtime Feature Detection

### Backend Configuration Interface
```typescript
interface BackendConfig {
  AUTH_ENABLED: boolean;            // Authentication system
  RBAC_ENABLED: boolean;           // Role-based access control
  ENABLE_TRAINING_PILOT: boolean;  // Training features
  ENABLE_SEMANTIC_CACHE: boolean;  // Query result caching
  ENABLE_RATE_LIMIT: boolean;      // Request rate limiting
  ENABLE_OBSERVABILITY: boolean;   // Enhanced logging
  ENABLE_SENTRY_MONITORING: boolean; // Error reporting
  IMMUTABLE_TOGGLES: string[];     // Toggles that can't change
}
```

### Health Endpoint Response
```json
{
  "status": "healthy",
  "timestamp": "2025-12-31T01:00:00.000Z",
  "version": "1.0.0",
  "features": {
    "auth_enabled": true,
    "rbac_enabled": true,
    "training_pilot": false,
    "semantic_cache": true,
    "rate_limit": true,
    "observability": true,
    "sentry_monitoring": true
  },
  "immutable_toggles": ["AUTH_ENABLED", "RBAC_ENABLED"]
}
```

## 📱 Frontend Behavior by Environment

### Local Development Environment
**Characteristics:**
- Fast feedback loop
- Maximum feature access for testing
- Relaxed security for convenience
- Enhanced debugging capabilities

**Feature States:**
```typescript
{
  AUTH_ENABLED: false,        // Skip login for faster dev
  RBAC_ENABLED: false,        // All features accessible
  ENABLE_TRAINING_PILOT: true,  // Test training features
  ENABLE_SEMANTIC_CACHE: false, // Avoid stale development data
  ENABLE_RATE_LIMIT: false,   // Unlimited requests for testing
  ENABLE_OBSERVABILITY: true, // Debug logging enabled
  ENABLE_SENTRY_MONITORING: false // No external error reporting
}
```

**UI Behavior:**
- **Login Flow:** Bypassed, uses dummy token
- **Admin Panel:** Fully accessible without role checks
- **Training Features:** Enabled for testing feedback flows
- **Error Messages:** Display full technical details
- **Rate Limiting:** No request throttling
- **Cache Notices:** Hidden (cache disabled)

### CI/Staging Environment  
**Characteristics:**
- Production-like testing
- Authentication enabled
- Rate limiting active
- Monitoring enabled

**Feature States:**
```typescript
{
  AUTH_ENABLED: true,         // Test authentication flows
  RBAC_ENABLED: true,         // Test role-based access
  ENABLE_TRAINING_PILOT: true,  // Test training workflows
  ENABLE_SEMANTIC_CACHE: true, // Test caching behavior
  ENABLE_RATE_LIMIT: true,    // Test rate limit handling
  ENABLE_OBSERVABILITY: true, // Full monitoring
  ENABLE_SENTRY_MONITORING: true // Error reporting for debugging
}
```

**UI Behavior:**
- **Login Flow:** Required, tests auth integration
- **Admin Panel:** Role-based access enforced
- **Training Features:** Enabled for workflow testing
- **Error Messages:** User-friendly with trace IDs
- **Rate Limiting:** 429 errors show retry countdown
- **Cache Notices:** Displayed when cache hit detected

### Production Environment
**Characteristics:**
- Maximum security
- Performance optimization
- Minimal debug information
- Full monitoring

**Feature States:**
```typescript
{
  AUTH_ENABLED: true,         // Required for security
  RBAC_ENABLED: true,         // Enforce access control
  ENABLE_TRAINING_PILOT: false, // Disable beta features
  ENABLE_SEMANTIC_CACHE: true, // Optimize performance
  ENABLE_RATE_LIMIT: true,    // Protect against abuse
  ENABLE_OBSERVABILITY: true, // Monitor production issues
  ENABLE_SENTRY_MONITORING: true // Report production errors
}
```

**UI Behavior:**
- **Login Flow:** Mandatory security enforcement
- **Admin Panel:** Strict RBAC with audit logging
- **Training Features:** Hidden from general users
- **Error Messages:** User-friendly, no technical details
- **Rate Limiting:** Enforced with user-friendly messages
- **Cache Notices:** Simple cache indicator

## 🎮 Feature Flag Implementation

### Centralized Access Pattern
Use **[`useFeatureFlag`](../frontend/src/hooks/useFeatureFlag.ts:139)** hook for consistent access:

```typescript
import { useFeatureFlag, useAllFeatureFlags } from '../hooks/useFeatureFlag';

export function LoginPage() {
  const authEnabled = useFeatureFlag('AUTH_ENABLED');
  
  if (!authEnabled) {
    // Local development - skip login
    return <DummyAuthSuccess />;
  }
  
  return <LoginForm />;
}

export function AdminPanel() {
  const hasAdminAccess = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
  
  if (!hasAdminAccess) {
    return <AccessDenied message="Admin features require authentication" />;
  }
  
  return <AdminUI />;
}
```

### Environment-Specific Components

#### Training Features
```typescript
export function TrainingTab() {
  const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
  const isProduction = useEnvironmentFlag(['production']);
  
  // Hide in production, even if accidentally enabled
  if (isProduction && !trainingEnabled) {
    return null;
  }
  
  if (!trainingEnabled) {
    return (
      <ComingSoonBanner 
        feature="Training Pilot"
        message="This feature is being tested and will be available soon."
      />
    );
  }
  
  return <TrainingPilotUI />;
}
```

#### Cache Notification
```typescript
export function CacheNotice({ response }: { response: Response }) {
  const cacheEnabled = useFeatureFlag('ENABLE_SEMANTIC_CACHE');
  const cacheHit = response.headers.get('X-Cache') === 'HIT';
  
  if (!cacheEnabled || !cacheHit) {
    return null;
  }
  
  return (
    <div className="cache-notice bg-blue-50 border border-blue-200 rounded p-2 text-sm">
      ℹ️ This result was cached from a previous query and may not be current
    </div>
  );
}
```

#### Rate Limit Handler
```typescript
export function RateLimitNotice({ error }: { error: ErrorResponse }) {
  const rateLimitEnabled = useFeatureFlag('ENABLE_RATE_LIMIT');
  const isRateLimit = error.error_code === 'RATE_LIMIT_EXCEEDED';
  
  if (!rateLimitEnabled || !isRateLimit) {
    return null;
  }
  
  const retryAfter = error.retry_after || 30;
  
  return (
    <div className="rate-limit-notice bg-yellow-50 border border-yellow-200 rounded p-3">
      <div className="flex items-center gap-2">
        <span>⏱️</span>
        <span>Rate limit exceeded. Please wait {retryAfter} seconds before trying again.</span>
      </div>
      <RetryCountdown seconds={retryAfter} />
    </div>
  );
}
```

## 🔒 Security Adaptations

### Token Management by Environment
```typescript
export class TokenManager {
  constructor(private config: EnvironmentConfig) {}
  
  async ensureValidToken(): Promise<string> {
    // Local development - use dummy token
    if (!this.config.backend.AUTH_ENABLED) {
      return 'dummy-token-for-dev';
    }
    
    // Production/staging - full token management
    if (!this.token || this.isTokenExpiringSoon()) {
      await this.refreshToken();
    }
    
    return this.token;
  }
  
  private isTokenExpiringSoon(): boolean {
    if (!this.config.backend.AUTH_ENABLED) {
      return false; // Dummy tokens never expire
    }
    
    // Normal token expiry logic for auth-enabled environments
    const timeUntilExpiry = this.getTimeUntilExpiry();
    return timeUntilExpiry !== null && timeUntilExpiry < this.refreshThreshold;
  }
}
```

### API Request Headers by Environment
```typescript
const makeRequest = async (url: string, options: RequestInit = {}) => {
  const config = await detectEnvironment();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add auth header if enabled
  if (config.backend.AUTH_ENABLED) {
    const token = await tokenManager.ensureValidToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Add trace headers for observability
  if (config.backend.ENABLE_OBSERVABILITY) {
    headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36)}`;
  }
  
  return fetch(url, {
    ...options,
    headers
  });
};
```

## 📊 Monitoring & Observability

### Environment-Aware Logging
```typescript
export function useEnvironmentLogging() {
  const config = useBackendConfig();
  const buildConfig = useBuildConfig();
  
  const log = (level: string, message: string, data?: any) => {
    // Local development - verbose console logging
    if (buildConfig?.DEBUG) {
      console[level](`[${level.toUpperCase()}] ${message}`, data);
    }
    
    // Staging/production - structured logging
    if (config.config?.backend.ENABLE_OBSERVABILITY) {
      const logEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        environment: config.config.environment,
        user_agent: navigator.userAgent
      };
      
      // Send to observability service
      if (window.__OBSERVABILITY_QUEUE__) {
        window.__OBSERVABILITY_QUEUE__.push(logEntry);
      }
    }
  };
  
  return { log };
}
```

### Error Reporting by Environment
```typescript
export function reportError(error: Error, context: string) {
  const config = useBackendConfig();
  
  // Always log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${context}] Error:`, error);
  }
  
  // Report to Sentry in staging/production
  if (config.config?.backend.ENABLE_SENTRY_MONITORING) {
    window.Sentry?.captureException(error, {
      tags: {
        environment: config.config.environment,
        context
      }
    });
  }
  
  // Track analytics in all environments with observability
  if (config.config?.backend.ENABLE_OBSERVABILITY) {
    window.gtag?.('event', 'exception', {
      description: error.message,
      fatal: false
    });
  }
}
```

## 🧪 Testing Across Environments

### Environment-Specific Test Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'local',
      use: {
        baseURL: 'http://localhost:5173',
        extraHTTPHeaders: {
          'X-Test-Environment': 'local'
        }
      }
    },
    {
      name: 'staging',
      use: {
        baseURL: 'https://app-staging.easyok.com',
        extraHTTPHeaders: {
          'X-Test-Environment': 'staging'
        }
      }
    }
  ]
});
```

### Feature Flag Testing
```typescript
// Test feature flag behavior across environments
test.describe('Feature Flag Behavior', () => {
  test('should skip authentication in local environment', async ({ page }) => {
    // Mock local health response
    await page.route('/api/v1/health', route => {
      route.fulfill({
        json: {
          status: 'healthy',
          features: {
            auth_enabled: false,
            rbac_enabled: false
          }
        }
      });
    });
    
    await page.goto('/');
    
    // Should go directly to main app without login
    await expect(page.locator('#chat-interface')).toBeVisible();
    await expect(page.locator('#login-form')).not.toBeVisible();
  });
  
  test('should require authentication in production', async ({ page }) => {
    // Mock production health response
    await page.route('/api/v1/health', route => {
      route.fulfill({
        json: {
          status: 'healthy',
          features: {
            auth_enabled: true,
            rbac_enabled: true
          }
        }
      });
    });
    
    await page.goto('/');
    
    // Should redirect to login
    await expect(page.locator('#login-form')).toBeVisible();
  });
});
```

## 🔧 Configuration Validation

### Runtime Configuration Checks
```typescript
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const warnings: string[] = [];
  
  // Security checks
  if (config.environment === 'production' && config.build.DEBUG) {
    warnings.push('DEBUG mode enabled in production');
  }
  
  if (config.environment === 'production' && !config.backend.AUTH_ENABLED) {
    warnings.push('Authentication disabled in production');
  }
  
  if (config.environment === 'production' && !config.backend.RBAC_ENABLED) {
    warnings.push('RBAC disabled in production');
  }
  
  // Feature consistency
  if (config.backend.RBAC_ENABLED && !config.backend.AUTH_ENABLED) {
    warnings.push('RBAC enabled but authentication disabled');
  }
  
  if (config.environment === 'production' && config.backend.ENABLE_TRAINING_PILOT) {
    warnings.push('Training pilot enabled in production');
  }
  
  // Performance checks
  if (config.environment === 'production' && !config.backend.ENABLE_RATE_LIMIT) {
    warnings.push('Rate limiting disabled in production');
  }
  
  return warnings;
}
```

### Configuration Debug Component
```typescript
export function ConfigDebugPanel() {
  const { config, isLoading, error } = useBackendConfig();
  const isProduction = config?.environment === 'production';
  
  // Hide in production unless explicitly enabled
  if (isProduction && !config?.build.DEBUG) {
    return null;
  }
  
  const warnings = config ? validateEnvironmentConfig(config) : [];
  
  return (
    <div className="config-debug fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg max-w-md">
      <h3 className="font-bold mb-2">Environment Debug</h3>
      
      <div className="text-sm space-y-1">
        <div>Environment: {config?.environment || 'Unknown'}</div>
        <div>Auth: {config?.backend.AUTH_ENABLED ? '✅' : '❌'}</div>
        <div>RBAC: {config?.backend.RBAC_ENABLED ? '✅' : '❌'}</div>
        <div>Training: {config?.backend.ENABLE_TRAINING_PILOT ? '✅' : '❌'}</div>
        <div>Cache: {config?.backend.ENABLE_SEMANTIC_CACHE ? '✅' : '❌'}</div>
      </div>
      
      {warnings.length > 0 && (
        <div className="mt-2 p-2 bg-yellow-600 rounded text-xs">
          <div className="font-bold">⚠️ Config Warnings:</div>
          {warnings.map((warning, i) => (
            <div key={i}>• {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 📚 Related Documentation

- **[`../frontend/src/utils/environmentDetection.ts`](../frontend/src/utils/environmentDetection.ts)** - Environment detection implementation
- **[`../frontend/src/hooks/useFeatureFlag.ts`](../frontend/src/hooks/useFeatureFlag.ts)** - Feature flag hooks
- **[`../api/endpoints.md`](../api/endpoints.md)** - `/health` endpoint details
- **[`../governance/frontend-rules.md`](../governance/frontend-rules.md)** - Rule #10 (no hardcoded assumptions)

---

## 📋 Environment Checklist

### Local Development Setup
- [ ] `.env.local` configured with local backend URL
- [ ] Debug logging enabled
- [ ] Authentication disabled for faster development
- [ ] All training features accessible
- [ ] No external monitoring enabled

### CI/Staging Deployment
- [ ] `.env.ci` configured with staging backend URL
- [ ] Authentication enabled and tested
- [ ] Rate limiting functional
- [ ] Monitoring and error reporting enabled
- [ ] Training features available for testing

### Production Deployment
- [ ] `.env.production` with production backend URL
- [ ] Authentication and RBAC enforced
- [ ] Training features disabled
- [ ] Full monitoring and error reporting
- [ ] Performance optimization enabled
- [ ] Security configuration validated

### Feature Flag Testing
- [ ] All feature combinations tested in CI
- [ ] Authentication flow tested across environments
- [ ] Admin features properly restricted
- [ ] Training features hidden in production
- [ ] Rate limiting behavior verified
- [ ] Cache notifications working correctly
