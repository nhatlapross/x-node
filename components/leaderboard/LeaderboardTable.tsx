'use client'

import { Star, CheckSquare, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RankBadge } from './RankBadge'
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

interface LeaderboardEntry {
  node: NodeData
  credits: number
  rank: number
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  favorites: Set<string>
  onToggleFavorite: (node: NodeData) => void
  onSelectNode: (node: NodeData) => void
  compareMode: boolean
  selectedForCompare: Set<string>
  onToggleCompare: (pubkey: string) => void
  formatBytes: (bytes: number) => string
  formatUptime: (seconds: number) => string
}

export function LeaderboardTable({
  entries,
  favorites,
  onToggleFavorite,
  onSelectNode,
  compareMode,
  selectedForCompare,
  onToggleCompare,
  formatBytes,
  formatUptime,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No nodes found matching your criteria
      </div>
    )
  }

  return (
    <div className="border border-border bg-card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium text-muted-foreground w-16">Rank</th>
            {compareMode && (
              <th className="text-center p-3 font-medium text-muted-foreground w-12">Select</th>
            )}
            <th className="text-center p-3 font-medium text-muted-foreground w-12">
              <Star className="w-4 h-4 mx-auto" />
            </th>
            <th className="text-left p-3 font-medium text-muted-foreground">Node</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Credits</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Version</th>
            <th className="text-right p-3 font-medium text-muted-foreground">CPU</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Uptime</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map(({ node, credits, rank }) => {
            const isFavorited = node.pubkey ? favorites.has(node.pubkey) : false
            const isSelectedForCompare = node.pubkey ? selectedForCompare.has(node.pubkey) : false

            return (
              <tr
                key={node.address}
                onClick={() => onSelectNode(node)}
                className={cn(
                  'hover:bg-muted/30 cursor-pointer transition-colors',
                  isSelectedForCompare && 'bg-primary/10'
                )}
              >
                {/* Rank */}
                <td className="p-3">
                  <RankBadge rank={rank} size="sm" />
                </td>

                {/* Compare checkbox */}
                {compareMode && (
                  <td className="p-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (node.pubkey) onToggleCompare(node.pubkey)
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      disabled={!node.pubkey}
                    >
                      {isSelectedForCompare ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                )}

                {/* Favorite */}
                <td className="p-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(node)
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    disabled={!node.pubkey}
                  >
                    <Star
                      className={cn(
                        'w-5 h-5 transition-colors',
                        isFavorited
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground hover:text-yellow-500'
                      )}
                    />
                  </button>
                </td>

                {/* Node info */}
                <td className="p-3">
                  <div className="font-medium font-mono">{node.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{node.address}</div>
                </td>

                {/* Location */}
                <td className="p-3">
                  {node.location ? (
                    <div className="flex items-center gap-2 font-mono text-xs">
                      {node.location.countryCode && (
                        <img
                          src={`https://flagsapi.com/${node.location.countryCode}/flat/16.png`}
                          alt={node.location.country}
                          className="w-4 h-3 object-cover"
                        />
                      )}
                      <span>{node.location.city}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>

                {/* Credits */}
                <td className="p-3 text-right">
                  <span className={cn(
                    'font-mono font-medium',
                    credits > 0 ? 'text-success' : 'text-muted-foreground'
                  )}>
                    {credits > 0 ? credits.toLocaleString() : '-'}
                  </span>
                </td>

                {/* Status */}
                <td className="p-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono',
                      node.status === 'online'
                        ? 'border-success text-success'
                        : node.status === 'offline'
                        ? 'border-destructive text-destructive'
                        : 'border-primary text-primary'
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 mr-1.5 rounded-full',
                        node.status === 'online'
                          ? 'bg-success'
                          : node.status === 'offline'
                          ? 'bg-destructive'
                          : 'bg-[#F59E0B]'
                      )}
                    />
                    {node.status}
                  </Badge>
                </td>

                {/* Version */}
                <td className="p-3 font-mono text-xs">
                  {node.version?.version || node.registryVersion || '-'}
                </td>

                {/* CPU */}
                <td className="p-3 text-right font-mono text-xs">
                  {node.stats ? `${node.stats.cpu_percent.toFixed(1)}%` : '-'}
                </td>

                {/* Uptime */}
                <td className="p-3 text-right font-mono text-xs">
                  {node.stats ? formatUptime(node.stats.uptime) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
