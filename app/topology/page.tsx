"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  Database,
  Settings,
  RefreshCw,
  Globe,
  Network,
} from "lucide-react";
import { DashboardLayout, PageHeader, type NavSection } from "@/components/layout";
import { Logo, LogoIcon } from "@/components/common";
import { FadeIn } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { batchGeolocate } from "@/lib/geolocation";
import { getFromDB, setToDB, getAllFromDB, STORES, CACHE_TTL, cacheKeys } from "@/lib/indexedDB";
import { findLatestVersion, getVersionColor } from "@/lib/version";
import type { GlobeNode, GlobeConnection } from "@/components/globe";

// Dynamic import to avoid SSR issues
const GlobeVisualization = dynamic(
  () => import("@/components/globe").then(mod => ({ default: mod.GlobeVisualization })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] flex items-center justify-center bg-card border border-border">
        <div className="text-muted-foreground font-mono">Loading Globe...</div>
      </div>
    ),
  }
);

// Types
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
  last_seen: string;
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
}

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

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "Nodes", href: "/nodes", icon: Server },
      { label: "Topology", href: "/topology", icon: Network },
      { label: "Storage", href: "/storage", icon: Database },
    ],
  },
  {
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function TopologyPage() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>("devnet1");
  const [registryPods, setRegistryPods] = useState<NetworkPod[]>([]);
  const [registryStatus, setRegistryStatus] = useState<"loading" | "success" | "error">("loading");
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const currentNetwork = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork)!;

  // Detect theme
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const callApi = async (
    ip: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    try {
      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: `http://${ip}:6000/rpc`,
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
  };

  const callRpcEndpoint = async (
    rpcUrl: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
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
  };

  // Load cached node data for pods from IndexedDB
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

  const fetchRegistryPods = useCallback(async (networkId: string, skipCache: boolean = false) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId);
    if (!network) return;

    setRegistryError(null);

    // Try IndexedDB cache first for instant display
    if (!skipCache) {
      try {
        const cachedPods = await getFromDB<NetworkPod[]>(STORES.REGISTRY, cacheKeys.registryPods(networkId));
        if (cachedPods && cachedPods.length > 0) {
          setRegistryPods(cachedPods);
          setRegistryStatus("success");
          setIsCached(true);
          try {
            const cachedNodes = await loadCachedNodes(cachedPods);
            setNodes(cachedNodes);

            // Count how many are already loaded
            const loadedCount = cachedNodes.filter(n => n.status !== 'loading').length;

            // If all nodes are cached, set lastUpdate
            if (loadedCount === cachedNodes.length) {
              setLastUpdate(new Date());
            }
          } catch (err) {
          }
        }
      } catch (err) {
      }
    }

    // Fetch fresh data
    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

    if (res.error) {
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

    const [versionRes, statsRes, podsRes] = await Promise.all([
      callApi(ip, "get-version"),
      callApi(ip, "get-stats"),
      callApi(ip, "get-pods"),
    ]);

    const isOffline = versionRes.error && statsRes.error;

    const fullResult: NodeData = {
      ...baseData,
      status: isOffline ? "offline" : "online",
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      pods: podsRes.result as PodsResponse | undefined,
      error: isOffline ? (versionRes.error || statsRes.error) : undefined,
      lastFetched: Date.now(),
    };

    // Cache the result to IndexedDB
    setToDB(STORES.NODES, cacheKeys.nodeData(pod.address), fullResult, CACHE_TTL.NODE_DATA);
    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n));
    return fullResult;
  }, []);

  const fetchAllNodesData = useCallback(async (forceRefresh: boolean = false) => {
    if (registryPods.length === 0) return;

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

    // Increased batch size for faster loading
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
    // Reset to loading state first
    setRegistryStatus("loading");

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

        // Set all state together
        setRegistryPods(cachedPods);
        setNodes(initialNodes);
        setIsCached(true);
        setRegistryStatus("success");
        // Set selectedNetwork LAST to trigger useEffect
        setSelectedNetwork(networkId);
      } else {
        // No cache, show loading
        setNodes([]);
        setRegistryPods([]);
        setGeolocations(new Map());
        setIsCached(false);
        setSelectedNetwork(networkId);
        setRegistryStatus("loading");
      }
    } catch (err) {
      setNodes([]);
      setRegistryPods([]);
      setGeolocations(new Map());
      setIsCached(false);
      setSelectedNetwork(networkId);
      setRegistryStatus("loading");
    }

    // Fetch fresh data in background
    fetchRegistryPods(networkId, false);
  }, [fetchRegistryPods]);

  useEffect(() => {
    fetchRegistryPods(selectedNetwork);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch nodes data when registry pods change or network switches
  // Using a ref to track network changes since React batches state updates
  const lastFetchedNetworkRef = useRef<string | null>(null);

  useEffect(() => {

    if (registryStatus === "success" && registryPods.length > 0) {
      // Always fetch if network changed
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

  // Store geolocation data
  const [geolocations, setGeolocations] = useState<Map<string, { lat: number; lng: number; city: string; country: string; region: string }>>(new Map());
  const [geoLoading, setGeoLoading] = useState(false);

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

    setGeoLoading(true);

    batchGeolocate(ipAddresses).then(results => {
      setGeolocations(results);
      setGeoLoading(false);
    }).catch(() => {
      setGeoLoading(false);
    });
  }, [loadedNodesCount]); // Use memoized count instead of nodes array

  // Convert nodes to globe format with geolocation
  const { globeNodes, globeConnections } = useMemo(() => {
    const loadedNodes = nodes.filter(n => n.status !== 'loading');

    // Wait for geolocation data
    if (geolocations.size === 0) {
      return { globeNodes: [], globeConnections: [] };
    }

    // Find latest version dynamically from all nodes
    const allVersions = loadedNodes
      .map(n => n.version?.version)
      .filter((v): v is string => !!v);
    const latestVersion = findLatestVersion(allVersions);

    const globeNodes = loadedNodes
      .map((node) => {
        const ip = node.address.split(':')[0];
        const geo = geolocations.get(ip);

        // Skip if geolocation not available yet
        if (!geo) return null;

        const isOnline = node.status === 'online';

        return {
          id: node.address,
          lat: geo.lat,
          lng: geo.lng,
          label: node.pubkey ? `${node.pubkey.slice(0, 8)}...` : ip,
          status: node.status,
          size: Math.max(1, Math.min(2, (node.pods?.total_count || 0) / 10 + 1)),
          // Use dynamic version color detection
          color: getVersionColor(node.version?.version, latestVersion, isOnline),
          // Additional data for detail panel
          version: node.version?.version,
          cpu: node.stats?.cpu_percent,
          ram: node.stats ? (node.stats.ram_used / node.stats.ram_total) * 100 : undefined,
          storage: node.stats?.file_size,
          uptime: node.stats?.uptime,
          peers: node.pods?.total_count,
          pubkey: node.pubkey,
        };
      })
      .filter((node) => node !== null) as GlobeNode[];

    const globeConnections: GlobeConnection[] = [];
    const connectionSet = new Set<string>();

    // Create IP to node mapping for faster lookups
    const ipToNodes = new Map<string, typeof loadedNodes[0]>();
    loadedNodes.forEach(node => {
      const ip = node.address.split(':')[0];
      ipToNodes.set(ip, node);
    });

    // Pre-build bidirectional lookup for O(1) checks
    const peerConnections = new Map<string, Set<string>>();
    loadedNodes.forEach(node => {
      if (!node.pods?.pods) return;
      const sourceIp = node.address.split(':')[0];
      const peers = new Set<string>();
      node.pods.pods.forEach(pod => {
        peers.add(pod.address.split(':')[0]);
      });
      peerConnections.set(sourceIp, peers);
    });

    // Limit connections for performance (max 500)
    const MAX_CONNECTIONS = 500;

    loadedNodes.forEach((node) => {
      if (globeConnections.length >= MAX_CONNECTIONS) return;
      if (!node.pods?.pods || node.pods.pods.length === 0) return;

      const sourceIp = node.address.split(':')[0];
      const sourceGeo = geolocations.get(sourceIp);
      if (!sourceGeo) return;

      node.pods.pods.forEach((pod) => {
        if (globeConnections.length >= MAX_CONNECTIONS) return;

        const targetIp = pod.address.split(':')[0];
        const targetNode = ipToNodes.get(targetIp);
        const targetGeo = geolocations.get(targetIp);

        if (!targetNode || !targetGeo || targetNode.address === node.address) return;

        const connectionId = [node.address, targetNode.address].sort().join('-');
        if (connectionSet.has(connectionId)) return;

        connectionSet.add(connectionId);

        const isActive = Date.now() / 1000 - pod.last_seen_timestamp < 300;
        // O(1) bidirectional check using pre-built lookup
        const targetPeers = peerConnections.get(targetIp);
        const isBidirectional = targetPeers?.has(sourceIp) ?? false;

        globeConnections.push({
          startLat: sourceGeo.lat,
          startLng: sourceGeo.lng,
          endLat: targetGeo.lat,
          endLng: targetGeo.lng,
          color: isBidirectional
            ? (isActive ? '#00ffff' : '#0099ff')
            : (isActive ? '#ffdd00' : '#888888'),
        });
      });
    });

    return { globeNodes, globeConnections };
  }, [nodes, geolocations]);

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
          title="Network Topology"
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

      {registryStatus === "loading" && (
        <FadeIn animateOnMount>
          <div className="mb-8 p-12 text-center border border-border bg-card">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-muted-foreground font-mono">Loading network topology...</div>
          </div>
        </FadeIn>
      )}

      {registryStatus === "success" && (
        <FadeIn animateOnMount>
          <div className="border border-border bg-card overflow-hidden relative" style={{ height: 'calc(100vh - 200px)', minHeight: '700px' }}>
            {geoLoading && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-primary/90 backdrop-blur text-primary-foreground px-4 py-2 rounded-lg text-xs font-mono flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Fetching real geolocation data...
              </div>
            )}
            <GlobeVisualization
              nodes={globeNodes}
              connections={globeConnections}
              isDark={isDark}
            />
          </div>
        </FadeIn>
      )}
    </DashboardLayout>
  );
}
