/**
 * Environment Detection System
 * 
 * Hybrid Approach (Governance Rule #10: No hardcoded env assumptions):
 * - Build-time: Non-security config (logging, debugging, URLs)
 * - Runtime: Security & feature flags (auth, rbac, rate limits)
 * 
 * This prevents hardcoded assumptions about backend behavior
 * and allows the frontend to adapt to actual backend configuration.
 */

/**
 * Backend configuration detected at runtime
 * These flags come from backend /health or /settings endpoint
 */
export interface BackendConfig {
  AUTH_ENABLED: boolean;
  RBAC_ENABLED: boolean;
  ENABLE_TRAINING_PILOT: boolean;
  ENABLE_SEMANTIC_CACHE: boolean;
  ENABLE_RATE_LIMIT: boolean;
  ENABLE_OBSERVABILITY: boolean;
  ENABLE_SENTRY_MONITORING: boolean;
  IMMUTABLE_TOGGLES: string[];
}

/**
 * Build-time configuration from Vite environment variables
 * These are safe to embed at build time as they're not security-sensitive
 */
export interface BuildTimeConfig {
  DEBUG: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  API_BASE_URL: string;
  SIGNOZ_DASHBOARD_URL: string;
  NODE_ENV: 'development' | 'staging' | 'production';
}

/**
 * Complete environment configuration
 */
export interface EnvironmentConfig {
  build: BuildTimeConfig;
  backend: BackendConfig;
  environment: 'local' | 'ci' | 'production';
  detectedAt: string; // ISO timestamp
}

/**
 * Default backend configuration for fallback
 * Used when backend is unreachable or during initial load
 */
const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  AUTH_ENABLED: false,
  RBAC_ENABLED: false,
  ENABLE_TRAINING_PILOT: false,
  ENABLE_SEMANTIC_CACHE: false,
  ENABLE_RATE_LIMIT: false,
  ENABLE_OBSERVABILITY: false,
  ENABLE_SENTRY_MONITORING: false,
  IMMUTABLE_TOGGLES: []
};

/**
 * Detect build-time configuration from Vite environment variables
 * Safe to call during build - no runtime dependencies
 */
function detectBuildTimeConfig(): BuildTimeConfig {
  return {
    DEBUG: import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true',
    LOG_LEVEL: (import.meta.env.VITE_LOG_LEVEL as any) || 'info',
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
    SIGNOZ_DASHBOARD_URL: import.meta.env.VITE_SIGNOZ_DASHBOARD_URL || '',
    NODE_ENV: import.meta.env.PROD ? 'production' : 'development'
  };
}

/**
 * Detect environment type based on URL and build config
 */
function detectEnvironmentType(): 'local' | 'ci' | 'production' {
  // Check hostname/URL patterns
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
    return 'local';
  }
  
  if (hostname.includes('staging') || hostname.includes('ci') || hostname.includes('test')) {
    return 'ci';
  }
  
  return 'production';
}

/**
 * Fetch backend configuration at runtime
 * Contacts backend to discover actual feature flags and settings
 */
async function fetchBackendConfig(apiBaseUrl: string): Promise<BackendConfig> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // No auth headers - health endpoint should be public
    });

    if (!response.ok) {
      console.warn(`Failed to fetch backend config: ${response.status}`);
      return DEFAULT_BACKEND_CONFIG;
    }

    const health = await response.json();
    
    // Extract feature flags from health response
    // Backend should include feature flags in health endpoint
    return {
      AUTH_ENABLED: health.features?.auth_enabled ?? DEFAULT_BACKEND_CONFIG.AUTH_ENABLED,
      RBAC_ENABLED: health.features?.rbac_enabled ?? DEFAULT_BACKEND_CONFIG.RBAC_ENABLED,
      ENABLE_TRAINING_PILOT: health.features?.training_pilot ?? DEFAULT_BACKEND_CONFIG.ENABLE_TRAINING_PILOT,
      ENABLE_SEMANTIC_CACHE: health.features?.semantic_cache ?? DEFAULT_BACKEND_CONFIG.ENABLE_SEMANTIC_CACHE,
      ENABLE_RATE_LIMIT: health.features?.rate_limit ?? DEFAULT_BACKEND_CONFIG.ENABLE_RATE_LIMIT,
      ENABLE_OBSERVABILITY: health.features?.observability ?? DEFAULT_BACKEND_CONFIG.ENABLE_OBSERVABILITY,
      ENABLE_SENTRY_MONITORING: health.features?.sentry_monitoring ?? DEFAULT_BACKEND_CONFIG.ENABLE_SENTRY_MONITORING,
      IMMUTABLE_TOGGLES: health.immutable_toggles ?? DEFAULT_BACKEND_CONFIG.IMMUTABLE_TOGGLES
    };
  } catch (error) {
    console.warn('Failed to detect backend configuration:', error);
    return DEFAULT_BACKEND_CONFIG;
  }
}

/**
 * Detect complete environment configuration
 * Combines build-time and runtime detection
 */
export async function detectEnvironment(): Promise<EnvironmentConfig> {
  const buildConfig = detectBuildTimeConfig();
  const envType = detectEnvironmentType();
  
  // Fetch backend config with timeout
  const backendConfig = await Promise.race([
    fetchBackendConfig(buildConfig.API_BASE_URL),
    new Promise<BackendConfig>((resolve) => 
      setTimeout(() => resolve(DEFAULT_BACKEND_CONFIG), 5000)
    )
  ]);

  return {
    build: buildConfig,
    backend: backendConfig,
    environment: envType,
    detectedAt: new Date().toISOString()
  };
}

/**
 * Lightweight environment detection for initial render
 * Returns synchronous build-time config only
 * Use for immediate rendering decisions before async detection completes
 */
export function detectEnvironmentSync(): Omit<EnvironmentConfig, 'backend'> & { backend: null } {
  return {
    build: detectBuildTimeConfig(),
    backend: null, // Will be populated by async detectEnvironment()
    environment: detectEnvironmentType(),
    detectedAt: new Date().toISOString()
  };
}

/**
 * Refresh backend configuration
 * Call this after network recovery or when backend config might have changed
 */
export async function refreshBackendConfig(currentConfig: EnvironmentConfig): Promise<EnvironmentConfig> {
  const newBackendConfig = await fetchBackendConfig(currentConfig.build.API_BASE_URL);
  
  return {
    ...currentConfig,
    backend: newBackendConfig,
    detectedAt: new Date().toISOString()
  };
}

/**
 * Validate environment configuration
 * Checks for inconsistent or suspicious configurations
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): string[] {
  const warnings: string[] = [];

  // Security checks
  if (config.environment === 'production' && config.build.DEBUG) {
    warnings.push('DEBUG enabled in production environment');
  }

  if (config.environment === 'production' && !config.backend.AUTH_ENABLED) {
    warnings.push('Authentication disabled in production environment');
  }

  // Feature flag consistency
  if (config.backend.RBAC_ENABLED && !config.backend.AUTH_ENABLED) {
    warnings.push('RBAC enabled but authentication disabled');
  }

  // Rate limiting
  if (config.environment === 'production' && !config.backend.ENABLE_RATE_LIMIT) {
    warnings.push('Rate limiting disabled in production environment');
  }

  return warnings;
}

/**
 * Get environment-specific API base URL
 * Handles different URL patterns for different environments
 */
export function getApiBaseUrl(config: EnvironmentConfig): string {
  // Remove trailing slash for consistency
  return config.build.API_BASE_URL.replace(/\/$/, '');
}

/**
 * Check if feature is enabled based on current environment
 * Centralized feature flag checking with fallback to defaults
 */
export function isFeatureEnabled(
  feature: Exclude<keyof BackendConfig, 'IMMUTABLE_TOGGLES'>,
  config: EnvironmentConfig | null
): boolean {
  if (!config || !config.backend) {
    return DEFAULT_BACKEND_CONFIG[feature];
  }
  
  return config.backend[feature];
}

/**
 * Get immutable toggles from current environment
 */
export function getImmutableToggles(config: EnvironmentConfig | null): string[] {
  if (!config || !config.backend) {
    return DEFAULT_BACKEND_CONFIG.IMMUTABLE_TOGGLES;
  }
  
  return config.backend.IMMUTABLE_TOGGLES;
}

/**
 * Get debug information about current environment
 * Useful for troubleshooting environment detection issues
 */
export function getEnvironmentDebugInfo(config: EnvironmentConfig) {
  return {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    userAgent: navigator.userAgent,
    detectionResult: config,
    buildTime: {
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE,
      allViteEnv: import.meta.env
    }
  };
}