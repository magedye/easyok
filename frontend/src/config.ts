// Configuration helper for API base and other constants.
// Read environment variables from Vite prefix (VITE_*) with sensible defaults.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Storage keys for tokens or other items
export const TOKEN_STORAGE_KEY = 'token';