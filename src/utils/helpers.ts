/**
 * Utility helper functions for the application
 */

/**
 * Format date to locale-specific string
 */
export const formatDate = (date: string | Date, locale: string = 'ar-SA'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date with time
 */
export const formatDateTime = (date: string | Date, locale: string = 'ar-SA'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format time duration (ms to readable format)
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

/**
 * Format file size to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format number with thousands separator
 */
export const formatNumber = (num: number, locale: string = 'en-US'): string => {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(num)
}

/**
 * Format percentage
 */
export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Truncate string with ellipsis
 */
export const truncate = (str: string, length: number = 50): string => {
  return str.length > length ? str.substring(0, length) + '...' : str
}

/**
 * Debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttle function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }
}

/**
 * Sleep/delay promise
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Generate random ID
 */
export const generateId = (): string => {
  try {
    return crypto.randomUUID()
  } catch {
    // Fallback for environments without crypto.randomUUID support
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

/**
 * Check if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Check if URL is valid
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Capitalize first letter
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Convert camelCase to kebab-case
 */
export const camelToKebab = (str: string): string => {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Convert snake_case to camelCase
 */
export const snakeToCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
}

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Merge objects shallowly
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mergeObjects = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  return { ...target, ...source }
}

/**
 * Filter object by keys
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const filterObject = <T extends Record<string, any>>(
  obj: T,
  keys: (keyof T)[],
): Partial<T> => {
  return Object.keys(obj)
    .filter((key) => keys.includes(key as keyof T))
    .reduce(
      (acc, key) => {
        acc[key as keyof T] = obj[key as keyof T]
        return acc
      },
      {} as Partial<T>,
    )
}

/**
 * Get value from nested object using path (e.g., "user.profile.name")
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, prop) => current?.[prop], obj)
}

/**
 * Set value in nested object using path
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setNestedValue = (obj: any, path: string, value: any): void => {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  const target = keys.reduce((current, key) => (current[key] = current[key] || {}), obj)
  target[lastKey] = value
}

/**
 * Convert object to URL search params
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const objectToParams = (obj: Record<string, any>): string => {
  const params = new URLSearchParams()
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  return params.toString()
}

/**
 * Parse URL search params to object
 */
export const paramsToObject = (params: URLSearchParams): Record<string, string> => {
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

/**
 * Retry function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> => {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs * Math.pow(2, attempt))
      }
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Check if value is empty
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Check if object has all required keys
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hasAllKeys = (obj: Record<string, any>, keys: string[]): boolean => {
  return keys.every((key) => key in obj && obj[key] !== undefined)
}

/**
 * Array utilities
 */
export const arrayUtils = {
  /**
   * Remove duplicates from array
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unique: <T,>(arr: T[], key?: (item: T) => any): T[] => {
    if (!key) return [...new Set(arr)]
    const seen = new Set()
    return arr.filter((item) => {
      const k = key(item)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  },

  /**
   * Group array items by key
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groupBy: <T,>(arr: T[], key: (item: T) => any): Record<string, T[]> => {
    return arr.reduce(
      (acc, item) => {
        const k = key(item)
        if (!acc[k]) acc[k] = []
        acc[k].push(item)
        return acc
      },
      {} as Record<string, T[]>,
    )
  },

  /**
   * Chunk array into smaller arrays
   */
  chunk: <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  },

  /**
   * Flatten nested array
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flatten: <T,>(arr: any[]): T[] => {
    return arr.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? arrayUtils.flatten(item) : item)
    }, [])
  },
}
