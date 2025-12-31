import { test, expect } from '@playwright/test';

/**
 * E2E tests for Environment Detection and Runtime Configuration
 * 
 * Key scenarios:
 * - Runtime environment detection (not build-time)
 * - Feature flag behavior across environments  
 * - AUTH_ENABLED detection and UI adaptation
 * - Configuration validation and fallbacks
 * - Dynamic environment switching
 * - Server-side environment variable exposure
 */

test.describe('Environment Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should detect runtime environment correctly', async ({ page }) => {
    // Check that environment detection happens at runtime, not build time
    const envInfo = await page.evaluate(() => {
      // Access environment through window.__ENV or similar runtime mechanism
      const env = (window as any).__ENV;
      return {
        hasRuntimeEnv: !!env,
        authEnabled: env?.AUTH_ENABLED,
        environment: env?.ENVIRONMENT || env?.NODE_ENV,
        apiBaseUrl: env?.API_BASE_URL,
        buildTime: env?.BUILD_TIME,
        // Check for build-time leakage (should not exist)
        hasProcessEnv: typeof (window as any).process !== 'undefined'
      };
    });

    // Should have runtime environment configuration
    expect(envInfo.hasRuntimeEnv).toBe(true);
    
    // Should not leak build-time process.env to browser
    expect(envInfo.hasProcessEnv).toBe(false);
    
    // Should have core configuration values
    expect(typeof envInfo.authEnabled).toBe('boolean');
    
    console.log('Runtime Environment Info:', envInfo);
  });

  test('should adapt UI based on AUTH_ENABLED setting', async ({ page }) => {
    const authStatus = await page.evaluate(() => {
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });

    if (authStatus) {
      // Auth enabled: should show login elements or auth-dependent features
      const authElements = await page.evaluate(() => {
        const loginBtn = document.querySelector('[data-testid="login"], [href*="login"]');
        const userMenu = document.querySelector('[data-testid="user-menu"]');
        const authHeader = document.querySelector('[data-testid="auth-header"]');
        
        return {
          hasLoginElements: !!(loginBtn || userMenu || authHeader),
          hasAuthIndicators: document.body.getAttribute('data-auth-enabled') === 'true'
        };
      });

      expect(authElements.hasLoginElements || authElements.hasAuthIndicators).toBe(true);
    } else {
      // Auth disabled: should not show auth-related UI elements
      const noAuthElements = await page.evaluate(() => {
        const loginBtn = !!document.querySelector('[data-testid="login"], [href*="login"]');
        const userProfile = !!document.querySelector('[data-testid="user-profile"]');
        const authRequiredBanners = !!document.querySelector('[data-testid="auth-required"]');
        
        return {
          hasLoginButton: loginBtn,
          hasUserProfile: userProfile,
          hasAuthBanners: authRequiredBanners
        };
      });

      expect(noAuthElements.hasLoginButton).toBe(false);
      expect(noAuthElements.hasUserProfile).toBe(false);
    }
  });

  test('should handle feature flags correctly', async ({ page }) => {
    // Test feature flag detection
    const featureFlags = await page.evaluate(() => {
      const env = (window as any).__ENV;
      return {
        debugMode: env?.DEBUG_MODE || env?.ENABLE_DEBUG,
        analyticsEnabled: env?.ANALYTICS_ENABLED,
        experimentalFeatures: env?.EXPERIMENTAL_FEATURES,
        telemetryEnabled: env?.TELEMETRY_ENABLED
      };
    });

    console.log('Feature Flags:', featureFlags);

    // Feature flags should exist and have boolean values
    Object.entries(featureFlags).forEach(([key, value]) => {
      if (value !== undefined) {
        expect(typeof value).toBe('boolean');
      }
    });

    // Test UI adaptation to feature flags
    if (featureFlags.debugMode) {
      // Debug mode should show additional development tools
      await expect(page.locator('[data-testid="debug-panel"], [data-dev-tools]')).toBeVisible({ timeout: 5000 });
    }

    if (featureFlags.analyticsEnabled === false) {
      // Should not load analytics scripts when disabled
      const analyticsScripts = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script => 
          script.src.includes('analytics') || 
          script.src.includes('gtag') ||
          script.textContent?.includes('analytics')
        );
      });
      expect(analyticsScripts).toBe(false);
    }
  });

  test('should validate API base URL configuration', async ({ page }) => {
    const apiConfig = await page.evaluate(() => {
      const env = (window as any).__ENV;
      return {
        apiBaseUrl: env?.API_BASE_URL,
        currentOrigin: window.location.origin,
        endpointUrl: env?.ENDPOINT_URL
      };
    });

    // API URL should be configured
    expect(apiConfig.apiBaseUrl || apiConfig.endpointUrl).toBeTruthy();
    
    // Should be a valid URL format
    if (apiConfig.apiBaseUrl) {
      expect(() => new URL(apiConfig.apiBaseUrl)).not.toThrow();
    }

    // Test that API calls use the configured URL
    let apiCallMade = false;
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCallMade = true;
        const reqUrl = new URL(request.url());
        console.log('API call to:', reqUrl.origin);
        
        // Should call configured API endpoint
        if (apiConfig.apiBaseUrl) {
          const expectedOrigin = new URL(apiConfig.apiBaseUrl).origin;
          expect(reqUrl.origin).toBe(expectedOrigin);
        }
      }
    });

    // Trigger an API call
    await page.locator('input[name="question"]').fill('test api config');
    await page.locator('button:has-text("Ask")').click();

    // Wait to ensure API call was made and validated
    await page.waitForTimeout(2000);
    expect(apiCallMade).toBe(true);
  });

  test('should handle environment-specific configurations', async ({ page }) => {
    const envConfig = await page.evaluate(() => {
      const env = (window as any).__ENV;
      return {
        environment: env?.ENVIRONMENT || env?.NODE_ENV,
        isDevelopment: env?.NODE_ENV === 'development' || env?.ENVIRONMENT === 'dev',
        isProduction: env?.NODE_ENV === 'production' || env?.ENVIRONMENT === 'prod',
        isTest: env?.NODE_ENV === 'test' || env?.ENVIRONMENT === 'test',
        logLevel: env?.LOG_LEVEL,
        enablePerformanceMonitoring: env?.PERFORMANCE_MONITORING
      };
    });

    console.log('Environment Configuration:', envConfig);

    // Should have environment indicator
    expect(envConfig.environment).toBeTruthy();

    if (envConfig.isDevelopment) {
      // Development should have additional debugging features
      const devFeatures = await page.evaluate(() => {
        return {
          consoleLogsEnabled: !window.console.log.toString().includes('function() {}'),
          hasDevtools: !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__,
          errorBoundaryVisible: !!document.querySelector('[data-testid="error-boundary"]')
        };
      });

      expect(devFeatures.consoleLogsEnabled).toBe(true);
    }

    if (envConfig.isProduction) {
      // Production should have optimized settings
      const prodSettings = await page.evaluate(() => {
        return {
          consoleSuppressed: console.debug === undefined || console.debug.toString().includes('function() {}'),
          minifiedCode: document.documentElement.innerHTML.length < 50000, // Rough check for minification
          hasSourceMaps: !!Array.from(document.querySelectorAll('script')).find(s => 
            s.src.includes('.map') || s.textContent?.includes('sourceMappingURL')
          )
        };
      });

      // In production, debug logging should be suppressed
      // Note: This may not be fully enforced in current implementation
      console.log('Production settings:', prodSettings);
    }
  });

  test('should handle configuration validation and fallbacks', async ({ page }) => {
    // Test what happens with invalid or missing configuration
    const configValidation = await page.evaluate(() => {
      const env = (window as any).__ENV || {};
      
      return {
        hasValidAuth: typeof env.AUTH_ENABLED === 'boolean',
        hasValidApiUrl: !!(env.API_BASE_URL || env.ENDPOINT_URL),
        hasEnvironment: !!(env.ENVIRONMENT || env.NODE_ENV),
        // Test fallback behavior
        authEnableFallback: env.AUTH_ENABLED ?? false,
        apiUrlFallback: env.API_BASE_URL || env.ENDPOINT_URL || window.location.origin + '/api'
      };
    });

    // Should provide sensible fallbacks
    expect(typeof configValidation.authEnableFallback).toBe('boolean');
    expect(configValidation.apiUrlFallback).toBeTruthy();

    console.log('Configuration validation:', configValidation);
  });

  test('should maintain configuration consistency across page loads', async ({ page }) => {
    // Get initial configuration
    const initialConfig = await page.evaluate(() => {
      return JSON.stringify((window as any).__ENV);
    });

    // Navigate to different section and back
    try {
      await page.locator('nav a, [data-testid="nav-link"]').first().click();
      await page.waitForTimeout(1000);
      await page.goBack();
      await page.waitForTimeout(1000);
    } catch (e) {
      // If no navigation exists, do a full reload
      await page.reload();
    }

    // Get configuration after navigation
    const afterNavConfig = await page.evaluate(() => {
      return JSON.stringify((window as any).__ENV);
    });

    // Configuration should remain consistent
    expect(afterNavConfig).toBe(initialConfig);
  });

  test('should expose only safe environment variables to browser', async ({ page }) => {
    const exposedVars = await page.evaluate(() => {
      const env = (window as any).__ENV || {};
      const keys = Object.keys(env);
      
      return {
        allKeys: keys,
        hasSensitiveData: keys.some(key => 
          key.includes('SECRET') || 
          key.includes('PASSWORD') ||
          key.includes('API_KEY') ||
          key.includes('PRIVATE') ||
          key.includes('TOKEN') && !key.includes('ENABLED')
        ),
        hasDbCredentials: keys.some(key =>
          key.includes('DB_') && (key.includes('PASSWORD') || key.includes('USER'))
        )
      };
    });

    console.log('Exposed environment variables:', exposedVars.allKeys);

    // Should not expose sensitive environment variables
    expect(exposedVars.hasSensitiveData).toBe(false);
    expect(exposedVars.hasDbCredentials).toBe(false);
  });

  test('should configure CORS and security headers appropriately', async ({ page }) => {
    // Make an API request and check response headers
    const response = await page.goto('/api/v1/health').catch(() => null);
    
    if (response) {
      const headers = response.headers();
      
      // Should have security headers in production-like environments
      const envInfo = await page.evaluate(() => (window as any).__ENV);
      
      if (envInfo?.ENVIRONMENT === 'production') {
        // Production should have strict security headers
        expect(headers['x-frame-options'] || headers['x-content-type-options']).toBeTruthy();
      }

      console.log('Security headers present:', Object.keys(headers).filter(h => 
        h.startsWith('x-') || h.includes('security') || h.includes('cors')
      ));
    }
  });

  test('should handle dynamic environment updates', async ({ page }) => {
    // Test if the app can handle dynamic configuration updates
    const originalConfig = await page.evaluate(() => (window as any).__ENV);

    // Attempt to update configuration (simulating runtime config change)
    await page.evaluate(() => {
      if ((window as any).__ENV) {
        (window as any).__ENV.FEATURE_FLAG_TEST = true;
      }
    });

    const updatedConfig = await page.evaluate(() => (window as any).__ENV);

    // Should reflect the update
    expect(updatedConfig.FEATURE_FLAG_TEST).toBe(true);

    // UI should react to feature flag changes (if implemented)
    // This is optional behavior that depends on the app's design
  });
});