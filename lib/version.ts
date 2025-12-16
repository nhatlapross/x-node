// Version utility for dynamic version detection and comparison

export interface VersionInfo {
  version: string
  major: number
  minor: number
  patch: number
  isPreRelease: boolean
  preReleaseTag?: string
}

/**
 * Check if a version is a pre-release (contains -alpha, -beta, -trynet, -rc, etc.)
 */
export function isPreReleaseVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false
  return version.includes('-')
}

/**
 * Check if a version is valid and not "unknown"
 */
export function isValidVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false
  if (version.toLowerCase() === 'unknown') return false
  return parseVersion(version) !== null
}

/**
 * Parse a version string like "0.6.0", "0.8", "v0.7.3" into components
 * Handles various formats: "0.8.0", "0.8", "v0.8.0", "V0.8"
 * Also handles pre-release versions like "0.8.0-trynet.20251212183600.9eea72e"
 */
export function parseVersion(version: string): VersionInfo | null {
  if (!version || typeof version !== 'string') return null
  if (version.toLowerCase() === 'unknown') return null

  // Clean the version string: remove 'v' or 'V' prefix, trim whitespace
  const cleaned = version.trim().replace(/^[vV]/, '').trim()

  // Check for pre-release tag
  const isPreRelease = cleaned.includes('-')
  const preReleaseTag = isPreRelease ? cleaned.split('-').slice(1).join('-') : undefined
  const baseVersion = isPreRelease ? cleaned.split('-')[0] : cleaned

  // Try matching 3-part version (major.minor.patch)
  let match = baseVersion.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (match) {
    return {
      version: cleaned,
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      isPreRelease,
      preReleaseTag,
    }
  }

  // Try matching 2-part version (major.minor) - treat patch as 0
  match = baseVersion.match(/^(\d+)\.(\d+)/)
  if (match) {
    return {
      version: cleaned,
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: 0,
      isPreRelease,
      preReleaseTag,
    }
  }

  // Try matching single number (major only)
  match = baseVersion.match(/^(\d+)$/)
  if (match) {
    return {
      version: cleaned,
      major: parseInt(match[1], 10),
      minor: 0,
      patch: 0,
      isPreRelease,
      preReleaseTag,
    }
  }

  return null
}

/**
 * Compare two version strings
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a)
  const vB = parseVersion(b)

  if (!vA && !vB) return 0
  if (!vA) return -1
  if (!vB) return 1

  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1

  return 0
}

/**
 * Find the latest STABLE version from a list of versions
 * - Ignores pre-release versions (containing -trynet, -beta, etc.)
 * - Ignores outliers (versions with very few nodes that might be misconfigured)
 * - Only considers versions that have at least minCount nodes
 */
export function findLatestVersion(versions: string[], minCount: number = 2): string | null {
  if (versions.length === 0) return null

  // Count occurrences of each version
  const counts = new Map<string, number>()
  versions.forEach(v => {
    if (v && isValidVersion(v)) {
      counts.set(v, (counts.get(v) || 0) + 1)
    }
  })

  // Filter to only stable versions with enough nodes
  const stableVersions = Array.from(counts.entries())
    .filter(([v, count]) => {
      const parsed = parseVersion(v)
      // Must be valid, not pre-release, and have at least minCount nodes
      return parsed && !parsed.isPreRelease && count >= minCount
    })
    .map(([v]) => v)

  if (stableVersions.length === 0) {
    // Fallback: if no stable versions meet criteria, use all valid versions with enough nodes
    const fallbackVersions = Array.from(counts.entries())
      .filter(([v, count]) => isValidVersion(v) && count >= minCount)
      .map(([v]) => v)

    if (fallbackVersions.length === 0) return null

    return fallbackVersions.reduce((latest, current) => {
      if (!latest) return current
      return compareVersions(current, latest) > 0 ? current : latest
    }, fallbackVersions[0])
  }

  return stableVersions.reduce((latest, current) => {
    if (!latest) return current
    return compareVersions(current, latest) > 0 ? current : latest
  }, stableVersions[0])
}

/**
 * Get version distribution from a list of versions
 * Returns sorted by version (newest first) with counts
 */
export function getVersionDistribution(versions: string[]): Array<{ version: string; count: number }> {
  const counts = new Map<string, number>()

  versions.forEach(v => {
    if (v && parseVersion(v)) {
      // Normalize the version for grouping
      counts.set(v, (counts.get(v) || 0) + 1)
    }
  })

  return Array.from(counts.entries())
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => compareVersions(b.version, a.version)) // Newest first
}

/**
 * Check if a version is the latest
 */
export function isLatestVersion(version: string, latestVersion: string): boolean {
  return compareVersions(version, latestVersion) >= 0
}

/**
 * Get version status label and color
 */
export type VersionStatus = 'latest' | 'outdated' | 'unknown'

export function getVersionStatus(version: string | undefined, latestVersion: string | null): VersionStatus {
  if (!version || !latestVersion) return 'unknown'
  if (!parseVersion(version) || !parseVersion(latestVersion)) return 'unknown'

  const comparison = compareVersions(version, latestVersion)
  if (comparison >= 0) return 'latest'
  return 'outdated'
}

/**
 * Get color for version status (for globe visualization)
 */
export function getVersionColor(version: string | undefined, latestVersion: string | null, isOnline: boolean): string {
  if (!isOnline) return '#ef4444' // Red for offline

  const status = getVersionStatus(version, latestVersion)

  switch (status) {
    case 'latest':
      return '#22c55e' // Green
    case 'outdated':
      return '#eab308' // Yellow/amber
    case 'unknown':
    default:
      return '#6b7280' // Gray
  }
}

/**
 * Format version for display - normalize to vX.Y.Z format
 */
export function formatVersion(version: string | undefined): string {
  if (!version) return 'N/A'

  const parsed = parseVersion(version)
  if (!parsed) return version // Return original if can't parse

  // Return normalized format
  return `v${parsed.major}.${parsed.minor}.${parsed.patch}`
}

/**
 * Normalize version string (remove prefix, standardize format)
 */
export function normalizeVersion(version: string): string {
  const parsed = parseVersion(version)
  if (!parsed) return version
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`
}
