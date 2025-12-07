'use client'

import { Clock, HardDrive, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DotProgress } from "@/components/common"
import { cn } from "@/lib/utils"

interface StatsResponse {
  active_streams: number
  cpu_percent: number
  current_index: number
  file_size: number
  last_updated: number
  packets_received: number
  packets_sent: number
  ram_total: number
  ram_used: number
  total_bytes: number
  total_pages: number
  uptime: number
}

interface VersionResponse {
  version: string
}

interface NodeData {
  ip: string
  address: string
  label: string
  pubkey: string | null
  registryVersion: string
  status: "online" | "offline" | "loading"
  version?: VersionResponse
  stats?: StatsResponse
  error?: string
  lastFetched?: number
  location?: {
    city: string
    country: string
    countryCode?: string
  }
}

interface NodeCardProps {
  node: NodeData
  isSelected: boolean
  onClick: () => void
  formatBytes: (bytes: number) => string
  formatUptime: (seconds: number) => string
}

export function NodeCard({ node, isSelected, onClick, formatBytes, formatUptime }: NodeCardProps) {
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
          <p className="text-xs font-mono text-muted-foreground">{node.address}</p>
          {node.location && (
            <p className="text-xs font-mono text-muted-foreground/80 flex items-center gap-1.5 mt-0.5">
              {node.location.countryCode && (
                <img
                  src={`https://flagsapi.com/${node.location.countryCode}/flat/16.png`}
                  alt={node.location.country}
                  className="w-4 h-3 object-cover"
                />
              )}
              {node.location.city}, {node.location.country}
            </p>
          )}
          {node.pubkey && (
            <p className="text-xs font-mono text-muted-foreground/60 truncate max-w-[200px]" title={node.pubkey}>
              {node.pubkey}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {node.version && (
            <Badge variant="outline" className="font-mono text-xs">
              v{node.version.version}
            </Badge>
          )}
          <span
            className={cn(
              "w-3 h-3",
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
          {/* CPU */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">CPU</span>
              <span className="font-mono">{node.stats.cpu_percent.toFixed(2)}%</span>
            </div>
            <DotProgress percent={node.stats.cpu_percent} />
          </div>

          {/* RAM */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">RAM</span>
              <span className="font-mono">
                {formatBytes(node.stats.ram_used)} / {formatBytes(node.stats.ram_total)}
              </span>
            </div>
            <DotProgress percent={(node.stats.ram_used / node.stats.ram_total) * 100} />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Uptime
              </div>
              <div className="text-sm font-mono">{formatUptime(node.stats.uptime)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Storage
              </div>
              <div className="text-sm font-mono">{formatBytes(node.stats.file_size)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> In
              </div>
              <div className="text-sm font-mono">{node.stats.packets_received}/s</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Out
              </div>
              <div className="text-sm font-mono">{node.stats.packets_sent}/s</div>
            </div>
          </div>
        </div>
      ) : node.status === "offline" ? (
        <div className="text-sm text-destructive py-4 font-mono">
          {node.error || "Node offline"}
        </div>
      ) : (
        <div className="space-y-3 py-2">
          {/* CPU Skeleton */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          {/* RAM Skeleton */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            {[...Array(4)].map((_, j) => (
              <div key={j}>
                <Skeleton className="h-3 w-12 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
