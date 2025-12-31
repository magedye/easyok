// Configuration helper for API base and other constants.
// Read environment variables from Vite prefix (VITE_*) with sensible defaults.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const SIGNOZ_DASHBOARD_URL: string =
  import.meta.env.VITE_SIGNOZ_DASHBOARD_URL || '';

// Storage keys for tokens or other items
export const TOKEN_STORAGE_KEY = 'session_token';

// Frontend authentication toggle.
// - Default: disabled (MVP)
// - To enable: set VITE_AUTH_ENABLED=true when building/running the frontend.
export const AUTH_ENABLED: boolean =
  String(import.meta.env.VITE_AUTH_ENABLED ?? 'false').toLowerCase() === 'true';
