"use client";

import { useState, useEffect, useCallback } from "react";
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
import { DashboardLayout, PageHeader, ContentSection, type NavSection } from "@/components/layout";
import { Logo, LogoIcon, DotDivider, BracketCard } from "@/components/common";
import { FadeIn, Stagger, StaggerItem, ScaleOnHover } from "@/components/common";
import { NodeCard, NodeDetailPanel, NodeFilters, NetworkStats } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { batchGeolocate } from "@/lib/geolocation";

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

  // View and filter state
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Geolocation data
  const [geolocations, setGeolocations] = useState<Map<string, { lat: number; lng: number; city: string; country: string; countryCode: string; region: string }>>(new Map());

  // Debug: log state changes
  useEffect(() => {
    console.log('[State] registryStatus:', registryStatus, 'registryPods:', registryPods.length, 'nodes:', nodes.length);
  }, [registryStatus, registryPods.length, nodes.length]);

  // Fetch geolocation data when nodes change
  useEffect(() => {
    const loadedNodes = nodes.filter(n => n.status !== 'loading');
    if (loadedNodes.length === 0) return;

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
  }, [nodes.length, nodes.filter(n => n.status !== 'loading').length]);

  // Get current network config
  const currentNetwork = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork)!;

  const callApi = async (
    ip: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    try {
      const endpoint = `http://${ip}:6000/rpc`;
      console.log('[callApi]', method, 'to', endpoint);

      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          method,
        }),
      });

      if (!response.ok) {
        //console.error('[callApi] Response not OK:', response.status, response.statusText);
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      console.log('[callApi]', method, 'Response data:', JSON.stringify(data, null, 2));

      if (data.error) return { error: data.error };
      // JSON-RPC response has result in data.result
      return { result: data.result };
    } catch (e) {
      console.error('[callApi] Exception:', e);
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Call RPC endpoint directly (for HTTPS endpoints)
  const callRpcEndpoint = async (
    rpcUrl: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    try {
      console.log('[callRpcEndpoint]', method, 'to', rpcUrl);

      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: rpcUrl,
          method,
        }),
      });

      if (!response.ok) {
        console.error('[callRpcEndpoint] Response not OK:', response.status);
        return { error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      console.log('[callRpcEndpoint] Response:', data);

      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      console.error('[callRpcEndpoint] Exception:', e);
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Fetch pods from selected network registry
  const fetchRegistryPods = useCallback(async (networkId: string) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId);
    if (!network) return;

    console.log('[Registry] Fetching pods from:', network.name);
    setRegistryStatus("loading");
    setRegistryError(null);
    setNodes([]);
    setSelectedNode(null);

    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");
    console.log('[Registry] Response:', res);

    if (res.error) {
      console.log('[Registry] Error:', res.error);
      setRegistryStatus("error");
      setRegistryError(res.error);
      setRegistryPods([]);
      return;
    }

    const data = res.result as NetworkPodsResponse;
    console.log('[Registry] Got pods:', data.pods?.length);

    if (!data.pods || data.pods.length === 0) {
      console.log('[Registry] No pods found');
      setRegistryStatus("error");
      setRegistryError("No pods found in registry");
      setRegistryPods([]);
      return;
    }

    // Sort by last_seen_timestamp (most recent first)
    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp);
    setRegistryPods(sortedPods);
    setRegistryStatus("success");
    console.log('[Registry] Success! Set', sortedPods.length, 'pods');

    // Initialize nodes with loading state
    const initialNodes: NodeData[] = sortedPods.map((pod, idx) => ({
      ip: pod.address.split(":")[0],
      address: pod.address,
      label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
      pubkey: pod.pubkey,
      registryVersion: pod.version,
      status: "loading" as const,
    }));
    setNodes(initialNodes);
    console.log('[Registry] Set initial nodes:', initialNodes.length);
  }, []);

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
      };
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
    console.log('[fetchNodeDataAndUpdate] Pods response for', ip, ':', podsRes);

    // Only set pods if we got a valid response
    let podsData: PodsResponse | undefined;
    if (podsRes.result && !podsRes.error) {
      podsData = podsRes.result as PodsResponse;
      console.log('[fetchNodeDataAndUpdate] Got', podsData.pods?.length, 'peers for', ip);
    } else {
      console.log('[fetchNodeDataAndUpdate] No pods data for', ip, '- error:', podsRes.error);
    }

    const fullResult: NodeData = {
      ...partialResult,
      pods: podsData,
    };

    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n));
    return fullResult;
  }, []);

  // Fetch all nodes with concurrency limit for better performance
  const fetchAllNodesData = useCallback(async () => {
    console.log('[fetchAllNodesData] Called with', registryPods.length, 'pods');
    if (registryPods.length === 0) {
      console.log('[fetchAllNodesData] No pods to fetch, returning');
      return;
    }

    setIsLoading(true);
    console.log('[fetchAllNodesData] Starting batched fetch for', registryPods.length, 'nodes');

    // Process in batches with concurrency limit
    const BATCH_SIZE = 5;
    const batches = [];

    for (let i = 0; i < registryPods.length; i += BATCH_SIZE) {
      batches.push(registryPods.slice(i, i + BATCH_SIZE));
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
  }, [registryPods, fetchNodeDataAndUpdate]);

  // Handle network change
  const handleNetworkChange = useCallback((networkId: string) => {
    setSelectedNetwork(networkId);
    fetchRegistryPods(networkId);
  }, [fetchRegistryPods]);

  // Initial fetch on mount
  useEffect(() => {
    fetchRegistryPods(selectedNetwork);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch nodes data when registry pods change
  useEffect(() => {
    console.log('[useEffect] Registry status:', registryStatus, 'Pods:', registryPods.length);
    if (registryStatus === "success" && registryPods.length > 0) {
      console.log('[useEffect] Triggering fetchAllNodesData');
      fetchAllNodesData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryStatus, registryPods.length]);


  // Calculate network stats
  const onlineNodes = nodes.filter((n) => n.status === "online");
  const totalStorage = onlineNodes.reduce(
    (acc, n) => acc + (n.stats?.file_size || 0),
    0
  );
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

  // Filter nodes based on current filters
  const filteredNodes = nodes.filter(node => {
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
          onClick={() => fetchRegistryPods(selectedNetwork)}
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
              onClick={() => fetchRegistryPods(selectedNetwork)}
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
            Showing {filteredNodes.length} of {nodes.length} nodes
          </p>

          {/* Card View */}
          {viewMode === "card" && (
            <Stagger
              key={`${statusFilter}-${versionFilter}-${searchQuery}`}
              animateOnMount
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredNodes.map((node) => (
                <StaggerItem key={node.address}>
                  <ScaleOnHover scale={1.01}>
                    <NodeCard
                      node={node}
                      isSelected={selectedNode === node.address}
                      onClick={() => setSelectedNode(selectedNode === node.address ? null : node.address)}
                      formatBytes={formatBytes}
                      formatUptime={formatUptime}
                    />
                  </ScaleOnHover>
                </StaggerItem>
              ))}
            </Stagger>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <div className="border border-border bg-card overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Node</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Version</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">CPU</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">RAM</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Storage</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Uptime</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Streams</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredNodes.map((node, idx) => (
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
          />
        </>
      )}
    </DashboardLayout>
  );
}
