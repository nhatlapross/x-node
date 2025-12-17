"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  RefreshCw,
  Trophy,
  Network,
  BarChart3,
} from "lucide-react";
import { DashboardLayout, PageHeader, type NavSection } from "@/components/layout";
import { Logo, LogoIcon, FadeIn, BracketCard } from "@/components/common";
import {
  LeaderboardTable,
  LeaderboardFilters,
  ComparisonPanel,
  RankBadge,
  type TimeRange,
} from "@/components/leaderboard";
import { NodeDetailPanel } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import { useNodes, NETWORK_RPC_ENDPOINTS, type NodeData } from "@/contexts/NodesContext";

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

// Navigation
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

export default function LeaderboardPage() {
  // Use shared context for nodes and credits data
  const {
    selectedNetwork,
    setSelectedNetwork,
    currentNetwork,
    nodes,
    podCredits,
    isLoading,
    refreshData,
    refreshPodCredits,
  } = useNodes();

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());

  // Detail panel
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // Load favorites on mount
  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

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
          onClick={() => { refreshData(true); refreshPodCredits(); }}
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
