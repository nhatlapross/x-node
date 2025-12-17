'use client'

import { Search, Star, GitCompare, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TimeRange = '24h' | '7d' | '30d' | 'all'
export type ViewMode = 'table' | 'cards'

interface LeaderboardFiltersProps {
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  showFavoritesOnly: boolean
  setShowFavoritesOnly: (show: boolean) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  compareMode: boolean
  setCompareMode: (mode: boolean) => void
  selectedCount: number
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'All Time' },
]

export function LeaderboardFilters({
  timeRange,
  setTimeRange,
  searchQuery,
  setSearchQuery,
  showFavoritesOnly,
  setShowFavoritesOnly,
  viewMode,
  setViewMode,
  compareMode,
  setCompareMode,
  selectedCount,
}: LeaderboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Time Range */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={cn(
              'px-3 py-1.5 text-xs font-mono transition-all rounded',
              timeRange === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>

      {/* Favorites Toggle */}
      <Button
        variant={showFavoritesOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        className="gap-2"
      >
        <Star className={cn('w-4 h-4', showFavoritesOnly && 'fill-current')} />
        Favorites
      </Button>

      {/* Compare Toggle */}
      <Button
        variant={compareMode ? 'default' : 'outline'}
        size="sm"
        onClick={() => setCompareMode(!compareMode)}
        className="gap-2"
      >
        <GitCompare className="w-4 h-4" />
        Compare
        {selectedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-foreground/20 rounded">
            {selectedCount}
          </span>
        )}
      </Button>

      {/* View Mode */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
        <button
          onClick={() => setViewMode('table')}
          className={cn(
            'p-1.5 rounded transition-all',
            viewMode === 'table'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('cards')}
          className={cn(
            'p-1.5 rounded transition-all',
            viewMode === 'cards'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
