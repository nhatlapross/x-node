"use client";

import { useState, useEffect, useCallback } from "react";

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
}

interface PodsResponse {
  pods: Pod[];
  total_count: number;
}

interface NodeData {
  ip: string;
  label: string;
  status: "online" | "offline" | "loading";
  version?: VersionResponse;
  stats?: StatsResponse;
  pods?: PodsResponse;
  error?: string;
  lastFetched?: number;
}

const DEVNET_NODES = [
  { ip: "173.212.203.145", label: "Devnet Node 1" },
  { ip: "173.212.220.65", label: "Devnet Node 2" },
  { ip: "161.97.97.41", label: "Devnet Node 3" },
  { ip: "192.190.136.36", label: "Devnet Node 4" },
  { ip: "192.190.136.37", label: "Devnet Node 5" },
  { ip: "192.190.136.38", label: "Devnet Node 6" },
  { ip: "192.190.136.28", label: "Devnet Node 7" },
  { ip: "192.190.136.29", label: "Devnet Node 8" },
  { ip: "207.244.255.1", label: "Devnet Node 9" },
];

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
  const [nodes, setNodes] = useState<NodeData[]>(
    DEVNET_NODES.map((n) => ({ ...n, status: "loading" as const }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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

  const fetchNodeData = useCallback(async (ip: string, label: string): Promise<NodeData> => {
    const nodeData: NodeData = { ip, label, status: "loading" };

    // Fetch all three APIs in parallel
    const [versionRes, statsRes, podsRes] = await Promise.all([
      callApi(ip, "get-version"),
      callApi(ip, "get-stats"),
      callApi(ip, "get-pods"),
    ]);

    if (versionRes.error && statsRes.error && podsRes.error) {
      return {
        ...nodeData,
        status: "offline",
        error: versionRes.error || statsRes.error || podsRes.error,
      };
    }

    return {
      ...nodeData,
      status: "online",
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      pods: podsRes.result as PodsResponse | undefined,
      lastFetched: Date.now(),
    };
  }, []);

  const fetchAllNodes = useCallback(async () => {
    setIsLoading(true);

    // Fetch all nodes in parallel
    const results = await Promise.all(
      DEVNET_NODES.map((node) => fetchNodeData(node.ip, node.label))
    );

    setNodes(results);
    setLastUpdate(new Date());
    setIsLoading(false);
  }, [fetchNodeData]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAllNodes, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchAllNodes]);

  // Initial fetch
  useEffect(() => {
    fetchAllNodes();
  }, [fetchAllNodes]);

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

  const selectedNodeData = selectedNode
    ? nodes.find((n) => n.ip === selectedNode)
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Xandeum pNodes Analytics
              </h1>
              <p className="text-sm text-zinc-400">Devnet Network Dashboard</p>
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
                onClick={fetchAllNodes}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isLoading ? "Refreshing..." : "Refresh All"}
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
                    width: `${(onlineNodes.length / nodes.length) * 100}%`,
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
        </section>

        {/* Node Grid */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">All Nodes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div
                key={node.ip}
                onClick={() =>
                  setSelectedNode(selectedNode === node.ip ? null : node.ip)
                }
                className={`bg-zinc-900 rounded-lg p-4 border cursor-pointer transition-all hover:border-blue-600 ${
                  selectedNode === node.ip
                    ? "border-blue-500 ring-1 ring-blue-500"
                    : "border-zinc-800"
                }`}
              >
                {/* Node Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-white">{node.label}</h3>
                    <p className="text-xs font-mono text-zinc-500">{node.ip}</p>
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
                          {node.stats.packets_received}/s
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Packets Out</div>
                        <div className="text-sm text-zinc-300">
                          {node.stats.packets_sent}/s
                        </div>
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

              {/* Peers Section */}
              {selectedNodeData.pods && (
                <div className="p-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-400 mb-3">
                    Known Peers ({selectedNodeData.pods.total_count})
                  </h3>
                  {selectedNodeData.pods.pods.length > 0 ? (
                    <div className="space-y-2">
                      {selectedNodeData.pods.pods.map((pod, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-zinc-800 rounded p-3"
                        >
                          <div>
                            <div className="font-mono text-sm text-white">
                              {pod.address}
                            </div>
                            <div className="text-xs text-zinc-500">
                              v{pod.version}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-400">
                              Last seen
                            </div>
                            <div className="text-xs text-zinc-500">
                              {pod.last_seen}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500 bg-zinc-800 rounded p-4 text-center">
                      No peers discovered yet
                    </div>
                  )}
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
                  <th className="text-left p-3 font-medium text-zinc-400">Node</th>
                  <th className="text-left p-3 font-medium text-zinc-400">Status</th>
                  <th className="text-left p-3 font-medium text-zinc-400">Version</th>
                  <th className="text-left p-3 font-medium text-zinc-400">CPU</th>
                  <th className="text-left p-3 font-medium text-zinc-400">RAM</th>
                  <th className="text-left p-3 font-medium text-zinc-400">Storage</th>
                  <th className="text-left p-3 font-medium text-zinc-400">Uptime</th>
                  <th className="text-left p-3 font-medium text-zinc-400">Streams</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {nodes.map((node) => (
                  <tr
                    key={node.ip}
                    className="hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() =>
                      setSelectedNode(selectedNode === node.ip ? null : node.ip)
                    }
                  >
                    <td className="p-3">
                      <div className="font-medium text-white">{node.label}</div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {node.ip}
                      </div>
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
                    <td className="p-3 text-zinc-300">
                      {node.version?.version || "-"}
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
                    <td className="p-3 text-zinc-300">
                      {node.stats ? formatUptime(node.stats.uptime) : "-"}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {node.stats?.active_streams ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
