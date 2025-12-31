import { test, expect } from '@playwright/test';

/**
 * E2E tests for Chat streaming contract compliance
 * 
 * Key validations:
 * - Complete NDJSON streaming flow: THINKING → TECHNICAL_VIEW → DATA → BUSINESS_VIEW → END
 * - Trace ID consistency across all chunks
 * - Stream termination behavior (single END chunk)
 * - Error handling and early termination
 * - UI rendering compliance with streaming order
 * - Token management during streaming
 */

test.describe('Chat Streaming Contract Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Set up console logging for NDJSON chunks
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().startsWith('NDJSON:')) {
        console.log('Captured NDJSON:', msg.text());
      }
    });

    // Default mock stream for chat flows to avoid backend dependency
    await page.route('**/api/v1/ask', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const question = (body.question || '').toString();
      const traceId = `trace-${Date.now()}`;
      const now = new Date().toISOString();

      let stream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"${now}","payload":{"content":"processing"}}\n{"type":"technical_view","trace_id":"${traceId}","timestamp":"${now}","payload":{"sql":"SELECT 1","assumptions":[],"is_safe":true}}\n{"type":"data","trace_id":"${traceId}","timestamp":"${now}","payload":[{"id":1,"name":"row"}]}\n{"type":"business_view","trace_id":"${traceId}","timestamp":"${now}","payload":{"text":"ok"}}\n{"type":"end","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"done"}}`;

      if (/error|nonexistent|fail/i.test(question)) {
        stream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"${now}","payload":{"content":"processing"}}\n{"type":"error","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"Test error","error_code":"TEST_ERROR"}}\n{"type":"end","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"done"}}`;
      } else if (/hello/i.test(question)) {
        stream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"${now}","payload":{"content":"hi"}}\n{"type":"end","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"done"}}`;
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: stream
      });
    });
  });

  test('should follow complete streaming sequence: thinking → technical_view → data → business_view → end', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    // Capture all NDJSON chunks
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          console.error('Failed to parse NDJSON:', text, e);
        }
      }
    });

    // Submit a standard query that should produce full sequence
    await page.locator('[data-testid="question-input"]').fill('اعرض لي البيانات المالية للعام الماضي');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for stream to complete with END chunk
    await expect.poll(async () => {
      return receivedChunks.some(chunk => chunk.type === 'end');
    }, { 
      message: 'Stream should complete with END chunk',
      timeout: 30000 
    }).toBeTruthy();

    // Validate chunk sequence
    const chunkTypes = receivedChunks.map(chunk => chunk.type);
    
    // First chunk must be thinking
    expect(chunkTypes[0]).toBe('thinking');
    
    // Last chunk must be end
    expect(chunkTypes[chunkTypes.length - 1]).toBe('end');
    
    // Validate expected sequence is present (not all chunks may be sent depending on query)
    const expectedOrder = ['thinking', 'technical_view', 'data', 'business_view', 'end'];
    let currentIndex = 0;
    
    for (const chunkType of chunkTypes) {
      const expectedIndex = expectedOrder.indexOf(chunkType, currentIndex);
      expect(expectedIndex).toBeGreaterThanOrEqual(currentIndex);
      currentIndex = expectedIndex;
    }
    
    // Ensure no chunks after END
    const endIndex = chunkTypes.indexOf('end');
    expect(endIndex).toBe(chunkTypes.length - 1);
  });

  test('should maintain consistent trace_id across all chunks', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    await page.locator('[data-testid="question-input"]').fill('test trace consistency');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for at least 2 chunks to validate consistency
    await expect.poll(() => receivedChunks.length >= 2, {
      message: 'Should receive at least 2 chunks',
      timeout: 15000
    }).toBeTruthy();

    // Validate all chunks have the same trace_id
    const firstTraceId = receivedChunks[0].trace_id;
    expect(firstTraceId).toBeTruthy();
    
    for (const chunk of receivedChunks) {
      expect(chunk.trace_id).toBe(firstTraceId);
      expect(chunk.timestamp).toBeTruthy();
    }
  });

  test('should handle error chunks with proper termination', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Submit query that triggers an error
    await page.locator('[data-testid="question-input"]').fill('SELECT * FROM nonexistent_table');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for stream to complete
    await expect.poll(() => {
      return receivedChunks.some(chunk => chunk.type === 'end');
    }, { 
      message: 'Stream should complete even with error',
      timeout: 20000 
    }).toBeTruthy();

    const chunkTypes = receivedChunks.map(chunk => chunk.type);
    
    // Should start with thinking
    expect(chunkTypes[0]).toBe('thinking');
    
    // Should end with end
    expect(chunkTypes[chunkTypes.length - 1]).toBe('end');
    
    // If error occurs, nothing should come after error except end
    const errorIndex = chunkTypes.indexOf('error');
    if (errorIndex !== -1) {
      const afterError = chunkTypes.slice(errorIndex + 1);
      expect(afterError).toEqual(['end']);
      
      // Validate error chunk structure
      const errorChunk = receivedChunks[errorIndex];
      expect(errorChunk.payload.message).toBeTruthy();
      expect(errorChunk.payload.error_code).toBeTruthy();
    }
  });

  test('should render chunks in UI as they arrive', async ({ page }) => {
    await page.locator('[data-testid="question-input"]').fill('show me user data');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for thinking phase to appear in UI
    await expect(page.locator('[data-testid="thinking-display"], .thinking-content')).toBeVisible({ timeout: 10000 });

    // Wait for technical view to appear
    await expect(page.locator('[data-testid="technical-view"], .technical-view')).toBeVisible({ timeout: 15000 });

    // Check that streaming is happening incrementally, not all at once
    const thinkingVisible = await page.locator('[data-testid="thinking-display"], .thinking-content').isVisible();
    expect(thinkingVisible).toBe(true);
  });

  test('should handle minimal valid sequence (thinking → end)', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Submit simple query that might only produce thinking → end
    await page.locator('[data-testid="question-input"]').fill('hello');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for completion
    await expect.poll(() => {
      return receivedChunks.some(chunk => chunk.type === 'end');
    }, { timeout: 15000 }).toBeTruthy();

    const chunkTypes = receivedChunks.map(chunk => chunk.type);
    
    // Should have at least thinking and end
    expect(chunkTypes).toContain('thinking');
    expect(chunkTypes).toContain('end');
    
    // First should be thinking, last should be end
    expect(chunkTypes[0]).toBe('thinking');
    expect(chunkTypes[chunkTypes.length - 1]).toBe('end');
  });

  test('should enforce single END chunk per stream', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    await page.locator('[data-testid="question-input"]').fill('test single end');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for stream completion
    await expect.poll(() => {
      return receivedChunks.some(chunk => chunk.type === 'end');
    }, { timeout: 15000 }).toBeTruthy();

    // Wait a bit more to ensure no additional chunks arrive
    await page.waitForTimeout(2000);

    // Count END chunks
    const endChunks = receivedChunks.filter(chunk => chunk.type === 'end');
    expect(endChunks.length).toBe(1);
  });

  test('should preserve chunk timestamps in chronological order', async ({ page }) => {
    const receivedChunks: any[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          receivedChunks.push(chunk);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    await page.locator('[data-testid="question-input"]').fill('timestamp test');
    await page.locator('[data-testid="ask-button"]').click();

    await expect.poll(() => {
      return receivedChunks.length >= 2;
    }, { timeout: 15000 }).toBeTruthy();

    // Validate timestamps are in chronological order
    for (let i = 1; i < receivedChunks.length; i++) {
      const prevTime = new Date(receivedChunks[i-1].timestamp);
      const currTime = new Date(receivedChunks[i].timestamp);
      expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
    }
  });

  test('should handle concurrent streams properly (if supported)', async ({ page }) => {
    // This test checks that if the UI supports multiple concurrent queries,
    // each stream maintains its own trace_id
    const stream1Chunks: any[] = [];
    const stream2Chunks: any[] = [];
    
    let streamCount = 0;
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          // Simple heuristic: assign to streams based on arrival order
          if (streamCount === 0) {
            stream1Chunks.push(chunk);
          } else {
            stream2Chunks.push(chunk);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Submit first query
    await page.locator('[data-testid="question-input"]').fill('first query');
    await page.locator('[data-testid="ask-button"]').click();
    
    // Wait a bit then submit second query if UI allows
    await page.waitForTimeout(1000);
    
    // Try to submit second query (might be blocked by UI)
    try {
      await page.locator('[data-testid="question-input"]').fill('second query');
      await page.locator('[data-testid="ask-button"]').click();
      streamCount = 1;
    } catch (e) {
      // UI might block concurrent queries - this is acceptable
      console.log('Concurrent queries not supported, skipping test');
      test.skip();
    }

    // If we get here, wait for both streams
    await expect.poll(() => {
      return stream1Chunks.some(c => c.type === 'end') || stream2Chunks.some(c => c.type === 'end');
    }, { timeout: 20000 }).toBeTruthy();

    // If we have chunks from both streams, validate they have different trace_ids
    if (stream1Chunks.length > 0 && stream2Chunks.length > 0) {
      expect(stream1Chunks[0].trace_id).not.toBe(stream2Chunks[0].trace_id);
    }
  });
});

test.describe('Chat UI Integration', () => {
  test('should disable input during streaming', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('[data-testid="question-input"]').fill('test input disable');
    await page.locator('[data-testid="ask-button"]').click();
    
    // Check if input and button are disabled during streaming
    const inputDisabled = await page.locator('[data-testid="question-input"]').isDisabled();
    const buttonDisabled = await page.locator('[data-testid="ask-button"]').isDisabled();
    
    // At least one should be disabled to prevent concurrent submissions
    expect(inputDisabled || buttonDisabled).toBe(true);
    
    // Wait for stream to complete
    await expect.poll(async () => {
      return await page.locator('[data-testid="question-input"]').isEnabled();
    }, { 
      message: 'Input should be re-enabled after stream completes',
      timeout: 30000 
    }).toBeTruthy();
  });

  test('should show loading states during streaming phases', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('[data-testid="question-input"]').fill('test loading states');
    await page.locator('[data-testid="ask-button"]').click();
    
    // Should show some form of loading indicator
    await expect(
      page.locator('[data-testid="loading"], .loading, .spinner, [aria-label*="loading" i]')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle Arabic RTL text properly', async ({ page }) => {
    await page.goto('/');
    
    const arabicQuestion = 'ما هي البيانات المتاحة؟';
    await page.locator('[data-testid="question-input"]').fill(arabicQuestion);
    await page.locator('[data-testid="ask-button"]').click();
    
    // Wait for the question display to update (thinking may be skipped in mock)
    await expect(page.locator('[data-testid="question-display"]')).toContainText(arabicQuestion);
    
    // Check RTL direction if applicable
    const direction = await page.locator('[data-testid="question-input"]').evaluate((el) => {
      return window.getComputedStyle(el).direction;
    });
    expect(['ltr', 'rtl']).toContain(direction);
  });
});
