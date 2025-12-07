'use client'

import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { BracketCard } from "@/components/common"

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

interface Pod {
  address: string
  version: string
  last_seen?: string
  last_seen_timestamp: number
  pubkey?: string | null
}

interface PodsResponse {
  pods: Pod[]
  total_count: number
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
  pods?: PodsResponse
  error?: string
  lastFetched?: number
}

interface NodeDetailPanelProps {
  node: NodeData | null
  onClose: () => void
  formatBytes: (bytes: number) => string
  formatUptime: (seconds: number) => string
  formatTimestamp: (timestamp: number) => string
}

export function NodeDetailPanel({
  node,
  onClose,
  formatBytes,
  formatUptime,
  formatTimestamp
}: NodeDetailPanelProps) {
  if (!node || node.status !== "online") return null

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        />

        {/* Side Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 bottom-0 w-full md:w-2/3 lg:w-1/2 bg-background border-l border-border z-50 overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-mono uppercase tracking-widest">Node Details</h2>
              <p className="text-sm text-muted-foreground font-mono">{node.label}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4">
            <BracketCard className="bg-card overflow-hidden">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                {node.stats && (
                  <>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">CPU Usage</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.cpu_percent.toFixed(2)}%</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">RAM Used</div>
                      <div className="text-2xl font-mono mt-1">{formatBytes(node.stats.ram_used)}</div>
                      <div className="text-xs text-muted-foreground">of {formatBytes(node.stats.ram_total)}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Uptime</div>
                      <div className="text-2xl font-mono mt-1">{formatUptime(node.stats.uptime)}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Storage Size</div>
                      <div className="text-2xl font-mono mt-1">{formatBytes(node.stats.file_size)}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Streams</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.active_streams}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Packets Received</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.packets_received}/s</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Packets Sent</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.packets_sent}/s</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Bytes</div>
                      <div className="text-2xl font-mono mt-1">{formatBytes(node.stats.total_bytes)}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Pages</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.total_pages}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Index</div>
                      <div className="text-2xl font-mono mt-1">{node.stats.current_index}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Last Updated</div>
                      <div className="text-lg font-mono mt-1">{formatTimestamp(node.stats.last_updated)}</div>
                    </div>
                    <div className="bg-card p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Version</div>
                      <div className="text-2xl font-mono mt-1">{node.version?.version || "N/A"}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Pubkey */}
              {node.pubkey && (
                <div className="p-4 border-t border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Public Key</div>
                  <div className="font-mono text-sm break-all">{node.pubkey}</div>
                </div>
              )}

              {/* Peers Section */}
              {node.pods && (
                <div className="p-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Known Peers ({node.pods.total_count})
                  </h3>
                  {node.pods.pods.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {node.pods.pods.map((pod, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-muted/50 p-3 border border-border">
                          <div>
                            <div className="font-mono text-sm">{pod.address}</div>
                            <div className="text-xs text-muted-foreground">v{pod.version}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Last seen</div>
                            <div className="text-xs font-mono">
                              {pod.last_seen || formatTimestamp(pod.last_seen_timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-4 text-center border border-border">
                      No peers discovered yet
                    </div>
                  )}
                </div>
              )}
            </BracketCard>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
