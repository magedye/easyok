import { AUTH_ENABLED, API_BASE_URL } from '../config';
import { detectEnvironment, detectEnvironmentSync } from './environmentDetection';

export type RuntimeEnv = {
  AUTH_ENABLED: boolean;
  API_BASE_URL: string;
  ENVIRONMENT: string;
  NODE_ENV: string;
  DEBUG_MODE: boolean;
  ANALYTICS_ENABLED: boolean | undefined;
  EXPERIMENTAL_FEATURES: boolean | undefined;
  TELEMETRY_ENABLED: boolean | undefined;
  BUILD_TIME: string;
};

declare global {
  interface Window {
    __ENV?: RuntimeEnv;
    __USER?: { role: 'admin' | 'viewer' };
  }
}

function buildBaseRuntimeEnv(): RuntimeEnv {
  const syncEnv = detectEnvironmentSync();
  return {
    AUTH_ENABLED,
    API_BASE_URL,
    ENVIRONMENT: syncEnv.environment,
    NODE_ENV: syncEnv.build.NODE_ENV || (import.meta.env.PROD ? 'production' : 'development'),
    DEBUG_MODE: syncEnv.build.DEBUG,
    ANALYTICS_ENABLED: false,
    EXPERIMENTAL_FEATURES: false,
    TELEMETRY_ENABLED: false,
    BUILD_TIME: syncEnv.detectedAt
  };
}

export function bootstrapRuntimeEnv(): RuntimeEnv {
  const baseEnv = buildBaseRuntimeEnv();
  window.__ENV = baseEnv;
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-auth-enabled', String(baseEnv.AUTH_ENABLED));
  }

  // Default user role (can be overridden by auth flow)
  if (!window.__USER) {
    window.__USER = { role: AUTH_ENABLED ? 'viewer' : 'admin' };
  }

  // Async refresh with runtime detection (best effort)
  detectEnvironment()
    .then((detected) => {
      const merged: RuntimeEnv = {
        AUTH_ENABLED: detected.backend.AUTH_ENABLED ?? baseEnv.AUTH_ENABLED,
        API_BASE_URL: detected.build.API_BASE_URL || baseEnv.API_BASE_URL,
        ENVIRONMENT: detected.environment || baseEnv.ENVIRONMENT,
        NODE_ENV: detected.build.NODE_ENV || baseEnv.NODE_ENV,
        DEBUG_MODE: detected.build.DEBUG,
        ANALYTICS_ENABLED: detected.backend.ENABLE_OBSERVABILITY ?? baseEnv.ANALYTICS_ENABLED,
        EXPERIMENTAL_FEATURES: detected.backend.ENABLE_TRAINING_PILOT ?? baseEnv.EXPERIMENTAL_FEATURES,
        TELEMETRY_ENABLED: detected.backend.ENABLE_RATE_LIMIT ?? baseEnv.TELEMETRY_ENABLED,
        BUILD_TIME: detected.detectedAt
      };
      window.__ENV = merged;
      if (typeof document !== 'undefined') {
        document.body.setAttribute('data-auth-enabled', String(merged.AUTH_ENABLED));
      }
    })
    .catch(() => {
      // Best-effort: fallback to baseEnv
    });

  return baseEnv;
}

export function getRuntimeEnv(): RuntimeEnv {
  return window.__ENV || buildBaseRuntimeEnv();
}
