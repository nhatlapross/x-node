"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamic import for 3D graph (avoid SSR issues with Three.js)
const NetworkTopology3D = dynamic(
  () => import("@/components/visualization/NetworkTopology3D"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-center">
        <div className="text-zinc-400">Loading 3D Network Graph...</div>
      </div>
    ),
  }
);

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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Get current network config
  const currentNetwork = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork)!;

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
      const data = await response.json();
      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Call RPC endpoint directly (for HTTPS endpoints)
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
      const data = await response.json();
      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Fetch pods from selected network registry
  const fetchRegistryPods = useCallback(async (networkId: string) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId);
    if (!network) return;

    setRegistryStatus("loading");
    setRegistryError(null);
    setNodes([]);
    setSelectedNode(null);

    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

    if (res.error) {
      setRegistryStatus("error");
      setRegistryError(res.error);
      setRegistryPods([]);
      return;
    }

    const data = res.result as NetworkPodsResponse;
    // Sort by last_seen_timestamp (most recent first)
    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp);
    setRegistryPods(sortedPods);
    setRegistryStatus("success");

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

    const fullResult: NodeData = {
      ...partialResult,
      pods: podsRes.result as PodsResponse | undefined,
    };

    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n));
    return fullResult;
  }, []);

  // Fetch all nodes with concurrency limit for better performance
  const fetchAllNodesData = useCallback(async () => {
    if (registryPods.length === 0) return;

    setIsLoading(true);

    // Process in batches with concurrency limit
    const BATCH_SIZE = 5;
    const batches = [];

    for (let i = 0; i < registryPods.length; i += BATCH_SIZE) {
      batches.push(registryPods.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((pod, idx) => {
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
  }, []);

  // Fetch nodes data when registry pods change
  useEffect(() => {
    if (registryStatus === "success" && registryPods.length > 0) {
      fetchAllNodesData();
    }
  }, [registryStatus, registryPods.length]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchRegistryPods(selectedNetwork);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedNetwork, fetchRegistryPods]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Xandeum pNodes Analytics
              </h1>
              <p className="text-sm text-zinc-400">
                {currentNetwork.name} Dashboard
              </p>
            </div>

            {/* Network Selector */}
            <div className="flex flex-wrap items-center gap-2">
              {NETWORK_RPC_ENDPOINTS.map((network) => (
                <button
                  key={network.id}
                  onClick={() => handleNetworkChange(network.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedNetwork === network.id
                      ? network.type === "mainnet"
                        ? "bg-green-600 text-white"
                        : "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      network.type === "mainnet" ? "bg-green-400" : "bg-blue-400"
                    }`}
                  />
                  {network.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-zinc-400">Auto-refresh (30s)</span>
              </label>
              <button
                onClick={() => fetchRegistryPods(selectedNetwork)}
                disabled={isLoading || registryStatus === "loading"}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {registryStatus === "loading"
                  ? "Loading pods..."
                  : isLoading
                  ? `Loading ${nodes.filter(n => n.status !== "loading").length}/${nodes.length}...`
                  : "Refresh All"}
              </button>
            </div>
          </div>
          {lastUpdate && (
            <p className="text-xs text-zinc-500 mt-2">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Error State */}
        {registryStatus === "error" && (
          <div className="mb-8 p-6 bg-red-900/20 border border-red-800 rounded-lg text-center">
            <div className="text-red-400 font-medium mb-2">Failed to load {currentNetwork.name}</div>
            <div className="text-zinc-400 text-sm">{registryError}</div>
            <button
              onClick={() => fetchRegistryPods(selectedNetwork)}
              className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {registryStatus === "loading" && (
          <div className="mb-8 p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-zinc-400">Loading pods from {currentNetwork.name}...</div>
          </div>
        )}

        {/* Main Content */}
        {registryStatus === "success" && (
          <>
            {/* Network Overview */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Network Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {onlineNodes.length}/{nodes.length}
                  </div>
                  <div className="text-sm text-zinc-400">Nodes Online</div>
                  <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: nodes.length > 0 ? `${(onlineNodes.length / nodes.length) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {formatBytes(totalStorage)}
                  </div>
                  <div className="text-sm text-zinc-400">Total Storage</div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {avgCpu.toFixed(2)}%
                  </div>
                  <div className="text-sm text-zinc-400">Avg CPU Usage</div>
                </div>

                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {avgRamPercent.toFixed(1)}%
                  </div>
                  <div className="text-sm text-zinc-400">Avg RAM Usage</div>
                </div>
              </div>

              {/* Version Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {registryPods.length}
                  </div>
                  <div className="text-sm text-zinc-400">Registered Pods</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {registryPods.filter((p) => p.version === "0.6.0").length}
                  </div>
                  <div className="text-sm text-zinc-400">Version 0.6.0</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {registryPods.filter((p) => p.version === "0.5.1").length}
                  </div>
                  <div className="text-sm text-zinc-400">Version 0.5.1</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {registryPods.filter((p) => p.pubkey).length}
                  </div>
                  <div className="text-sm text-zinc-400">With Pubkey</div>
                </div>
              </div>

              {/* Sync Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 border border-cyan-800/50">
                  <div className="text-3xl font-bold text-cyan-400 font-mono">
                    #{maxSyncIndex}
                  </div>
                  <div className="text-sm text-zinc-400">Latest Sync Index</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {formatBytes(totalDataSynced)}
                  </div>
                  <div className="text-sm text-zinc-400">Total Data Synced</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {totalActiveStreams}
                  </div>
                  <div className="text-sm text-zinc-400">Active Streams</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {onlineNodes.reduce((acc, n) => acc + (n.stats?.total_pages || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-zinc-400">Total Pages</div>
                </div>
              </div>

              {/* Network Traffic */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-zinc-900 rounded-lg p-4 border border-green-800/50">
                  <div className="text-3xl font-bold text-green-400">
                    {onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_received || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-zinc-400">Packets/s (In)</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-blue-800/50">
                  <div className="text-3xl font-bold text-blue-400">
                    {onlineNodes.reduce((acc, n) => acc + (n.stats?.packets_sent || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-zinc-400">Packets/s (Out)</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {onlineNodes.length > 0
                      ? formatUptime(Math.max(...onlineNodes.map((n) => n.stats?.uptime || 0)))
                      : "-"}
                  </div>
                  <div className="text-sm text-zinc-400">Max Uptime</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <div className="text-3xl font-bold text-white">
                    {onlineNodes.length > 0
                      ? formatUptime(
                          Math.round(
                            onlineNodes.reduce((acc, n) => acc + (n.stats?.uptime || 0), 0) / onlineNodes.length
                          )
                        )
                      : "-"}
                  </div>
                  <div className="text-sm text-zinc-400">Avg Uptime</div>
                </div>
              </div>
            </section>

            {/* Network Topology 3D */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Network Topology</h2>
              <p className="text-sm text-zinc-400 mb-4">
                3D visualization of node connections. Drag to rotate, scroll to zoom, click node for details.
              </p>
              <NetworkTopology3D
                nodes={nodes}
                onNodeClick={(node) => setSelectedNode(node.address)}
              />
            </section>

            {/* Node Grid */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">All Nodes ({nodes.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nodes.map((node) => (
                  <div
                    key={node.address}
                    onClick={() =>
                      setSelectedNode(selectedNode === node.address ? null : node.address)
                    }
                    className={`bg-zinc-900 rounded-lg p-4 border cursor-pointer transition-all hover:border-blue-600 ${
                      selectedNode === node.address
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : "border-zinc-800"
                    }`}
                  >
                    {/* Node Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-white">{node.label}</h3>
                        <p className="text-xs font-mono text-zinc-500">{node.address}</p>
                        {node.pubkey && (
                          <p className="text-xs font-mono text-zinc-600 truncate max-w-[200px]" title={node.pubkey}>
                            {node.pubkey}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {node.version && (
                          <span className="text-xs bg-zinc-800 px-2 py-1 rounded">
                            v{node.version.version}
                          </span>
                        )}
                        <span
                          className={`w-3 h-3 rounded-full ${
                            node.status === "online"
                              ? "bg-green-500"
                              : node.status === "offline"
                              ? "bg-red-500"
                              : "bg-yellow-500 animate-pulse"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Node Stats */}
                    {node.status === "online" && node.stats ? (
                      <div className="space-y-2">
                        {/* CPU */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400">CPU</span>
                            <span className="text-zinc-300">
                              {node.stats.cpu_percent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(node.stats.cpu_percent, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* RAM */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400">RAM</span>
                            <span className="text-zinc-300">
                              {formatBytes(node.stats.ram_used)} /{" "}
                              {formatBytes(node.stats.ram_total)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 transition-all"
                              style={{
                                width: `${(node.stats.ram_used / node.stats.ram_total) * 100}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Sync Info */}
                        <div className="mt-3 pt-3 border-t border-zinc-800">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-zinc-500">Sync Index</span>
                            <span className="text-sm font-mono text-cyan-400">
                              #{node.stats.current_index}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Data Synced</span>
                            <span className="text-sm text-zinc-300">
                              {formatBytes(node.stats.total_bytes)}
                            </span>
                          </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800">
                          <div>
                            <div className="text-xs text-zinc-500">Uptime</div>
                            <div className="text-sm text-zinc-300">
                              {formatUptime(node.stats.uptime)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Storage</div>
                            <div className="text-sm text-zinc-300">
                              {formatBytes(node.stats.file_size)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Packets In</div>
                            <div className="text-sm text-zinc-300">
                              {node.stats.packets_received.toLocaleString()}/s
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Packets Out</div>
                            <div className="text-sm text-zinc-300">
                              {node.stats.packets_sent.toLocaleString()}/s
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Active Streams</div>
                            <div className="text-sm text-zinc-300">
                              {node.stats.active_streams}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500">Total Pages</div>
                            <div className="text-sm text-zinc-300">
                              {node.stats.total_pages.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Last Updated */}
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <div className="text-xs text-zinc-500">
                            Last Updated: {formatTimestamp(node.stats.last_updated)}
                          </div>
                        </div>
                      </div>
                    ) : node.status === "offline" ? (
                      <div className="text-sm text-red-400 py-4">
                        {node.error || "Node offline"}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500 py-4 animate-pulse">
                        Loading...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Selected Node Detail */}
            {selectedNodeData && selectedNodeData.status === "online" && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4">
                  Node Details: {selectedNodeData.label}
                </h2>
                <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800">
                    {selectedNodeData.stats && (
                      <>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            CPU Usage
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.cpu_percent.toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            RAM Used
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {formatBytes(selectedNodeData.stats.ram_used)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            of {formatBytes(selectedNodeData.stats.ram_total)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Uptime
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {formatUptime(selectedNodeData.stats.uptime)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Storage Size
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {formatBytes(selectedNodeData.stats.file_size)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Active Streams
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.active_streams}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Packets Received
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.packets_received}/s
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Packets Sent
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.packets_sent}/s
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Total Bytes
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {formatBytes(selectedNodeData.stats.total_bytes)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Total Pages
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.total_pages}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Current Index
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.stats.current_index}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Last Updated
                          </div>
                          <div className="text-lg font-bold text-white mt-1">
                            {formatTimestamp(selectedNodeData.stats.last_updated)}
                          </div>
                        </div>
                        <div className="bg-zinc-900 p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider">
                            Version
                          </div>
                          <div className="text-2xl font-bold text-white mt-1">
                            {selectedNodeData.version?.version || "N/A"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Pubkey */}
                  {selectedNodeData.pubkey && (
                    <div className="p-4 border-t border-zinc-800">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        Public Key
                      </div>
                      <div className="font-mono text-sm text-zinc-300 break-all">
                        {selectedNodeData.pubkey}
                      </div>
                    </div>
                  )}

                  {/* Peers Section */}
                  {selectedNodeData.pods && (
                    <div className="p-4 border-t border-zinc-800">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-medium text-zinc-400">
                          Known Peers ({selectedNodeData.pods.total_count})
                        </h3>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">
                            v0.6.0: {selectedNodeData.pods.pods.filter(p => p.version === "0.6.0").length}
                          </span>
                          <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                            v0.5.1: {selectedNodeData.pods.pods.filter(p => p.version === "0.5.1").length}
                          </span>
                        </div>
                      </div>
                      {selectedNodeData.pods.pods.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {selectedNodeData.pods.pods
                            .sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp)
                            .map((pod, idx) => {
                              const isRecent = Date.now() / 1000 - pod.last_seen_timestamp < 300; // 5 minutes
                              return (
                                <div
                                  key={idx}
                                  className={`bg-zinc-800 rounded p-3 border-l-2 ${
                                    isRecent ? "border-green-500" : "border-zinc-600"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            isRecent ? "bg-green-500" : "bg-zinc-500"
                                          }`}
                                        />
                                        <span className="font-mono text-sm text-white">
                                          {pod.address}
                                        </span>
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            pod.version === "0.6.0"
                                              ? "bg-green-500/20 text-green-400"
                                              : "bg-yellow-500/20 text-yellow-400"
                                          }`}
                                        >
                                          v{pod.version}
                                        </span>
                                      </div>
                                      {pod.pubkey && (
                                        <div
                                          className="font-mono text-xs text-zinc-500 mt-1 truncate cursor-pointer hover:text-zinc-300"
                                          title={pod.pubkey}
                                          onClick={() => navigator.clipboard.writeText(pod.pubkey || "")}
                                        >
                                          {pod.pubkey}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                      <div className="text-xs text-zinc-400">
                                        {isRecent ? "Active" : "Last seen"}
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {formatTimestamp(pod.last_seen_timestamp)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-500 bg-zinc-800 rounded p-4 text-center">
                          No peers discovered yet
                        </div>
                      )}
                      <div className="mt-3 text-xs text-zinc-500">
                        Peers discovered via Gossip Protocol (port 9001). Green indicator = active within 5 minutes.
                      </div>
                    </div>
                  )}

                  {/* Raw JSON */}
                  <details className="border-t border-zinc-800">
                    <summary className="p-4 cursor-pointer text-sm text-zinc-400 hover:text-zinc-300">
                      View Raw JSON Response
                    </summary>
                    <pre className="p-4 pt-0 text-xs text-zinc-500 overflow-x-auto">
                      {JSON.stringify(
                        {
                          version: selectedNodeData.version,
                          stats: selectedNodeData.stats,
                          pods: selectedNodeData.pods,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </div>
              </section>
            )}

            {/* All Nodes Table */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Nodes Comparison Table</h2>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left p-3 font-medium text-zinc-400">#</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Node</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Status</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Sync Index</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Data Synced</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Version</th>
                      <th className="text-left p-3 font-medium text-zinc-400">CPU</th>
                      <th className="text-left p-3 font-medium text-zinc-400">RAM</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Storage</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Packets In/Out</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Streams</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Uptime</th>
                      <th className="text-left p-3 font-medium text-zinc-400">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {nodes.map((node, idx) => (
                      <tr
                        key={node.address}
                        className={`hover:bg-zinc-800/50 cursor-pointer ${
                          selectedNode === node.address ? "bg-blue-900/20" : ""
                        }`}
                        onClick={() =>
                          setSelectedNode(selectedNode === node.address ? null : node.address)
                        }
                      >
                        <td className="p-3 text-zinc-500">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-medium text-white">{node.label}</div>
                          <div className="text-xs text-zinc-500 font-mono">
                            {node.address}
                          </div>
                          {node.pubkey && (
                            <div className="text-xs text-zinc-600 font-mono truncate max-w-[150px]" title={node.pubkey}>
                              {node.pubkey}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                              node.status === "online"
                                ? "bg-green-500/20 text-green-400"
                                : node.status === "offline"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                node.status === "online"
                                  ? "bg-green-400"
                                  : node.status === "offline"
                                  ? "bg-red-400"
                                  : "bg-yellow-400"
                              }`}
                            />
                            {node.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-cyan-400">
                            {node.stats?.current_index !== undefined ? `#${node.stats.current_index}` : "-"}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats ? formatBytes(node.stats.total_bytes) : "-"}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.version?.version || node.registryVersion || "-"}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats?.cpu_percent.toFixed(2) || "-"}%
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats
                            ? `${((node.stats.ram_used / node.stats.ram_total) * 100).toFixed(1)}%`
                            : "-"}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats ? formatBytes(node.stats.file_size) : "-"}
                        </td>
                        <td className="p-3 text-zinc-300 text-xs">
                          {node.stats ? (
                            <span>
                              <span className="text-green-400">{node.stats.packets_received.toLocaleString()}</span>
                              {" / "}
                              <span className="text-blue-400">{node.stats.packets_sent.toLocaleString()}</span>
                            </span>
                          ) : "-"}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats?.active_streams ?? "-"}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {node.stats ? formatUptime(node.stats.uptime) : "-"}
                        </td>
                        <td className="p-3 text-zinc-400 text-xs">
                          {node.stats ? formatTimestamp(node.stats.last_updated) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-zinc-500 text-sm">
          <p>Xandeum pNodes Analytics Platform</p>
          <p className="mt-1">
            Join Discord:{" "}
            <a
              href="https://discord.gg/uqRSmmM5m"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              discord.gg/uqRSmmM5m
            </a>
            {" | "}
            <a
              href="https://xandeum.network"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              xandeum.network
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
