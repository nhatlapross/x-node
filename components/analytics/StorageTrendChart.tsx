'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ChartStorageData } from '@/lib/useHistoricalData'

interface StorageTrendChartProps {
  data: ChartStorageData[]
  isLoading?: boolean
}

function formatStorage(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function StorageTrendChart({ data, isLoading }: StorageTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      time: new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: d.time,
      storageGB: d.storage / (1024 * 1024 * 1024), // Convert to GB for display
    }))
  }, [data])

  // Calculate growth
  const growth = useMemo(() => {
    if (data.length < 2) return { storage: 0, streams: 0 }
    const first = data[0]
    const last = data[data.length - 1]
    return {
      storage: last.storage - first.storage,
      streams: last.streams - first.streams,
    }
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const date = new Date(data.timestamp)
      return (
        <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
          <p className="text-xs text-muted-foreground mb-2">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-muted-foreground">Storage</span>
              </div>
              <span className="font-mono text-sm text-emerald-400">
                {formatStorage(data.storage)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm text-muted-foreground">Active Streams</span>
              </div>
              <span className="font-mono text-sm text-amber-400">
                {data.streams.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading storage data...</div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">No storage data available yet</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Growth indicators */}
      <div className="flex gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Storage Change:</span>
          <span className={`font-mono ${growth.storage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {growth.storage >= 0 ? '+' : ''}{formatStorage(Math.abs(growth.storage))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Stream Change:</span>
          <span className={`font-mono ${growth.streams >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {growth.streams >= 0 ? '+' : ''}{growth.streams.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="storageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="storage"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              width={50}
              tickFormatter={(v) => `${v.toFixed(1)} GB`}
            />
            <YAxis
              yAxisId="streams"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              content={({ payload }) => (
                <div className="flex justify-center gap-6 pt-2">
                  {payload?.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-muted-foreground capitalize">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            />
            <Area
              yAxisId="storage"
              type="monotone"
              dataKey="storageGB"
              name="storage"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#storageGradient)"
              animationDuration={1000}
            />
            <Bar
              yAxisId="streams"
              dataKey="streams"
              name="streams"
              fill="#f59e0b"
              opacity={0.6}
              radius={[2, 2, 0, 0]}
              animationDuration={1000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
