'use client'

import styled from '@emotion/styled'
import { cn } from '@/lib/utils'

interface BracketCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  accentColor?: string
  /** Show brackets on all four corners (default: top-left and bottom-right only) */
  allCorners?: boolean
}

const BracketWrapper = styled.div<{ $accentColor: string; $allCorners: boolean }>`
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: ${props => props.$accentColor};
    border-style: solid;
    border-width: 2px;
    pointer-events: none;
  }

  /* Top-left bracket */
  &::before {
    top: 0;
    left: 0;
    border-right: none;
    border-bottom: none;
  }

  /* Bottom-right bracket */
  &::after {
    bottom: 0;
    right: 0;
    border-left: none;
    border-top: none;
  }

  ${props => props.$allCorners && `
    /* Additional corners via extra pseudo-elements on inner wrapper */
    & > .bracket-corners::before,
    & > .bracket-corners::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border-color: ${props.$accentColor};
      border-style: solid;
      border-width: 2px;
      pointer-events: none;
    }

    & > .bracket-corners::before {
      top: 0;
      right: 0;
      border-left: none;
      border-bottom: none;
    }

    & > .bracket-corners::after {
      bottom: 0;
      left: 0;
      border-right: none;
      border-top: none;
    }
  `}
`

export function BracketCard({
  children,
  className,
  accentColor = 'var(--primary)',
  allCorners = false,
  ...props
}: BracketCardProps) {
  return (
    <BracketWrapper
      $accentColor={accentColor}
      $allCorners={allCorners}
      className={cn('p-6 bg-background', className)}
      {...props}
    >
      {allCorners && <div className="bracket-corners absolute inset-0 pointer-events-none" />}
      {children}
    </BracketWrapper>
  )
}
