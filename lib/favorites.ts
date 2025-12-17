// Favorites management using IndexedDB
// No TTL - favorites are permanent until explicitly removed

import { STORES, cacheKeys, getFromDB, setToDB, deleteFromDB, getAllFromDB } from './indexedDB'

// Very long TTL for favorites (effectively permanent - 10 years)
const FAVORITES_TTL = 10 * 365 * 24 * 60 * 60 * 1000

export interface FavoriteNode {
  pubkey: string
  label: string
  address: string
  addedAt: number
}

/**
 * Get all favorited node pubkeys
 */
export async function getFavorites(): Promise<Set<string>> {
  try {
    const all = await getAllFromDB<FavoriteNode>(STORES.FAVORITES)
    return new Set(Array.from(all.values()).map(f => f.pubkey))
  } catch {
    return new Set()
  }
}

/**
 * Get all favorite nodes with full data
 */
export async function getAllFavorites(): Promise<FavoriteNode[]> {
  try {
    const all = await getAllFromDB<FavoriteNode>(STORES.FAVORITES)
    return Array.from(all.values()).sort((a, b) => b.addedAt - a.addedAt)
  } catch {
    return []
  }
}

/**
 * Check if a node is favorited
 */
export async function isFavorited(pubkey: string): Promise<boolean> {
  if (!pubkey) return false
  try {
    const key = cacheKeys.favorite(pubkey)
    const result = await getFromDB<FavoriteNode>(STORES.FAVORITES, key)
    return result !== null
  } catch {
    return false
  }
}

/**
 * Add a node to favorites
 */
export async function addFavorite(node: { pubkey: string; label: string; address: string }): Promise<void> {
  if (!node.pubkey) return

  const favorite: FavoriteNode = {
    pubkey: node.pubkey,
    label: node.label,
    address: node.address,
    addedAt: Date.now(),
  }

  const key = cacheKeys.favorite(node.pubkey)
  await setToDB(STORES.FAVORITES, key, favorite, FAVORITES_TTL)
}

/**
 * Remove a node from favorites
 */
export async function removeFavorite(pubkey: string): Promise<void> {
  if (!pubkey) return
  const key = cacheKeys.favorite(pubkey)
  await deleteFromDB(STORES.FAVORITES, key)
}

/**
 * Toggle favorite status and return new state
 */
export async function toggleFavorite(node: { pubkey: string; label: string; address: string }): Promise<boolean> {
  if (!node.pubkey) return false

  const favorited = await isFavorited(node.pubkey)

  if (favorited) {
    await removeFavorite(node.pubkey)
    return false
  } else {
    await addFavorite(node)
    return true
  }
}
