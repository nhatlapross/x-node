'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  /** Height in pixels (width auto-calculated from aspect ratio) */
  height?: number
  className?: string
}

// Full logo with "NODE" text (aspect ratio ~2.55:1)
export function Logo({ height = 32, className }: LogoProps) {
  const [isDark, setIsDark] = useState(false)
  const width = Math.round(height * 2.55) // 958/376 ≈ 2.55

  useEffect(() => {
    // Check initial state
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()

    // Watch for changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDark()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <Image
      src={isDark ? '/full-logo-dark.svg' : '/full-logo-light.svg'}
      alt="Xnode"
      width={width}
      height={height}
      className={cn('shrink-0', className)}
    />
  )
}

// Compact logo for collapsed sidebar
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDark()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <Image
      src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Xnode"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    />
  )
}
