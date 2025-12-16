// Geolocation utility for IP addresses with persistent caching

import { getFromCache, setToCache, CACHE_TTL, cacheKeys } from './cache'

export interface GeoLocation {
  lat: number
  lng: number
  city: string
  country: string
  countryCode: string
  region: string
}

// In-memory cache (populated from localStorage on first access)
let geoCache: Map<string, GeoLocation> | null = null
let cacheInitialized = false

// Mock data as fallback
const mockLocations: GeoLocation[] = [
  { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'USA', countryCode: 'US', region: 'North America' },
  { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'USA', countryCode: 'US', region: 'North America' },
  { lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK', countryCode: 'GB', region: 'Europe' },
  { lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'Germany', countryCode: 'DE', region: 'Europe' },
  { lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'France', countryCode: 'FR', region: 'Europe' },
  { lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan', countryCode: 'JP', region: 'Asia' },
  { lat: 1.3521, lng: 103.8198, city: 'Singapore', country: 'Singapore', countryCode: 'SG', region: 'Asia' },
  { lat: 37.5665, lng: 126.9780, city: 'Seoul', country: 'South Korea', countryCode: 'KR', region: 'Asia' },
  { lat: -33.8688, lng: 151.2093, city: 'Sydney', country: 'Australia', countryCode: 'AU', region: 'Oceania' },
  { lat: 43.6532, lng: -79.3832, city: 'Toronto', country: 'Canada', countryCode: 'CA', region: 'North America' },
  { lat: 55.7558, lng: 37.6173, city: 'Moscow', country: 'Russia', countryCode: 'RU', region: 'Europe' },
  { lat: 19.4326, lng: -99.1332, city: 'Mexico City', country: 'Mexico', countryCode: 'MX', region: 'North America' },
  { lat: -23.5505, lng: -46.6333, city: 'São Paulo', country: 'Brazil', countryCode: 'BR', region: 'South America' },
  { lat: 28.6139, lng: 77.2090, city: 'New Delhi', country: 'India', countryCode: 'IN', region: 'Asia' },
  { lat: 41.9028, lng: 12.4964, city: 'Rome', country: 'Italy', countryCode: 'IT', region: 'Europe' },
]

/**
 * Initialize cache from localStorage
 */
function initCache(): Map<string, GeoLocation> {
  if (geoCache && cacheInitialized) return geoCache

  geoCache = new Map<string, GeoLocation>()

  // Try to load from localStorage
  const cached = getFromCache<Record<string, GeoLocation>>(cacheKeys.geolocations())
  if (cached) {
    Object.entries(cached).forEach(([ip, location]) => {
      geoCache!.set(ip, location)
    })
  }

  cacheInitialized = true
  return geoCache
}

/**
 * Save cache to localStorage
 */
function saveCache(): void {
  if (!geoCache) return

  const cacheObject: Record<string, GeoLocation> = {}
  geoCache.forEach((location, ip) => {
    cacheObject[ip] = location
  })

  setToCache(cacheKeys.geolocations(), cacheObject, CACHE_TTL.GEOLOCATION)
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Get mock geolocation (fallback)
 */
function getMockGeolocation(ipAddress: string): GeoLocation {
  const index = hashCode(ipAddress) % mockLocations.length
  const location = mockLocations[index]

  const offset = 0.5
  const randomLat = (hashCode(ipAddress + 'lat') % 100) / 100 * offset - offset/2
  const randomLng = (hashCode(ipAddress + 'lng') % 100) / 100 * offset - offset/2

  return {
    ...location,
    lat: location.lat + randomLat,
    lng: location.lng + randomLng,
  }
}

/**
 * Get real geographic location for an IP address using ip-api.com
 * Falls back to mock data if API fails
 */
export async function getGeolocation(ipAddress: string): Promise<GeoLocation> {
  const cache = initCache()

  // Check cache first
  if (cache.has(ipAddress)) {
    return cache.get(ipAddress)!
  }

  try {
    // Call ip-api.com (free, no API key needed, 45 req/min)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,city,lat,lon,continentCode`)

    if (!response.ok) {
      throw new Error('API request failed')
    }

    const data = await response.json()

    if (data.status === 'fail') {
      console.warn(`Geolocation failed for ${ipAddress}, using mock data`)
      const mockLocation = getMockGeolocation(ipAddress)
      cache.set(ipAddress, mockLocation)
      return mockLocation
    }

    const location: GeoLocation = {
      lat: data.lat,
      lng: data.lon,
      city: data.city || 'Unknown',
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'XX',
      region: getRegionFromContinent(data.continentCode),
    }

    // Cache the result
    cache.set(ipAddress, location)
    return location

  } catch (error) {
    console.warn(`Geolocation error for ${ipAddress}:`, error, '- using mock data')
    const mockLocation = getMockGeolocation(ipAddress)
    cache.set(ipAddress, mockLocation)
    return mockLocation
  }
}

/**
 * Batch geocode multiple IP addresses with rate limiting
 * Optimized: skips already cached IPs, saves to localStorage after completion
 */
export async function batchGeolocate(ipAddresses: string[]): Promise<Map<string, GeoLocation>> {
  const cache = initCache()
  const results = new Map<string, GeoLocation>()

  // Separate cached and uncached IPs
  const uncachedIps: string[] = []

  ipAddresses.forEach(ip => {
    if (cache.has(ip)) {
      results.set(ip, cache.get(ip)!)
    } else {
      uncachedIps.push(ip)
    }
  })

  // If all IPs are cached, return immediately
  if (uncachedIps.length === 0) {
    return results
  }

  // Process uncached IPs in batches (45/min for ip-api.com)
  const BATCH_SIZE = 15  // Increased from 10 for faster loading
  const DELAY_MS = 1000  // Reduced from 1500ms

  for (let i = 0; i < uncachedIps.length; i += BATCH_SIZE) {
    const batch = uncachedIps.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        const location = await getGeolocation(ip)
        return { ip, location }
      })
    )

    // Add to results map
    batchResults.forEach(({ ip, location }) => {
      results.set(ip, location)
    })

    // Wait before next batch (except for last batch)
    if (i + BATCH_SIZE < uncachedIps.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  // Save updated cache to localStorage
  saveCache()

  return results
}

/**
 * Map continent code to region name
 */
function getRegionFromContinent(code: string): string {
  const regions: Record<string, string> = {
    'AF': 'Africa',
    'AN': 'Antarctica',
    'AS': 'Asia',
    'EU': 'Europe',
    'NA': 'North America',
    'OC': 'Oceania',
    'SA': 'South America',
  }
  return regions[code] || 'Unknown'
}

/**
 * Clear the geolocation cache (useful for testing)
 */
export function clearGeoCache() {
  geoCache?.clear()
  cacheInitialized = false
}

/**
 * Get current cache size (for debugging)
 */
export function getGeoCacheSize(): number {
  return initCache().size
}
