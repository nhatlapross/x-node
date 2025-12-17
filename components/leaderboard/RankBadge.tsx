'use client'

import { cn } from '@/lib/utils'
import { Crown, Medal } from 'lucide-react'

interface RankBadgeProps {
  rank: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function RankBadge({ rank, size = 'md', className }: RankBadgeProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }

  const iconSize = {
    sm: 12,
    md: 16,
    lg: 20,
  }

  // Top 3 get special styling
  if (rank === 1) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold shadow-lg shadow-yellow-500/30',
          sizeClasses[size],
          className
        )}
      >
        <Crown size={iconSize[size]} className="fill-current" />
      </div>
    )
  }

  if (rank === 2) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 font-bold shadow-lg shadow-slate-400/30',
          sizeClasses[size],
          className
        )}
      >
        <Medal size={iconSize[size]} className="fill-current" />
      </div>
    )
  }

  if (rank === 3) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 font-bold shadow-lg shadow-amber-600/30',
          sizeClasses[size],
          className
        )}
      >
        <Medal size={iconSize[size]} className="fill-current" />
      </div>
    )
  }

  // 4+ just show the number
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-muted text-muted-foreground font-mono font-medium',
        sizeClasses[size],
        className
      )}
    >
      {rank}
    </div>
  )
}
