'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isPreReleaseVersion } from '@/lib/version'

interface VersionData {
  version: string
  count: number
}

interface VersionDistributionChartProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribution: VersionData[]
  latestVersion: string | null
  totalNodes: number
}

// Color palette for the pie chart
const COLORS = [
  '#22c55e', // green - latest
  '#eab308', // yellow - outdated
  '#f97316', // orange
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6b7280', // gray
]

export function VersionDistributionChart({
  open,
  onOpenChange,
  distribution,
  latestVersion,
  totalNodes,
}: VersionDistributionChartProps) {
  // Prepare chart data with colors
  const chartData = useMemo(() => {
    return distribution.map((item, index) => {
      const isLatest = latestVersion && item.version === latestVersion
      const isPreRelease = isPreReleaseVersion(item.version)

      return {
        name: `v${item.version}`,
        value: item.count,
        percentage: ((item.count / totalNodes) * 100).toFixed(1),
        fill: isLatest ? COLORS[0] : COLORS[(index % (COLORS.length - 1)) + 1],
        isLatest,
        isPreRelease,
      }
    })
  }, [distribution, latestVersion, totalNodes])

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-mono text-sm font-medium">{data.name}</p>
          <p className="text-muted-foreground text-sm">
            {data.value} nodes ({data.percentage}%)
          </p>
          {data.isLatest && (
            <span className="text-xs text-green-500">Latest stable</span>
          )}
          {data.isPreRelease && (
            <span className="text-xs text-orange-500">Pre-release</span>
          )}
        </div>
      )
    }
    return null
  }

  // Custom legend
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-mono text-muted-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-light tracking-wide">
            VERSION DISTRIBUTION
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Pie Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={500}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Version List */}
          <div className="mt-6 space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="font-mono text-sm">
                    {item.name}
                    {item.isLatest && (
                      <span className="ml-2 text-xs text-green-500">(Latest)</span>
                    )}
                    {item.isPreRelease && (
                      <span className="ml-2 text-xs text-orange-500">(Pre-release)</span>
                    )}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-primary">{item.value}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({item.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Nodes</span>
              <span className="font-mono text-primary">{totalNodes}</span>
            </div>
            {latestVersion && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Latest Version</span>
                <span className="font-mono text-green-500">v{latestVersion}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
