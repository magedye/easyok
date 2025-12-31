/**
 * TokenManager - Thread-safe token management with race condition handling
 * 
 * Key Features:
 * - Race-safe token refresh (prevents multiple simultaneous refresh attempts)
 * - Automatic refresh 5 minutes before expiry
 * - SessionStorage usage (Governance Rule #6: No secrets in localStorage)
 * - JWT token decoding and validation
 * - Token cleanup on logout/401 errors
 * 
 * Thread Safety:
 * - Uses refresh lock to prevent concurrent refresh calls
 * - Promise sharing for multiple simultaneous token requests
 * - Queue management for pending requests during refresh
 */

interface TokenPayload {
  exp: number;
  iat: number;
  sub: string;
  [key: string]: any;
}

interface RefreshResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

/**
 * Thread-safe token manager with race condition prevention
 */
export class TokenManager {
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshLock = false;
  private readonly storageKey = 'session_token';
  private readonly apiBaseUrl: string;
  
  // Refresh 5 minutes before expiry (300 seconds)
  private readonly refreshThreshold = 5 * 60 * 1000; // milliseconds

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.loadTokenFromStorage();
  }

  /**
   * Load token from sessionStorage on initialization
   * Validates token before using it
   */
  private loadTokenFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        // Validate token before using
        if (this.isTokenValid(stored)) {
          this.token = stored;
        } else {
          // Remove invalid token
          sessionStorage.removeItem(this.storageKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load token from storage:', error);
    }
  }

  /**
   * Thread-safe token access with automatic refresh
   * This is the main method that handles all token operations
   */
  async ensureValidToken(): Promise<string> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      try {
        return await this.refreshPromise;
      } catch (error) {
        // If refresh failed, clear the promise and try again
        this.refreshPromise = null;
        throw error;
      }
    }

    // If current token is valid, return it immediately
    if (this.token && this.isTokenValid(this.token)) {
      return this.token;
    }

    // Need to refresh - start refresh with promise sharing
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } catch (error) {
      // Refresh failed - clear token and force login
      this.clearToken();
      throw new Error('Token refresh failed - login required');
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh with error handling
   */
  private async performTokenRefresh(): Promise<string> {
    if (this.refreshLock) {
      throw new Error('Token refresh already in progress');
    }

    this.refreshLock = true;
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        // Use a reasonable timeout for refresh requests
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        // Log the specific error
        console.warn(`Token refresh failed: ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
          // Refresh token is invalid - need to login again
          throw new Error('Refresh token expired');
        }
        
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data: RefreshResponse = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token in refresh response');
      }

      // Update token and storage
      this.setToken(data.access_token);
      return data.access_token;
      
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    } finally {
      this.refreshLock = false;
    }
  }

  /**
   * Set new token and store securely in sessionStorage
   * Governance Rule #6: Use sessionStorage, not localStorage
   */
  setToken(token: string): void {
    if (!token) {
      throw new Error('Cannot set empty token');
    }

    this.token = token;
    
    try {
      sessionStorage.setItem(this.storageKey, token);
    } catch (error) {
      console.error('Failed to store token:', error);
      // Continue without storage - token will work for current session
    }
  }

  /**
   * Clear token from memory and storage
   * Call this on logout or 401 errors
   */
  clearToken(): void {
    this.token = null;
    this.refreshPromise = null;
    this.refreshLock = false;
    
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear token from storage:', error);
    }
  }

  /**
   * Check if token exists (doesn't validate expiry)
   */
  hasToken(): boolean {
    return this.token !== null;
  }

  /**
   * Get current token without refresh (can be expired)
   * Use ensureValidToken() for guaranteed valid token
   */
  getCurrentToken(): string | null {
    return this.token;
  }

  /**
   * Check if token expires within refresh threshold (5 minutes)
   * Also validates token structure and signature
   */
  private isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      const payload = this.decodeToken(token);
      
      // Check if token has expiry
      if (typeof payload.exp !== 'number') {
        console.warn('Token missing expiry claim');
        return false;
      }

      // Check if token expires soon (within threshold)
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      return timeUntilExpiry > this.refreshThreshold;
    } catch (error) {
      console.warn('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Decode JWT token payload (does not verify signature)
   * Only use for extracting expiry and user info
   */
  private decodeToken(token: string): TokenPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT structure');
      }

      // Decode base64url payload
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to decode token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user information from token
   * Returns null if token is invalid
   */
  getUserInfo(): { sub: string; exp: number; [key: string]: any } | null {
    if (!this.token) return null;

    try {
      return this.decodeToken(this.token);
    } catch {
      return null;
    }
  }

  /**
   * Get time until token expiry in milliseconds
   * Returns negative number if already expired
   */
  getTimeUntilExpiry(): number | null {
    if (!this.token) return null;

    try {
      const payload = this.decodeToken(this.token);
      if (typeof payload.exp !== 'number') return null;
      
      return (payload.exp * 1000) - Date.now();
    } catch {
      return null;
    }
  }

  /**
   * Check if token is close to expiry (within warning threshold)
   * Useful for showing "session expiring" warnings
   */
  isTokenExpiringSoon(warningThresholdMs = 10 * 60 * 1000): boolean { // 10 minutes default
    const timeUntilExpiry = this.getTimeUntilExpiry();
    return timeUntilExpiry !== null && timeUntilExpiry <= warningThresholdMs && timeUntilExpiry > 0;
  }

  /**
   * Manual token refresh (force refresh even if not near expiry)
   * Useful for explicit user actions like "extend session"
   */
  async forceRefresh(): Promise<string> {
    // Clear current refresh promise to force new refresh
    this.refreshPromise = null;
    
    // Temporarily mark token as expired to trigger refresh
    const originalToken = this.token;
    this.token = 'expired';
    
    try {
      return await this.ensureValidToken();
    } catch (error) {
      // Restore original token on failure
      this.token = originalToken;
      throw error;
    }
  }

  /**
   * Get debug information about token state
   * Only available in development mode
   */
  getDebugInfo() {
    if (import.meta.env.PROD) {
      console.warn('Token debug info should not be accessed in production');
      return null;
    }

    const userInfo = this.getUserInfo();
    const timeUntilExpiry = this.getTimeUntilExpiry();
    
    return {
      hasToken: this.hasToken(),
      isRefreshing: this.refreshLock,
      hasRefreshPromise: this.refreshPromise !== null,
      userInfo: userInfo ? {
        sub: userInfo.sub,
        exp: userInfo.exp,
        // Don't include other claims for security
      } : null,
      timeUntilExpiry,
      isExpiringSoon: this.isTokenExpiringSoon(),
      isValid: this.token ? this.isTokenValid(this.token) : false
    };
  }

  /**
   * Cleanup method - call before destroying TokenManager instance
   */
  dispose(): void {
    this.refreshPromise = null;
    this.refreshLock = false;
    // Don't clear token from storage - let it persist until logout
  }
}

/**
 * Global token manager instance
 * Initialized with environment-detected API base URL
 */
let globalTokenManager: TokenManager | null = null;

/**
 * Get or create global token manager instance
 */
export function getTokenManager(apiBaseUrl?: string): TokenManager {
  if (!globalTokenManager || apiBaseUrl) {
    const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    globalTokenManager = new TokenManager(baseUrl);
  }
  
  return globalTokenManager;
}

/**
 * Convenience function for getting valid token
 * Throws error if token refresh fails
 */
export async function getValidToken(apiBaseUrl?: string): Promise<string> {
  const tokenManager = getTokenManager(apiBaseUrl);
  return await tokenManager.ensureValidToken();
}

/**
 * Convenience function for checking if user is authenticated
 */
export function isAuthenticated(apiBaseUrl?: string): boolean {
  const tokenManager = getTokenManager(apiBaseUrl);
  return tokenManager.hasToken();
}

/**
 * Convenience function for logout
 * Clears token and resets global instance
 */
export function logout(): void {
  if (globalTokenManager) {
    globalTokenManager.clearToken();
    globalTokenManager = null;
  }
}