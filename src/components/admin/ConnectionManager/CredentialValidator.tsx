/**
 * CredentialValidator.tsx
 * Input fields for auth credentials with validation and masking
 * 
 * Spec: ADMIN_UI_COMPONENTS_GUIDE.md § ConnectionManager
 * Phase 2b: Week 2 deliverable
 */

import { useState } from 'react'
import type { ApiConnection } from '@/types/apiCatalog'
import { Input } from '@/components/shared/Input'
import { Card } from '@/components/shared/Card'

interface CredentialValidatorProps {
  authType: ApiConnection['authType']
  authConfig?: ApiConnection['authConfig']
  onChange?: (authConfig: ApiConnection['authConfig']) => void
}

export function CredentialValidator({ authType, authConfig, onChange }: CredentialValidatorProps) {
  const [showToken, setShowToken] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showClientSecret, setShowClientSecret] = useState(false)

  const updateConfig = (updates: Partial<NonNullable<ApiConnection['authConfig']>>) => {
    onChange?.({ ...authConfig, ...updates })
  }

  if (authType === 'none') {
    return (
      <Card>
        <div className="p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            No authentication required for this connection
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Authentication Credentials
          </h3>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {authType === 'bearer' && 'Bearer Token'}
            {authType === 'apiKey' && 'API Key'}
            {authType === 'basic' && 'Basic Authentication'}
            {authType === 'oauth2' && 'OAuth 2.0'}
          </span>
        </div>

        {/* Bearer Token */}
        {authType === 'bearer' && (
          <>
            <Input
              id="bearer-header"
              label="Authorization Header"
              placeholder="Authorization"
              value={authConfig?.header || ''}
              onChange={(e) => updateConfig({ header: e.target.value })}
              hint="Header name for the token (default: Authorization)"
            />
            
            <div className="relative">
              <Input
                id="bearer-token"
                type={showToken ? 'text' : 'password'}
                label="Bearer Token"
                placeholder="Enter your bearer token"
                value={authConfig?.token || ''}
                onChange={(e) => updateConfig({ token: e.target.value })}
                hint="The authentication token"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showToken ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                Expected Format
              </h4>
              <code className="text-xs font-mono text-blue-700 dark:text-blue-400">
                {authConfig?.header || 'Authorization'}: Bearer {'{'}token{'}'}
              </code>
            </div>
          </>
        )}

        {/* API Key */}
        {authType === 'apiKey' && (
          <>
            <Input
              id="apikey-header"
              label="Header Name"
              placeholder="X-API-Key"
              value={authConfig?.header || ''}
              onChange={(e) => updateConfig({ header: e.target.value })}
              hint="Name of the header where the API key will be sent"
            />
            
            <div className="relative">
              <Input
                id="apikey-token"
                type={showToken ? 'text' : 'password'}
                label="API Key"
                placeholder="Enter your API key"
                value={authConfig?.token || ''}
                onChange={(e) => updateConfig({ token: e.target.value })}
                hint="The API key value"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showToken ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">
                Expected Format
              </h4>
              <code className="text-xs font-mono text-green-700 dark:text-green-400">
                {authConfig?.header || 'X-API-Key'}: {'{'}api_key{'}'}
              </code>
            </div>
          </>
        )}

        {/* Basic Auth */}
        {authType === 'basic' && (
          <>
            <Input
              id="basic-username"
              label="Username"
              placeholder="Enter username"
              value={authConfig?.username || ''}
              onChange={(e) => updateConfig({ username: e.target.value })}
            />
            
            <div className="relative">
              <Input
                id="basic-password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter password"
                value={authConfig?.password || ''}
                onChange={(e) => updateConfig({ password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                Expected Format
              </h4>
              <code className="text-xs font-mono text-yellow-700 dark:text-yellow-400">
                Authorization: Basic {'{'}base64(username:password){'}'}
              </code>
            </div>
          </>
        )}

        {/* OAuth 2.0 */}
        {authType === 'oauth2' && (
          <>
            <Input
              id="oauth-client-id"
              label="Client ID"
              placeholder="Enter client ID"
              value={authConfig?.clientId || ''}
              onChange={(e) => updateConfig({ clientId: e.target.value })}
            />
            
            <div className="relative">
              <Input
                id="oauth-client-secret"
                type={showClientSecret ? 'text' : 'password'}
                label="Client Secret"
                placeholder="Enter client secret"
                value={authConfig?.clientSecret || ''}
                onChange={(e) => updateConfig({ clientSecret: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowClientSecret(!showClientSecret)}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showClientSecret ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <Input
              id="oauth-token-url"
              label="Token URL"
              placeholder="https://oauth.example.com/token"
              value={authConfig?.tokenUrl || ''}
              onChange={(e) => updateConfig({ tokenUrl: e.target.value })}
              hint="URL to fetch the access token"
            />

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
                OAuth 2.0 Flow
              </h4>
              <ol className="text-xs text-purple-700 dark:text-purple-400 space-y-1 list-decimal list-inside">
                <li>Request token from Token URL with Client ID/Secret</li>
                <li>Receive access_token in response</li>
                <li>Use access_token in Authorization header</li>
              </ol>
            </div>
          </>
        )}

        {/* Security Warning */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-900 dark:text-red-300">
                Security Notice
              </h4>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Credentials are encrypted and stored securely. Never share your credentials or commit them to version control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default CredentialValidator
