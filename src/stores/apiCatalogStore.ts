/**
 * API Catalog Store
 * Global state management for API catalog using Zustand
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  ApiCatalog,
  ApiCatalogVersion,
  ApiEndpoint,
  ApiConnection,
  SyncState,
  CatalogSyncMessage,
} from '@/types/apiCatalog'
import { DEFAULT_API_CATALOG } from '@/services/apiCatalogService'

interface CatalogState {
  // Catalog data
  catalog: ApiCatalog
  endpoints: ApiEndpoint[]
  connections: ApiConnection[]
  versions: ApiCatalogVersion[]

  // UI state
  isLoading: boolean
  isSyncing: boolean
  error: string | null

  // Sync state
  lastSyncedAt: string | null
  pendingChanges: string[]
  syncState: SyncState | null

  // WebSocket connection
  isConnected: boolean
  wsUrl: string | null

  // Actions
  setCatalog: (catalog: ApiCatalog) => void
  setEndpoints: (endpoints: ApiEndpoint[]) => void
  setConnections: (connections: ApiConnection[]) => void
  setVersions: (versions: ApiCatalogVersion[]) => void

  setLoading: (loading: boolean) => void
  setSyncing: (syncing: boolean) => void
  setError: (error: string | null) => void

  updateSyncState: (syncState: SyncState) => void
  addPendingChange: (changeId: string) => void
  clearPendingChanges: () => void

  setConnected: (connected: boolean) => void
  setWsUrl: (url: string) => void

  // Sync actions
  handleSyncMessage: (message: CatalogSyncMessage) => void
  refreshFromServer: () => Promise<void>
  resetToDefaults: () => void
}

const createCatalogStore = () =>
  create<CatalogState>()(
    devtools(
      persist(
        (set, get) => ({
          // Initial state
          catalog: DEFAULT_API_CATALOG,
          endpoints: DEFAULT_API_CATALOG.currentVersion?.endpoints || [],
          connections: DEFAULT_API_CATALOG.currentVersion?.connections || [],
          versions: [],

          isLoading: false,
          isSyncing: false,
          error: null,

          lastSyncedAt: null,
          pendingChanges: [],
          syncState: null,

          isConnected: false,
          wsUrl: null,

          // Setters
          setCatalog: (catalog) => {
            set({ catalog, lastSyncedAt: new Date().toISOString() })
          },

          setEndpoints: (endpoints) => {
            set({ endpoints })
          },

          setConnections: (connections) => {
            set({ connections })
          },

          setVersions: (versions) => {
            set({ versions })
          },

          setLoading: (loading) => {
            set({ isLoading: loading })
          },

          setSyncing: (syncing) => {
            set({ isSyncing: syncing })
          },

          setError: (error) => {
            set({ error })
          },

          updateSyncState: (syncState) => {
            set({ syncState })
          },

          addPendingChange: (changeId) => {
            const { pendingChanges } = get()
            if (!pendingChanges.includes(changeId)) {
              set({ pendingChanges: [...pendingChanges, changeId] })
            }
          },

          clearPendingChanges: () => {
            set({ pendingChanges: [] })
          },

          setConnected: (connected) => {
            set({ isConnected: connected })
          },

          setWsUrl: (url) => {
            set({ wsUrl: url })
          },

          // Handle incoming sync messages
          handleSyncMessage: (message) => {
            const { catalog, endpoints, connections } = get()

            switch (message.type) {
              case 'update': {
                if (message.resourceType === 'endpoint') {
                  const updated = endpoints.map((ep) =>
                    ep.id === message.resourceId ? { ...(message.data as ApiEndpoint) } : ep
                  )
                  set({ endpoints: updated })
                }
                if (message.resourceType === 'connection') {
                  const updated = connections.map((conn) =>
                    conn.id === message.resourceId ? { ...(message.data as ApiConnection) } : conn
                  )
                  set({ connections: updated })
                }
                break
              }

              case 'delete': {
                if (message.resourceType === 'endpoint') {
                  set({ endpoints: endpoints.filter((ep) => ep.id !== message.resourceId) })
                }
                if (message.resourceType === 'connection') {
                  set({ connections: connections.filter((c) => c.id !== message.resourceId) })
                }
                break
              }

              case 'publish': {
                if (message.data) {
                  const newVersion = message.data as ApiCatalogVersion
                  set({
                    catalog: {
                      ...catalog,
                      currentVersionId: newVersion.id,
                      currentVersion: newVersion,
                      updatedAt: message.timestamp,
                    },
                  })
                }
                break
              }

              case 'conflict': {
                set({ error: `Conflict detected: ${message.metadata?.message || 'Unable to sync changes'}` })
                break
              }
            }
          },

          refreshFromServer: async () => {
            // This will be implemented in the actual hook/service caller
            // Placeholder for async refresh logic
            set({ isLoading: true })
            try {
              // Simulate fetching from server
              set({ error: null, lastSyncedAt: new Date().toISOString() })
            } catch (err) {
              set({ error: (err as Error).message })
            } finally {
              set({ isLoading: false })
            }
          },

          resetToDefaults: () => {
            set({
              catalog: DEFAULT_API_CATALOG,
              endpoints: DEFAULT_API_CATALOG.currentVersion?.endpoints || [],
              connections: DEFAULT_API_CATALOG.currentVersion?.connections || [],
              versions: [],
              pendingChanges: [],
              error: null,
              lastSyncedAt: null,
            })
          },
        }),
        {
          name: 'api-catalog-store',
          partialize: (state) => ({
            catalog: state.catalog,
            endpoints: state.endpoints,
            connections: state.connections,
            lastSyncedAt: state.lastSyncedAt,
            pendingChanges: state.pendingChanges,
          }),
        }
      ),
      { name: 'ApiCatalogStore' }
    )
  )

export const useApiCatalogStore = createCatalogStore()

/**
 * Custom hook to get endpoints from store
 */
export function useCatalogEndpoints() {
  return useApiCatalogStore((state) => state.endpoints)
}

/**
 * Custom hook to get connections from store
 */
export function useCatalogConnections() {
  return useApiCatalogStore((state) => state.connections)
}

/**
 * Custom hook to get catalog from store
 */
export function useCatalog() {
  return useApiCatalogStore((state) => state.catalog)
}

/**
 * Custom hook to get sync state from store
 */
export function useCatalogSyncState() {
  return {
    lastSyncedAt: useApiCatalogStore((state) => state.lastSyncedAt),
    pendingChanges: useApiCatalogStore((state) => state.pendingChanges),
    isSyncing: useApiCatalogStore((state) => state.isSyncing),
    isConnected: useApiCatalogStore((state) => state.isConnected),
  }
}

/**
 * Hook to connect to catalog sync WebSocket
 */
export function useCatalogWebSocket(wsUrl: string) {
  const store = useApiCatalogStore()

  const connect = () => {
    if (!wsUrl) return

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        store.setConnected(true)
        console.log('Connected to catalog sync WebSocket')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as CatalogSyncMessage
          store.handleSyncMessage(message)
        } catch (err) {
          console.error('Failed to parse sync message', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error', error)
        store.setError('Sync connection error')
      }

      ws.onclose = () => {
        store.setConnected(false)
        console.log('Disconnected from catalog sync WebSocket')
      }

      return ws
    } catch (err) {
      console.error('Failed to connect to WebSocket', err)
      store.setError((err as Error).message)
    }
  }

  return { connect }
}
