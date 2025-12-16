'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getFromDB,
  setToDB,
  getAllFromDB,
  batchSetToDB,
  STORES,
  CACHE_TTL,
  cacheKeys,
} from './indexedDB'

// Types
export interface NetworkPod {
  address: string
  last_seen_timestamp: number
  pubkey: string | null
  version: string
}

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

export interface PodsResponse {
  pods: NetworkPod[]
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

interface UseNodeCacheOptions {
  networkId: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseNodeCacheReturn {
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

export function useNodeCache({
  networkId,
  autoRefresh = false,
  refreshInterval = 60000,
}: UseNodeCacheOptions): UseNodeCacheReturn {
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [registryPods, setRegistryPods] = useState<NetworkPod[]>([])
  const [registryStatus, setRegistryStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState(networkId)

  const fetchingRef = useRef(false)
  const initialLoadDone = useRef(false)

  // Load all cached nodes from IndexedDB
  const loadCachedData = useCallback(async (netId: string): Promise<{
    pods: NetworkPod[] | null
    nodes: Map<string, NodeData>
  }> => {
    const [cachedPods, cachedNodes] = await Promise.all([
      getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(netId)),
      getAllFromDB<NodeData>(STORES.NODES),
    ])

    return {
      pods: cachedPods,
      nodes: cachedNodes,
    }
  }, [])

  // Initialize nodes from pods with cache
  const initNodesFromPods = useCallback((
    pods: NetworkPod[],
    cachedNodes: Map<string, NodeData>
  ): NodeData[] => {
    return pods.map((pod, idx) => {
      const cacheKey = cacheKeys.nodeData(pod.address)
      const cached = cachedNodes.get(cacheKey)

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
      // Save to IndexedDB
      await setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), offlineResult, CACHE_TTL.NODE_DATA)
      return offlineResult
    }

    const podsRes = await callApi(ip, 'get-pods')

    const result: NodeData = {
      ...baseData,
      status: 'online',
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      pods: podsRes.result as PodsResponse | undefined,
      lastFetched: Date.now(),
    }

    // Save to IndexedDB
    await setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), result, CACHE_TTL.NODE_DATA)
    return result
  }, [])

  // Fetch registry pods
  const fetchRegistryPods = useCallback(async (netId: string, forceRefresh: boolean = false) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === netId)
    if (!network) return

    setRegistryError(null)

    // Load from cache first (instant display)
    if (!forceRefresh) {
      const { pods: cachedPods, nodes: cachedNodes } = await loadCachedData(netId)

      if (cachedPods && cachedPods.length > 0) {
        setRegistryPods(cachedPods)
        setRegistryStatus('success')
        setIsCached(true)

        const initialNodes = initNodesFromPods(cachedPods, cachedNodes)
        setNodes(initialNodes)

        // Count how many are already loaded vs need fetching
        const loadedCount = initialNodes.filter(n => n.status !== 'loading').length

        // If all nodes are cached, we're done
        if (loadedCount === initialNodes.length) {
          setLastUpdate(new Date())
          return
        }
      }
    }

    // Fetch fresh registry data in background
    const res = await callRpcEndpoint(network.rpcUrl, 'get-pods')

    if (res.error) {
      if (forceRefresh || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError(res.error)
      }
      return
    }

    const data = res.result as { pods: NetworkPod[]; total_count: number }
    if (!data.pods || data.pods.length === 0) {
      if (forceRefresh || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError('No pods found in registry')
      }
      return
    }

    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp)

    // Save to IndexedDB
    await setToDB(STORES.REGISTRY, cacheKeys.registryPods(netId), sortedPods, CACHE_TTL.REGISTRY_PODS)

    setRegistryPods(sortedPods)
    setRegistryStatus('success')

    // Get cached nodes
    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES)
    const initialNodes = initNodesFromPods(sortedPods, cachedNodes)
    setNodes(initialNodes)
    setIsCached(false)
  }, [loadCachedData, initNodesFromPods, registryPods.length])

  // Fetch all nodes that need updating
  const fetchAllNodes = useCallback(async (forceRefresh: boolean = false) => {
    if (fetchingRef.current || registryPods.length === 0) return
    fetchingRef.current = true
    setIsLoading(true)

    // Get cached nodes to skip already-loaded ones
    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES)

    // Filter pods that need fetching
    const podsToFetch = forceRefresh
      ? registryPods
      : registryPods.filter(pod => {
          const cacheKey = cacheKeys.nodeData(pod.address)
          const cached = cachedNodes.get(cacheKey)
          return !cached || cached.status === 'loading'
        })

    if (podsToFetch.length === 0) {
      setLastUpdate(new Date())
      setIsLoading(false)
      fetchingRef.current = false
      return
    }

    // Batch fetch
    const BATCH_SIZE = 10
    const batches: NetworkPod[][] = []

    for (let i = 0; i < podsToFetch.length; i += BATCH_SIZE) {
      batches.push(podsToFetch.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((pod) => {
          const globalIdx = registryPods.indexOf(pod)
          return fetchNodeData(pod, globalIdx)
        })
      )

      // Update state progressively
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
    await fetchRegistryPods(selectedNetwork, true)
    await fetchAllNodes(true)
  }, [fetchRegistryPods, selectedNetwork, fetchAllNodes])

  // Change network
  const changeNetwork = useCallback((netId: string) => {
    fetchingRef.current = false
    setSelectedNetwork(netId)
    setNodes([])
    setRegistryPods([])
    setRegistryStatus('loading')
    setRegistryError(null)
    initialLoadDone.current = false
    fetchRegistryPods(netId, false)
  }, [fetchRegistryPods])

  // Initial load
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    fetchRegistryPods(selectedNetwork, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch nodes when registry is ready
  useEffect(() => {
    if (registryStatus === 'success' && registryPods.length > 0) {
      const hasLoadingNodes = nodes.some(n => n.status === 'loading')
      if (hasLoadingNodes) {
        fetchAllNodes(false)
      }
    }
  }, [registryStatus, registryPods.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (!fetchingRef.current) {
        fetchAllNodes(false)
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchAllNodes])

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
