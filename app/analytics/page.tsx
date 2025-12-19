"use client";

import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  Activity,
  RefreshCw,
  Trophy,
  Network,
  BarChart3,
  TrendingUp,
  Clock,
  Server,
} from "lucide-react";
import { DashboardLayout, PageHeader, type NavSection } from "@/components/layout";
import { Logo, LogoIcon, FadeIn, BracketCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { NETWORK_RPC_ENDPOINTS } from "@/contexts/NodesContext";
import {
  useNetworkHistory,
  useNetworkComparison,
  useHistoryStats,
  type HistoryPeriod,
} from "@/lib/useHistoricalData";
import {
  NetworkHealthChart,
  ResourceUsageChart,
  NetworkComparisonChart,
  StorageTrendChart,
} from "@/components/analytics";

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
      { label: "Topology", href: "/topology", icon: Network },
    ],
  },
];

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

export default function AnalyticsPage() {
  const [selectedNetwork, setSelectedNetwork] = useState("devnet1");
  const [selectedPeriod, setSelectedPeriod] = useState<HistoryPeriod>("24h");

  // Fetch network history for selected network
  const {
    chartData,
    isLoading: networkLoading,
    refresh: refreshNetwork,
  } = useNetworkHistory({
    network: selectedNetwork,
    period: selectedPeriod,
  });

  // Fetch network comparison
  const {
    networks,
    data: comparisonData,
    isLoading: comparisonLoading,
    refresh: refreshComparison,
  } = useNetworkComparison({
    period: selectedPeriod,
  });

  // Fetch aggregated stats (kept for potential future use)
  const {
    isLoading: statsLoading,
    refresh: refreshStats,
  } = useHistoryStats({
    period: selectedPeriod,
  });

  const isLoading = networkLoading || comparisonLoading || statsLoading;

  // Calculate period stats from chartData (responds to period/network changes)
  const periodStats = useMemo(() => {
    if (!chartData) {
      return { totalPods: 0, online: 0, avgCpu: 0, avgRam: 0 };
    }

    const nodes = chartData.nodes || [];
    const resources = chartData.resources || [];

    // Get latest values from nodes data
    const latestNode = nodes[nodes.length - 1];
    const totalPods = latestNode?.total || 0;
    const online = latestNode?.online || 0;

    // Calculate averages for the period
    const avgCpu = resources.length > 0
      ? resources.reduce((sum, r) => sum + (r.cpu || 0), 0) / resources.length
      : 0;
    const avgRam = resources.length > 0
      ? resources.reduce((sum, r) => sum + (r.ram || 0), 0) / resources.length
      : 0;

    return { totalPods, online, avgCpu, avgRam };
  }, [chartData]);

  const handleRefresh = () => {
    refreshNetwork();
    refreshComparison();
    refreshStats();
  };

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

  // Period selector
  const PeriodSelector = () => (
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-muted-foreground" />
      <div className="flex border border-border rounded-md overflow-hidden">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedPeriod(option.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-mono transition-all border-r border-border last:border-r-0",
              selectedPeriod === option.value
                ? "bg-primary/10 text-primary"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Get current network label
  const currentNetworkLabel =
    NETWORK_RPC_ENDPOINTS.find((n) => n.id === selectedNetwork)?.name ||
    selectedNetwork;

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
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      }
    >
      <FadeIn animateOnMount>
        <PageHeader
          title="Network Analytics"
          description="Historical data and performance trends"
          actions={<NetworkSelector />}
        />
      </FadeIn>

      {/* Period Selector */}
      <div className="flex justify-between items-center mb-6">
        <PeriodSelector />
        <div className="text-xs text-muted-foreground font-mono">
          Viewing: {currentNetworkLabel} / {selectedPeriod}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Pods
            </span>
          </div>
          <p className="text-3xl font-light font-mono">
            {networkLoading || !chartData ? (
              <span className="animate-pulse text-muted-foreground">--</span>
            ) : (
              periodStats.totalPods
            )}
          </p>
        </BracketCard>

        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Online
            </span>
          </div>
          <p className="text-3xl font-light font-mono text-green-500">
            {networkLoading || !chartData ? (
              <span className="animate-pulse text-muted-foreground">--</span>
            ) : (
              periodStats.online
            )}
          </p>
        </BracketCard>

        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Avg CPU
            </span>
          </div>
          <p className="text-3xl font-light font-mono text-cyan-500">
            {networkLoading || !chartData ? (
              <span className="animate-pulse text-muted-foreground">--</span>
            ) : (
              `${periodStats.avgCpu.toFixed(1)}%`
            )}
          </p>
        </BracketCard>

        <BracketCard className="p-4 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Avg RAM
            </span>
          </div>
          <p className="text-3xl font-light font-mono text-purple-500">
            {networkLoading || !chartData ? (
              <span className="animate-pulse text-muted-foreground">--</span>
            ) : (
              `${periodStats.avgRam.toFixed(1)}%`
            )}
          </p>
        </BracketCard>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger
            value="health"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono text-xs"
          >
            Network Health
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono text-xs"
          >
            Resources
          </TabsTrigger>
          <TabsTrigger
            value="storage"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono text-xs"
          >
            Storage
          </TabsTrigger>
          <TabsTrigger
            value="comparison"
            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-mono text-xs"
          >
            Network Comparison
          </TabsTrigger>
        </TabsList>

        {/* Network Health Tab */}
        <TabsContent value="health">
          <BracketCard className="p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-light tracking-wide uppercase">
                  Node Status Over Time
                </h3>
                <p className="text-sm text-muted-foreground">
                  Online vs offline nodes for {currentNetworkLabel}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                  <span className="text-muted-foreground">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-red-500/70" />
                  <span className="text-muted-foreground">Offline</span>
                </div>
              </div>
            </div>
            <NetworkHealthChart
              data={chartData?.nodes || []}
              isLoading={networkLoading || !chartData}
            />
          </BracketCard>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources">
          <BracketCard className="p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-light tracking-wide uppercase">
                  Resource Utilization
                </h3>
                <p className="text-sm text-muted-foreground">
                  CPU and RAM usage trends for {currentNetworkLabel}
                </p>
              </div>
            </div>
            <ResourceUsageChart
              data={chartData?.resources || []}
              isLoading={networkLoading || !chartData}
            />
          </BracketCard>
        </TabsContent>

        {/* Storage Tab */}
        <TabsContent value="storage">
          <BracketCard className="p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-light tracking-wide uppercase">
                  Storage & Streams
                </h3>
                <p className="text-sm text-muted-foreground">
                  Total storage and active streams over time
                </p>
              </div>
            </div>
            <StorageTrendChart
              data={chartData?.storage || []}
              isLoading={networkLoading || !chartData}
            />
          </BracketCard>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          <div className="space-y-6">
            {/* Online Nodes Comparison */}
            <BracketCard className="p-6 bg-card">
              <div className="mb-4">
                <h3 className="text-lg font-light tracking-wide uppercase">
                  Online Nodes Comparison
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compare online node counts across all networks
                </p>
              </div>
              <NetworkComparisonChart
                networks={networks}
                data={comparisonData}
                isLoading={comparisonLoading || networks.length === 0}
                metric="online"
              />
            </BracketCard>

            {/* CPU Comparison */}
            <BracketCard className="p-6 bg-card">
              <div className="mb-4">
                <h3 className="text-lg font-light tracking-wide uppercase">
                  CPU Usage Comparison
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compare average CPU usage across networks
                </p>
              </div>
              <NetworkComparisonChart
                networks={networks}
                data={comparisonData}
                isLoading={comparisonLoading || networks.length === 0}
                metric="avgCpu"
              />
            </BracketCard>

            {/* Total Pods Comparison */}
            <BracketCard className="p-6 bg-card">
              <div className="mb-4">
                <h3 className="text-lg font-light tracking-wide uppercase">
                  Total Pods Comparison
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compare total pod counts across networks
                </p>
              </div>
              <NetworkComparisonChart
                networks={networks}
                data={comparisonData}
                isLoading={comparisonLoading || networks.length === 0}
                metric="total"
              />
            </BracketCard>
          </div>
        </TabsContent>
      </Tabs>

      {/* Data Quality Notice */}
      <div className="mt-8 p-4 border border-border/50 bg-muted/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">About This Data</h4>
            <p className="text-xs text-muted-foreground">
              Historical data is collected every 10 minutes by sampling up to 20
              nodes per network. Data is retained for 30 days. The metrics shown
              represent aggregated network-wide statistics including node
              availability, resource utilization, and storage capacity over time.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
