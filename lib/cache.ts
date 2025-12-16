// Caching utility with localStorage persistence and TTL support

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const CACHE_PREFIX = 'xnode_cache_'

// Default TTLs (in milliseconds)
export const CACHE_TTL = {
  NODE_DATA: 5 * 60 * 1000,      // 5 minutes for node stats
  GEOLOCATION: 24 * 60 * 60 * 1000, // 24 hours for geolocation (rarely changes)
  REGISTRY_PODS: 2 * 60 * 1000,  // 2 minutes for registry list
  POD_CREDITS: 60 * 1000,        // 1 minute for credits
} as const

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/**
 * Get data from cache
 */
export function getFromCache<T>(key: string): T | null {
  if (!isBrowser()) return null

  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key)
    if (!cached) return null

    const entry: CacheEntry<T> = JSON.parse(cached)
    const now = Date.now()

    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }

    return entry.data
  } catch {
    return null
  }
}

/**
 * Save data to cache with TTL
 */
export function setToCache<T>(key: string, data: T, ttl: number): void {
  if (!isBrowser()) return

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch (e) {
    // Handle quota exceeded - clear old cache entries
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearExpiredCache()
      try {
        const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl }
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
      } catch {
        // If still fails, silently ignore
      }
    }
  }
}

/**
 * Clear specific cache key
 */
export function clearCache(key: string): void {
  if (!isBrowser()) return
  localStorage.removeItem(CACHE_PREFIX + key)
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (!isBrowser()) return

  const now = Date.now()
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(CACHE_PREFIX)) continue

    try {
      const cached = localStorage.getItem(key)
      if (!cached) continue

      const entry: CacheEntry<unknown> = JSON.parse(cached)
      if (now - entry.timestamp > entry.ttl) {
        keysToRemove.push(key)
      }
    } catch {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * Clear all xnode cache
 */
export function clearAllCache(): void {
  if (!isBrowser()) return

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

// Cache key generators
export const cacheKeys = {
  registryPods: (network: string) => `registry_pods_${network}`,
  nodeData: (address: string) => `node_${address}`,
  geolocation: (ip: string) => `geo_${ip}`,
  geolocations: () => 'geolocations_all',
  podCredits: () => 'pod_credits',
}

// Batch cache operations for better performance
export function getBatchFromCache<T>(keys: string[]): Map<string, T> {
  const results = new Map<string, T>()
  if (!isBrowser()) return results

  keys.forEach(key => {
    const data = getFromCache<T>(key)
    if (data !== null) {
      results.set(key, data)
    }
  })

  return results
}

export function setBatchToCache<T>(entries: Array<{ key: string; data: T }>, ttl: number): void {
  entries.forEach(({ key, data }) => setToCache(key, data, ttl))
}
