'use client'

import { useMemo, useState } from "react"
import { Server, HardDrive, Cpu, Activity, Users, Coins, CheckCircle, AlertCircle } from "lucide-react"
import { BracketCard, DotProgress } from "@/components/common"
import { Stagger, StaggerItem, ScaleOnHover } from "@/components/common"
import { getVersionDistribution, findLatestVersion, compareVersions } from "@/lib/version"
import { VersionDistributionChart } from "./VersionDistributionChart"

interface NetworkPod {
  address: string
  last_seen_timestamp: number
  pubkey: string | null
  version: string
}

interface NetworkStatsProps {
  onlineCount: number
  totalCount: number
  totalStorage: number
  avgCpu: number
  avgRamPercent: number
  registryPods: NetworkPod[]
  formatBytes: (bytes: number) => string
  totalCredits?: number
}

export function NetworkStats({
  onlineCount,
  totalCount,
  totalStorage,
  avgCpu,
  avgRamPercent,
  registryPods,
  formatBytes,
  totalCredits = 0,
}: NetworkStatsProps) {
  // State for version chart modal
  const [showVersionChart, setShowVersionChart] = useState(false)

  // Calculate version statistics dynamically
  const versionStats = useMemo(() => {
    const versions = registryPods.map(p => p.version).filter(Boolean)
    const distribution = getVersionDistribution(versions)
    const latestVersion = findLatestVersion(versions)

    // Get top versions for display (up to 3)
    const topVersions = distribution.slice(0, 3)

    // Count nodes on latest vs outdated using version comparison
    // A node is "latest" if its version compares equal to or greater than latestVersion
    const latestCount = latestVersion
      ? registryPods.filter(p => p.version && compareVersions(p.version, latestVersion) >= 0).length
      : 0
    const outdatedCount = registryPods.length - latestCount

    return {
      distribution,
      latestVersion,
      topVersions,
      latestCount,
      outdatedCount,
    }
  }, [registryPods])

  return (
    <>
      <Stagger animateOnMount className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StaggerItem>
          <ScaleOnHover className="h-full">
            <BracketCard className="p-4 bg-card h-full">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Nodes Online</span>
              </div>
              <p className="text-3xl font-light font-mono">
                {onlineCount}/{totalCount}
              </p>
              <DotProgress
                percent={totalCount > 0 ? (onlineCount / totalCount) * 100 : 0}
                className="mt-2"
              />
            </BracketCard>
          </ScaleOnHover>
        </StaggerItem>

        <StaggerItem>
          <ScaleOnHover className="h-full">
            <BracketCard className="p-4 bg-card h-full">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Storage</span>
              </div>
              <p className="text-3xl font-light font-mono">{formatBytes(totalStorage)}</p>
              <DotProgress percent={0} className="mt-2 opacity-0" />
            </BracketCard>
          </ScaleOnHover>
        </StaggerItem>

        <StaggerItem>
          <ScaleOnHover className="h-full">
            <BracketCard className="p-4 bg-card h-full">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Avg CPU</span>
              </div>
              <p className="text-3xl font-light font-mono text-primary">{avgCpu.toFixed(2)}%</p>
              <DotProgress percent={avgCpu} className="mt-2" />
            </BracketCard>
          </ScaleOnHover>
        </StaggerItem>

        <StaggerItem>
          <ScaleOnHover className="h-full">
            <BracketCard className="p-4 bg-card h-full">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Avg RAM</span>
              </div>
              <p className="text-3xl font-light font-mono text-primary">{avgRamPercent.toFixed(1)}%</p>
              <DotProgress percent={avgRamPercent} className="mt-2" />
            </BracketCard>
          </ScaleOnHover>
        </StaggerItem>
      </Stagger>

      {/* Version Stats - Dynamic */}
      <Stagger animateOnMount className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StaggerItem className="h-full">
          <BracketCard className="p-4 bg-card h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Registered</span>
            </div>
            <p className="text-2xl font-light font-mono">{registryPods.length}</p>
            <div className="text-xs text-muted-foreground mt-1">
              Total pods in registry
            </div>
            <div className="text-xs mt-1 invisible">placeholder</div>
          </BracketCard>
        </StaggerItem>

        {/* Latest Version - Dynamic */}
        <StaggerItem className="h-full">
          <BracketCard className="p-4 bg-card h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Latest {versionStats.latestVersion ? `v${versionStats.latestVersion}` : ''}
              </span>
            </div>
            <p className="text-2xl font-light font-mono text-green-500">
              {versionStats.latestCount}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              {registryPods.length > 0 ? `${((versionStats.latestCount / registryPods.length) * 100).toFixed(0)}% updated` : 'No pods'}
            </div>
            <div className="text-xs mt-1 invisible">placeholder</div>
          </BracketCard>
        </StaggerItem>

        {/* Outdated Versions - Dynamic - Clickable */}
        <StaggerItem className="h-full">
          <ScaleOnHover className="h-full">
            <BracketCard
              className="p-4 bg-card cursor-pointer hover:border-yellow-500/50 transition-colors h-full flex flex-col"
              onClick={() => setShowVersionChart(true)}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Outdated</span>
              </div>
              <p className="text-2xl font-light font-mono text-yellow-500">
                {versionStats.outdatedCount}
              </p>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {versionStats.topVersions.length > 1
                  ? versionStats.topVersions.slice(1, 3).map(v => `v${v.version} (${v.count})`).join(', ')
                  : 'All on latest version'}
              </div>
              <div className="text-xs text-primary/70 mt-1">Click for details</div>
            </BracketCard>
          </ScaleOnHover>
        </StaggerItem>

        <StaggerItem className="h-full">
          <BracketCard className="p-4 bg-card h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-success" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Credits</span>
            </div>
            <p className="text-2xl font-light font-mono text-success">
              {totalCredits.toLocaleString()}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Network reputation
            </div>
            <div className="text-xs mt-1 invisible">placeholder</div>
          </BracketCard>
        </StaggerItem>
      </Stagger>

      {/* Version Distribution Chart Modal */}
      <VersionDistributionChart
        open={showVersionChart}
        onOpenChange={setShowVersionChart}
        distribution={versionStats.distribution}
        latestVersion={versionStats.latestVersion}
        totalNodes={registryPods.length}
      />
    </>
  )
}
