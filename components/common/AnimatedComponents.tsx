'use client'

import { motion, type Variants, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
}

export const slideInLeft: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0 },
}

export const slideInRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
}

// Stagger children animation
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// =============================================================================
// FADE IN COMPONENT
// =============================================================================

interface FadeInProps extends HTMLMotionProps<'div'> {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  delay?: number
  duration?: number
  className?: string
  children: React.ReactNode
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ direction = 'up', delay = 0, duration = 0.5, className, children, ...props }, ref) => {
    const variants: Record<string, Variants> = {
      up: fadeInUp,
      down: fadeInDown,
      left: fadeInLeft,
      right: fadeInRight,
      none: fadeIn,
    }

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={variants[direction]}
        transition={{ duration, delay, ease: 'easeOut' }}
        className={cn(className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
FadeIn.displayName = 'FadeIn'

// =============================================================================
// STAGGER CONTAINER
// =============================================================================

interface StaggerProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number
  initialDelay?: number
  className?: string
  children: React.ReactNode
}

export function Stagger({
  staggerDelay = 0.1,
  initialDelay = 0,
  className,
  children,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// STAGGER ITEM
// =============================================================================

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
}

export function StaggerItem({ className, children, ...props }: StaggerItemProps) {
  return (
    <motion.div
      variants={staggerItem}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// SCALE ON HOVER
// =============================================================================

interface ScaleOnHoverProps extends HTMLMotionProps<'div'> {
  scale?: number
  className?: string
  children: React.ReactNode
}

export function ScaleOnHover({
  scale = 1.02,
  className,
  children,
  ...props
}: ScaleOnHoverProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// PULSE ANIMATION
// =============================================================================

interface PulseProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
}

export function Pulse({ className, children, ...props }: PulseProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.02, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// SHIMMER / SKELETON
// =============================================================================

interface ShimmerProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Shimmer({ className, width = '100%', height = 20 }: ShimmerProps) {
  return (
    <motion.div
      className={cn('bg-muted overflow-hidden relative', className)}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-background/50 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
  )
}

// =============================================================================
// COUNTER ANIMATION
// =============================================================================

interface CounterProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  from?: number
  to: number
  duration?: number
  className?: string
  formatter?: (value: number) => string
}

export function Counter({
  from = 0,
  to,
  duration = 1.5,
  className,
  formatter = (v) => Math.round(v).toLocaleString(),
  ...props
}: CounterProps) {
  return (
    <motion.span
      className={cn(className)}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      {...props}
    >
      <motion.span
        initial={{
          opacity: 0,
          // Use from as the initial display value concept
        }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration }}
      >
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: duration * 0.5 }}
        >
          {formatter(from === 0 ? to : to)}
        </motion.span>
      </motion.span>
    </motion.span>
  )
}

// =============================================================================
// PROGRESS ANIMATION
// =============================================================================

interface AnimatedProgressProps {
  percent: number
  className?: string
  barClassName?: string
  duration?: number
  delay?: number
}

export function AnimatedProgress({
  percent,
  className,
  barClassName,
  duration = 1,
  delay = 0.3,
}: AnimatedProgressProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent))

  return (
    <div className={cn('h-3 bg-muted overflow-hidden', className)}>
      <motion.div
        className={cn('h-full bg-primary', barClassName)}
        initial={{ width: 0 }}
        whileInView={{ width: `${clampedPercent}%` }}
        viewport={{ once: true }}
        transition={{ duration, delay, ease: 'easeOut' }}
      />
    </div>
  )
}

// =============================================================================
// TYPEWRITER EFFECT
// =============================================================================

interface TypewriterProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  text: string
  className?: string
  delay?: number
  speed?: number
}

export function Typewriter({
  text,
  className,
  delay = 0,
  speed = 0.05,
  ...props
}: TypewriterProps) {
  const characters = text.split('')

  return (
    <motion.span className={cn(className)} {...props}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: delay + index * speed }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  )
}

// =============================================================================
// BORDER ANIMATION (draws border around element)
// =============================================================================

interface BorderDrawProps {
  className?: string
  children: React.ReactNode
  duration?: number
  color?: string
}

export function BorderDraw({
  className,
  children,
  duration = 1,
  color = 'var(--primary)',
}: BorderDrawProps) {
  return (
    <div className={cn('relative', className)}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <motion.rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="none"
          stroke={color}
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration, ease: 'easeInOut' }}
        />
      </svg>
      {children}
    </div>
  )
}

// =============================================================================
// FLIP CARD
// =============================================================================

interface FlipCardProps {
  front: React.ReactNode
  back: React.ReactNode
  className?: string
}

export function FlipCard({ front, back, className }: FlipCardProps) {
  return (
    <motion.div
      className={cn('relative cursor-pointer', className)}
      initial={false}
      whileHover="flipped"
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        variants={{
          flipped: { rotateY: 180 },
        }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      >
        <div
          className="absolute inset-0 backface-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {back}
        </div>
      </motion.div>
    </motion.div>
  )
}

// =============================================================================
// REVEAL ON SCROLL
// =============================================================================

interface RevealProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
  width?: 'fit' | 'full'
}

export function Reveal({ className, children, width = 'fit', ...props }: RevealProps) {
  return (
    <div
      className={cn('relative overflow-hidden', width === 'fit' ? 'w-fit' : 'w-full', className)}
    >
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        {...props}
      >
        {children}
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-primary z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={{
          hidden: { left: 0 },
          visible: { left: '100%' },
        }}
        transition={{ duration: 0.5, ease: 'easeIn' }}
      />
    </div>
  )
}

// =============================================================================
// MAGNETIC HOVER (cursor follows)
// =============================================================================

interface MagneticProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
  strength?: number
}

export function Magnetic({ className, children, strength = 0.3, ...props }: MagneticProps) {
  return (
    <motion.div
      className={cn(className)}
      whileHover={{ scale: 1 + strength * 0.15 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// GLITCH TEXT
// =============================================================================

interface GlitchTextProps {
  text: string
  className?: string
}

export function GlitchText({ text, className }: GlitchTextProps) {
  return (
    <motion.span
      className={cn('relative inline-block', className)}
      whileHover="glitch"
    >
      <span className="relative z-10">{text}</span>
      <motion.span
        className="absolute inset-0 text-destructive"
        style={{ clipPath: 'inset(50% 0 0 0)' }}
        variants={{
          glitch: {
            x: [-2, 2, -2, 0],
            transition: { duration: 0.2, repeat: 2 },
          },
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-primary"
        style={{ clipPath: 'inset(0 0 50% 0)' }}
        variants={{
          glitch: {
            x: [2, -2, 2, 0],
            transition: { duration: 0.2, repeat: 2 },
          },
        }}
      >
        {text}
      </motion.span>
    </motion.span>
  )
}

// =============================================================================
// FLOATING ANIMATION
// =============================================================================

interface FloatingProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
  duration?: number
  distance?: number
}

export function Floating({
  className,
  children,
  duration = 3,
  distance = 10,
  ...props
}: FloatingProps) {
  return (
    <motion.div
      className={cn(className)}
      animate={{
        y: [-distance, distance, -distance],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// =============================================================================
// SPIN ANIMATION
// =============================================================================

interface SpinProps extends HTMLMotionProps<'div'> {
  className?: string
  children: React.ReactNode
  duration?: number
}

export function Spin({ className, children, duration = 2, ...props }: SpinProps) {
  return (
    <motion.div
      className={cn(className)}
      animate={{ rotate: 360 }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
