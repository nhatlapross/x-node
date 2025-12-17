'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ComparisonData } from '@/lib/useHistoricalData'

interface NetworkComparisonChartProps {
  networks: string[]
  data: Record<string, ComparisonData[]>
  isLoading?: boolean
  metric?: 'online' | 'total' | 'avgCpu'
}

const NETWORK_COLORS: Record<string, string> = {
  devnet1: '#22c55e',  // green
  devnet2: '#3b82f6',  // blue
  mainnet1: '#f59e0b', // amber
  mainnet2: '#ec4899', // pink
}

const NETWORK_LABELS: Record<string, string> = {
  devnet1: 'Devnet 1',
  devnet2: 'Devnet 2',
  mainnet1: 'Mainnet 1',
  mainnet2: 'Mainnet 2',
}

export function NetworkComparisonChart({
  networks,
  data,
  isLoading,
  metric = 'online'
}: NetworkComparisonChartProps) {
  // Merge all network data into a single timeline
  const chartData = useMemo(() => {
    if (networks.length === 0) return []

    // Get all unique timestamps
    const allTimestamps = new Set<number>()
    networks.forEach(network => {
      data[network]?.forEach(d => allTimestamps.add(d.time))
    })

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)

    // Build merged data
    return sortedTimestamps.map(timestamp => {
      const point: any = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      networks.forEach(network => {
        const networkData = data[network]?.find(d => d.time === timestamp)
        point[network] = networkData ? networkData[metric] : null
      })

      return point
    })
  }, [networks, data, metric])

  const metricLabels = {
    online: 'Online Nodes',
    total: 'Total Pods',
    avgCpu: 'Avg CPU %',
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const date = new Date(data.timestamp)
      return (
        <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {NETWORK_LABELS[entry.dataKey] || entry.dataKey}
                  </span>
                </div>
                <span className="font-mono text-sm" style={{ color: entry.color }}>
                  {entry.value !== null ? (metric === 'avgCpu' ? `${entry.value.toFixed(1)}%` : entry.value) : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading comparison data...</div>
      </div>
    )
  }

  if (networks.length === 0 || chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">No comparison data available</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        Comparing: {metricLabels[metric]}
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              width={40}
              tickFormatter={(v) => metric === 'avgCpu' ? `${v}%` : v}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              content={({ payload }) => (
                <div className="flex justify-center gap-6 pt-2 flex-wrap">
                  {payload?.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {NETWORK_LABELS[entry.value as string] || entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            />
            {networks.map((network) => (
              <Line
                key={network}
                type="monotone"
                dataKey={network}
                stroke={NETWORK_COLORS[network] || '#888'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: NETWORK_COLORS[network] || '#888' }}
                connectNulls
                animationDuration={1000}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
