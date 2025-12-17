"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  RefreshCw,
  Globe,
  Network,
  Trophy,
  BarChart3,
} from "lucide-react";
import { DashboardLayout, PageHeader, type NavSection } from "@/components/layout";
import { Logo, LogoIcon } from "@/components/common";
import { FadeIn } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { batchGeolocate } from "@/lib/geolocation";
import { findLatestVersion, getVersionColor } from "@/lib/version";
import type { GlobeNode, GlobeConnection } from "@/components/globe";
import { useNodes, NETWORK_RPC_ENDPOINTS, type NodeData as ContextNodeData } from "@/contexts/NodesContext";

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

export default function TopologyPage() {
  // Use shared context for nodes data
  const {
    selectedNetwork,
    setSelectedNetwork,
    currentNetwork,
    nodes: contextNodes,
    registryPods,
    isLoading,
    registryStatus,
    registryError,
    lastUpdate,
    isCached,
    refreshData,
  } = useNodes();

  // Map context nodes to local NodeData type (they're compatible)
  const nodes = contextNodes as NodeData[];

  const [isDark, setIsDark] = useState(false);

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

  // Store geolocation data (specific to topology for globe)
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
          onClick={() => setSelectedNetwork(network.id)}
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
          onClick={() => refreshData(true)}
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
              onClick={() => refreshData(true)}
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
