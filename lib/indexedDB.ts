// IndexedDB-based caching for node data with TTL support

const DB_NAME = 'xnode_cache'
const DB_VERSION = 2

// Store names
export const STORES = {
  NODES: 'nodes',
  REGISTRY: 'registry',
  GEOLOCATION: 'geolocation',
  META: 'meta',
  FAVORITES: 'favorites',
} as const

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  NODE_DATA: 5 * 60 * 1000,        // 5 minutes
  REGISTRY_PODS: 5 * 60 * 1000,    // 5 minutes
  GEOLOCATION: 24 * 60 * 60 * 1000, // 24 hours
  BACKGROUND_REFRESH: 5 * 60 * 1000, // 5 minutes - interval for background updates
  ACTIVITY_DATA: 2 * 60 * 1000,    // 2 minutes - activity/solscan data
} as const

interface CacheEntry<T> {
  key: string
  data: T
  timestamp: number
  ttl: number
}

let dbInstance: IDBDatabase | null = null
let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Initialize IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.NODES)) {
        db.createObjectStore(STORES.NODES, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.REGISTRY)) {
        db.createObjectStore(STORES.REGISTRY, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.GEOLOCATION)) {
        db.createObjectStore(STORES.GEOLOCATION, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        db.createObjectStore(STORES.FAVORITES, { keyPath: 'key' })
      }
    }
  })

  return dbPromise
}

/**
 * Get data from IndexedDB
 */
export async function getFromDB<T>(store: string, key: string): Promise<T | null> {
  try {
    const db = await initDB()

    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.get(key)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined

        if (!entry) {
          resolve(null)
          return
        }

        // Check TTL
        const now = Date.now()
        if (now - entry.timestamp > entry.ttl) {
          // Expired - delete and return null
          deleteFromDB(store, key)
          resolve(null)
          return
        }

        resolve(entry.data)
      }

      request.onerror = () => {
        console.error('IndexedDB get error:', request.error)
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

/**
 * Save data to IndexedDB
 */
export async function setToDB<T>(store: string, key: string, data: T, ttl: number): Promise<void> {
  try {
    const db = await initDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
      }

      const request = objectStore.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        console.error('IndexedDB set error:', request.error)
        reject(request.error)
      }
    })
  } catch (e) {
    console.error('IndexedDB set error:', e)
  }
}

/**
 * Delete from IndexedDB
 */
export async function deleteFromDB(store: string, key: string): Promise<void> {
  try {
    const db = await initDB()

    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => resolve() // Ignore errors on delete
    })
  } catch {
    // Ignore
  }
}

/**
 * Get all entries from a store
 */
export async function getAllFromDB<T>(store: string): Promise<Map<string, T>> {
  const results = new Map<string, T>()

  try {
    const db = await initDB()

    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readonly')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.getAll()

      request.onsuccess = () => {
        const entries = request.result as CacheEntry<T>[]
        const now = Date.now()

        entries.forEach(entry => {
          if (now - entry.timestamp <= entry.ttl) {
            results.set(entry.key, entry.data)
          }
        })

        resolve(results)
      }

      request.onerror = () => {
        console.error('IndexedDB getAll error:', request.error)
        resolve(results)
      }
    })
  } catch {
    return results
  }
}

/**
 * Batch set multiple entries
 */
export async function batchSetToDB<T>(
  store: string,
  entries: Array<{ key: string; data: T }>,
  ttl: number
): Promise<void> {
  if (entries.length === 0) return

  try {
    const db = await initDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const timestamp = Date.now()

      entries.forEach(({ key, data }) => {
        const entry: CacheEntry<T> = { key, data, timestamp, ttl }
        objectStore.put(entry)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        console.error('IndexedDB batch set error:', transaction.error)
        reject(transaction.error)
      }
    })
  } catch (e) {
    console.error('IndexedDB batch set error:', e)
  }
}

/**
 * Clear expired entries from a store
 */
export async function clearExpiredFromDB(store: string): Promise<void> {
  try {
    const db = await initDB()

    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.openCursor()
      const now = Date.now()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const entry = cursor.value as CacheEntry<unknown>
          if (now - entry.timestamp > entry.ttl) {
            cursor.delete()
          }
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    })
  } catch {
    // Ignore
  }
}

/**
 * Clear all data from a store
 */
export async function clearStore(store: string): Promise<void> {
  try {
    const db = await initDB()

    return new Promise((resolve) => {
      const transaction = db.transaction(store, 'readwrite')
      const objectStore = transaction.objectStore(store)
      const request = objectStore.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  } catch {
    // Ignore
  }
}

// Cache key generators
export const cacheKeys = {
  registryPods: (network: string) => `registry_${network}`,
  nodeData: (address: string) => `node_${address}`,
  geolocation: (ip: string) => `geo_${ip}`,
  lastUpdate: (network: string) => `lastUpdate_${network}`,
  favorite: (pubkey: string) => `fav_${pubkey}`,
  activityMeta: () => 'activity_meta',
  activityTransfers: () => 'activity_transfers',
  activityHolders: () => 'activity_holders',
  activityDefi: () => 'activity_defi',
  activityMarkets: () => 'activity_markets',
  activityPriceHistory: () => 'activity_price_history',
}
