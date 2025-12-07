'use client'

import { useState, useEffect, useMemo } from 'react'
import { Network, Globe as GlobeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NetworkTopology3D } from './NetworkTopology3D'
import { GlobeVisualization, type GlobeNode, type GlobeConnection } from '../globe'
import { getGeolocation, batchGeolocate } from '@/lib/geolocation'

interface NodeData {
  address: string
  pubkey: string | null
  status: 'online' | 'offline' | 'loading'
  version?: { version: string }
  stats?: {
    cpu_percent: number
    ram_used: number
    ram_total: number
    uptime: number
    active_streams: number
    current_index: number
  }
  pods?: {
    pods: Array<{
      address: string
      pubkey?: string | null
      version: string
      last_seen_timestamp: number
    }>
    total_count: number
  }
}

interface NetworkTopologyViewProps {
  nodes: NodeData[]
  onNodeClick?: (node: NodeData) => void
  isDark?: boolean
}

type ViewMode = 'graph' | 'globe'

export function NetworkTopologyView({ nodes, onNodeClick, isDark = true }: NetworkTopologyViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Convert nodes to globe format with geolocation
  const { globeNodes, globeConnections } = useMemo(() => {
    if (!mounted) return { globeNodes: [], globeConnections: [] }

    // Filter out loading nodes
    const loadedNodes = nodes.filter(n => n.status !== 'loading')

    // Get IPs from addresses
    const ipAddresses = loadedNodes.map(n => n.address.split(':')[0])

    // Batch geocode all IPs
    const geolocations = batchGeolocate(ipAddresses)

    // Create globe nodes
    const globeNodes: GlobeNode[] = loadedNodes.map((node) => {
      const ip = node.address.split(':')[0]
      const geo = geolocations.get(ip)!
      const isOnline = node.status === 'online'
      const isLatestVersion = node.version?.version === '0.6.0'

      return {
        id: node.address,
        lat: geo.lat,
        lng: geo.lng,
        label: node.pubkey ? `${node.pubkey.slice(0, 8)}...` : ip,
        status: node.status,
        size: Math.max(0.3, Math.min(1, (node.pods?.total_count || 0) / 10)),
        color: isOnline
          ? (isLatestVersion ? '#22c55e' : '#eab308')
          : '#ef4444',
      }
    })

    // Create globe connections based on pod relationships
    const globeConnections: GlobeConnection[] = []
    const connectionSet = new Set<string>()

    loadedNodes.forEach((node) => {
      if (node.pods?.pods) {
        const sourceIp = node.address.split(':')[0]
        const sourceGeo = geolocations.get(sourceIp)

        if (!sourceGeo) return

        node.pods.pods.forEach((pod) => {
          const targetIp = pod.address.split(':')[0]
          const targetNode = loadedNodes.find(n => n.address.startsWith(targetIp))
          const targetGeo = geolocations.get(targetIp)

          if (targetNode && targetGeo && targetNode.address !== node.address) {
            // Create unique connection ID (sorted to avoid duplicates)
            const connectionId = [node.address, targetNode.address].sort().join('-')

            if (!connectionSet.has(connectionId)) {
              connectionSet.add(connectionId)

              // Check if connection is active (last seen < 5 minutes)
              const isActive = Date.now() / 1000 - pod.last_seen_timestamp < 300

              // Check if bidirectional
              const targetPods = targetNode.pods?.pods || []
              const isBidirectional = targetPods.some(
                p => p.address.startsWith(sourceIp)
              )

              globeConnections.push({
                startLat: sourceGeo.lat,
                startLng: sourceGeo.lng,
                endLat: targetGeo.lat,
                endLng: targetGeo.lng,
                color: isBidirectional
                  ? (isActive ? '#00ffcc' : '#66aaff')
                  : (isActive ? '#ffcc00' : '#666666'),
              })
            }
          }
        })
      }
    })

    return { globeNodes, globeConnections }
  }, [nodes, mounted])

  // Stats
  const stats = useMemo(() => {
    const loadedCount = nodes.filter(n => n.status !== 'loading').length
    const totalCount = nodes.length
    const onlineCount = nodes.filter(n => n.status === 'online').length
    return { onlineCount, loadedCount, totalCount }
  }, [nodes])

  return (
    <div className="relative w-full h-full">
      {/* View Mode Toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-background/95 backdrop-blur border border-border rounded-lg p-1">
        <Button
          variant={viewMode === 'graph' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('graph')}
          className={cn(
            'gap-2',
            viewMode === 'graph' && 'bg-primary text-primary-foreground'
          )}
        >
          <Network className="w-4 h-4" />
          <span className="hidden sm:inline">Graph</span>
        </Button>
        <Button
          variant={viewMode === 'globe' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('globe')}
          className={cn(
            'gap-2',
            viewMode === 'globe' && 'bg-primary text-primary-foreground'
          )}
        >
          <GlobeIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Globe</span>
        </Button>
      </div>

      {/* Stats Overlay */}
      <div className="absolute bottom-4 left-4 z-20 bg-background/95 backdrop-blur border border-border rounded-lg p-3 text-xs font-mono">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-muted-foreground">Status:</div>
          <div className="text-foreground font-medium">
            {stats.onlineCount}/{stats.loadedCount} online
          </div>
          {stats.loadedCount < stats.totalCount && (
            <>
              <div className="text-muted-foreground">Loading:</div>
              <div className="text-primary font-medium">
                {stats.loadedCount}/{stats.totalCount}
              </div>
            </>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="w-full h-full">
        {viewMode === 'graph' ? (
          <NetworkTopology3D nodes={nodes} onNodeClick={onNodeClick} />
        ) : (
          mounted && (
            <GlobeVisualization
              nodes={globeNodes}
              connections={globeConnections}
              isDark={isDark}
            />
          )
        )}
      </div>
    </div>
  )
}
