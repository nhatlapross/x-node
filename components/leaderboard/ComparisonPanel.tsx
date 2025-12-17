'use client'

import { X, Coins, Cpu, HardDrive, Clock, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RankBadge } from './RankBadge'
import { DotProgress } from '@/components/common'
import { cn } from '@/lib/utils'

interface NodeData {
  ip: string
  address: string
  label: string
  pubkey: string | null
  registryVersion: string
  status: 'online' | 'offline' | 'loading'
  version?: { version: string }
  stats?: {
    cpu_percent: number
    ram_used: number
    ram_total: number
    file_size: number
    uptime: number
  }
  location?: {
    city: string
    country: string
    countryCode?: string
  }
}

interface ComparisonEntry {
  node: NodeData
  credits: number
  rank: number
}

interface ComparisonPanelProps {
  entries: ComparisonEntry[]
  onClose: () => void
  onRemove: (pubkey: string) => void
  formatBytes: (bytes: number) => string
  formatUptime: (seconds: number) => string
}

export function ComparisonPanel({
  entries,
  onClose,
  onRemove,
  formatBytes,
  formatUptime,
}: ComparisonPanelProps) {
  if (entries.length === 0) {
    return null
  }

  // Find max values for relative comparison bars
  const maxCredits = Math.max(...entries.map(e => e.credits), 1)
  const maxCpu = Math.max(...entries.map(e => e.node.stats?.cpu_percent || 0), 1)
  const maxRam = Math.max(...entries.map(e => {
    if (!e.node.stats) return 0
    return (e.node.stats.ram_used / e.node.stats.ram_total) * 100
  }), 1)
  const maxStorage = Math.max(...entries.map(e => e.node.stats?.file_size || 0), 1)
  const maxUptime = Math.max(...entries.map(e => e.node.stats?.uptime || 0), 1)

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-card border-l border-border shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Compare Nodes ({entries.length})</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Comparison Grid */}
      <div className="p-4">
        {/* Node Headers */}
        <div className={cn(
          'grid gap-4 mb-6',
          entries.length === 1 && 'grid-cols-1',
          entries.length === 2 && 'grid-cols-2',
          entries.length >= 3 && 'grid-cols-3'
        )}>
          {entries.map(({ node, rank }) => (
            <div
              key={node.address}
              className="p-4 bg-muted/30 border border-border rounded-lg relative"
            >
              <button
                onClick={() => node.pubkey && onRemove(node.pubkey)}
                className="absolute top-2 right-2 p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <RankBadge rank={rank} size="md" />
                <div>
                  <div className="font-medium font-mono text-sm">{node.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{node.address}</div>
                </div>
              </div>
              {node.location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {node.location.countryCode && (
                    <img
                      src={`https://flagsapi.com/${node.location.countryCode}/flat/16.png`}
                      alt={node.location.country}
                      className="w-4 h-3 object-cover"
                    />
                  )}
                  {node.location.city}, {node.location.country}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Comparison Stats */}
        <div className="space-y-6">
          {/* Credits */}
          <ComparisonRow
            icon={<Coins className="w-4 h-4 text-success" />}
            label="Reputation Credits"
            entries={entries}
            getValue={(e) => e.credits}
            formatValue={(v) => v.toLocaleString()}
            maxValue={maxCredits}
            colorClass="bg-success"
          />

          {/* CPU */}
          <ComparisonRow
            icon={<Cpu className="w-4 h-4 text-primary" />}
            label="CPU Usage"
            entries={entries}
            getValue={(e) => e.node.stats?.cpu_percent || 0}
            formatValue={(v) => `${v.toFixed(1)}%`}
            maxValue={maxCpu}
            colorClass="bg-primary"
          />

          {/* RAM */}
          <ComparisonRow
            icon={<Activity className="w-4 h-4 text-primary" />}
            label="RAM Usage"
            entries={entries}
            getValue={(e) => {
              if (!e.node.stats) return 0
              return (e.node.stats.ram_used / e.node.stats.ram_total) * 100
            }}
            formatValue={(v) => `${v.toFixed(1)}%`}
            maxValue={maxRam}
            colorClass="bg-primary"
          />

          {/* Storage */}
          <ComparisonRow
            icon={<HardDrive className="w-4 h-4 text-muted-foreground" />}
            label="Storage"
            entries={entries}
            getValue={(e) => e.node.stats?.file_size || 0}
            formatValue={(v) => formatBytes(v)}
            maxValue={maxStorage}
            colorClass="bg-muted-foreground"
          />

          {/* Uptime */}
          <ComparisonRow
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
            label="Uptime"
            entries={entries}
            getValue={(e) => e.node.stats?.uptime || 0}
            formatValue={(v) => formatUptime(v)}
            maxValue={maxUptime}
            colorClass="bg-muted-foreground"
          />
        </div>
      </div>
    </div>
  )
}

interface ComparisonRowProps {
  icon: React.ReactNode
  label: string
  entries: ComparisonEntry[]
  getValue: (entry: ComparisonEntry) => number
  formatValue: (value: number) => string
  maxValue: number
  colorClass: string
}

function ComparisonRow({
  icon,
  label,
  entries,
  getValue,
  formatValue,
  maxValue,
  colorClass,
}: ComparisonRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn(
        'grid gap-4',
        entries.length === 1 && 'grid-cols-1',
        entries.length === 2 && 'grid-cols-2',
        entries.length >= 3 && 'grid-cols-3'
      )}>
        {entries.map((entry) => {
          const value = getValue(entry)
          const percent = maxValue > 0 ? (value / maxValue) * 100 : 0

          return (
            <div key={entry.node.address} className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all duration-500', colorClass)}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-sm font-mono font-medium">
                {formatValue(value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
