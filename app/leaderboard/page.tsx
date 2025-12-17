"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  RefreshCw,
  Trophy,
  Network,
} from "lucide-react";
import { DashboardLayout, PageHeader, ContentSection, type NavSection } from "@/components/layout";
import { Logo, LogoIcon, FadeIn, BracketCard } from "@/components/common";
import {
  LeaderboardTable,
  LeaderboardFilters,
  ComparisonPanel,
  RankBadge,
  type TimeRange,
  type ViewMode,
} from "@/components/leaderboard";
import { NodeDetailPanel } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { batchGeolocate } from "@/lib/geolocation";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import { PROXY_URL, USE_PROXY, proxyEndpoints } from "@/lib/proxyConfig";

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

interface NodeData {
  ip: string;
  address: string;
  label: string;
  pubkey: string | null;
  registryVersion: string;
  status: "online" | "offline" | "loading";
  version?: VersionResponse;
  stats?: StatsResponse;
  error?: string;
  lastFetched?: number;
  location?: {
    city: string;
    country: string;
    countryCode?: string;
  };
}

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

interface PodCredit {
  pod_id: string;
  credits: number;
}

interface PodCreditsResponse {
  pods_credits: PodCredit[];
  status: string;
}

interface LeaderboardEntry {
  node: NodeData;
  credits: number;
  rank: number;
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
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Network config
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

// Navigation
const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
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

export default function LeaderboardPage() {
  // Network state
  const [selectedNetwork, setSelectedNetwork] = useState<string>("devnet1");
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pod credits
  const [podCredits, setPodCredits] = useState<Map<string, number>>(new Map());

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());

  // Detail panel
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // Load favorites on mount
  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  // Call RPC endpoint
  const callRpcEndpoint = useCallback(async (
    rpcUrl: string,
    method: string
  ): Promise<{ result?: unknown; error?: string }> => {
    if (USE_PROXY && PROXY_URL) {
      try {
        const response = await fetch(proxyEndpoints.rpc(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: rpcUrl, method }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.result) return { result: data.result };
          if (data.error) return { error: data.error };
        }
      } catch {
        // Continue to fallback
      }
    }

    const payload = { jsonrpc: "2.0", method, id: 1 };
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.result) return { result: data.result };
        if (data.error) return { error: data.error };
      }
    } catch {
      // Try local proxy
    }

    try {
      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: rpcUrl, method }),
      });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const data = await response.json();
      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  }, []);

  // Fetch pod credits
  const fetchPodCredits = useCallback(async () => {
    try {
      const response = await fetch("/api/pod-credits");
      if (!response.ok) return;
      const data: PodCreditsResponse = await response.json();
      if (data.status === "success" && data.pods_credits) {
        const creditsMap = new Map<string, number>();
        data.pods_credits.forEach(pc => creditsMap.set(pc.pod_id, pc.credits));
        setPodCredits(creditsMap);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Call node API
  const callApi = async (ip: string, method: string): Promise<{ result?: unknown; error?: string }> => {
    try {
      const response = await fetch("/api/prpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: `http://${ip}:6000/rpc`, method }),
      });
      if (!response.ok) return { error: `HTTP ${response.status}` };
      const data = await response.json();
      if (data.error) return { error: data.error };
      return { result: data.result };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unknown error" };
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === selectedNetwork);
    if (!network) return;

    // Fetch registry pods
    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");
    if (res.error || !res.result) {
      setIsLoading(false);
      return;
    }

    const data = res.result as NetworkPodsResponse;
    if (!data.pods || data.pods.length === 0) {
      setIsLoading(false);
      return;
    }

    // Initialize nodes
    const initialNodes: NodeData[] = data.pods.map((pod, idx) => ({
      ip: pod.address.split(":")[0],
      address: pod.address,
      label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
      pubkey: pod.pubkey,
      registryVersion: pod.version,
      status: "loading" as const,
    }));
    setNodes(initialNodes);

    // Fetch node details in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < data.pods.length; i += BATCH_SIZE) {
      const batch = data.pods.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (pod, batchIdx) => {
        const idx = i + batchIdx;
        const ip = pod.address.split(":")[0];

        const [versionRes, statsRes] = await Promise.all([
          callApi(ip, "get-version"),
          callApi(ip, "get-stats"),
        ]);

        const nodeData: NodeData = {
          ip,
          address: pod.address,
          label: pod.pubkey ? `${pod.pubkey.slice(0, 8)}...` : `Node ${idx + 1}`,
          pubkey: pod.pubkey,
          registryVersion: pod.version,
          status: versionRes.error && statsRes.error ? "offline" : "online",
          version: versionRes.result as VersionResponse | undefined,
          stats: statsRes.result as StatsResponse | undefined,
          error: versionRes.error || statsRes.error,
        };

        setNodes(prev => prev.map(n => n.address === pod.address ? nodeData : n));
      }));
    }

    // Fetch geolocation
    const loadedNodes = initialNodes.filter(n => n.status !== 'loading');
    if (loadedNodes.length > 0) {
      const ips = loadedNodes.map(n => n.address.split(':')[0]);
      const geoResults = await batchGeolocate(ips);
      setNodes(prev => prev.map(node => {
        const ip = node.address.split(':')[0];
        const geo = geoResults.get(ip);
        if (geo) {
          return { ...node, location: { city: geo.city, country: geo.country, countryCode: geo.countryCode } };
        }
        return node;
      }));
    }

    setIsLoading(false);
  }, [selectedNetwork, callRpcEndpoint]);

  // Initial fetch
  useEffect(() => {
    fetchData();
    fetchPodCredits();
  }, [fetchData, fetchPodCredits]);

  // Handle favorite toggle
  const handleToggleFavorite = async (node: NodeData) => {
    if (!node.pubkey) return;
    const newState = await toggleFavorite({
      pubkey: node.pubkey,
      label: node.label,
      address: node.address,
    });
    setFavorites(prev => {
      const next = new Set(prev);
      if (newState) {
        next.add(node.pubkey!);
      } else {
        next.delete(node.pubkey!);
      }
      return next;
    });
  };

  // Handle compare toggle
  const handleToggleCompare = (pubkey: string) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(pubkey)) {
        next.delete(pubkey);
      } else if (next.size < 3) {
        next.add(pubkey);
      }
      return next;
    });
  };

  // Build leaderboard entries
  const leaderboardEntries = useMemo(() => {
    // Filter and sort by credits
    let filtered = nodes
      .filter(node => node.pubkey) // Only nodes with pubkey
      .map(node => ({
        node,
        credits: node.pubkey ? (podCredits.get(node.pubkey) || 0) : 0,
        rank: 0,
      }))
      .sort((a, b) => b.credits - a.credits);

    // Assign ranks
    filtered = filtered.map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    // Apply filters
    if (showFavoritesOnly) {
      filtered = filtered.filter(e => e.node.pubkey && favorites.has(e.node.pubkey));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.node.label.toLowerCase().includes(query) ||
        e.node.address.toLowerCase().includes(query) ||
        e.node.pubkey?.toLowerCase().includes(query) ||
        e.node.location?.city.toLowerCase().includes(query) ||
        e.node.location?.country.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [nodes, podCredits, showFavoritesOnly, favorites, searchQuery]);

  // Get entries for comparison
  const comparisonEntries = useMemo(() => {
    return leaderboardEntries.filter(e => e.node.pubkey && selectedForCompare.has(e.node.pubkey));
  }, [leaderboardEntries, selectedForCompare]);

  // Stats
  const totalCredits = leaderboardEntries.reduce((sum, e) => sum + e.credits, 0);
  const topNode = leaderboardEntries[0];

  // Network selector
  const NetworkSelector = () => (
    <div className="flex flex-wrap items-center gap-2">
      {NETWORK_RPC_ENDPOINTS.map((network) => (
        <button
          key={network.id}
          onClick={() => setSelectedNetwork(network.id)}
          className={cn(
            "px-3 py-1.5 text-sm font-mono transition-all flex items-center gap-2 border",
            selectedNetwork === network.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/50"
          )}
        >
          <span className={cn("w-2 h-2", network.type === "mainnet" ? "bg-success" : "bg-[#F59E0B]")} />
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
      loading={isLoading}
      headerRight={
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchData(); fetchPodCredits(); }}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <FadeIn animateOnMount>
        <PageHeader
          title="Reputation Leaderboard"
          description="Nodes ranked by their reputation credits"
          actions={<NetworkSelector />}
        />
      </FadeIn>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Top Node</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : topNode ? (
            <div className="flex items-center gap-3">
              <RankBadge rank={1} size="md" />
              <div>
                <p className="font-mono font-medium">{topNode.node.label}</p>
                <p className="text-sm text-success font-mono">{topNode.credits.toLocaleString()} credits</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No data</p>
          )}
        </BracketCard>

        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Nodes</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-3xl font-light font-mono">{leaderboardEntries.length}</p>
          )}
        </BracketCard>

        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-success" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Credits</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-3xl font-light font-mono text-success">{totalCredits.toLocaleString()}</p>
          )}
        </BracketCard>
      </div>

      {/* Filters */}
      <LeaderboardFilters
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showFavoritesOnly={showFavoritesOnly}
        setShowFavoritesOnly={setShowFavoritesOnly}
        viewMode={viewMode}
        setViewMode={setViewMode}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
        selectedCount={selectedForCompare.size}
      />

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4 font-mono">
        Showing {leaderboardEntries.length} nodes
        {showFavoritesOnly && " (favorites only)"}
        {searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="w-8 h-8" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <LeaderboardTable
          entries={leaderboardEntries}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onSelectNode={setSelectedNode}
          compareMode={compareMode}
          selectedForCompare={selectedForCompare}
          onToggleCompare={handleToggleCompare}
          formatBytes={formatBytes}
          formatUptime={formatUptime}
        />
      )}

      {/* Node Detail Panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          formatBytes={formatBytes}
          formatUptime={formatUptime}
          formatTimestamp={formatTimestamp}
          credits={selectedNode.pubkey ? podCredits.get(selectedNode.pubkey) : undefined}
        />
      )}

      {/* Comparison Panel */}
      {compareMode && comparisonEntries.length > 0 && (
        <ComparisonPanel
          entries={comparisonEntries}
          onClose={() => {
            setCompareMode(false);
            setSelectedForCompare(new Set());
          }}
          onRemove={(pubkey) => {
            setSelectedForCompare(prev => {
              const next = new Set(prev);
              next.delete(pubkey);
              return next;
            });
          }}
          formatBytes={formatBytes}
          formatUptime={formatUptime}
        />
      )}
    </DashboardLayout>
  );
}
