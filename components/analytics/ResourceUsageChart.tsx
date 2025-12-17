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
  ReferenceLine,
} from 'recharts'
import { ChartResourceData } from '@/lib/useHistoricalData'

interface ResourceUsageChartProps {
  data: ChartResourceData[]
  isLoading?: boolean
  showWarningThreshold?: boolean
}

export function ResourceUsageChart({
  data,
  isLoading,
  showWarningThreshold = true
}: ResourceUsageChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      time: new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: d.time,
    }))
  }, [data])

  // Calculate stats
  const stats = useMemo(() => {
    if (data.length === 0) return { avgCpu: 0, avgRam: 0, maxCpu: 0, maxRam: 0 }
    const avgCpu = data.reduce((sum, d) => sum + d.cpu, 0) / data.length
    const avgRam = data.reduce((sum, d) => sum + d.ram, 0) / data.length
    const maxCpu = Math.max(...data.map(d => d.cpu))
    const maxRam = Math.max(...data.map(d => d.ram))
    return { avgCpu, avgRam, maxCpu, maxRam }
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
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-sm text-muted-foreground">CPU</span>
              </div>
              <span className={`font-mono text-sm ${data.cpu > 80 ? 'text-red-400' : data.cpu > 60 ? 'text-yellow-400' : 'text-cyan-400'}`}>
                {data.cpu.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-sm text-muted-foreground">RAM</span>
              </div>
              <span className={`font-mono text-sm ${data.ram > 80 ? 'text-red-400' : data.ram > 60 ? 'text-yellow-400' : 'text-purple-400'}`}>
                {data.ram.toFixed(1)}%
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
        <div className="animate-pulse text-muted-foreground">Loading resource data...</div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">No resource data available yet</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Avg CPU:</span>
          <span className="font-mono text-cyan-400">{stats.avgCpu.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Avg RAM:</span>
          <span className="font-mono text-purple-400">{stats.avgRam.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Peak CPU:</span>
          <span className={`font-mono ${stats.maxCpu > 80 ? 'text-red-400' : 'text-cyan-400'}`}>{stats.maxCpu.toFixed(1)}%</span>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
              <linearGradient id="ramGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#c084fc" />
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
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              width={35}
              tickFormatter={(v) => `${v}%`}
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
                      <span className="text-xs text-muted-foreground uppercase">
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            />
            {showWarningThreshold && (
              <ReferenceLine
                y={80}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{
                  value: 'Warning',
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 10,
                  opacity: 0.7
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="cpu"
              stroke="url(#cpuGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#06b6d4' }}
              animationDuration={1000}
            />
            <Line
              type="monotone"
              dataKey="ram"
              stroke="url(#ramGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#a855f7' }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
