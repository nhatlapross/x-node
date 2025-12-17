'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { proxyEndpoints, HistoryPeriod, HistoryInterval, USE_PROXY } from './proxyConfig'

// Re-export types from proxyConfig for convenience
export type { HistoryPeriod, HistoryInterval } from './proxyConfig'

// ============================================
// Types for Historical Data API Responses
// ============================================

export interface NetworkSnapshot {
  timestamp: string
  totalPods: number
  onlineNodes: number
  offlineNodes: number
  totalStorage: number
  avgCpu: number
  avgRam: number
  totalStreams: number
  totalBytesTransferred: number
  versionDistribution: Record<string, number>
}

export interface NodeHistoryEntry {
  timestamp: string
  status: 'online' | 'offline'
  version: string
  cpu: number
  ram: number
  storage: number
  uptime: number
  activeStreams: number
  packetsReceived: number
  packetsSent: number
  peersCount: number
}

export interface AggregatedStats {
  totalPods: number
  totalOnline: number
  totalOffline: number
  avgCpuAllNetworks: number
  avgRamAllNetworks: number
  totalStorageAllNetworks: number
}

export interface LatestNetworkData {
  network: string
  timestamp: string
  totalPods: number
  onlineNodes: number
  offlineNodes: number
  avgCpu: number
  avgRam: number
  totalStorage: number
}

// Chart-ready data types (pre-formatted by backend)
export interface ChartNodeData {
  time: number
  online: number
  offline: number
  total: number
}

export interface ChartResourceData {
  time: number
  cpu: number
  ram: number
}

export interface ChartStorageData {
  time: number
  storage: number
  streams: number
}

export interface NetworkChartData {
  nodes: ChartNodeData[]
  resources: ChartResourceData[]
  storage: ChartStorageData[]
}

export interface ComparisonData {
  time: number
  online: number
  total: number
  avgCpu: number
}

// API Response types
export interface NetworkHistoryResponse {
  success: boolean
  network: string
  period: string
  interval: string
  count: number
  data: NetworkSnapshot[]
}

export interface NodeHistoryResponse {
  success: boolean
  address: string
  period: string
  count: number
  data: NodeHistoryEntry[]
}

export interface HistoryStatsResponse {
  success: boolean
  period: string
  aggregated: AggregatedStats
  latest: Record<string, LatestNetworkData>
}

export interface HistoryLatestResponse {
  success: boolean
  data: Record<string, LatestNetworkData> | LatestNetworkData
}

export interface NetworkChartsResponse {
  success: boolean
  network: string
  period: string
  interval: string
  charts: NetworkChartData
}

export interface ChartsComparisonResponse {
  success: boolean
  period: string
  interval: string
  networks: string[]
  data: Record<string, ComparisonData[]>
}

// ============================================
// Custom Hook for Network Historical Data
// ============================================

interface UseNetworkHistoryOptions {
  network: string
  period?: HistoryPeriod
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseNetworkHistoryReturn {
  data: NetworkSnapshot[]
  chartData: NetworkChartData | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  setPeriod: (period: HistoryPeriod) => void
  currentPeriod: HistoryPeriod
}

export function useNetworkHistory({
  network,
  period: initialPeriod = '24h',
  autoRefresh = false,
  refreshInterval = 60000,
}: UseNetworkHistoryOptions): UseNetworkHistoryReturn {
  const [data, setData] = useState<NetworkSnapshot[]>([])
  const [chartData, setChartData] = useState<NetworkChartData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<HistoryPeriod>(initialPeriod)

  const fetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync period with prop changes
  useEffect(() => {
    setCurrentPeriod(initialPeriod)
  }, [initialPeriod])

  const fetchHistory = useCallback(async () => {
    // Debug: Log proxy status
    if (process.env.NODE_ENV === 'development') {
      console.log('[useNetworkHistory] USE_PROXY:', USE_PROXY, 'PROXY_URL:', proxyEndpoints.networkCharts(network, currentPeriod))
    }

    if (!USE_PROXY || fetchingRef.current || !network) {
      if (process.env.NODE_ENV === 'development' && !USE_PROXY) {
        console.warn('[useNetworkHistory] Proxy not configured. Set NEXT_PUBLIC_PROXY_URL in .env.local and restart the dev server.')
      }
      return
    }

    fetchingRef.current = true
    setIsLoading(true)
    setError(null)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      // Fetch both raw history and chart-formatted data in parallel
      const [historyRes, chartsRes] = await Promise.all([
        fetch(proxyEndpoints.networkHistory(network, currentPeriod), {
          signal: abortControllerRef.current.signal,
        }),
        fetch(proxyEndpoints.networkCharts(network, currentPeriod), {
          signal: abortControllerRef.current.signal,
        }),
      ])

      if (!historyRes.ok) {
        throw new Error(`Failed to fetch history: ${historyRes.status}`)
      }

      const historyData: NetworkHistoryResponse = await historyRes.json()

      if (process.env.NODE_ENV === 'development') {
        console.log('[useNetworkHistory] Received history data:', historyData.count, 'entries')
      }

      if (!historyData.success) {
        throw new Error('Failed to fetch network history')
      }

      setData(historyData.data)

      if (chartsRes.ok) {
        const chartsData: NetworkChartsResponse = await chartsRes.json()
        if (process.env.NODE_ENV === 'development') {
          console.log('[useNetworkHistory] Received chart data:', {
            nodes: chartsData.charts?.nodes?.length || 0,
            resources: chartsData.charts?.resources?.length || 0,
            storage: chartsData.charts?.storage?.length || 0,
          })
        }
        if (chartsData.success) {
          setChartData(chartsData.charts)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[useNetworkHistory] Error:', err.message)
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [network, currentPeriod])

  const refresh = useCallback(async () => {
    await fetchHistory()
  }, [fetchHistory])

  const setPeriod = useCallback((period: HistoryPeriod) => {
    setCurrentPeriod(period)
  }, [])

  // Initial fetch and refetch on network/period change
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchHistory()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchHistory])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    data,
    chartData,
    isLoading,
    error,
    refresh,
    setPeriod,
    currentPeriod,
  }
}

// ============================================
// Custom Hook for Node Historical Data
// ============================================

interface UseNodeHistoryOptions {
  address: string
  period?: HistoryPeriod
  enabled?: boolean
}

interface UseNodeHistoryReturn {
  data: NodeHistoryEntry[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useNodeHistory({
  address,
  period = '24h',
  enabled = true,
}: UseNodeHistoryOptions): UseNodeHistoryReturn {
  const [data, setData] = useState<NodeHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchingRef = useRef(false)

  const fetchHistory = useCallback(async () => {
    if (!USE_PROXY || fetchingRef.current || !address || !enabled) return

    fetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(proxyEndpoints.nodeHistory(address, period))

      if (!response.ok) {
        throw new Error(`Failed to fetch node history: ${response.status}`)
      }

      const result: NodeHistoryResponse = await response.json()

      if (!result.success) {
        throw new Error('Failed to fetch node history')
      }

      setData(result.data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [address, period, enabled])

  const refresh = useCallback(async () => {
    await fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (enabled) {
      fetchHistory()
    }
  }, [fetchHistory, enabled])

  return {
    data,
    isLoading,
    error,
    refresh,
  }
}

// ============================================
// Custom Hook for Aggregated Stats
// ============================================

interface UseHistoryStatsOptions {
  period?: HistoryPeriod
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseHistoryStatsReturn {
  aggregated: AggregatedStats | null
  latest: Record<string, LatestNetworkData>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useHistoryStats({
  period = '24h',
  autoRefresh = false,
  refreshInterval = 60000,
}: UseHistoryStatsOptions = {}): UseHistoryStatsReturn {
  const [aggregated, setAggregated] = useState<AggregatedStats | null>(null)
  const [latest, setLatest] = useState<Record<string, LatestNetworkData>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchingRef = useRef(false)

  const fetchStats = useCallback(async () => {
    if (!USE_PROXY || fetchingRef.current) return

    fetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(proxyEndpoints.historyStats(period))

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`)
      }

      const result: HistoryStatsResponse = await response.json()

      if (!result.success) {
        throw new Error('Failed to fetch history stats')
      }

      setAggregated(result.aggregated)
      setLatest(result.latest)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [period])

  const refresh = useCallback(async () => {
    await fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchStats()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchStats])

  return {
    aggregated,
    latest,
    isLoading,
    error,
    refresh,
  }
}

// ============================================
// Custom Hook for Network Comparison
// ============================================

interface UseNetworkComparisonOptions {
  period?: HistoryPeriod
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseNetworkComparisonReturn {
  networks: string[]
  data: Record<string, ComparisonData[]>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  setPeriod: (period: HistoryPeriod) => void
  currentPeriod: HistoryPeriod
}

export function useNetworkComparison({
  period: initialPeriod = '24h',
  autoRefresh = false,
  refreshInterval = 60000,
}: UseNetworkComparisonOptions = {}): UseNetworkComparisonReturn {
  const [networks, setNetworks] = useState<string[]>([])
  const [data, setData] = useState<Record<string, ComparisonData[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<HistoryPeriod>(initialPeriod)

  const fetchingRef = useRef(false)

  const fetchComparison = useCallback(async () => {
    if (!USE_PROXY || fetchingRef.current) return

    fetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(proxyEndpoints.chartsComparison(currentPeriod))

      if (!response.ok) {
        throw new Error(`Failed to fetch comparison: ${response.status}`)
      }

      const result: ChartsComparisonResponse = await response.json()

      if (!result.success) {
        throw new Error('Failed to fetch network comparison')
      }

      setNetworks(result.networks)
      setData(result.data)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [currentPeriod])

  const refresh = useCallback(async () => {
    await fetchComparison()
  }, [fetchComparison])

  const setPeriod = useCallback((period: HistoryPeriod) => {
    setCurrentPeriod(period)
  }, [])

  useEffect(() => {
    fetchComparison()
  }, [fetchComparison])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchComparison()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchComparison])

  return {
    networks,
    data,
    isLoading,
    error,
    refresh,
    setPeriod,
    currentPeriod,
  }
}

// ============================================
// Utility: Fetch latest data (real-time)
// ============================================

export async function fetchLatestData(network?: string): Promise<LatestNetworkData | Record<string, LatestNetworkData> | null> {
  if (!USE_PROXY) return null

  try {
    const response = await fetch(proxyEndpoints.historyLatest(network))

    if (!response.ok) {
      throw new Error(`Failed to fetch latest data: ${response.status}`)
    }

    const result: HistoryLatestResponse = await response.json()

    if (!result.success) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}
