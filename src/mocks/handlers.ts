import { http, HttpResponse } from 'msw'

const mockUsers = [
  {
    id: '1',
    username: 'test-user',
    password: 'password123',
    name: 'Test User',
    role: 'admin',
  },
  {
    id: '2',
    username: 'analyst-user',
    password: 'password123',
    name: 'Analyst User',
    role: 'analyst',
  },
]

const mockQueryHistory = [
  {
    id: 'q-1',
    question: 'How many invoices this month?',
    generated_sql: "SELECT COUNT(*) FROM invoices WHERE created_at >= date_trunc('month', now())",
    status: 'completed',
    execution_time_ms: 120,
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-2',
    question: 'Revenue by customer',
    generated_sql: 'SELECT customer_id, SUM(amount) FROM invoices GROUP BY customer_id',
    status: 'completed',
    execution_time_ms: 230,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
]

const mockRequestVolume = Array.from({ length: 12 }).map((_, index) => {
  const timestamp = new Date(Date.now() - (11 - index) * 5 * 60 * 1000).toISOString()
  return { timestamp, count: 80 + index * 7 }
})

const mockLatencySeries = mockRequestVolume.map((point, index) => ({
  timestamp: point.timestamp,
  ms: 140 + Math.sin(index / 2) * 15 + index * 1.5,
}))

const mockErrorRateSeries = mockRequestVolume.map((point, index) => ({
  timestamp: point.timestamp,
  rate: Number((1.4 + Math.cos(index / 2) * 0.6).toFixed(2)),
}))

const mockAuditLogs = [
  {
    id: 'audit-1',
    userId: '1',
    action: 'publish',
    resource: 'api-catalog',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'success',
    details: { version: '1.2.0' },
  },
  {
    id: 'audit-2',
    userId: '2',
    action: 'preview',
    resource: 'api-catalog',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'success',
    details: { version: '1.2.0-rc1' },
  },
  {
    id: 'audit-3',
    userId: '1',
    action: 'update',
    resource: 'connection',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'success',
    details: { connection: 'Default Backend' },
  },
]

const plannedResponse = {
  message: 'Feature currently not available',
  status: 'planned',
}

export const handlers = [
  // Root + health/metrics
  http.get('*/', () =>
    HttpResponse.json({
      message: 'Vanna Insight Engine API 1.0.0',
      docs: '/docs',
      openapi: '/openapi.json',
      health: '/health',
      metrics: '/metrics',
    }),
  ),
  http.get('*/health', () =>
    HttpResponse.json({
      status: 'healthy',
      version: '1.0.0',
      providersActive: 1,
      dependencies: { postgres: true, redis: true, chroma: true },
      features: { circuitBreaker: true, correlationIds: true, failover: true },
    }),
  ),
  http.get('*/metrics', () =>
    HttpResponse.text(
      '# HELP api_requests_total Total API requests\n# TYPE api_requests_total counter\napi_requests_total 42\n',
      { headers: { 'Content-Type': 'text/plain' } },
    ),
  ),
  http.get('*/metrics/json', () =>
    HttpResponse.json({
      appInfo: { name: 'Vanna Insight Engine', version: '1.0.0' },
      providersTotal: 1,
      serviceStatus: 'healthy',
      dependencies: { postgres: true, redis: true, chroma: true },
      features: { circuitBreaker: true, correlationIds: true, failover: true },
    }),
  ),
  http.get('*/admin/health', () =>
    HttpResponse.json({
      status: 'healthy',
      database: 'ok',
      cache: 'ok',
      uptime: 86_400,
      timestamp: new Date().toISOString(),
    }),
  ),
  http.get('*/admin/metrics', () =>
    HttpResponse.json({
      averageQueryTime: 185,
      successRate: 99.2,
      activeQueries: 8,
      queriesPerMinute: 74,
      cpuUsage: 43.1,
      memoryUsage: 61.4,
      diskUsage: 54.2,
      requestVolumeSeries: mockRequestVolume,
      latencyP95Series: mockLatencySeries,
      errorRateSeries: mockErrorRateSeries,
    }),
  ),
  http.get('*/admin/audit-logs', () =>
    HttpResponse.json({
      items: mockAuditLogs,
      total: mockAuditLogs.length,
      page: 1,
      limit: mockAuditLogs.length,
      hasNextPage: false,
      hasPreviousPage: false,
    }),
  ),

  // Auth
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    const user = mockUsers.find((u) => u.username === body.username && u.password === body.password)

    if (!user) {
      return HttpResponse.json({ error: 'INVALID_CREDENTIALS', correlation_id: crypto.randomUUID() }, { status: 401 })
    }

    return HttpResponse.json({
      access_token: `mock-token-${user.id}`,
      token_type: 'bearer',
      user_id: user.id,
      username: user.username,
      correlation_id: 'mock-correlation',
    })
  }),
  http.post('*/api/v1/auth/signup', async ({ request }) => {
    const body = (await request.json()) as { username: string; full_name: string }
    return HttpResponse.json({
      user_id: crypto.randomUUID(),
      username: body.username,
      full_name: body.full_name,
      message: 'User created successfully',
    })
  }),
  http.post('*/api/v1/refresh-token', () =>
    HttpResponse.json({
      accessToken: `refreshed-${Date.now()}`,
      tokenType: 'Bearer',
      expiresIn: 86400,
      correlationId: 'mock-refresh',
    }),
  ),
  http.post('*/api/v1/logout', () => HttpResponse.json({ message: 'Logged out successfully' })),
  http.get('*/api/v1/auth/me', () =>
    HttpResponse.json({
      userId: '1',
      username: 'test-user',
      fullName: 'Test User',
      role: 'admin',
    }),
  ),

  // SQL endpoints
  http.post('*/api/v1/sql/generate', async ({ request }) => {
    const body = (await request.json()) as { question: string }
    return HttpResponse.json({
      queryId: crypto.randomUUID(),
      sql: 'SELECT COUNT(*) FROM invoices',
      correlationId: 'mock-generate',
      confidence: 0.94,
      intent: {
        queryType: 'COUNT',
        entities: { tables: ['invoices'] },
        filters: [],
        confidence: 0.9,
      },
      question: body.question,
    })
  }),
  http.post('*/api/v1/sql/validate', () =>
    HttpResponse.json({
      isValid: true,
      correlationId: 'mock-validate',
      issues: [],
    }),
  ),
  http.post('*/api/v1/sql/execute', async ({ request }) => {
    const body = (await request.json()) as { sql: string }
    return HttpResponse.json({
      rows: [{ count: 42 }],
      columns: ['count'],
      rowCount: 1,
      executionTimeMs: 250,
      correlationId: 'mock-execute',
      sql: body.sql,
    })
  }),
  http.get('*/api/v1/sql/history', () => HttpResponse.json(mockQueryHistory)),
  http.get('*/api/v1/sql/:queryId/followup', ({ params }) =>
    HttpResponse.json({
      suggestions: [
        `Show trend for ${params.queryId}`,
        'Add filters for last quarter',
      ],
      correlationId: 'mock-followup',
    }),
  ),
  http.post('*/api/v1/sql/summarize', () =>
    HttpResponse.json({
      summary: 'Query returns aggregate metrics for invoices.',
      correlationId: 'mock-summary',
    }),
  ),

  // Public SQL helpers (deferred UI)
  http.post('*/api/v1/generate-sql', () =>
    HttpResponse.json({
      sql: 'SELECT 1',
      correlation_id: 'public-generate',
      status: 'success',
    }),
  ),
  http.post('*/api/v1/fix-sql', () =>
    HttpResponse.json({
      sql: 'SELECT * FROM users',
      correlation_id: 'public-fix',
      status: 'success',
    }),
  ),
  http.post('*/api/v1/explain-sql', () =>
    HttpResponse.json({
      explanation: 'Counts completed orders',
      correlation_id: 'public-explain',
      status: 'success',
    }),
  ),

  // Feedback
  http.post('*/api/v1/feedback', async ({ request }) => {
    const body = (await request.json()) as { query_id: string }
    return HttpResponse.json({
      feedbackId: crypto.randomUUID(),
      queryId: body.query_id ?? 'unknown',
      status: 'recorded',
      correlationId: 'mock-feedback',
    })
  }),
  http.get('*/api/v1/feedback/:queryId', ({ params }) =>
    HttpResponse.json({
      queryId: params.queryId,
      feedbackItems: [
        {
          id: 'fb-1',
          queryId: params.queryId,
          rating: 5,
          comment: 'Great!',
          approvedForTraining: true,
          createdAt: new Date().toISOString(),
        },
      ],
      totalCount: 1,
    }),
  ),
  http.post('*/api/v1/feedback/train', () =>
    HttpResponse.json({
      trainingId: crypto.randomUUID(),
      status: 'queued',
      itemsCount: 2,
      message: 'Training job scheduled',
    }),
  ),

  // Admin governance + planned endpoints
  http.get('*/api/v1/admin/training-data', () =>
    HttpResponse.json({
      items: [
        {
          id: 'fb-1',
          queryId: 'q-1',
          rating: 5,
          comment: 'Accurate',
          approvedForTraining: true,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    }),
  ),
  http.post('*/api/v1/admin/training-data/approve', () =>
    HttpResponse.json({
      trainingId: crypto.randomUUID(),
      status: 'approved',
      itemsCount: 1,
      message: 'Feedback approved',
    }),
  ),
  http.post('*/api/v1/admin/schema/reload', () =>
    HttpResponse.json({
      status: 'reloaded',
    }),
  ),
  http.get('*/api/v1/admin/feedback/metrics', () => HttpResponse.json(plannedResponse)),
  http.post('*/api/v1/admin/training-data', () => HttpResponse.json(plannedResponse)),

  http.get('*/api/v1/admin/config', () =>
    HttpResponse.json({
      environment: 'local',
      version: '1.0.0',
      features: {
        sql_generation: true,
        scheduled_reports: false,
        sql_approval: false,
      },
    }),
  ),
  http.post('*/api/v1/admin/config', () => HttpResponse.json(plannedResponse)),
  http.post('*/api/v1/admin/approve-sql', () => HttpResponse.json(plannedResponse)),
  http.get('*/api/v1/admin/feedback-metrics', () =>
    HttpResponse.json({
      total_feedback_count: 24,
      approved_for_training_count: 10,
      average_rating: 4.3,
      queries_with_feedback: 18,
    }),
  ),
  http.post('*/api/v1/admin/scheduled/create', () => HttpResponse.json(plannedResponse)),
  http.get('*/api/v1/admin/scheduled/list', () => HttpResponse.json(plannedResponse)),
  http.delete('*/api/v1/admin/scheduled/:reportId', () => HttpResponse.json(plannedResponse)),
]
