# API Endpoints Reference

**Target Audience:** Frontend Developers  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document provides a comprehensive reference for all backend endpoints used by the frontend. Each endpoint includes HTTP method, path, request/response schemas, and example usage.

## 🔐 Authentication

Most endpoints require authentication via Bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

Endpoints marked as **Public** do not require authentication.

## 📡 Base URLs by Environment

| Environment | Base URL |
|------------|----------|
| Local | `http://localhost:8000` |
| CI/Staging | `https://api-staging.easyok.com` |
| Production | `https://api.easyok.com` |

Use **[`environmentDetection.ts`](../frontend/src/utils/environmentDetection.ts:139)** for runtime detection.

## 🏥 Health & Status Endpoints

### GET /api/v1/health
**Purpose:** Service health check and feature flag discovery  
**Authentication:** Public  
**Used by:** **[`environmentDetection.ts`](../frontend/src/utils/environmentDetection.ts:139)**

#### Request
```http
GET /api/v1/health
Accept: application/json
```

#### Response (200 OK)
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

#### Frontend Usage
```typescript
const config = await detectEnvironment();
console.log('Backend features:', config.backend);
```

---

## 🔑 Authentication Endpoints

### POST /api/v1/auth/token
**Purpose:** User login and token acquisition  
**Authentication:** Public  
**Used by:** Login components

#### Request
```http
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=secretpassword&grant_type=password
```

#### Response (200 OK)
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Response (401 Unauthorized)
```json
{
  "message": "Invalid credentials",
  "error_code": "INVALID_CREDENTIALS",
  "trace_id": "req_1704067200_abcd1234"
}
```

#### Frontend Usage
```typescript
const tokenManager = getTokenManager();
const response = await fetch('/api/v1/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username, password, grant_type: 'password' })
});

if (response.ok) {
  const { access_token } = await response.json();
  tokenManager.setToken(access_token);
}
```

### POST /api/v1/auth/refresh
**Purpose:** Token refresh to extend session  
**Authentication:** Required (Bearer token)  
**Used by:** **[`TokenManager`](../frontend/src/api/tokenManager.ts:33)**

#### Request
```http
POST /api/v1/auth/refresh
Authorization: Bearer <current_token>
Content-Type: application/json
```

#### Response (200 OK)
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

#### Response (401 Unauthorized)
```json
{
  "message": "Refresh token expired",
  "error_code": "TOKEN_EXPIRED",
  "trace_id": "req_1704067200_efgh5678"
}
```

#### Frontend Usage
```typescript
// Automatic handling via TokenManager
const validToken = await tokenManager.ensureValidToken();
```

---

## 💬 Chat & Query Endpoints

### POST /api/v1/chat/ask
**Purpose:** Submit question and receive streaming NDJSON response  
**Authentication:** Required  
**Used by:** **[`Chat`](../frontend/src/components/Chat.tsx:38)** component

#### Request
```http
POST /api/v1/chat/ask
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "What are the top 5 customers by revenue?",
  "stream": true
}
```

#### Response (200 OK - NDJSON Stream)
```
{"type": "thinking", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:00.000Z", "payload": {"content": "Analyzing customer revenue data..."}}
{"type": "technical_view", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:01.000Z", "payload": {"sql": "SELECT customer_name, SUM(order_value) as revenue FROM orders GROUP BY customer_name ORDER BY revenue DESC LIMIT 5", "assumptions": ["Using latest order data", "Excluding cancelled orders"], "is_safe": true, "policy_hash": "policy_v1_abc123"}}
{"type": "data", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:02.000Z", "payload": [{"customer_name": "ACME Corp", "revenue": 150000}, {"customer_name": "Tech Solutions", "revenue": 120000}]}
{"type": "business_view", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:03.000Z", "payload": {"text": "Based on the analysis, ACME Corp is your top customer...", "metrics": {"total_customers": 2, "total_revenue": 270000}}}
{"type": "end", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:04.000Z", "payload": {"message": "Query completed successfully", "total_chunks": 5}}
```

#### Error Response (Stream)
```
{"type": "error", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:05.000Z", "payload": {"message": "Table 'customers' access denied", "error_code": "TABLE_ACCESS_DENIED", "details": {"table": "customers", "required_permission": "READ"}}}
{"type": "end", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:06.000Z", "payload": {"message": "Query failed", "total_chunks": 2}}
```

#### Frontend Usage
```typescript
const { start } = useEasyStream();
await start({ question: userQuestion, stream: true }, handleChunk);
```

### POST /api/v1/chat/feedback
**Purpose:** Submit feedback on query results  
**Authentication:** Required  
**Used by:** **[`TechnicalViewPanel`](../frontend/src/components/TechnicalViewPanel.tsx:30)** feedback

#### Request
```http
POST /api/v1/chat/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "trace_id": "trace_abc123",
  "feedback_type": "incorrect_result",
  "message": "The SQL query returned wrong data",
  "context": {
    "sql": "SELECT...",
    "expected": "Different results",
    "actual": "Current results"
  }
}
```

#### Response (201 Created)
```json
{
  "feedback_id": "feedback_xyz789",
  "trace_id": "trace_abc123",
  "status": "received",
  "message": "Feedback submitted successfully"
}
```

#### Frontend Usage
```typescript
const submitFeedback = async (traceId: string, message: string) => {
  await fetch('/api/v1/chat/feedback', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getValidToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trace_id: traceId,
      feedback_type: 'incorrect_result',
      message
    })
  });
};
```

---

## 📊 Training & Admin Endpoints

### GET /api/v1/training/items
**Purpose:** Get training items for review  
**Authentication:** Required (RBAC: admin)  
**Used by:** Training admin components

#### Request
```http
GET /api/v1/training/items?status=pending&limit=50
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "items": [
    {
      "id": "training_001",
      "question": "Show me sales data",
      "sql": "SELECT * FROM sales",
      "status": "pending",
      "created_at": "2025-12-31T01:00:00.000Z",
      "feedback_count": 3
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

#### Frontend Usage
```typescript
const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
const canAccess = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);

if (trainingEnabled && canAccess) {
  const items = await fetchTrainingItems();
}
```

### POST /api/v1/training/approve/{item_id}
**Purpose:** Approve training item  
**Authentication:** Required (RBAC: admin)

#### Request
```http
POST /api/v1/training/approve/training_001
Authorization: Bearer <token>
Content-Type: application/json

{
  "approved": true,
  "notes": "SQL looks correct for this use case"
}
```

#### Response (200 OK)
```json
{
  "item_id": "training_001",
  "status": "approved",
  "approved_by": "admin@example.com",
  "approved_at": "2025-12-31T01:00:00.000Z"
}
```

---

## ⚙️ Admin Feature Toggle Endpoints

### GET /api/v1/admin/feature-toggles
**Purpose:** Get current feature toggle states  
**Authentication:** Required (RBAC: admin)  
**Used by:** Admin feature toggle panel

#### Request
```http
GET /api/v1/admin/feature-toggles
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "toggles": {
    "AUTH_ENABLED": {
      "value": true,
      "immutable": true,
      "description": "Enable authentication system"
    },
    "ENABLE_TRAINING_PILOT": {
      "value": false,
      "immutable": false,
      "description": "Enable training pilot features"
    }
  },
  "immutable_toggles": ["AUTH_ENABLED", "RBAC_ENABLED"]
}
```

#### Frontend Usage
```typescript
const immutableToggles = useImmutableToggles();
const isReadOnly = immutableToggles.includes('AUTH_ENABLED');
```

### PUT /api/v1/admin/feature-toggles/{toggle_name}
**Purpose:** Update feature toggle value  
**Authentication:** Required (RBAC: admin)

#### Request
```http
PUT /api/v1/admin/feature-toggles/ENABLE_TRAINING_PILOT
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": true,
  "reason": "Enabling for beta testing"
}
```

#### Response (200 OK)
```json
{
  "toggle_name": "ENABLE_TRAINING_PILOT",
  "old_value": false,
  "new_value": true,
  "updated_by": "admin@example.com",
  "updated_at": "2025-12-31T01:00:00.000Z"
}
```

#### Response (400 Bad Request - Immutable Toggle)
```json
{
  "message": "Feature toggle cannot be modified",
  "error_code": "FEATURE_TOGGLE_IMMUTABLE",
  "trace_id": "req_1704067200_ijkl9012",
  "details": {
    "toggle_name": "AUTH_ENABLED",
    "reason": "This toggle is marked as immutable"
  }
}
```

---

## 🔍 Analytics & Observability Endpoints

### GET /api/v1/analytics/usage
**Purpose:** Get usage analytics  
**Authentication:** Required (RBAC: admin)  
**Used by:** Analytics dashboard

#### Request
```http
GET /api/v1/analytics/usage?date_range=7d&metric=query_count
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "metric": "query_count",
  "date_range": "7d",
  "data": [
    {
      "date": "2025-12-31",
      "value": 1250
    },
    {
      "date": "2025-12-30", 
      "value": 1100
    }
  ],
  "total": 8750
}
```

### GET /api/v1/observability/traces/{trace_id}
**Purpose:** Get trace details for debugging  
**Authentication:** Required  
**Used by:** Error debugging

#### Request
```http
GET /api/v1/observability/traces/trace_abc123
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "trace_id": "trace_abc123",
  "spans": [
    {
      "span_id": "span_001",
      "operation": "query_generation",
      "duration_ms": 150,
      "status": "success"
    }
  ],
  "total_duration_ms": 2300,
  "status": "success"
}
```

---

## 📋 Query Catalog Endpoints

### GET /api/v1/catalog/schemas
**Purpose:** Get available database schemas  
**Authentication:** Required  
**Used by:** Schema selection components

#### Request
```http
GET /api/v1/catalog/schemas
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "schemas": [
    {
      "name": "sales",
      "description": "Sales and customer data",
      "table_count": 8,
      "accessible": true
    },
    {
      "name": "hr",
      "description": "Human resources data", 
      "table_count": 5,
      "accessible": false
    }
  ]
}
```

### GET /api/v1/catalog/tables
**Purpose:** Get accessible tables for query building  
**Authentication:** Required

#### Request
```http
GET /api/v1/catalog/tables?schema=sales
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "schema": "sales",
  "tables": [
    {
      "name": "customers",
      "description": "Customer master data",
      "column_count": 12,
      "row_estimate": 50000,
      "accessible": true
    },
    {
      "name": "orders",
      "description": "Order transactions",
      "column_count": 8,
      "row_estimate": 250000,
      "accessible": true
    }
  ]
}
```

---

## 🚨 Error Responses

All endpoints follow consistent error response format:

### Standard Error Schema
```json
{
  "message": "Human-readable error description",
  "error_code": "MACHINE_READABLE_CODE",
  "trace_id": "req_1704067200_abcd1234",
  "details": {
    "field_name": "Additional context",
    "suggested_action": "What user should do"
  },
  "retry_after": 30
}
```

### Common Error Codes by Endpoint

| Endpoint | Common Errors |
|----------|---------------|
| `/auth/token` | `INVALID_CREDENTIALS`, `RATE_LIMIT_EXCEEDED` |
| `/auth/refresh` | `TOKEN_EXPIRED`, `TOKEN_INVALID` |
| `/chat/ask` | `POLICY_VIOLATION`, `SQL_EXECUTION_FAILED`, `LLM_SERVICE_UNAVAILABLE` |
| `/admin/feature-toggles` | `FEATURE_TOGGLE_IMMUTABLE`, `FORBIDDEN` |
| `/training/*` | `TRAINING_VALIDATION_FAILED`, `TRAINING_ITEM_NOT_FOUND` |

For complete error handling strategies, see **[`api/errors.md`](errors.md)**.

---

## 🔗 Frontend Integration Patterns

### Token Management Integration
```typescript
// All API calls should use TokenManager for authentication
const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  const token = await getValidToken();
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};
```

### Error Handling Integration
```typescript
// Use ErrorHandler for consistent error processing
const handleApiResponse = async (response: Response, requestId?: string) => {
  if (!response.ok) {
    const errorHandler = getErrorHandler();
    const error = await ErrorHandler.parseErrorFromResponse(response);
    const handling = await errorHandler.handleError(error, requestId);
    
    if (handling.shouldRetry) {
      // Implement retry logic
      await new Promise(resolve => setTimeout(resolve, handling.retryAfterMs));
      return makeAuthenticatedRequest(response.url);
    }
    
    throw new Error(handling.userMessage);
  }
  
  return response.json();
};
```

### Feature Flag Integration
```typescript
// Check features before making admin requests
const AdminComponent = () => {
  const hasAdminAccess = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
  
  const handleToggleUpdate = async (toggleName: string, value: boolean) => {
    if (!hasAdminAccess) {
      throw new Error('Admin access required');
    }
    
    await makeAuthenticatedRequest(`/api/v1/admin/feature-toggles/${toggleName}`, {
      method: 'PUT',
      body: JSON.stringify({ value })
    });
  };
  
  return hasAdminAccess ? <AdminPanel /> : <AccessDenied />;
};
```

---

## 📚 Related Documentation

- **[`streaming.md`](streaming.md)** - NDJSON streaming protocol details
- **[`errors.md`](errors.md)** - Complete error handling guide
- **[`../environment/frontend-behavior.md`](../environment/frontend-behavior.md)** - Feature flag behavior matrix
- **[`../governance/frontend-rules.md`](../governance/frontend-rules.md)** - API usage governance rules

---

## 🔄 API Versioning

All endpoints use `/api/v1/` prefix. Breaking changes will increment the version number. The frontend should handle version detection via the health endpoint.

### Version Compatibility
- **v1.x** - Current stable version
- **v2.x** - Future version (backward compatibility maintained)

Monitor the `version` field in health endpoint responses for API version updates.
