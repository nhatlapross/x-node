'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { batchGeolocate } from '@/lib/geolocation'
import { getFromDB, setToDB, getAllFromDB, STORES, CACHE_TTL, cacheKeys } from '@/lib/indexedDB'
import { PROXY_URL, USE_PROXY, proxyEndpoints } from '@/lib/proxyConfig'

// Types
interface VersionResponse {
  version: string
}

interface StatsResponse {
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

export interface NodeData {
  ip: string
  address: string
  label: string
  pubkey: string | null
  registryVersion: string
  status: 'online' | 'offline' | 'loading'
  version?: VersionResponse
  stats?: StatsResponse
  error?: string
  lastFetched?: number
  location?: {
    city: string
    country: string
    countryCode?: string
  }
}

interface NetworkPod {
  address: string
  last_seen_timestamp: number
  pubkey: string | null
  version: string
}

interface NetworkPodsResponse {
  pods: NetworkPod[]
  total_count: number
}

interface PodCredit {
  pod_id: string
  credits: number
}

interface PodCreditsResponse {
  pods_credits: PodCredit[]
  status: string
}

interface NetworkConfig {
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

interface NodesContextValue {
  // Network state
  selectedNetwork: string
  setSelectedNetwork: (network: string) => void
  currentNetwork: NetworkConfig

  // Data
  nodes: NodeData[]
  registryPods: NetworkPod[]
  podCredits: Map<string, number>

  // Loading states
  isLoading: boolean
  registryStatus: 'loading' | 'success' | 'error'
  registryError: string | null
  isCached: boolean
  lastUpdate: Date | null

  // Actions
  refreshData: (forceRefresh?: boolean) => Promise<void>
  refreshPodCredits: () => Promise<void>
}

const NodesContext = createContext<NodesContextValue | null>(null)

export function useNodes() {
  const context = useContext(NodesContext)
  if (!context) {
    throw new Error('useNodes must be used within NodesProvider')
  }
  return context
}

interface NodesProviderProps {
  children: ReactNode
  initialNetwork?: string
}

export function NodesProvider({ children, initialNetwork = 'devnet1' }: NodesProviderProps) {
  const [selectedNetwork, setSelectedNetworkState] = useState(initialNetwork)
  const [registryPods, setRegistryPods] = useState<NetworkPod[]>([])
  const [registryStatus, setRegistryStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [podCredits, setPodCredits] = useState<Map<string, number>>(new Map())

  const lastFetchedNetworkRef = useRef<string | null>(null)
  const lastGeoFetchRef = useRef<number>(0)

  const currentNetwork = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork)!

  // Call RPC endpoint - prioritize external proxy to avoid CORS errors
  const callRpcEndpoint = useCallback(async (
    rpcUrl: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    // Try external proxy first if configured
    if (USE_PROXY && PROXY_URL) {
      try {
        const response = await fetch(proxyEndpoints.rpc(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: rpcUrl, method }),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.result) return { result: data.result }
          if (data.error) return { error: data.error }
        }
      } catch {
        // Continue to local proxy
      }
    }

    // Use local proxy (avoids CORS errors in console)
    try {
      const response = await fetch('/api/prpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: rpcUrl, method }),
      })
      if (!response.ok) return { error: `HTTP ${response.status}` }
      const data = await response.json()
      if (data.error) return { error: data.error }
      return { result: data.result }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }, [])

  // Call individual node API
  const callApi = useCallback(async (ip: string, method: string): Promise<{ result?: unknown; error?: string }> => {
    try {
      const response = await fetch('/api/prpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: `http://${ip}:6000/rpc`, method }),
      })
      if (!response.ok) return { error: `HTTP ${response.status}` }
      const data = await response.json()
      if (data.error) return { error: data.error }
      return { result: data.result }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }, [])

  // Fetch pod credits
  const fetchPodCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/pod-credits')
      if (!response.ok) return
      const data: PodCreditsResponse = await response.json()
      if (data.status === 'success' && data.pods_credits) {
        const creditsMap = new Map<string, number>()
        data.pods_credits.forEach(pc => creditsMap.set(pc.pod_id, pc.credits))
        setPodCredits(creditsMap)
      }
    } catch {
      // Ignore
    }
  }, [])

  // Load cached nodes
  const loadCachedNodes = useCallback(async (pods: NetworkPod[]): Promise<NodeData[]> => {
    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES)
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

  // Fetch node data and update
  const fetchNodeDataAndUpdate = useCallback(async (pod: NetworkPod, index: number) => {
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
      setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), offlineResult, CACHE_TTL.NODE_DATA)
      setNodes(prev => prev.map(n => n.address === pod.address ? offlineResult : n))
      return offlineResult
    }

    const fullResult: NodeData = {
      ...baseData,
      status: 'online',
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      lastFetched: Date.now(),
    }

    setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), fullResult, CACHE_TTL.NODE_DATA)
    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n))
    return fullResult
  }, [callApi])

  // Fetch all nodes data
  const fetchAllNodesData = useCallback(async (forceRefresh: boolean = false) => {
    if (registryPods.length === 0) return

    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES)
    const podsToFetch = forceRefresh
      ? registryPods
      : registryPods.filter((pod) => {
          const cacheKey = cacheKeys.nodeData(pod.address)
          const cached = cachedNodes.get(cacheKey)
          return !cached || cached.status === 'loading'
        })

    if (podsToFetch.length === 0) {
      setLastUpdate(new Date())
      return
    }

    setIsLoading(true)

    const BATCH_SIZE = 10
    const batches = []
    for (let i = 0; i < podsToFetch.length; i += BATCH_SIZE) {
      batches.push(podsToFetch.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((pod) => {
          const globalIdx = registryPods.indexOf(pod)
          return fetchNodeDataAndUpdate(pod, globalIdx)
        })
      )
    }

    setLastUpdate(new Date())
    setIsLoading(false)
    setIsCached(false)
  }, [registryPods, fetchNodeDataAndUpdate])

  // Fetch registry pods
  const fetchRegistryPods = useCallback(async (networkId: string, skipCache: boolean = false) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId)
    if (!network) return

    setRegistryError(null)

    // Try cache first
    if (!skipCache) {
      try {
        const cachedPods = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(networkId))
        if (cachedPods && cachedPods.length > 0) {
          setRegistryPods(cachedPods)
          setRegistryStatus('success')
          setIsCached(true)
          const cachedNodes = await loadCachedNodes(cachedPods)
          setNodes(cachedNodes)
          const loadedCount = cachedNodes.filter(n => n.status !== 'loading').length
          if (loadedCount === cachedNodes.length) {
            setLastUpdate(new Date())
          }
        }
      } catch {
        // Continue to fetch
      }
    }

    // Fetch fresh data
    const res = await callRpcEndpoint(network.rpcUrl, 'get-pods')

    if (res.error) {
      if (skipCache || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError(res.error)
        setRegistryPods([])
      }
      return
    }

    const data = res.result as NetworkPodsResponse

    if (!data.pods || data.pods.length === 0) {
      if (skipCache || registryPods.length === 0) {
        setRegistryStatus('error')
        setRegistryError('No pods found in registry')
        setRegistryPods([])
      }
      return
    }

    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp)
    setRegistryPods(sortedPods)
    setRegistryStatus('success')
    setIsCached(false)

    setToDB(STORES.REGISTRY, cacheKeys.registryPods(networkId), sortedPods, CACHE_TTL.REGISTRY_PODS)

    const initialNodes = await loadCachedNodes(sortedPods)
    setNodes(initialNodes)
  }, [loadCachedNodes, registryPods.length, callRpcEndpoint])

  // Handle network change with instant cache display
  const handleNetworkChange = useCallback(async (networkId: string) => {
    setRegistryStatus('loading')

    try {
      const cachedPods = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(networkId))
      if (cachedPods && cachedPods.length > 0) {
        const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES)
        const initialNodes = cachedPods.map((pod, idx) => {
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

        setRegistryPods(cachedPods)
        setNodes(initialNodes)
        setIsCached(true)
        setRegistryStatus('success')
        setSelectedNetworkState(networkId)
      } else {
        setNodes([])
        setRegistryPods([])
        setIsCached(false)
        setSelectedNetworkState(networkId)
        setRegistryStatus('loading')
      }
    } catch {
      setNodes([])
      setRegistryPods([])
      setIsCached(false)
      setSelectedNetworkState(networkId)
      setRegistryStatus('loading')
    }

    fetchRegistryPods(networkId, false)
  }, [fetchRegistryPods])

  // Geolocation fetching
  useEffect(() => {
    const loadedNodes = nodes.filter(n => n.status !== 'loading')
    if (loadedNodes.length === 0) return

    const now = Date.now()
    if (now - lastGeoFetchRef.current < 2000) return
    lastGeoFetchRef.current = now

    const ipAddresses = loadedNodes.map(n => n.address.split(':')[0])
    batchGeolocate(ipAddresses).then(results => {
      setNodes(prev => prev.map(node => {
        const ip = node.address.split(':')[0]
        const geo = results.get(ip)
        if (geo && !node.location) {
          return {
            ...node,
            location: {
              city: geo.city,
              country: geo.country,
              countryCode: geo.countryCode,
            }
          }
        }
        return node
      }))
    })
  }, [nodes.filter(n => n.status !== 'loading').length])

  // Fetch nodes data when registry changes
  useEffect(() => {
    if (registryStatus === 'success' && registryPods.length > 0) {
      const networkChanged = lastFetchedNetworkRef.current !== selectedNetwork
      if (networkChanged) {
        lastFetchedNetworkRef.current = selectedNetwork
        fetchAllNodesData()
      } else {
        const hasLoadingNodes = nodes.some(n => n.status === 'loading')
        if (hasLoadingNodes) {
          fetchAllNodesData()
        }
      }
    }
  }, [registryStatus, registryPods.length, selectedNetwork, fetchAllNodesData])

  // Initial fetch on mount
  useEffect(() => {
    fetchRegistryPods(selectedNetwork)
    fetchPodCredits()
  }, []) // Only run once on mount

  // Public refresh function
  const refreshData = useCallback(async (forceRefresh: boolean = false) => {
    await fetchRegistryPods(selectedNetwork, forceRefresh)
  }, [selectedNetwork, fetchRegistryPods])

  const value: NodesContextValue = {
    selectedNetwork,
    setSelectedNetwork: handleNetworkChange,
    currentNetwork,
    nodes,
    registryPods,
    podCredits,
    isLoading,
    registryStatus,
    registryError,
    isCached,
    lastUpdate,
    refreshData,
    refreshPodCredits: fetchPodCredits,
  }

  return <NodesContext.Provider value={value}>{children}</NodesContext.Provider>
}
