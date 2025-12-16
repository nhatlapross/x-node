'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getFromCache, setToCache, CACHE_TTL, cacheKeys } from './cache'

// Types
export interface VersionResponse {
  version: string
}

export interface StatsResponse {
  active_streams: number
  cpu_percent: number
  current_index: number
  file_size: number
  last_updated: number
  packets_received: number
  packets_sent: number
  ram_total: number
  ram_used: number
  total_bytes: number
  total_pages: number
  uptime: number
}

export interface Pod {
  address: string
  version: string
  last_seen?: string
  last_seen_timestamp: number
  pubkey?: string | null
}

export interface PodsResponse {
  pods: Pod[]
  total_count: number
}

export interface NodeData {
  ip: string
  address: string
  label: string
  pubkey: string | null
  registryVersion: string
  status: 'online' | 'offline' | 'loading'
  version?: VersionResponse
  stats?: StatsResponse
  pods?: PodsResponse
  error?: string
  lastFetched?: number
  location?: {
    city: string
    country: string
    countryCode?: string
  }
}

export interface NetworkPod {
  address: string
  last_seen_timestamp: number
  pubkey: string | null
  version: string
}

export interface NetworkConfig {
  id: string
  name: string
  rpcUrl: string
  type: 'devnet' | 'mainnet'
}

export const NETWORK_RPC_ENDPOINTS: NetworkConfig[] = [
  { id: 'devnet1', name: 'Devnet 1', rpcUrl: 'https://rpc1.pchednode.com/rpc', type: 'devnet' },
  { id: 'devnet2', name: 'Devnet 2', rpcUrl: 'https://rpc2.pchednode.com/rpc', type: 'devnet' },
  { id: 'mainnet1', name: 'Mainnet 1', rpcUrl: 'https://rpc3.pchednode.com/rpc', type: 'mainnet' },
  { id: 'mainnet2', name: 'Mainnet 2', rpcUrl: 'https://rpc4.pchednode.com/rpc', type: 'mainnet' },
]

// API helpers
async function callRpcEndpoint(endpoint: string, method: string) {
  try {
    const response = await fetch('/api/prpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method }),
    })
    return response.json()
  } catch (error) {
    return { error: String(error) }
  }
}

async function callApi(ip: string, method: string) {
  try {
    const response = await fetch('/api/prpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: `http://${ip}:6000/rpc`,
        method,
      }),
    })
    return response.json()
  } catch (error) {
    return { error: String(error) }
  }
}

interface UseNodeDataOptions {
  networkId: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseNodeDataReturn {
  nodes: NodeData[]
  registryPods: NetworkPod[]
  registryStatus: 'loading' | 'success' | 'error'
  registryError: string | null
  isLoading: boolean
  isCached: boolean
  lastUpdate: Date | null
  refresh: () => Promise<void>
  changeNetwork: (networkId: string) => void
  selectedNetwork: string
}

export function useNodeData({
  networkId,
  autoRefresh = false,
  refreshInterval = 60000,
}: UseNodeDataOptions): UseNodeDataReturn {
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [registryPods, setRegistryPods] = useState<NetworkPod[]>([])
  const [registryStatus, setRegistryStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState(networkId)

  // Request deduplication
  const fetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load cached registry pods
  const loadCachedRegistry = useCallback((netId: string): NetworkPod[] | null => {
    const cached = getFromCache<NetworkPod[]>(cacheKeys.registryPods(netId))
    return cached
  }, [])

  // Load cached node data
  const loadCachedNodes = useCallback((pods: NetworkPod[]): NodeData[] => {
    return pods.map((pod, idx) => {
      const cached = getFromCache<NodeData>(cacheKeys.nodeData(pod.address))
      if (cached && cached.status !== 'loading') {
        return cached
      }
      return {
        ip: pod.address.split(':')[0],
        address: pod.address,
        label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
        pubkey: pod.pubkey,
        registryVersion: pod.version,
        status: 'loading' as const,
      }
    })
  }, [])

  // Fetch registry pods
  const fetchRegistryPods = useCallback(async (netId: string, useCacheFirst: boolean = true) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === netId)
    if (!network) return

    // Try cache first for instant display
    if (useCacheFirst) {
      const cachedPods = loadCachedRegistry(netId)
      if (cachedPods && cachedPods.length > 0) {
        setRegistryPods(cachedPods)
        setRegistryStatus('success')
        setIsCached(true)
        const cachedNodes = loadCachedNodes(cachedPods)
        setNodes(cachedNodes)
      }
    }

    // Fetch fresh data
    const res = await callRpcEndpoint(network.rpcUrl, 'get-pods')

    if (res.error) {
      // Only set error if we don't have cached data
      if (!useCacheFirst || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError(res.error)
      }
      return
    }

    const data = res.result as { pods: NetworkPod[]; total_count: number }
    if (!data.pods || data.pods.length === 0) {
      if (!useCacheFirst || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError('No pods found in registry')
      }
      return
    }

    // Sort by last_seen_timestamp (most recent first)
    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp)

    // Cache the registry pods
    setToCache(cacheKeys.registryPods(netId), sortedPods, CACHE_TTL.REGISTRY_PODS)

    setRegistryPods(sortedPods)
    setRegistryStatus('success')
    setIsCached(false)

    // Initialize nodes with cached data if available
    const initialNodes = loadCachedNodes(sortedPods)
    setNodes(initialNodes)
  }, [loadCachedRegistry, loadCachedNodes, registryPods.length])

  // Fetch single node data
  const fetchNodeData = useCallback(async (pod: NetworkPod, index: number): Promise<NodeData> => {
    const ip = pod.address.split(':')[0]
    const baseData: NodeData = {
      ip,
      address: pod.address,
      label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${index + 1}`,
      pubkey: pod.pubkey,
      registryVersion: pod.version,
      status: 'loading',
    }

    // Phase 1: Fetch version and stats in parallel
    const [versionRes, statsRes] = await Promise.all([
      callApi(ip, 'get-version'),
      callApi(ip, 'get-stats'),
    ])

    if (versionRes.error && statsRes.error) {
      const offlineResult: NodeData = {
        ...baseData,
        status: 'offline',
        error: versionRes.error || statsRes.error,
        lastFetched: Date.now(),
      }
      setToCache(cacheKeys.nodeData(pod.address), offlineResult, CACHE_TTL.NODE_DATA)
      return offlineResult
    }

    // Phase 2: Fetch pods data
    const podsRes = await callApi(ip, 'get-pods')

    const result: NodeData = {
      ...baseData,
      status: 'online',
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      pods: podsRes.result as PodsResponse | undefined,
      lastFetched: Date.now(),
    }

    // Cache the result
    setToCache(cacheKeys.nodeData(pod.address), result, CACHE_TTL.NODE_DATA)
    return result
  }, [])

  // Fetch all nodes with optimized batching
  const fetchAllNodes = useCallback(async () => {
    if (fetchingRef.current || registryPods.length === 0) return
    fetchingRef.current = true
    setIsLoading(true)

    // Cancel any previous fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Larger batch size for faster loading
    const BATCH_SIZE = 10 // Increased from 5
    const batches: NetworkPod[][] = []

    for (let i = 0; i < registryPods.length; i += BATCH_SIZE) {
      batches.push(registryPods.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      if (abortControllerRef.current?.signal.aborted) break

      const results = await Promise.all(
        batch.map((pod) => {
          const globalIdx = registryPods.indexOf(pod)
          return fetchNodeData(pod, globalIdx)
        })
      )

      // Update nodes progressively
      setNodes(prev => {
        const updated = [...prev]
        results.forEach(result => {
          const idx = updated.findIndex(n => n.address === result.address)
          if (idx !== -1) {
            updated[idx] = result
          }
        })
        return updated
      })
    }

    setLastUpdate(new Date())
    setIsLoading(false)
    setIsCached(false)
    fetchingRef.current = false
  }, [registryPods, fetchNodeData])

  // Manual refresh
  const refresh = useCallback(async () => {
    if (fetchingRef.current) return
    await fetchRegistryPods(selectedNetwork, false)
  }, [fetchRegistryPods, selectedNetwork])

  // Change network
  const changeNetwork = useCallback((netId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    fetchingRef.current = false
    setSelectedNetwork(netId)
    setNodes([])
    setRegistryPods([])
    setRegistryStatus('loading')
    setRegistryError(null)
    fetchRegistryPods(netId, true)
  }, [fetchRegistryPods])

  // Initial fetch
  useEffect(() => {
    fetchRegistryPods(selectedNetwork, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch nodes when registry changes
  useEffect(() => {
    if (registryStatus === 'success' && registryPods.length > 0) {
      // Only fetch if we have loading nodes (not fully cached)
      const hasLoadingNodes = nodes.some(n => n.status === 'loading')
      if (hasLoadingNodes || !isCached) {
        fetchAllNodes()
      }
    }
  }, [registryStatus, registryPods.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchAllNodes()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchAllNodes])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    nodes,
    registryPods,
    registryStatus,
    registryError,
    isLoading,
    isCached,
    lastUpdate,
    refresh,
    changeNetwork,
    selectedNetwork,
  }
}
