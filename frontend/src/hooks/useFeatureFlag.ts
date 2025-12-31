import React, { useContext, createContext, useEffect, useState, ReactNode } from 'react';
import { 
  EnvironmentConfig, 
  BackendConfig, 
  detectEnvironment, 
  detectEnvironmentSync,
  isFeatureEnabled,
  getImmutableToggles
} from '../utils/environmentDetection';

/**
 * Backend Configuration Context
 * Provides runtime-detected backend feature flags and environment settings
 * to all components that need to adapt to backend capabilities
 */
interface BackendConfigContextValue {
  config: EnvironmentConfig | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const BackendConfigContext = createContext<BackendConfigContextValue>({
  config: null,
  isLoading: true,
  error: null,
  refresh: async () => {}
});

/**
 * Provider component for backend configuration
 * Detects environment and backend features on mount and provides to children
 */
export function BackendConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<EnvironmentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with synchronous config for immediate rendering
  useEffect(() => {
    // Set initial sync config to prevent render blocking
    const syncConfig = detectEnvironmentSync();
    setConfig({
      ...syncConfig,
      backend: {
        AUTH_ENABLED: false,
        RBAC_ENABLED: false,
        ENABLE_TRAINING_PILOT: false,
        ENABLE_SEMANTIC_CACHE: false,
        ENABLE_RATE_LIMIT: false,
        ENABLE_OBSERVABILITY: false,
        ENABLE_SENTRY_MONITORING: false,
        IMMUTABLE_TOGGLES: []
      }
    });
  }, []);

  // Perform async detection for runtime features
  useEffect(() => {
    let mounted = true;

    async function initializeConfig() {
      try {
        setIsLoading(true);
        setError(null);
        
        const detectedConfig = await detectEnvironment();
        
        if (mounted) {
          setConfig(detectedConfig);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to detect environment';
          setError(errorMessage);
          console.warn('Environment detection failed:', err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeConfig();

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      setError(null);
      const newConfig = await detectEnvironment();
      setConfig(newConfig);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh configuration';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <BackendConfigContext.Provider 
      value={{ 
        config, 
        isLoading, 
        error, 
        refresh 
      }}
    >
      {children}
    </BackendConfigContext.Provider>
  );
}

/**
 * Hook to access backend configuration
 * Provides complete environment config including build-time and runtime settings
 */
export function useBackendConfig(): BackendConfigContextValue {
  const context = useContext(BackendConfigContext);
  
  if (!context) {
    throw new Error('useBackendConfig must be used within BackendConfigProvider');
  }
  
  return context;
}

/**
 * Hook for single feature flag access
 * Usage: const trainingEnabled = useFeatureFlag('ENABLE_TRAINING_PILOT');
 * 
 * Returns boolean indicating if feature is enabled
 * Falls back to false if backend config not yet loaded
 */
export function useFeatureFlag(flag: Exclude<keyof BackendConfig, 'IMMUTABLE_TOGGLES'>): boolean {
  const { config } = useBackendConfig();
  return isFeatureEnabled(flag, config);
}

/**
 * Hook for multiple feature flag check (all must be true)
 * Usage: const canAccessAdmin = useAllFeatureFlags(['AUTH_ENABLED', 'RBAC_ENABLED']);
 * 
 * Returns true only if ALL specified flags are enabled
 * Useful for features that require multiple conditions
 */
export function useAllFeatureFlags(
  flags: Array<Exclude<keyof BackendConfig, 'IMMUTABLE_TOGGLES'>>
): boolean {
  const { config } = useBackendConfig();
  
  if (!config) return false;
  
  return flags.every(flag => isFeatureEnabled(flag, config));
}

/**
 * Hook for any feature flag check (at least one must be true)
 * Usage: const hasAnyAuth = useAnyFeatureFlag(['AUTH_ENABLED', 'OAUTH_ENABLED']);
 * 
 * Returns true if ANY of the specified flags are enabled
 * Useful for fallback authentication methods or alternative features
 */
export function useAnyFeatureFlag(
  flags: Array<Exclude<keyof BackendConfig, 'IMMUTABLE_TOGGLES'>>
): boolean {
  const { config } = useBackendConfig();
  
  if (!config) return false;
  
  return flags.some(flag => isFeatureEnabled(flag, config));
}

/**
 * Hook to access immutable toggles
 * Returns list of feature toggle names that cannot be changed at runtime
 */
export function useImmutableToggles(): string[] {
  const { config } = useBackendConfig();
  return getImmutableToggles(config);
}

/**
 * Hook to check if a specific toggle is immutable
 * Usage: const isReadOnly = useIsToggleImmutable('AUTH_ENABLED');
 * 
 * Useful for showing read-only badges in admin UI
 */
export function useIsToggleImmutable(toggleName: string): boolean {
  const immutableToggles = useImmutableToggles();
  return immutableToggles.includes(toggleName);
}

/**
 * Hook for environment-specific values
 * Returns different values based on detected environment
 * 
 * Usage: 
 * const apiTimeout = useEnvironmentValue({
 *   local: 5000,
 *   ci: 10000,
 *   production: 15000
 * });
 */
export function useEnvironmentValue<T>(values: {
  local: T;
  ci: T;
  production: T;
}): T {
  const { config } = useBackendConfig();
  
  if (!config) {
    // Default to local during loading
    return values.local;
  }
  
  return values[config.environment];
}

/**
 * Hook for conditional rendering based on environment
 * Usage: const showDebugTools = useEnvironmentFlag(['local', 'ci']);
 * 
 * Returns true if current environment is in the allowed list
 */
export function useEnvironmentFlag(allowedEnvironments: Array<'local' | 'ci' | 'production'>): boolean {
  const { config } = useBackendConfig();
  
  if (!config) return false;
  
  return allowedEnvironments.includes(config.environment);
}

/**
 * Hook for build-time configuration access
 * Provides immediate access to build-time values without async loading
 * 
 * Usage: const apiUrl = useBuildConfig('API_BASE_URL');
 */
export function useBuildConfig(): {
  DEBUG: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  API_BASE_URL: string;
  SIGNOZ_DASHBOARD_URL: string;
  NODE_ENV: 'development' | 'staging' | 'production';
} | null {
  const { config } = useBackendConfig();
  return config?.build || null;
}

/**
 * Hook to refresh backend configuration
 * Useful for manual refresh after network recovery or settings changes
 * 
 * Usage:
 * const refreshConfig = useRefreshConfig();
 * await refreshConfig(); // Re-detect backend features
 */
export function useRefreshConfig() {
  const { refresh } = useBackendConfig();
  return refresh;
}

/**
 * Development hook for debugging configuration
 * Only available in development mode
 */
export function useConfigDebug() {
  const { config, isLoading, error } = useBackendConfig();
  const buildConfig = useBuildConfig();
  
  if (buildConfig?.NODE_ENV === 'production') {
    console.warn('useConfigDebug should not be used in production');
    return null;
  }
  
  return {
    config,
    isLoading,
    error,
    flags: config ? {
      auth: isFeatureEnabled('AUTH_ENABLED', config),
      rbac: isFeatureEnabled('RBAC_ENABLED', config),
      training: isFeatureEnabled('ENABLE_TRAINING_PILOT', config),
      cache: isFeatureEnabled('ENABLE_SEMANTIC_CACHE', config),
      rateLimit: isFeatureEnabled('ENABLE_RATE_LIMIT', config)
    } : null
  };
}