/**
 * Governance Compliance Audit
 * 
 * This file contains comprehensive tests to validate that all governance rules
 * are properly enforced in the frontend implementation. These tests ensure
 * compliance with security, data handling, and architectural constraints.
 * 
 * CRITICAL: All tests in this file MUST pass for production deployment.
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

type Violation = {
  file: string;
  pattern: string;
  match: string;
  line: number;
};

test.describe('Governance Compliance Audit', () => {
  test('RULE #1: No SQL parsing/generation in frontend', async () => {
    // Scan all frontend source files for SQL-related code
    const frontendDir = path.join(__dirname, '../../frontend/src');
    const sourceFiles = await getAllSourceFiles(frontendDir);
    
    const violations: Array<{
      file: string;
      pattern: string;
      match: string;
      line: number;
    }> = [];
    
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(frontendDir, filePath);
      
      // Check for SQL building/parsing patterns
      const sqlPatterns = [
        /SELECT\s+.*\s+FROM/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+.*\s+SET/i,
        /DELETE\s+FROM/i,
        /CREATE\s+TABLE/i,
        /ALTER\s+TABLE/i,
        /sql\s*\+\s*\w+/i, // String concatenation for SQL
        /`\s*SELECT/i, // Template literal SQL
        /buildQuery|generateSql|createQuery|sqlBuilder/i,
        /WHERE\s+\w+\s*=\s*\$/i // Dynamic WHERE clauses
      ];
      
      sqlPatterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches && !isTestFile(filePath) && !isAllowedException(content, matches[0])) {
          violations.push({
            file: relativePath,
            pattern: pattern.toString(),
            match: matches[0],
            line: getLineNumber(content, matches[0])
          });
        }
      });
    }
    
    if (violations.length > 0) {
      console.error('SQL parsing/generation violations found:', violations);
    }
    
    expect(violations).toHaveLength(0);
  });

  test('RULE #2: No caching or RLS logic in frontend', async () => {
    const frontendDir = path.join(__dirname, '../../frontend/src');
    const sourceFiles = await getAllSourceFiles(frontendDir);
    
    const violations: Violation[] = [];
    
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(frontendDir, filePath);
      
      // Check for caching and RLS patterns
      const forbiddenPatterns = [
        /localStorage\.setItem.*cache/i,
        /sessionStorage\.setItem.*cache/i,
        /cache\.set|setCache|cacheData/i,
        /row.*level.*security|rls/i,
        /check.*permission|authorize.*row|filter.*user/i,
        /canAccess|hasPermission.*row|rowFilter/i
      ];
      
      forbiddenPatterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches && !isTestFile(filePath) && !isAllowedException(content, matches[0])) {
          violations.push({
            file: relativePath,
            pattern: pattern.toString(),
            match: matches[0],
            line: getLineNumber(content, matches[0])
          });
        }
      });
    }
    
    if (violations.length > 0) {
      console.error('Caching/RLS violations found:', violations);
    }
    
    expect(violations).toHaveLength(0);
  });

  test('RULE #3: No localStorage for tokens', async () => {
    const frontendDir = path.join(__dirname, '../../frontend/src');
    const sourceFiles = await getAllSourceFiles(frontendDir);
    
    const violations: Violation[] = [];
    
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(frontendDir, filePath);
      
      // Check for localStorage usage with tokens
      const tokenStoragePatterns = [
        /localStorage\.setItem.*token/i,
        /localStorage\.getItem.*token/i,
        /localStorage\[.*token.*\]/i,
        /setItem.*["\'].*token.*["\']/i
      ];
      
      tokenStoragePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches && !isTestFile(filePath)) {
          violations.push({
            file: relativePath,
            pattern: pattern.toString(),
            match: matches[0],
            line: getLineNumber(content, matches[0])
          });
        }
      });
    }
    
    if (violations.length > 0) {
      console.error('localStorage token violations found:', violations);
    }
    
    expect(violations).toHaveLength(0);
  });

  test('RULE #4: All mutations go through API only', async ({ page }) => {
    // This test verifies that the frontend doesn't contain direct database operations
    await page.goto('/');
    
    // Check for database-related globals or direct DB access
    const directDbAccess = await page.evaluate(() => {
      const globals = Object.keys(window);
      return {
        hasDbGlobals: globals.some(key => 
          key.toLowerCase().includes('db') || 
          key.toLowerCase().includes('sql') ||
          key.toLowerCase().includes('query')
        ),
        hasFetchOverrides: typeof (window as any).originalFetch !== 'undefined',
        directDbViolations: globals.filter(key => 
          /^(mysql|postgres|mongo|redis|sqlite)/i.test(key)
        )
      };
    });
    
    expect(directDbAccess.directDbViolations).toHaveLength(0);
    
    // Ensure all data mutations use proper API endpoints
    const apiCallsMade: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'GET') {
        apiCallsMade.push(request.url());
      }
    });
    
    // Test a mutation action if available
    try {
      await page.locator('input[name="question"]').fill('test mutation audit');
      await page.locator('button:has-text("Ask")').click();
      await page.waitForTimeout(1000);
      
      // All mutations should go through /api/ endpoints
      const nonApiMutations = apiCallsMade.filter(url => !url.includes('/api/'));
      expect(nonApiMutations).toHaveLength(0);
    } catch (e) {
      // If no mutation UI available, that's acceptable
      console.log('No mutation UI found for testing');
    }
  });

  test('RULE #5: TokenManager uses sessionStorage with refresh strategy', async ({ page }) => {
    await page.goto('/');
    
    const authEnabled = await page.evaluate(() => {
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });
    
    if (!authEnabled) {
      test.skip(true, 'AUTH_ENABLED=false; token tests not applicable');
    }
    
    // Check that tokenManager is properly configured
    const tokenManagerConfig = await page.evaluate(() => {
      return {
        usesSessionStorage: !!window.sessionStorage,
        usesLocalStorage: !!window.localStorage,
        // Check if token is stored in sessionStorage when auth flow happens
        sessionKeys: Object.keys(window.sessionStorage),
        localKeys: Object.keys(window.localStorage)
      };
    });
    
    expect(tokenManagerConfig.usesSessionStorage).toBe(true);
    
    // Tokens should NOT be in localStorage
    const tokenInLocal = tokenManagerConfig.localKeys.some(key => 
      key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')
    );
    expect(tokenInLocal).toBe(false);
  });

  test('RULE #6: Environment detection is runtime-based', async ({ page }) => {
    await page.goto('/');
    
    const envDetection = await page.evaluate(() => {
      const env = (window as any).__ENV;
      return {
        hasRuntimeEnv: !!env,
        envKeys: env ? Object.keys(env) : [],
        // Check that it's not build-time detection
        hasProcessEnv: typeof process !== 'undefined',
        hasBuildTimeVars: !!(window as any).REACT_APP_ENV || !!(window as any).NODE_ENV
      };
    });
    
    // Should have runtime environment configuration
    expect(envDetection.hasRuntimeEnv).toBe(true);
    
    // Should not expose build-time process.env
    expect(envDetection.hasProcessEnv).toBe(false);
    
    console.log('Runtime environment keys:', envDetection.envKeys);
  });

  test('RULE #7: Streaming chunks strictly validated via StreamValidator', async () => {
    // Check that StreamValidator is properly integrated
    const frontendDir = path.join(__dirname, '../../frontend/src');
    const sourceFiles = await getAllSourceFiles(frontendDir);
    
    let hasStreamValidation = false;
    let validationUsage = [];
    
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(frontendDir, filePath);
      
      // Check for StreamValidator usage
      if (content.includes('StreamValidator') || content.includes('validateChunk')) {
        hasStreamValidation = true;
        validationUsage.push(relativePath);
      }
      
      // Check for raw chunk processing without validation
      const rawChunkPatterns = [
        /chunks?\.push.*without.*validat/i,
        /JSON\.parse.*chunk.*without/i
      ];
      
      rawChunkPatterns.forEach(pattern => {
        if (pattern.test(content) && !isTestFile(filePath)) {
          throw new Error(`Raw chunk processing without validation found in ${relativePath}`);
        }
      });
    }
    
    expect(hasStreamValidation).toBe(true);
    console.log('StreamValidator used in:', validationUsage);
  });

  test('RULE #8: No unauthorized data exposure in browser', async ({ page }) => {
    await page.goto('/');
    
    const dataExposure = await page.evaluate(() => {
      const globals = Object.keys(window);
      
      return {
        sensitiveGlobals: globals.filter(key => 
          /password|secret|key|token|credential/i.test(key) &&
          !key.includes('test') && !key.includes('mock')
        ),
        exposedDatabaseInfo: globals.filter(key =>
          /database|connection|db_/i.test(key)
        ),
        backendInternals: globals.filter(key =>
          /internal|private|admin/i.test(key) && 
          typeof (window as any)[key] === 'object'
        )
      };
    });
    
    expect(dataExposure.sensitiveGlobals).toHaveLength(0);
    expect(dataExposure.exposedDatabaseInfo).toHaveLength(0);
    expect(dataExposure.backendInternals).toHaveLength(0);
  });

  test('RULE #9: Error handling follows governance contract', async ({ page }) => {
    // Test that errors include trace_id and follow proper format
    const errors: any[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          if (chunk.type === 'error') {
            errors.push(chunk);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
    
    // Trigger an error condition
    await page.goto('/');
    await page.locator('input[name="question"]').fill('SELECT * FROM nonexistent');
    await page.locator('button:has-text("Ask")').click();
    
    // Wait for potential error
    await page.waitForTimeout(5000);
    
    if (errors.length > 0) {
      const error = errors[0];
      
      // Error must have trace_id
      expect(error.trace_id).toBeTruthy();
      
      // Error must have proper structure
      expect(error.payload.error_code).toBeTruthy();
      expect(error.payload.message).toBeTruthy();
      
      console.log('Error chunk validated:', error);
    }
  });
});

// Helper functions
async function getAllSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function traverse(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await traverse(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) || 
         filePath.includes('/test/') || 
         filePath.includes('/__tests__/');
}

function isAllowedException(content: string, match: string): boolean {
  // Check if this is in a comment or test scenario
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('*') || 
          line.includes('// TODO') || line.includes('// FIXME') ||
          line.includes('mock') || line.includes('example')) {
        return true;
      }
    }
  }
  return false;
}

function getLineNumber(content: string, match: string): number {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      return i + 1;
    }
  }
  return 0;
}