"use client";

import { Clock, HardDrive, Zap, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DotProgress } from "@/components/common";
import { cn } from "@/lib/utils";

// Utility function to truncate version string
const truncateVersion = (version: string, maxLength: number = 15) => {
  if (!version || version.length <= maxLength) return version;
  return version.slice(0, maxLength) + "...";
};

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

interface VersionResponse {
  version: string;
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

interface NodeCardProps {
  node: NodeData;
  isSelected: boolean;
  onClick: () => void;
  formatBytes: (bytes: number) => string;
  formatUptime: (seconds: number) => string;
  credits?: number;
}

export function NodeCard({
  node,
  isSelected,
  onClick,
  formatBytes,
  formatUptime,
  credits,
}: NodeCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "border p-4 cursor-pointer transition-all bg-card",
        isSelected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Node Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium font-mono">{node.label}</h3>
          <p className="text-xs font-mono text-muted-foreground">
            {node.address}
          </p>
          {/* Location - always render with consistent height */}
          <div className="text-xs font-mono text-muted-foreground/80 flex items-center gap-1.5 mt-0.5 h-4">
            {node.status === "loading" ? (
              <>
                <Skeleton className="w-4 h-3" />
                <Skeleton className="h-3 w-24" />
              </>
            ) : node.location ? (
              <>
                {node.location.countryCode && (
                  <img
                    src={`https://flagsapi.com/${node.location.countryCode}/flat/16.png`}
                    alt={node.location.country}
                    className="w-4 h-3 object-cover"
                  />
                )}
                {node.location.city}, {node.location.country}
              </>
            ) : null}
          </div>
          {/* Pubkey - always render with consistent height */}
          <div className="text-xs font-mono text-muted-foreground/60 truncate max-w-[200px] h-4">
            {node.status === "loading" ? (
              <Skeleton className="h-3 w-[180px]" />
            ) : node.pubkey ? (
              <span title={node.pubkey}>{node.pubkey}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {node.status === "loading" ? (
            <Skeleton className="h-5 w-12" />
          ) : node.version ? (
            <Badge
              variant="outline"
              className="font-mono text-xs max-w-[120px] truncate"
              title={`v${node.version.version}`}
            >
              v{truncateVersion(node.version.version)}
            </Badge>
          ) : null}
          <span
            className={cn(
              "w-3 h-3 flex-shrink-0",
              node.status === "online"
                ? "bg-success"
                : node.status === "offline"
                ? "bg-destructive"
                : "bg-[#F59E0B] animate-pulse"
            )}
          />
        </div>
      </div>

      {/* Node Stats */}
      {node.status === "online" && node.stats ? (
        <div className="space-y-2">
          {/* Status Line - for consistent height */}
          <div className="text-xs font-mono text-success h-4 flex items-center">
            Connected
          </div>

          {/* CPU */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">CPU</span>
              <span className="font-mono">
                {node.stats.cpu_percent.toFixed(2)}%
              </span>
            </div>
            <DotProgress percent={node.stats.cpu_percent} />
          </div>

          {/* RAM */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">RAM</span>
              <span className="font-mono">
                {formatBytes(node.stats.ram_used)} /{" "}
                {formatBytes(node.stats.ram_total)}
              </span>
            </div>
            <DotProgress
              percent={(node.stats.ram_used / node.stats.ram_total) * 100}
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Uptime
              </div>
              <div className="text-sm font-mono">
                {formatUptime(node.stats.uptime)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Storage
              </div>
              <div className="text-sm font-mono">
                {formatBytes(node.stats.file_size)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> In
              </div>
              <div className="text-sm font-mono">
                {node.stats.packets_received}/s
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Out
              </div>
              <div className="text-sm font-mono">
                {node.stats.packets_sent}/s
              </div>
            </div>
          </div>

          {/* Credits - Always show for consistent height */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins
                className={cn(
                  "w-3.5 h-3.5",
                  credits !== undefined && credits > 0
                    ? "text-success"
                    : "text-muted-foreground/50"
                )}
              />
              <span>Reputation Credits</span>
            </div>
            <div
              className={cn(
                "text-sm font-mono font-medium",
                credits !== undefined && credits > 0
                  ? "text-success"
                  : "text-muted-foreground/50"
              )}
            >
              {credits !== undefined && credits > 0
                ? credits.toLocaleString()
                : "--"}
            </div>
          </div>
        </div>
      ) : node.status === "offline" ? (
        <div className="space-y-2">
          {/* Status Line - Error Message */}
          <div className="text-xs text-destructive font-mono h-4 flex items-center">
            {node.error || "Node offline"}
          </div>

          {/* CPU - Disabled */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground/50">CPU</span>
              <span className="font-mono text-muted-foreground/50">--</span>
            </div>
            <DotProgress percent={0} />
          </div>

          {/* RAM - Disabled */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground/50">RAM</span>
              <span className="font-mono text-muted-foreground/50">--</span>
            </div>
            <DotProgress percent={0} />
          </div>

          {/* Quick Stats - Disabled */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Uptime
              </div>
              <div className="text-sm font-mono text-muted-foreground/50">
                --
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Storage
              </div>
              <div className="text-sm font-mono text-muted-foreground/50">
                --
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <Zap className="w-3 h-3" /> In
              </div>
              <div className="text-sm font-mono text-muted-foreground/50">
                --
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground/50 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Out
              </div>
              <div className="text-sm font-mono text-muted-foreground/50">
                --
              </div>
            </div>
          </div>

          {/* Credits - Disabled */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
              <Coins className="w-3.5 h-3.5" />
              <span>Reputation Credits</span>
            </div>
            <div className="text-sm font-mono font-medium text-muted-foreground/50">
              --
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Status Line - Loading */}
          <div className="text-xs font-mono h-4 flex items-center">
            <Skeleton className="h-3 w-16" />
          </div>

          {/* CPU Skeleton */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-12" />
            </div>
            <DotProgress percent={0} className="opacity-30" />
          </div>
          {/* RAM Skeleton */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-24" />
            </div>
            <DotProgress percent={0} className="opacity-30" />
          </div>
          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-2 gap-9 mt-3 pt-3 border-t border-border">
            {[...Array(4)].map((_, j) => (
              <div key={j}>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="text-sm font-mono">
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Credits Skeleton */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Skeleton className="h-3.5 w-3.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="text-sm font-mono font-medium">
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
