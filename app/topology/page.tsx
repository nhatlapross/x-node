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
import { DashboardLayout, PageHeader, type NavSection } from "@/components/layout";
import { Logo, LogoIcon } from "@/components/common";
import { FadeIn } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const NetworkTopology3D = dynamic(
  () => import("@/components/visualization/NetworkTopology3D").then(mod => ({ default: mod.NetworkTopology3D })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] flex items-center justify-center bg-card border border-border">
        <div className="text-muted-foreground font-mono">Loading 3D Topology...</div>
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

  const fetchRegistryPods = useCallback(async (networkId: string) => {
    const network = NETWORK_RPC_ENDPOINTS.find(n => n.id === networkId);
    if (!network) return;

    setRegistryStatus("loading");
    setRegistryError(null);
    setNodes([]);

    const res = await callRpcEndpoint(network.rpcUrl, "get-pods");

    if (res.error) {
      setRegistryStatus("error");
      setRegistryError(res.error);
      setRegistryPods([]);
      return;
    }

    const data = res.result as NetworkPodsResponse;
    if (!data.pods || data.pods.length === 0) {
      setRegistryStatus("error");
      setRegistryError("No pods found in registry");
      setRegistryPods([]);
      return;
    }

    const sortedPods = data.pods.sort((a, b) => b.last_seen_timestamp - a.last_seen_timestamp);
    setRegistryPods(sortedPods);
    setRegistryStatus("success");

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

    const [versionRes, statsRes] = await Promise.all([
      callApi(ip, "get-version"),
      callApi(ip, "get-stats"),
    ]);

    if (versionRes.error && statsRes.error) {
      const offlineResult: NodeData = {
        ...baseData,
        status: "offline",
        error: versionRes.error || statsRes.error,
      };
      setNodes(prev => prev.map(n => n.address === pod.address ? offlineResult : n));
      return offlineResult;
    }

    const partialResult: NodeData = {
      ...baseData,
      status: "online",
      version: versionRes.result as VersionResponse | undefined,
      stats: statsRes.result as StatsResponse | undefined,
      lastFetched: Date.now(),
    };
    setNodes(prev => prev.map(n => n.address === pod.address ? partialResult : n));

    const podsRes = await callApi(ip, "get-pods");
    const fullResult: NodeData = {
      ...partialResult,
      pods: podsRes.result as PodsResponse | undefined,
    };

    setNodes(prev => prev.map(n => n.address === pod.address ? fullResult : n));
    return fullResult;
  }, []);

  const fetchAllNodesData = useCallback(async () => {
    if (registryPods.length === 0) return;

    setIsLoading(true);

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

  const handleNetworkChange = useCallback((networkId: string) => {
    setSelectedNetwork(networkId);
    fetchRegistryPods(networkId);
  }, [fetchRegistryPods]);

  useEffect(() => {
    fetchRegistryPods(selectedNetwork);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (registryStatus === "success" && registryPods.length > 0) {
      fetchAllNodesData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryStatus, registryPods.length]);

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
          title="Network Topology"
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
          <div className="border border-border bg-card overflow-hidden" style={{ height: '600px' }}>
            <NetworkTopology3D nodes={nodes} />
          </div>
        </FadeIn>
      )}
    </DashboardLayout>
  );
}
