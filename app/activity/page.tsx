"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  RefreshCw,
  Network,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRightLeft,
  Coins,
  ExternalLink,
  Copy,
  Check,
  Flame,
  Droplets,
  BarChart3,
  PieChart as PieChartIcon,
  Trophy,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  DashboardLayout,
  PageHeader,
  ContentSection,
  type NavSection,
} from "@/components/layout";
import { Logo, LogoIcon, BracketCard } from "@/components/common";
import { FadeIn, Stagger, StaggerItem } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type TokenMeta,
  type TokenTransfer,
  type TokenHolder,
  type DefiActivity,
  type TokenMarket,
  XAND_TOKEN_ADDRESS,
  formatTokenAmount,
  formatUSD,
  formatPercentage,
  shortenAddress,
  getActivityTypeLabel,
  getActivityTypeColor,
  timeAgo,
} from "@/lib/solscan-types";

// Navigation sections
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

// Copy to clipboard hook
function useCopyToClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  }, []);

  return { copiedText, copy };
}

// Stats Card Component
function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  loading,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  trend?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <BracketCard className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded" />
        </div>
      </BracketCard>
    );
  }

  return (
    <BracketCard className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-light mt-1">{value}</p>
          {subValue && (
            <p className="text-sm text-muted-foreground mt-1">{subValue}</p>
          )}
          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 mt-1 text-sm",
                trend >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{formatPercentage(trend)}</span>
            </div>
          )}
        </div>
        <div className="p-2 bg-muted/50 rounded">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      </div>
    </BracketCard>
  );
}

// Known address labels
const ADDRESS_LABELS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter Aggregator",
  "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL": "Raydium Vault Authority",
  "ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn": "Meteora (XAND) Vault Authority",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium CPMM",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora DLMM",
};

function getAddressLabel(address: string): string | null {
  if (!address) return null;
  // Check full address
  if (ADDRESS_LABELS[address]) return ADDRESS_LABELS[address];
  // Check if starts with known prefix
  for (const [key, label] of Object.entries(ADDRESS_LABELS)) {
    if (address.startsWith(key.slice(0, 8))) return label;
  }
  return null;
}

// Transfer Row Component
function TransferRow({
  transfer,
  onCopy,
  copiedText,
  price,
}: {
  transfer: TokenTransfer;
  onCopy: (text: string) => void;
  copiedText: string | null;
  price: number;
}) {
  const tokenAmount = transfer.amount / Math.pow(10, transfer.token_decimals);
  const usdValue = tokenAmount * price;
  const fromLabel = getAddressLabel(transfer.from_address);
  const toLabel = getAddressLabel(transfer.to_address);

  return (
    <div className="grid grid-cols-12 gap-2 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded items-center text-sm">
      {/* Signature */}
      <div className="col-span-2">
        <a
          href={`https://solscan.io/tx/${transfer.trans_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-primary hover:underline"
        >
          {shortenAddress(transfer.trans_id, 6)}
        </a>
      </div>

      {/* Time */}
      <div className="col-span-1 text-muted-foreground text-xs">
        {timeAgo(transfer.block_time)}
      </div>

      {/* Action */}
      <div className="col-span-1">
        <span
          className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            getActivityTypeColor(transfer.activity_type)
          )}
        >
          {getActivityTypeLabel(transfer.activity_type)}
        </span>
      </div>

      {/* From */}
      <div className="col-span-2">
        {transfer.from_address ? (
          <div className="flex items-center gap-1">
            {fromLabel && (
              <span className="text-xs text-blue-400">{fromLabel}</span>
            )}
            {!fromLabel && (
              <button
                onClick={() => onCopy(transfer.from_address)}
                className="font-mono text-xs hover:text-primary flex items-center gap-1"
              >
                {shortenAddress(transfer.from_address, 4)}
                {copiedText === transfer.from_address ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 opacity-50" />
                )}
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>

      {/* To */}
      <div className="col-span-2">
        {transfer.to_address ? (
          <div className="flex items-center gap-1">
            {toLabel && (
              <span className="text-xs text-purple-400">{toLabel}</span>
            )}
            {!toLabel && (
              <button
                onClick={() => onCopy(transfer.to_address)}
                className="font-mono text-xs hover:text-primary flex items-center gap-1"
              >
                {shortenAddress(transfer.to_address, 4)}
                {copiedText === transfer.to_address ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 opacity-50" />
                )}
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>

      {/* Amount */}
      <div className="col-span-2 text-right font-mono">
        {tokenAmount > 0 ? tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}
      </div>

      {/* Value */}
      <div className="col-span-1 text-right text-muted-foreground">
        {usdValue > 0 ? formatUSD(usdValue) : "-"}
      </div>

      {/* Token */}
      <div className="col-span-1 text-right">
        <span className="text-xs text-primary">XAND</span>
      </div>
    </div>
  );
}

// Transfers Table Header
function TransfersTableHeader() {
  return (
    <div className="grid grid-cols-12 gap-2 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-wider px-2 -mx-2">
      <div className="col-span-2">Signature</div>
      <div className="col-span-1">Time</div>
      <div className="col-span-1">Action</div>
      <div className="col-span-2">From</div>
      <div className="col-span-2">To</div>
      <div className="col-span-2 text-right">Amount</div>
      <div className="col-span-1 text-right">Value</div>
      <div className="col-span-1 text-right">Token</div>
    </div>
  );
}

// Legacy Transfer Row for mobile
function TransferRowMobile({
  transfer,
  onCopy,
  copiedText,
  price,
}: {
  transfer: TokenTransfer;
  onCopy: (text: string) => void;
  copiedText: string | null;
  price: number;
}) {
  const tokenAmount = transfer.amount / Math.pow(10, transfer.token_decimals);
  const usdValue = tokenAmount * price;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            getActivityTypeColor(transfer.activity_type)
          )}
        >
          {getActivityTypeLabel(transfer.activity_type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">From:</span>
            <button
              onClick={() => onCopy(transfer.from_address)}
              className="font-mono text-xs hover:text-primary flex items-center gap-1"
            >
              {shortenAddress(transfer.from_address)}
              {copiedText === transfer.from_address ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-50" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">To:</span>
            <button
              onClick={() => onCopy(transfer.to_address)}
              className="font-mono text-xs hover:text-primary flex items-center gap-1"
            >
              {shortenAddress(transfer.to_address)}
              {copiedText === transfer.to_address ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-50" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">
          {formatTokenAmount(transfer.amount, transfer.token_decimals)} XAND
        </p>
        <p className="text-xs text-green-500">{usdValue > 0 ? formatUSD(usdValue) : ""}</p>
        <p className="text-xs text-muted-foreground">
          {timeAgo(transfer.block_time)}
        </p>
      </div>
      <a
        href={`https://solscan.io/tx/${transfer.trans_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 p-1 hover:bg-muted rounded"
      >
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </a>
    </div>
  );
}

// Holder Row Component
function HolderRow({
  holder,
  rank,
  onCopy,
  copiedText,
}: {
  holder: TokenHolder;
  rank: number;
  onCopy: (text: string) => void;
  copiedText: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          #{rank}
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onCopy(holder.owner)}
            className="font-mono text-sm hover:text-primary flex items-center gap-1"
          >
            {shortenAddress(holder.owner, 6)}
            {copiedText === holder.owner ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 opacity-50" />
            )}
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm">
          {formatTokenAmount(holder.amount, holder.decimals)} XAND
        </p>
        {holder.percentage && (
          <p className="text-xs text-muted-foreground">
            {holder.percentage.toFixed(2)}%
          </p>
        )}
      </div>
      <a
        href={`https://solscan.io/account/${holder.owner}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 p-1 hover:bg-muted rounded"
      >
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </a>
    </div>
  );
}

// DeFi Activity Row Component
function DefiRow({
  activity,
  onCopy,
  copiedText,
}: {
  activity: DefiActivity;
  onCopy: (text: string) => void;
  copiedText: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            getActivityTypeColor(activity.activity_type)
          )}
        >
          {getActivityTypeLabel(activity.activity_type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Platform:</span>
            <span className="font-mono text-xs">
              {shortenAddress(activity.platform)}
            </span>
          </div>
          <button
            onClick={() => onCopy(activity.from_address)}
            className="font-mono text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            {shortenAddress(activity.from_address)}
            {copiedText === activity.from_address ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 opacity-50" />
            )}
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          {timeAgo(activity.block_time)}
        </p>
      </div>
      <a
        href={`https://solscan.io/tx/${activity.trans_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 p-1 hover:bg-muted rounded"
      >
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </a>
    </div>
  );
}

// Market Row Component
function MarketRow({ market }: { market: TokenMarket }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 -mx-2 rounded">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2 bg-muted/50 rounded">
          <Droplets className="w-5 h-5 text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm">{shortenAddress(market.pool_id)}</p>
          <p className="text-xs text-muted-foreground">
            {shortenAddress(market.program_id)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm">
          {market.trade_24h.toLocaleString()} trades (24h)
        </p>
        <p className="text-xs text-muted-foreground">
          Vol: {formatUSD(market.volume_24h)}
        </p>
      </div>
      <a
        href={`https://solscan.io/account/${market.pool_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 p-1 hover:bg-muted rounded"
      >
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </a>
    </div>
  );
}

export default function ActivityPage() {
  // State
  const [tokenMeta, setTokenMeta] = useState<TokenMeta | null>(null);
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [holders, setHolders] = useState<{ total: number; items: TokenHolder[] } | null>(null);
  const [defiActivities, setDefiActivities] = useState<DefiActivity[]>([]);
  const [markets, setMarkets] = useState<TokenMarket[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ time: number; price: number; volume: number }[]>([]);

  // Pagination state for transfers
  const [transfersPagination, setTransfersPagination] = useState<{
    hasMore: boolean;
    lastSignature: string | null;
    pageSize: number;
  }>({ hasMore: false, lastSignature: null, pageSize: 20 });
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading] = useState({
    meta: true,
    transfers: true,
    holders: true,
    defi: true,
    markets: true,
    analytics: true,
  });

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("transfers");

  const { copiedText, copy } = useCopyToClipboard();

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setError(null);
    setLoading({
      meta: true,
      transfers: true,
      holders: true,
      defi: true,
      markets: true,
      analytics: true,
    });

    try {
      // Fetch all data in parallel
      const [metaRes, transfersRes, holdersRes, defiRes, marketsRes, priceHistoryRes] =
        await Promise.allSettled([
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "meta" }),
          }),
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "transfers", params: { page_size: 20 } }),
          }),
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "holders", params: { page_size: 20 } }),
          }),
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "defi", params: { page_size: 20 } }),
          }),
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "markets", params: { page_size: 20 } }),
          }),
          fetch("/api/solscan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "price-history" }),
          }),
        ]);

      // Process metadata
      if (metaRes.status === "fulfilled" && metaRes.value.ok) {
        const data = await metaRes.value.json();
        if (data.success && data.data) {
          setTokenMeta(data.data);
        }
      }
      setLoading((prev) => ({ ...prev, meta: false }));

      // Process transfers
      if (transfersRes.status === "fulfilled" && transfersRes.value.ok) {
        const data = await transfersRes.value.json();
        if (data.success && data.data) {
          setTransfers(data.data);
          if (data.pagination) {
            setTransfersPagination(data.pagination);
          }
        }
      }
      setLoading((prev) => ({ ...prev, transfers: false }));

      // Process holders
      if (holdersRes.status === "fulfilled" && holdersRes.value.ok) {
        const data = await holdersRes.value.json();
        if (data.success && data.data) {
          setHolders(data.data);
        }
      }
      setLoading((prev) => ({ ...prev, holders: false }));

      // Process DeFi activities
      if (defiRes.status === "fulfilled" && defiRes.value.ok) {
        const data = await defiRes.value.json();
        if (data.success && data.data) {
          setDefiActivities(data.data);
        }
      }
      setLoading((prev) => ({ ...prev, defi: false }));

      // Process markets
      if (marketsRes.status === "fulfilled" && marketsRes.value.ok) {
        const data = await marketsRes.value.json();
        if (data.success && data.data) {
          setMarkets(data.data);
        }
      }
      setLoading((prev) => ({ ...prev, markets: false }));

      // Process price history
      if (priceHistoryRes.status === "fulfilled" && priceHistoryRes.value.ok) {
        const data = await priceHistoryRes.value.json();
        if (data.success && data.data) {
          setPriceHistory(data.data);
        }
      }
      setLoading((prev) => ({ ...prev, analytics: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setLoading({
        meta: false,
        transfers: false,
        holders: false,
        defi: false,
        markets: false,
        analytics: false,
      });
    }
  }, []);

  // Load more transfers (pagination)
  const loadMoreTransfers = useCallback(async () => {
    if (!transfersPagination.hasMore || !transfersPagination.lastSignature || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = await fetch("/api/solscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "transfers",
          params: {
            page_size: transfersPagination.pageSize,
            before: transfersPagination.lastSignature
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTransfers((prev) => [...prev, ...data.data]);
          if (data.pagination) {
            setTransfersPagination(data.pagination);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load more transfers:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [transfersPagination, loadingMore]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout
      sections={navSections}
      logo={<Logo />}
      logoCollapsed={<LogoIcon />}
      loading={Object.values(loading).some(Boolean)}
    >
      <FadeIn>
        <PageHeader
          title="XAND Token Activity"
          description={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span>On-chain activity for XAND token</span>
              <button
                onClick={() => copy(XAND_TOKEN_ADDRESS)}
                className="font-mono text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 inline-flex items-center gap-1"
              >
                {shortenAddress(XAND_TOKEN_ADDRESS, 6)}
                {copiedText === XAND_TOKEN_ADDRESS ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <a
                href={`https://solscan.io/token/${XAND_TOKEN_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View on Solscan
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={Object.values(loading).some(Boolean)}
            >
              <RefreshCw
                className={cn(
                  "w-4 h-4 mr-2",
                  Object.values(loading).some(Boolean) && "animate-spin"
                )}
              />
              Refresh
            </Button>
          }
        />

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Token Stats */}
        <ContentSection title="Token Overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Price"
              value={tokenMeta ? formatUSD(tokenMeta.price) : "-"}
              trend={tokenMeta?.price_change_24h}
              icon={Coins}
              loading={loading.meta}
            />
            <StatCard
              label="Market Cap"
              value={tokenMeta ? formatUSD(tokenMeta.market_cap) : "-"}
              subValue={
                tokenMeta?.market_cap_rank
                  ? `Rank #${tokenMeta.market_cap_rank}`
                  : undefined
              }
              icon={TrendingUp}
              loading={loading.meta}
            />
            <StatCard
              label="24h Volume"
              value={tokenMeta ? formatUSD(tokenMeta.volume_24h) : "-"}
              icon={ArrowRightLeft}
              loading={loading.meta}
            />
            <StatCard
              label="Holders"
              value={tokenMeta ? tokenMeta.holder.toLocaleString() : "-"}
              icon={Users}
              loading={loading.meta}
            />
          </div>
        </ContentSection>

        {/* Token Details */}
        {tokenMeta && (
          <ContentSection title="Token Details">
            <BracketCard className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Name
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {tokenMeta.icon && (
                      <img
                        src={tokenMeta.icon}
                        alt={tokenMeta.name}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="font-medium">
                      {tokenMeta.name} ({tokenMeta.symbol})
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total Supply
                  </p>
                  <p className="mt-1 font-mono">
                    {formatTokenAmount(
                      parseFloat(tokenMeta.supply),
                      tokenMeta.decimals
                    )}{" "}
                    {tokenMeta.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Decimals
                  </p>
                  <p className="mt-1">{tokenMeta.decimals}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Mint Authority
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {tokenMeta.mint_authority
                      ? shortenAddress(tokenMeta.mint_authority)
                      : "Disabled"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Freeze Authority
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {tokenMeta.freeze_authority
                      ? shortenAddress(tokenMeta.freeze_authority)
                      : "Disabled"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Created
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(tokenMeta.created_time * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </BracketCard>
          </ContentSection>
        )}

        {/* Activity Tabs */}
        <ContentSection>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="transfers" className="gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Transfers
                {transfers.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {transfers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="holders" className="gap-2">
                <Users className="w-4 h-4" />
                Top Holders
                {holders && (
                  <Badge variant="secondary" className="ml-1">
                    {holders.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="defi" className="gap-2">
                <Flame className="w-4 h-4" />
                DeFi Activity
                {defiActivities.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {defiActivities.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="markets" className="gap-2">
                <Droplets className="w-4 h-4" />
                Markets
                {markets.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {markets.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Transfers Tab */}
            <TabsContent value="transfers">
              <BracketCard className="p-4">
                {/* Total count header */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    Total {transfers.length} transfers
                  </span>
                </div>

                {/* Table Header */}
                <TransfersTableHeader />

                {loading.transfers ? (
                  <div className="space-y-3 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 py-3">
                        <Skeleton className="col-span-2 h-4" />
                        <Skeleton className="col-span-1 h-4" />
                        <Skeleton className="col-span-1 h-4" />
                        <Skeleton className="col-span-2 h-4" />
                        <Skeleton className="col-span-2 h-4" />
                        <Skeleton className="col-span-2 h-4" />
                        <Skeleton className="col-span-1 h-4" />
                        <Skeleton className="col-span-1 h-4" />
                      </div>
                    ))}
                  </div>
                ) : transfers.length > 0 ? (
                  <div>
                    {transfers.map((transfer, idx) => (
                      <TransferRow
                        key={`${transfer.trans_id}-${idx}`}
                        transfer={transfer}
                        onCopy={copy}
                        copiedText={copiedText}
                        price={tokenMeta?.price || 0}
                      />
                    ))}

                    {/* Load More Button */}
                    {transfersPagination.hasMore && (
                      <div className="flex justify-center mt-4 pt-4 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadMoreTransfers}
                          disabled={loadingMore}
                          className="gap-2"
                        >
                          {loadingMore ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              Load More Transactions
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No recent transfers found</p>
                  </div>
                )}
              </BracketCard>
            </TabsContent>

            {/* Holders Tab */}
            <TabsContent value="holders">
              <BracketCard className="p-4">
                {loading.holders ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : holders && holders.items.length > 0 ? (
                  <Stagger staggerDelay={0.03}>
                    {holders.items.map((holder, idx) => (
                      <StaggerItem key={holder.owner}>
                        <HolderRow
                          holder={holder}
                          rank={holder.rank || idx + 1}
                          onCopy={copy}
                          copiedText={copiedText}
                        />
                      </StaggerItem>
                    ))}
                  </Stagger>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No holder data available</p>
                  </div>
                )}
              </BracketCard>
            </TabsContent>

            {/* DeFi Tab */}
            <TabsContent value="defi">
              <BracketCard className="p-4">
                {loading.defi ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-6 w-20" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : defiActivities.length > 0 ? (
                  <Stagger staggerDelay={0.03}>
                    {defiActivities.map((activity, idx) => (
                      <StaggerItem key={`${activity.trans_id}-${idx}`}>
                        <DefiRow
                          activity={activity}
                          onCopy={copy}
                          copiedText={copiedText}
                        />
                      </StaggerItem>
                    ))}
                  </Stagger>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Flame className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No DeFi activity found</p>
                  </div>
                )}
              </BracketCard>
            </TabsContent>

            {/* Markets Tab */}
            <TabsContent value="markets">
              <BracketCard className="p-4">
                {loading.markets ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : markets.length > 0 ? (
                  <Stagger staggerDelay={0.03}>
                    {markets.map((market, idx) => (
                      <StaggerItem key={`${market.pool_id}-${idx}`}>
                        <MarketRow market={market} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Droplets className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No market data available</p>
                  </div>
                )}
              </BracketCard>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <div className="space-y-6">
                {/* Price Chart */}
                <BracketCard className="p-4">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Price History (24h)
                  </h3>
                  {loading.analytics ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : priceHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={priceHistory}>
                        <defs>
                          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="time"
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        <YAxis
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => `$${value.toFixed(6)}`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#999' }}
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value: number) => [`$${value.toFixed(8)}`, 'Price']}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#priceGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <p>No price history available</p>
                    </div>
                  )}
                </BracketCard>

                {/* Volume Chart */}
                <BracketCard className="p-4">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Volume (24h)
                  </h3>
                  {loading.analytics ? (
                    <Skeleton className="h-[200px] w-full" />
                  ) : priceHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="time"
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                        <YAxis
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => formatUSD(value)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#999' }}
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                          formatter={(value: number) => [formatUSD(value), 'Volume']}
                        />
                        <Bar dataKey="volume" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      <p>No volume data available</p>
                    </div>
                  )}
                </BracketCard>

                {/* Holder Distribution */}
                <BracketCard className="p-4">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4" />
                    Top Holder Distribution
                  </h3>
                  {loading.holders ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : holders && holders.items.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={holders.items.slice(0, 10).map((h, i) => ({
                              name: `#${i + 1} ${shortenAddress(h.owner, 4)}`,
                              value: h.amount / Math.pow(10, h.decimals),
                              percentage: h.percentage || 0,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {holders.items.slice(0, 10).map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={[
                                  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6',
                                  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
                                ][index % 10]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1a1a1a',
                              border: '1px solid #333',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number, name: string) => [
                              `${formatTokenAmount(value * Math.pow(10, 9), 9)} XAND`,
                              name
                            ]}
                          />
                          <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            wrapperStyle={{ fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <p>No holder data available</p>
                    </div>
                  )}
                </BracketCard>
              </div>
            </TabsContent>
          </Tabs>
        </ContentSection>
      </FadeIn>
    </DashboardLayout>
  );
}
