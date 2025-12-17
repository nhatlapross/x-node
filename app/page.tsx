"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  RefreshCw,
  Globe,
  Network,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  BarChart3,
} from "lucide-react";
import { DashboardLayout, PageHeader, ContentSection, type NavSection } from "@/components/layout";
import { Logo, LogoIcon, DotDivider, BracketCard } from "@/components/common";
import { FadeIn, Stagger, StaggerItem, ScaleOnHover } from "@/components/common";
import { NodeCard, NodeDetailPanel, NodeFilters, NetworkStats } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { batchGeolocate } from "@/lib/geolocation";
import { getFromDB, setToDB, getAllFromDB, STORES, CACHE_TTL, cacheKeys } from "@/lib/indexedDB";
import { PROXY_URL, USE_PROXY, proxyEndpoints } from "@/lib/proxyConfig";
import { useNodes as useNodesContext, NETWORK_RPC_ENDPOINTS as NETWORK_ENDPOINTS } from "@/contexts/NodesContext";

// Types based on pRPC API documentation
interface VersionResponse {
  version: string;
}

interface StatsResponse {
  active_streams: number;
  cpu_percent: number;
  current_index: number;
  file_size: number;
  last_updated: number;
  packets_received: number;
  packets_sent: number;
  ram_total: number;
  ram_used: number;
  total_bytes: number;
  total_pages: number;
  uptime: number;
}

interface Pod {
  address: string;
  version: string;
  last_seen?: string;
  last_seen_timestamp: number;
  pubkey?: string | null;
}

interface PodsResponse {
  pods: Pod[];
  total_count: number;
}

interface NodeData {
  ip: string;
  address: string;
  label: string;
  pubkey: string | null;
  registryVersion: string;
  status: "online" | "offline" | "loading";
  version?: VersionResponse;
  stats?: StatsResponse;
  pods?: PodsResponse;
  error?: string;
  lastFetched?: number;
  location?: {
    city: string;
    country: string;
    countryCode?: string;
  };
}

// Network RPC endpoints for fetching pods
interface NetworkConfig {
  id: string;
  name: string;
  rpcUrl: string;
  type: "devnet" | "mainnet";
}

const NETWORK_RPC_ENDPOINTS: NetworkConfig[] = [
  { id: "devnet1", name: "Devnet 1", rpcUrl: "https://rpc1.pchednode.com/rpc", type: "devnet" },
  { id: "devnet2", name: "Devnet 2", rpcUrl: "https://rpc2.pchednode.com/rpc", type: "devnet" },
  { id: "mainnet1", name: "Mainnet 1", rpcUrl: "https://rpc3.pchednode.com/rpc", type: "mainnet" },
  { id: "mainnet2", name: "Mainnet 2", rpcUrl: "https://rpc4.pchednode.com/rpc", type: "mainnet" },
];

interface NetworkPod {
  address: string;
  last_seen_timestamp: number;
  pubkey: string | null;
  version: string;
}

interface NetworkPodsResponse {
  pods: NetworkPod[];
  total_count: number;
}

// Pod Credits API types
interface PodCredit {
  pod_id: string;
  credits: number;
}

interface PodCreditsResponse {
  pods_credits: PodCredit[];
  status: string;
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Define navigation sections
const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "Nodes", href: "/", icon: Server },
      { label: "Topology", href: "/topology", icon: Network },
    ],
  },
];

export default function Home() {
  // Selected network
  const [selectedNetwork, setSelectedNetwork] = useState<string>("devnet1");

  // Pods list from registry
  const [registryPods, setRegistryPods] = useState<NetworkPod[]>([]);
  const [registryStatus, setRegistryStatus] = useState<"loading" | "success" | "error">("loading");
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Nodes data (fetched from individual pods)
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Pod Credits data
  const [podCredits, setPodCredits] = useState<Map<string, number>>(new Map());
  const [podCreditsLoading, setPodCreditsLoading] = useState(false);

  // View and filter state
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort state
  type SortColumn = "label" | "location" | "status" | "version" | "cpu" | "ram" | "storage" | "uptime" | "streams" | "credits";
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Geolocation data
  const [geolocations, setGeolocations] = useState<Map<string, { lat: number; lng: number; city: string; country: string; countryCode: string; region: string }>>(new Map());

  // Track loaded nodes count to avoid recalculating in dependency
  const loadedNodesCount = useMemo(() =>
    nodes.filter(n => n.status !== 'loading').length
  , [nodes]);

  // Fetch geolocation data when loaded nodes change
  const lastGeoFetchRef = useRef<number>(0);

  useEffect(() => {
    const loadedNodes = nodes.filter(n => n.status !== 'loading');
    if (loadedNodes.length === 0) return;

    // Debounce: only fetch if 2 seconds have passed since last fetch
    const now = Date.now();
    if (now - lastGeoFetchRef.current < 2000) return;
    lastGeoFetchRef.current = now;

    const ipAddresses = loadedNodes.map(n => n.address.split(':')[0]);

    batchGeolocate(ipAddresses).then(results => {
      setGeolocations(results);

      // Update nodes with location data
      setNodes(prev => prev.map(node => {
        const ip = node.address.split(':')[0];
        const geo = results.get(ip);

        if (geo && !node.location) {
          return {
            ...node,
            location: {
              city: geo.city,
              country: geo.country,
              countryCode: geo.countryCode,
            }
          };
        }
        return node;
      }));
    });
  }, [loadedNodesCount]); // Use memoized count instead of inline filter

  // Get current network config
  const currentNetwork = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork)!;

  const callApi = async (
    ip: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    try {
      const endpoint = `http://${ip}:6000/rpc`;

      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          method,
        }),
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();

      if (data.error) return { error: data.error };
      // JSON-RPC response has result in data.result
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Call RPC endpoint - use external proxy if configured, otherwise try direct/fallback
  const callRpcEndpoint = useCallback(async (
    rpcUrl: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    // If external proxy is configured, use it (bypasses Cloudflare)
    if (USE_PROXY && PROXY_URL) {
      try {
        const response = await fetch(proxyEndpoints.rpc(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: rpcUrl, method }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            return { result: data.result };
          }
          if (data.error) {
            return { error: data.error };
          }
        }
      } catch (e) {
        // External proxy failed, continue to fallback
      }
    }

    const payload = {
      jsonrpc: "2.0",
      method: method,
      id: 1,
    };

    // Try direct fetch from browser (can bypass Cloudflare JS challenge)
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          return { result: data.result };
        }
        if (data.error) {
          return { error: data.error };
        }
      }
    } catch {
      // Direct fetch failed (CORS or network error), try local proxy
    }

    // Fallback to local server proxy
    try {
      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: rpcUrl,
          method,
        }),
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }

      const data = await response.json();

      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  }, []);

  // Fetch Pod Credits via local API proxy
  const fetchPodCredits = useCallback(async () => {
    setPodCreditsLoading(true);
    try {
      const response = await fetch("/api/pod-credits");
      if (!response.ok) {
        return;
      }

      const data: PodCreditsResponse = await response.json();
      if (data.status === "success" && data.pods_credits) {
        const creditsMap = new Map<string, number>();
        data.pods_credits.forEach(pc => {
          creditsMap.set(pc.pod_id, pc.credits);
        });
        setPodCredits(creditsMap);
      }
    } catch (e) {
    } finally {
      setPodCreditsLoading(false);
    }
  }, []);

  // Load cached node data for a list of pods from IndexedDB
  const loadCachedNodes = useCallback(async (pods: NetworkPod[]): Promise<NodeData[]> => {
    // Get all cached nodes at once for better performance
    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES);

    return pods.map((pod, idx) => {
      const cacheKey = cacheKeys.nodeData(pod.address);
      const cached = cachedNodes.get(cacheKey);
      if (cached && cached.status !== 'loading') {
        return cached;
      }
      return {
        ip: pod.address.split(":")[0],
        address: pod.address,
        label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
        pubkey: pod.pubkey,
        registryVersion: pod.version,
        status: "loading" as const,
      };
    });
  }, []);

  // Fetch pods from selected network registry
  const fetchRegistryPods = useCallback(async (networkId: string, skipCache: boolean = false) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId);
    if (!network) return;

    setRegistryError(null);
    setSelectedNode(null);

    // Try loading from IndexedDB cache first for instant display
    if (!skipCache) {
      try {
        const cachedPods = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(networkId));
        if (cachedPods && cachedPods.length > 0) {
          setRegistryPods(cachedPods);
          setRegistryStatus("success");
          setIsCached(true);
          // Load cached node data from IndexedDB
          try {
            const cachedNodes = await loadCachedNodes(cachedPods);
            setNodes(cachedNodes);

            // Count how many are already loaded
            const loadedCount = cachedNodes.filter(n => n.status !== 'loading').length;

            // If all nodes are cached, set lastUpdate and skip fetching
            if (loadedCount === cachedNodes.length) {
              setLastUpdate(new Date());
            }
          } catch (err) {
          }
        }
      } catch (err) {
        // Continue to fetch from API
      }
    }

    // Fetch fresh data
    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

    if (res.error) {
      // Only show error if we don't have cached data
      if (skipCache || registryPods.length === 0) {
        setRegistryStatus("error");
        setRegistryError(res.error);
        setRegistryPods([]);
      }
      return;
    }

    const data = res.result as NetworkPodsResponse;

    if (!data.pods || data.pods.length === 0) {
      if (skipCache || registryPods.length === 0) {
        setRegistryStatus("error");
        setRegistryError("No pods found in registry");
        setRegistryPods([]);
      }
      return;
    }

    // Sort by last_seen_timestamp (most recent first)
    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp);

    // Set state FIRST to ensure UI updates
    setRegistryPods(sortedPods);
    setRegistryStatus("success");
    setIsCached(false);

    // Cache the registry pods to IndexedDB (don't await, do in background)
    setToDB(STORES.REGISTRY, cacheKeys.registryPods(networkId), sortedPods, CACHE_TTL.REGISTRY_PODS)

    // Initialize nodes with cached data if available
    try {
      const initialNodes = await loadCachedNodes(sortedPods);
      setNodes(initialNodes);
    } catch (err) {
      // Fallback: create loading nodes
      const loadingNodes = sortedPods.map((pod, idx) => ({
        ip: pod.address.split(":")[0],
        address: pod.address,
        label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
        pubkey: pod.pubkey,
        registryVersion: pod.version,
        status: "loading" as const,
      }));
      setNodes(loadingNodes);
    }
  }, [loadCachedNodes, registryPods.length]);

  // Fetch detailed data for a single node with progressive loading
  const fetchNodeDataAndUpdate = useCallback(async (pod: NetworkPod, index: number) => {
    const ip = pod.address.split(":")[0];
    const baseData: NodeData = {
      ip,
      address: pod.address,
      label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${index + 1}`,
      pubkey: pod.pubkey,
      registryVersion: pod.version,
      status: "loading",
    };

    // Phase 1: Fetch version and stats first (fastest, most important)
    const [versionRes, statsRes] = await Promise.all([
      callApi(ip, "get-version"),
      callApi(ip, "get-stats"),
    ]);

    // If both failed, mark as offline immediately
    if (versionRes.error && statsRes.error) {
      const offlineResult: NodeData = {
        ...baseData,
        status: "offline",
        error: versionRes.error || statsRes.error,
        lastFetched: Date.now(),
      };
      // Cache offline result to IndexedDB
      setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), offlineResult, CACHE_TTL.NODE_DATA);
      setNodes(prev => prev.map(n => n.address === pod.address ? offlineResult : n));
      return offlineResult;
    }

    // Update with partial data immediately (online with stats)
    const partialResult: NodeData = {
      ...baseData,
      status: "online",
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      lastFetched: Date.now(),
    };
    setNodes(prev => prev.map(n => n.address === pod.address ? partialResult : n));

    // Phase 2: Fetch pods data (slower, less critical)
    const podsRes = await callApi(ip, "get-pods");

    // Only set pods if we got a valid response
    let podsData: PodsResponse | undefined;
    if (podsRes.result && !podsRes.error) {
      podsData = podsRes.result as PodsResponse;
    } else {
    }

    const fullResult: NodeData = {
      ...partialResult,
      pods: podsData,
    };

    // Cache the full result to IndexedDB
    setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), fullResult, CACHE_TTL.NODE_DATA);
    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n));
    return fullResult;
  }, []);

  // Fetch all nodes with concurrency limit for better performance
  const fetchAllNodesData = useCallback(async (forceRefresh: boolean = false) => {
    if (registryPods.length === 0) {
      return;
    }

    // Get cached nodes from IndexedDB to determine which need fetching
    const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES);

    // Filter to only fetch nodes that need updating
    const podsToFetch = forceRefresh
      ? registryPods
      : registryPods.filter((pod) => {
          const cacheKey = cacheKeys.nodeData(pod.address);
          const cached = cachedNodes.get(cacheKey);
          return !cached || cached.status === 'loading';
        });

    if (podsToFetch.length === 0) {
      setLastUpdate(new Date());
      return;
    }

    setIsLoading(true);

    // Process in batches with concurrency limit (increased for faster loading)
    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < podsToFetch.length; i += BATCH_SIZE) {
      batches.push(podsToFetch.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((pod) => {
          const globalIdx = registryPods.indexOf(pod);
          return fetchNodeDataAndUpdate(pod, globalIdx);
        })
      );
    }

    setLastUpdate(new Date());
    setIsLoading(false);
    setIsCached(false);
  }, [registryPods, fetchNodeDataAndUpdate]);

  // Handle network change - show cached data immediately, fetch fresh in background
  const handleNetworkChange = useCallback(async (networkId: string) => {
    setSelectedNode(null);

    // Reset to loading state first
    setRegistryStatus("loading");

    let hasLoadingNodes = false;

    // Try to load from cache immediately (instant switch)
    try {
      const cachedPods = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(networkId));
      if (cachedPods && cachedPods.length > 0) {

        const cachedNodes = await getAllFromDB<NodeData>(STORES.NODES);
        const initialNodes = cachedPods.map((pod, idx) => {
          const cacheKey = cacheKeys.nodeData(pod.address);
          const cached = cachedNodes.get(cacheKey);
          if (cached && cached.status !== 'loading') {
            return cached;
          }
          hasLoadingNodes = true;
          return {
            ip: pod.address.split(":")[0],
            address: pod.address,
            label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
            pubkey: pod.pubkey,
            registryVersion: pod.version,
            status: "loading" as const,
          };
        });

        const loadedCount = initialNodes.filter(n => n.status !== 'loading').length;

        // Set all state together BEFORE changing selectedNetwork
        // This ensures useEffect sees the correct nodes state
        setRegistryPods(cachedPods);
        setNodes(initialNodes);
        setIsCached(true);
        setRegistryStatus("success");
        // Set selectedNetwork LAST to trigger useEffect with correct state
        setSelectedNetwork(networkId);
      } else {
        // No cache, show loading
        setNodes([]);
        setRegistryPods([]);
        setIsCached(false);
        // Set selectedNetwork LAST
        setSelectedNetwork(networkId);
        setRegistryStatus("loading");
        hasLoadingNodes = true;
      }
    } catch (err) {
      setNodes([]);
      setRegistryPods([]);
      setIsCached(false);
      setSelectedNetwork(networkId);
      setRegistryStatus("loading");
      hasLoadingNodes = true;
    }

    // Fetch fresh data in background
    fetchRegistryPods(networkId, false);
  }, [fetchRegistryPods]);

  // Initial fetch on mount
  useEffect(() => {
    fetchRegistryPods(selectedNetwork);
    fetchPodCredits(); // Fetch pod credits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch nodes data when registry pods change or network switches
  // Using a ref to track network changes since React batches state updates
  const lastFetchedNetworkRef = useRef<string | null>(null);

  useEffect(() => {

    if (registryStatus === "success" && registryPods.length > 0) {
      // Always fetch if network changed or if this is a new network we haven't fetched for
      const networkChanged = lastFetchedNetworkRef.current !== selectedNetwork;

      if (networkChanged) {
        lastFetchedNetworkRef.current = selectedNetwork;
        fetchAllNodesData();
      } else {
        // Same network - only fetch if there are loading nodes
        const hasLoadingNodes = nodes.some(n => n.status === 'loading');
        if (hasLoadingNodes) {
          fetchAllNodesData();
        } else {
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryStatus, registryPods.length, selectedNetwork]);

  // Background preload other networks after initial load completes
  useEffect(() => {
    if (registryStatus !== "success" || isLoading) return;

    const preloadOtherNetworks = async () => {
      const otherNetworks = NETWORK_RPC_ENDPOINTS.filter(n => n.id !== selectedNetwork);

      for (const network of otherNetworks) {
        // Check if already cached
        const cached = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(network.id));
        if (cached && cached.length > 0) {
          continue;
        }

        // Fetch and cache in background - use callRpcEndpoint which tries direct first
        try {
          const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

          if (res.result) {
            const data = res.result as NetworkPodsResponse;
            if (data.pods && data.pods.length > 0) {
              const sortedPods = data.pods.sort((a: NetworkPod, b: NetworkPod) =>
                b.last_seen_timestamp - a.last_seen_timestamp
              );
              await setToDB(STORES.REGISTRY, cacheKeys.registryPods(network.id), sortedPods, CACHE_TTL.REGISTRY_PODS);
            }
          }
        } catch (err) {
        }

        // Small delay between preloads to not overwhelm
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    // Delay preload to not interfere with initial load
    const timer = setTimeout(preloadOtherNetworks, 3000);
    return () => clearTimeout(timer);
  }, [registryStatus, isLoading, selectedNetwork]);

  // Periodic background refresh (every 5 minutes)
  useEffect(() => {
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const backgroundRefresh = async () => {
      if (isLoading) return;

      // Silently fetch fresh data without showing loading state
      const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork);
      if (!network) return;

      try {
        // Use callRpcEndpoint which tries direct browser fetch first
        const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

        if (res.result) {
          const data = res.result as NetworkPodsResponse;
          if (data.pods && data.pods.length > 0) {
            const sortedPods = data.pods.sort((a: NetworkPod, b: NetworkPod) =>
              b.last_seen_timestamp - a.last_seen_timestamp
            );

            // Update cache
            await setToDB(STORES.REGISTRY, cacheKeys.registryPods(selectedNetwork), sortedPods, CACHE_TTL.REGISTRY_PODS);

            // Update state if data changed
            if (sortedPods.length !== registryPods.length) {
              setRegistryPods(sortedPods);
              const cachedNodes = await loadCachedNodes(sortedPods);
              setNodes(cachedNodes);
            }

            setLastUpdate(new Date());
          }
        }
      } catch (err) {
      }
    };

    const interval = setInterval(backgroundRefresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedNetwork, isLoading, registryPods.length, loadCachedNodes, callRpcEndpoint]);

  // Calculate network stats
  const onlineNodes = nodes.filter((n) => n.status === "online");
  const totalStorage = onlineNodes.reduce(
    (acc, n) => acc + (n.stats?.file_size || 0),
    0
  );

  // Calculate total credits for all nodes
  const totalCredits = nodes.reduce((acc, n) => {
    if (n.pubkey) {
      return acc + (podCredits.get(n.pubkey) || 0);
    }
    return acc;
  }, 0);
  const avgCpu =
    onlineNodes.length > 0
      ? onlineNodes.reduce((acc, n) => acc + (n.stats?.cpu_percent || 0), 0) /
        onlineNodes.length
      : 0;
  const avgRamPercent =
    onlineNodes.length > 0
      ? onlineNodes.reduce(
          (acc, n) =>
            acc +
            ((n.stats?.ram_used || 0) / (n.stats?.ram_total || 1)) * 100,
          0
        ) / onlineNodes.length
      : 0;

  // Calculate sync stats
  const maxSyncIndex = onlineNodes.length > 0
    ? Math.max(...onlineNodes.map((n) => n.stats?.current_index || 0))
    : 0;
  const totalDataSynced = onlineNodes.reduce(
    (acc, n) => acc + (n.stats?.total_bytes || 0),
    0
  );
  const totalActiveStreams = onlineNodes.reduce(
    (acc, n) => acc + (n.stats?.active_streams || 0),
    0
  );

  const selectedNodeData = selectedNode
    ? nodes.find((n) => n.address === selectedNode)
    : null;

  // Get unique versions for filter
  const uniqueVersions = Array.from(new Set(
    nodes.map(n => n.version?.version || n.registryVersion).filter(Boolean)
  )).sort();

  // Handle sort toggle
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  // Filter and sort nodes
  const filteredAndSortedNodes = nodes
    .filter(node => {
      // Status filter
      if (statusFilter !== "all" && node.status !== statusFilter) return false;

      // Version filter
      if (versionFilter !== "all") {
        const nodeVersion = node.version?.version || node.registryVersion;
        if (nodeVersion !== versionFilter) return false;
      }

      // Search filter (search in label, address, pubkey)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchLabel = node.label.toLowerCase().includes(query);
        const matchAddress = node.address.toLowerCase().includes(query);
        const matchPubkey = node.pubkey?.toLowerCase().includes(query);
        if (!matchLabel && !matchAddress && !matchPubkey) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;

      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortColumn) {
        case "label":
          return direction * a.label.localeCompare(b.label);
        case "location":
          const aLoc = a.location?.city || "";
          const bLoc = b.location?.city || "";
          return direction * aLoc.localeCompare(bLoc);
        case "status":
          return direction * a.status.localeCompare(b.status);
        case "version":
          const aVer = a.version?.version || a.registryVersion || "";
          const bVer = b.version?.version || b.registryVersion || "";
          return direction * aVer.localeCompare(bVer);
        case "cpu":
          return direction * ((a.stats?.cpu_percent || 0) - (b.stats?.cpu_percent || 0));
        case "ram":
          const aRam = a.stats ? (a.stats.ram_used / a.stats.ram_total) * 100 : 0;
          const bRam = b.stats ? (b.stats.ram_used / b.stats.ram_total) * 100 : 0;
          return direction * (aRam - bRam);
        case "storage":
          return direction * ((a.stats?.file_size || 0) - (b.stats?.file_size || 0));
        case "uptime":
          return direction * ((a.stats?.uptime || 0) - (b.stats?.uptime || 0));
        case "streams":
          return direction * ((a.stats?.active_streams || 0) - (b.stats?.active_streams || 0));
        case "credits":
          const aCredits = a.pubkey ? (podCredits.get(a.pubkey) || 0) : 0;
          const bCredits = b.pubkey ? (podCredits.get(b.pubkey) || 0) : 0;
          return direction * (aCredits - bCredits);
        default:
          return 0;
      }
    });

  // Network selector component
  const NetworkSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      {NETWORK_RPC_ENDPOINTS.map((network) => (
        <button
          key={network.id}
          onClick={() => handleNetworkChange(network.id)}
          className={cn(
            "px-3 py-1.5 text-sm font-mono transition-all flex items-center gap-2 border",
            selectedNetwork === network.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/50"
          )}
        >
          <span
            className={cn(
              "w-2 h-2",
              network.type === "mainnet" ? "bg-success" : "bg-[#F59E0B]"
            )}
          />
          {network.name}
        </button>
      ))}
    </div>
  );

  return (
    <DashboardLayout
      sections={navSections}
      logo={<Logo height={36} />}
      logoCollapsed={<LogoIcon size={36} />}
      loading={isLoading || registryStatus === "loading"}
      headerRight={
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRegistryPods(selectedNetwork, true)}
          disabled={isLoading || registryStatus === "loading"}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <FadeIn animateOnMount>
        <PageHeader
          title="Network Dashboard"
          description={
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {currentNetwork.name}
              {isCached && (
                <Badge variant="outline" className="text-xs ml-2">
                  Cached
                </Badge>
              )}
              {lastUpdate && (
                <span className="text-xs text-muted-foreground ml-2">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </span>
          }
          actions={<NetworkSelector />}
        />
      </FadeIn>

      {/* Error State */}
      {registryStatus === "error" && (
        <FadeIn animateOnMount>
          <div className="mb-8 p-6 border border-destructive bg-destructive/10">
            <div className="text-destructive font-medium mb-2">Failed to load {currentNetwork.name}</div>
            <div className="text-muted-foreground text-sm">{registryError}</div>
            <Button
              variant="destructive"
              size="sm"
              className="mt-4"
              onClick={() => fetchRegistryPods(selectedNetwork, true)}
            >
              Retry
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Loading State */}
      {registryStatus === "loading" && (
        <FadeIn animateOnMount>
          {/* Network Stats Skeleton */}
          <ContentSection title="Network Overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <BracketCard key={i} className="p-4 bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-2 w-full" />
                </BracketCard>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[...Array(4)].map((_, i) => (
                <BracketCard key={i} className="p-4 bg-card">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-6 w-12" />
                </BracketCard>
              ))}
            </div>
          </ContentSection>

          <DotDivider className="my-8" />

          {/* Node Cards Skeleton */}
          <ContentSection title="All Nodes">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border border-border p-4 bg-card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <Skeleton className="h-5 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                      {[...Array(4)].map((_, j) => (
                        <div key={j}>
                          <Skeleton className="h-3 w-12 mb-1" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ContentSection>
        </FadeIn>
      )}

      {/* Main Content */}
      {registryStatus === "success" && (
        <>
          {/* Network Overview */}
          <ContentSection title="Network Overview">
            <NetworkStats
              onlineCount={onlineNodes.length}
              totalCount={nodes.length}
              totalStorage={totalStorage}
              avgCpu={avgCpu}
              avgRamPercent={avgRamPercent}
              registryPods={registryPods}
              formatBytes={formatBytes}
              totalCredits={totalCredits}
            />
          </ContentSection>

          <DotDivider className="my-8" />

          {/* Filters and View Switcher */}
          <NodeFilters
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            versionFilter={versionFilter}
            setVersionFilter={setVersionFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            uniqueVersions={uniqueVersions}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {/* Results Count */}
          <p className="text-sm text-muted-foreground mb-4 font-mono">
            Showing {filteredAndSortedNodes.length} of {nodes.length} nodes
            {sortColumn && (
              <span className="ml-2 text-primary">
                (sorted by {sortColumn} {sortDirection === "asc" ? "↑" : "↓"})
              </span>
            )}
          </p>

          {/* Card View */}
          {viewMode === "card" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedNodes.map((node) => (
                <div
                  key={node.address}
                  className="transition-opacity duration-300"
                >
                  <ScaleOnHover scale={1.01}>
                    <NodeCard
                      node={node}
                      isSelected={selectedNode === node.address}
                      onClick={() => setSelectedNode(selectedNode === node.address ? null : node.address)}
                      formatBytes={formatBytes}
                      formatUptime={formatUptime}
                      credits={node.pubkey ? podCredits.get(node.pubkey) : undefined}
                    />
                  </ScaleOnHover>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <div className="border border-border bg-card overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("label")}
                    >
                      <div className="flex items-center gap-1">
                        Node
                        <SortIcon column="label" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("location")}
                    >
                      <div className="flex items-center gap-1">
                        Location
                        <SortIcon column="location" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        <SortIcon column="status" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("version")}
                    >
                      <div className="flex items-center gap-1">
                        Version
                        <SortIcon column="version" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("cpu")}
                    >
                      <div className="flex items-center gap-1">
                        CPU
                        <SortIcon column="cpu" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("ram")}
                    >
                      <div className="flex items-center gap-1">
                        RAM
                        <SortIcon column="ram" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("storage")}
                    >
                      <div className="flex items-center gap-1">
                        Storage
                        <SortIcon column="storage" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("uptime")}
                    >
                      <div className="flex items-center gap-1">
                        Uptime
                        <SortIcon column="uptime" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("streams")}
                    >
                      <div className="flex items-center gap-1">
                        Streams
                        <SortIcon column="streams" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("credits")}
                    >
                      <div className="flex items-center gap-1">
                        Credits
                        <SortIcon column="credits" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAndSortedNodes.map((node, idx) => (
                    <tr
                      key={node.address}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer transition-colors",
                        selectedNode === node.address && "bg-primary/10"
                      )}
                      onClick={() =>
                        setSelectedNode(selectedNode === node.address ? null : node.address)
                      }
                    >
                      <td className="p-3 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-medium font-mono">{node.label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{node.address}</div>
                      </td>
                      <td className="p-3">
                        {node.location ? (
                          <div className="flex items-center gap-2 font-mono text-xs">
                            {node.location.countryCode && (
                              <img
                                src={`https://flagsapi.com/${node.location.countryCode}/flat/16.png`}
                                alt={node.location.country}
                                className="w-4 h-3 object-cover"
                              />
                            )}
                            <span>{node.location.city}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono",
                            node.status === "online"
                              ? "border-success text-success"
                              : node.status === "offline"
                              ? "border-destructive text-destructive"
                              : "border-primary text-primary"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 mr-1.5",
                              node.status === "online"
                                ? "bg-success"
                                : node.status === "offline"
                                ? "bg-destructive"
                                : "bg-[#F59E0B]"
                            )}
                          />
                          {node.status}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono">{node.version?.version || node.registryVersion || "-"}</td>
                      <td className="p-3 font-mono">{node.stats?.cpu_percent.toFixed(2) || "-"}%</td>
                      <td className="p-3 font-mono">
                        {node.stats
                          ? `${((node.stats.ram_used / node.stats.ram_total) * 100).toFixed(1)}%`
                          : "-"}
                      </td>
                      <td className="p-3 font-mono">{node.stats ? formatBytes(node.stats.file_size) : "-"}</td>
                      <td className="p-3 font-mono">{node.stats ? formatUptime(node.stats.uptime) : "-"}</td>
                      <td className="p-3 font-mono">{node.stats?.active_streams ?? "-"}</td>
                      <td className="p-3 font-mono">
                        {node.pubkey && podCredits.get(node.pubkey) !== undefined ? (
                          <span className="text-success font-medium">
                            {podCredits.get(node.pubkey)?.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected Node Detail Modal */}
          <NodeDetailPanel
            node={selectedNodeData || null}
            onClose={() => setSelectedNode(null)}
            formatBytes={formatBytes}
            formatUptime={formatUptime}
            formatTimestamp={formatTimestamp}
            credits={selectedNodeData?.pubkey ? podCredits.get(selectedNodeData.pubkey) : undefined}
          />
        </>
      )}
    </DashboardLayout>
  );
}
