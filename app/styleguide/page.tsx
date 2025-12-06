'use client'

import { useState, useEffect } from 'react'
import { Copy, ExternalLink, Info, Search, Settings, TrendingUp, TrendingDown, ChevronRight, Moon, Sun, Loader2, LayoutDashboard, Server, Activity, Users, Database, Wallet, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BracketCard,
  ChamferedCard,
  ChamferedCardWithBorder,
  DotGrid,
  DotDivider,
  DotLine,
  DotProgress,
  // Animation components
  FadeIn,
  Stagger,
  StaggerItem,
  ScaleOnHover,
  Pulse,
  Shimmer,
  AnimatedProgress,
  Typewriter,
  Reveal,
  GlitchText,
  Floating,
  Spin,
  // Logo
  Logo,
  LogoIcon,
} from '@/components/common'
import { type NavSection } from '@/components/layout'

// Section wrapper component with animation
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FadeIn direction="up" className="mb-16">
      <section>
        <h2 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">{title}</h2>
        <DotDivider className="mb-8" />
        {children}
      </section>
    </FadeIn>
  )
}

// Color swatch component with hover animation
function ColorSwatch({ name, variable, fallback }: { name: string; variable: string; fallback: string }) {
  return (
    <ScaleOnHover scale={1.03}>
      <div className="flex flex-col gap-2 cursor-pointer">
        <div
          className="w-full h-20 border border-border"
          style={{ backgroundColor: `var(${variable}, ${fallback})` }}
        />
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs font-mono text-muted-foreground">{variable}</p>
        </div>
      </div>
    </ScaleOnHover>
  )
}

export default function StyleguidePage() {
  const [isDark, setIsDark] = useState(() => {
    // Check if we're on the client and get initial state
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    // Sync with system preference on mount (only updates DOM, not state directly)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const currentIsDark = document.documentElement.classList.contains('dark')

    // Only update if needed and not already in sync
    if (!currentIsDark && prefersDark) {
      document.documentElement.classList.add('dark')
      // Use a microtask to avoid synchronous setState warning
      queueMicrotask(() => setIsDark(true))
    }
  }, [])

  const toggleDarkMode = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-50">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl tracking-widest uppercase font-normal">Design System</h1>
            <p className="text-muted-foreground mt-1">Minimal Data-Brutalism Component Library</p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleDarkMode}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* ============================================= */}
        {/* COLOR PALETTE */}
        {/* ============================================= */}
        <Section title="Color Palette">
          <div className="space-y-8">
            <div className="p-4 bg-card border border-border mb-4">
              <p className="text-sm">
                <span className="font-medium">Theme:</span>{' '}
                <span className="font-mono">{isDark ? 'Dark (Green accent)' : 'Light (Orange/Yellow accent)'}</span>
              </p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Primary Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <ColorSwatch name="Primary" variable="--primary" fallback="#F59E0B" />
                <ColorSwatch name="Primary Hover" variable="--primary-hover" fallback="#D97706" />
                <ColorSwatch name="Background" variable="--background" fallback="#FFFFFF" />
                <ColorSwatch name="Surface" variable="--surface" fallback="#F5F5F0" />
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Card & Surfaces</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <ColorSwatch name="Card" variable="--card" fallback="#FAFAF7" />
                <ColorSwatch name="Popover" variable="--popover" fallback="#FFFFFF" />
                <ColorSwatch name="Accent" variable="--accent" fallback="#FEF3C7" />
                <ColorSwatch name="Muted" variable="--muted" fallback="#F5F5F0" />
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Neutral Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <ColorSwatch name="Border" variable="--border" fallback="#E5E5E5" />
                <ColorSwatch name="Foreground" variable="--foreground" fallback="#1A1A1A" />
                <ColorSwatch name="Muted Foreground" variable="--muted-foreground" fallback="#9CA3AF" />
                <ColorSwatch name="Ring" variable="--ring" fallback="#9CA3AF" />
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Semantic Colors</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <ColorSwatch name="Success" variable="--success" fallback="#22C55E" />
                <ColorSwatch name="Destructive" variable="--destructive" fallback="#EF4444" />
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* TYPOGRAPHY */}
        {/* ============================================= */}
        <Section title="Typography">
          <div className="space-y-4">
            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Page Title</p>
              <p className="text-2xl tracking-widest uppercase font-normal">STAKE WITH US</p>
            </div>

            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Section Header</p>
              <p className="text-sm tracking-widest uppercase text-muted-foreground">RECENT BLOCKS</p>
            </div>

            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Body Text</p>
              <p className="text-base text-secondary-foreground">Earn yield on your SOL while helping protect and improve Solana for everyone.</p>
            </div>

            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Data / Numbers (Share Tech Mono)</p>
              <p className="font-mono text-2xl">14.55M SOL</p>
              <p className="font-mono text-sm mt-2">0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D</p>
            </div>

            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Addresses (Truncated)</p>
              <p className="font-mono text-sm text-muted-foreground">Fd7btg...2v69Nk</p>
            </div>

            <div className="p-4 bg-card border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Labels</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated APY</p>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* SIGNATURE ELEMENTS - BRACKETS */}
        {/* ============================================= */}
        <Section title="Signature Elements — Corner Brackets">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Two Corners (Default)</p>
              <BracketCard>
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">STAKE WITH US</h3>
                <p className="text-secondary-foreground">Earn yield on your SOL while helping protect and improve Solana.</p>
              </BracketCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Four Corners</p>
              <BracketCard allCorners>
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">FEATURED CONTENT</h3>
                <p className="text-secondary-foreground">Important container with all four corner brackets.</p>
              </BracketCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Custom Color</p>
              <BracketCard accentColor="var(--success)">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">SUCCESS STATE</h3>
                <p className="text-secondary-foreground">Brackets can use semantic colors for different states.</p>
              </BracketCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">With Card Background</p>
              <BracketCard className="bg-card">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">CARD BACKGROUND</h3>
                <p className="text-secondary-foreground">Using the card color for subtle differentiation.</p>
              </BracketCard>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* SIGNATURE ELEMENTS - CHAMFERED */}
        {/* ============================================= */}
        <Section title="Signature Elements — Chamfered Corners">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Top Corners (Default)</p>
              <ChamferedCard className="bg-card">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">CHAMFERED TOP</h3>
                <p className="text-secondary-foreground">Diagonal cut on both top corners.</p>
              </ChamferedCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Top-Left Only</p>
              <ChamferedCard chamfer="top-left" className="bg-card">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">TOP-LEFT CUT</h3>
                <p className="text-secondary-foreground">Single corner chamfer for asymmetric look.</p>
              </ChamferedCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">All Corners</p>
              <ChamferedCard chamfer="all" size={16} className="bg-card">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">ALL CORNERS</h3>
                <p className="text-secondary-foreground">Octagonal shape with larger chamfer size.</p>
              </ChamferedCard>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">With Accent Border</p>
              <ChamferedCardWithBorder size={16} accentColor="var(--primary)">
                <h3 className="text-sm tracking-widest uppercase text-muted-foreground mb-2">ACCENT BORDER</h3>
                <p className="text-secondary-foreground">Visible accent color on chamfered edges.</p>
              </ChamferedCardWithBorder>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* DECORATIVE PATTERNS */}
        {/* ============================================= */}
        <Section title="Decorative Patterns">
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Dot Grid Backgrounds</p>
              <div className="grid md:grid-cols-3 gap-4">
                <DotGrid variant="default" className="p-8 border border-border bg-background">
                  <p className="text-sm font-medium">Default Grid</p>
                  <p className="text-xs text-muted-foreground">Gray dots</p>
                </DotGrid>
                <DotGrid variant="subtle" className="p-8 border border-border bg-background">
                  <p className="text-sm font-medium">Subtle Grid</p>
                  <p className="text-xs text-muted-foreground">Very light dots</p>
                </DotGrid>
                <DotGrid variant="accent" className="p-8 border border-border bg-background">
                  <p className="text-sm font-medium">Accent Grid</p>
                  <p className="text-xs text-muted-foreground">Tinted dots</p>
                </DotGrid>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Dot Dividers</p>
              <div className="space-y-6 p-6 bg-card border border-border">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Triple Dot Line (Accent)</p>
                  <DotDivider lines={3} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Double Dot Line (Accent)</p>
                  <DotDivider />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Double Dot Line (Muted)</p>
                  <DotDivider muted />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Single Dot Line</p>
                  <DotLine />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Single Dot Line (Muted)</p>
                  <DotLine color="var(--muted-foreground)" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Dot Progress Bars</p>
              <div className="space-y-4 p-6 bg-card border border-border">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress (Solid - Default)</span>
                    <span>73.4%</span>
                  </div>
                  <DotProgress percent={73.4} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress (Gradient - Optional)</span>
                    <span>45%</span>
                  </div>
                  <DotProgress percent={45} gradient />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress (Low)</span>
                    <span>12%</span>
                  </div>
                  <DotProgress percent={12} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* ANIMATIONS */}
        {/* ============================================= */}
        <Section title="Animations (Framer Motion)">
          <div className="space-y-12">
            {/* Fade In Animations */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Fade In Variants</p>
              <div className="grid md:grid-cols-4 gap-4">
                <FadeIn direction="up" delay={0}>
                  <div className="p-4 border border-border bg-card text-center">
                    <p className="text-sm">Fade Up</p>
                  </div>
                </FadeIn>
                <FadeIn direction="down" delay={0.1}>
                  <div className="p-4 border border-border bg-card text-center">
                    <p className="text-sm">Fade Down</p>
                  </div>
                </FadeIn>
                <FadeIn direction="left" delay={0.2}>
                  <div className="p-4 border border-border bg-card text-center">
                    <p className="text-sm">Fade Left</p>
                  </div>
                </FadeIn>
                <FadeIn direction="right" delay={0.3}>
                  <div className="p-4 border border-border bg-card text-center">
                    <p className="text-sm">Fade Right</p>
                  </div>
                </FadeIn>
              </div>
            </div>

            {/* Stagger Animation */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Stagger Children</p>
              <Stagger className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <StaggerItem key={i}>
                    <div className="p-4 border border-border bg-card text-center">
                      <p className="text-sm font-mono">{i}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>

            {/* Scale on Hover */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Scale on Hover</p>
              <div className="flex flex-wrap gap-4">
                <ScaleOnHover scale={1.05}>
                  <div className="p-6 border border-border bg-card cursor-pointer">
                    <p className="text-sm">Hover me (1.05x)</p>
                  </div>
                </ScaleOnHover>
                <ScaleOnHover scale={1.1}>
                  <div className="p-6 border border-primary bg-card cursor-pointer">
                    <p className="text-sm">Hover me (1.1x)</p>
                  </div>
                </ScaleOnHover>
              </div>
            </div>

            {/* Reveal Animation */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Reveal Animation</p>
              <div className="flex flex-wrap gap-8">
                <Reveal>
                  <p className="text-2xl font-mono">14.55M SOL</p>
                </Reveal>
                <Reveal>
                  <p className="text-2xl tracking-widest uppercase">STAKED</p>
                </Reveal>
              </div>
            </div>

            {/* Typewriter Effect */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Typewriter Effect</p>
              <div className="p-6 border border-border bg-card">
                <p className="text-lg font-mono">
                  <Typewriter text="Decentralized. Secure. Fast." speed={0.08} />
                </p>
              </div>
            </div>

            {/* Glitch Text */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Glitch Text (Hover)</p>
              <div className="p-6 border border-border bg-card">
                <p className="text-2xl tracking-widest uppercase">
                  <GlitchText text="XNODE" />
                </p>
              </div>
            </div>

            {/* Animated Progress */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Animated Progress</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Network Sync</span>
                    <span>85%</span>
                  </div>
                  <AnimatedProgress percent={85} duration={1.2} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Staking Progress</span>
                    <span>42%</span>
                  </div>
                  <AnimatedProgress percent={42} duration={1.5} delay={0.5} barClassName="bg-[var(--success)]" />
                </div>
              </div>
            </div>

            {/* Continuous Animations */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Continuous Animations</p>
              <div className="flex flex-wrap items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <Pulse>
                    <div className="w-12 h-12 bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-xs">LIVE</span>
                    </div>
                  </Pulse>
                  <span className="text-xs text-muted-foreground">Pulse</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Floating distance={8}>
                    <div className="w-12 h-12 border border-primary flex items-center justify-center">
                      <span className="text-primary text-xl">^</span>
                    </div>
                  </Floating>
                  <span className="text-xs text-muted-foreground">Float</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spin duration={2}>
                    <Loader2 className="w-8 h-8 text-primary" />
                  </Spin>
                  <span className="text-xs text-muted-foreground">Spin</span>
                </div>
              </div>
            </div>

            {/* Shimmer/Skeleton */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Shimmer / Loading States</p>
              <div className="p-6 border border-border bg-card space-y-4">
                <Shimmer height={24} width="60%" />
                <Shimmer height={16} width="100%" />
                <Shimmer height={16} width="80%" />
                <div className="flex gap-4 mt-4">
                  <Shimmer height={40} width={100} />
                  <Shimmer height={40} width={100} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* BUTTONS */}
        {/* ============================================= */}
        <Section title="Buttons">
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Button Variants</p>
              <div className="flex flex-wrap gap-4">
                <Button>Primary Button</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Button Sizes</p>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg">Large</Button>
                <Button size="default">Default</Button>
                <Button size="sm">Small</Button>
                <Button size="icon"><Settings className="w-4 h-4" /></Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">With Icons</p>
              <div className="flex flex-wrap gap-4">
                <Button>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </Button>
                <Button variant="secondary">
                  View Details
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Full Width (CTA Style)</p>
              <div className="max-w-md">
                <Button className="w-full">Connect Wallet</Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Disabled State</p>
              <div className="flex flex-wrap gap-4">
                <Button disabled>Disabled Primary</Button>
                <Button variant="secondary" disabled>Disabled Secondary</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* INPUTS */}
        {/* ============================================= */}
        <Section title="Input Fields">
          <div className="max-w-md space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Default Input</label>
              <Input placeholder="Enter amount to stake" />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">With Search Icon</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search tokens..." className="pl-10" />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Disabled</label>
              <Input placeholder="Disabled input" disabled />
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* CARDS */}
        {/* ============================================= */}
        <Section title="Cards">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm tracking-widest uppercase font-normal">Basic Card</CardTitle>
                <CardDescription>Standard card with header and content</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-foreground">Card content goes here. Cards have subtle backgrounds, no shadows.</p>
              </CardContent>
            </Card>

            <Card className="bg-surface">
              <CardHeader>
                <CardTitle className="text-sm tracking-widest uppercase font-normal">Surface Card</CardTitle>
                <CardDescription>Using surface background color</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-foreground">Subtle differentiation with surface background.</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ============================================= */}
        {/* BADGES */}
        {/* ============================================= */}
        <Section title="Badges">
          <div className="flex flex-wrap gap-4">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge className="bg-success hover:bg-success/90 text-white">Success</Badge>
          </div>
        </Section>

        {/* ============================================= */}
        {/* TABS */}
        {/* ============================================= */}
        <Section title="Tabs">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="p-4 border border-border bg-card mt-4">
              <p className="text-secondary-foreground">Overview content appears here.</p>
            </TabsContent>
            <TabsContent value="transactions" className="p-4 border border-border bg-card mt-4">
              <p className="text-secondary-foreground">Transactions list would go here.</p>
            </TabsContent>
            <TabsContent value="analytics" className="p-4 border border-border bg-card mt-4">
              <p className="text-secondary-foreground">Analytics and charts would appear here.</p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* ============================================= */}
        {/* STATS / METRICS */}
        {/* ============================================= */}
        <Section title="Stats & Metrics">
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-6" staggerDelay={0.1}>
            <StaggerItem>
              <ScaleOnHover>
                <div className="p-4 border border-border bg-card">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Network TPS</p>
                  <p className="text-3xl font-light font-mono">719</p>
                </div>
              </ScaleOnHover>
            </StaggerItem>

            <StaggerItem>
              <ScaleOnHover>
                <div className="p-4 border border-border bg-card">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Staked</p>
                  <p className="text-3xl font-light font-mono">14.55M</p>
                  <p className="text-xs text-muted-foreground">SOL</p>
                </div>
              </ScaleOnHover>
            </StaggerItem>

            <StaggerItem>
              <ScaleOnHover>
                <div className="p-4 border border-border bg-card">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">APY</p>
                  <p className="text-3xl font-light font-mono text-primary">6.62%</p>
                </div>
              </ScaleOnHover>
            </StaggerItem>

            <StaggerItem>
              <ScaleOnHover>
                <div className="p-4 border border-border bg-card">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">24h Change</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <p className="text-3xl font-light font-mono text-success">+2.4%</p>
                  </div>
                </div>
              </ScaleOnHover>
            </StaggerItem>
          </Stagger>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Stats with Brackets</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <BracketCard className="p-4 bg-card">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Validators</p>
                <p className="text-2xl font-light font-mono">1,847</p>
              </BracketCard>

              <BracketCard className="p-4 bg-card">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Epoch</p>
                <p className="text-2xl font-light font-mono">584</p>
              </BracketCard>

              <BracketCard className="p-4 bg-card">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Block Height</p>
                <p className="text-2xl font-light font-mono">251.2M</p>
              </BracketCard>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* TABLE EXAMPLE */}
        {/* ============================================= */}
        <Section title="Data Table">
          <div className="border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-normal">Token</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-normal">Price</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-normal">24h</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-normal">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium">Solana</p>
                      <p className="text-xs text-muted-foreground font-mono">SOL</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$142.50</td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-success font-mono text-sm flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +5.2%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$65.2B</td>
                </tr>
                <tr className="border-b border-border hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium">Ethereum</p>
                      <p className="text-xs text-muted-foreground font-mono">ETH</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$2,340.00</td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-destructive font-mono text-sm flex items-center justify-end gap-1">
                      <TrendingDown className="w-3 h-3" />
                      -1.8%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$281.5B</td>
                </tr>
                <tr className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium">Bitcoin</p>
                      <p className="text-xs text-muted-foreground font-mono">BTC</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$43,250.00</td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-success font-mono text-sm flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +2.1%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-sm">$847.3B</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ============================================= */}
        {/* ICONS */}
        {/* ============================================= */}
        <Section title="Icons (Lucide)">
          <div className="flex flex-wrap gap-6">
            {[
              { icon: Search, name: 'Search' },
              { icon: Copy, name: 'Copy' },
              { icon: ExternalLink, name: 'ExternalLink' },
              { icon: Settings, name: 'Settings' },
              { icon: Info, name: 'Info' },
              { icon: TrendingUp, name: 'TrendingUp' },
              { icon: TrendingDown, name: 'TrendingDown' },
              { icon: ChevronRight, name: 'ChevronRight' },
              { icon: Moon, name: 'Moon' },
              { icon: Sun, name: 'Sun' },
            ].map(({ icon: Icon, name }) => (
              <div key={name} className="flex flex-col items-center gap-2 p-4 border border-border bg-card">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ============================================= */}
        {/* LAYOUT PATTERNS */}
        {/* ============================================= */}
        <Section title="Layout Patterns — Sidebar Navigation">
          <div className="space-y-8">
            {/* Logo Demo */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Logo (Light/Dark Mode Aware)</p>
              <div className="flex items-center gap-8 p-6 border border-border bg-card">
                <div className="flex flex-col items-center gap-3">
                  <Logo height={40} />
                  <span className="text-xs text-muted-foreground">Full Logo (Expanded)</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <LogoIcon size={40} />
                  <span className="text-xs text-muted-foreground">Icon Only (Collapsed)</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Navigation Items (Active State with Left Accent Border)</p>
              <div className="max-w-xs border border-border bg-sidebar">
                {/* Demo navigation items */}
                {(() => {
                  const demoNavSections: NavSection[] = [
                    {
                      title: 'Overview',
                      items: [
                        { label: 'Dashboard', href: '#dashboard', icon: LayoutDashboard },
                        { label: 'Analytics', href: '#analytics', icon: BarChart3, badge: 'New' },
                      ],
                    },
                    {
                      title: 'Network',
                      items: [
                        { label: 'Nodes', href: '#nodes', icon: Server, badge: 42 },
                        { label: 'Activity', href: '#activity', icon: Activity },
                        { label: 'Validators', href: '#validators', icon: Users },
                      ],
                    },
                    {
                      title: 'Resources',
                      items: [
                        { label: 'Storage', href: '#storage', icon: Database },
                        { label: 'Wallet', href: '#wallet', icon: Wallet },
                      ],
                    },
                  ]
                  const activeItem = '#nodes'

                  return (
                    <nav className="py-4">
                      {demoNavSections.map((section, sectionIdx) => (
                        <div key={sectionIdx} className="mb-4">
                          {section.title && (
                            <div className="px-6 mb-2">
                              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                                {section.title}
                              </span>
                            </div>
                          )}
                          <ul className="space-y-1">
                            {section.items.map((item) => {
                              const isActive = item.href === activeItem
                              const Icon = item.icon

                              return (
                                <li key={item.href}>
                                  <div
                                    className={`relative flex items-center gap-3 px-6 py-3 text-sm transition-colors cursor-pointer ${
                                      isActive
                                        ? 'text-sidebar-primary bg-sidebar-accent'
                                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                    }`}
                                  >
                                    {/* Active indicator */}
                                    {isActive && (
                                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary" />
                                    )}
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge !== undefined && (
                                      <span
                                        className={`px-2 py-0.5 text-xs ${
                                          isActive
                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                      >
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </nav>
                  )
                })()}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Dashboard Layout Structure</p>
              <div className="border border-border bg-card p-4">
                <div className="flex gap-4">
                  {/* Mini sidebar representation */}
                  <div className="w-16 shrink-0">
                    <div className="bg-sidebar border border-sidebar-border h-48 flex flex-col">
                      <div className="h-10 border-b border-sidebar-border flex items-center justify-center">
                        <div className="w-6 h-6 bg-primary" />
                      </div>
                      <div className="flex-1 py-2 space-y-1">
                        <div className="h-8 mx-2 bg-sidebar-accent border-l-2 border-sidebar-primary" />
                        <div className="h-8 mx-2 bg-transparent" />
                        <div className="h-8 mx-2 bg-transparent" />
                      </div>
                    </div>
                  </div>
                  {/* Main content representation */}
                  <div className="flex-1">
                    <div className="bg-background border border-border h-48 flex flex-col">
                      <div className="h-10 border-b border-border bg-card/50 flex items-center px-3">
                        <div className="w-20 h-4 bg-muted" />
                        <div className="flex-1" />
                        <div className="w-6 h-6 bg-muted" />
                      </div>
                      <div className="flex-1 p-3 space-y-2">
                        <div className="h-4 bg-muted w-1/3" />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-16 bg-card border border-border" />
                          <div className="h-16 bg-card border border-border" />
                          <div className="h-16 bg-card border border-border" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Fixed sidebar (256px / 72px collapsed) + Scrollable main content
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Usage</p>
              <div className="p-4 bg-card border border-border font-mono text-xs space-y-2">
                <p className="text-muted-foreground">{`// Import layout components`}</p>
                <p>{`import { DashboardLayout, PageHeader } from '@/components/layout'`}</p>
                <p className="text-muted-foreground mt-4">{`// Define navigation sections`}</p>
                <p>{`const navSections = [{ title: 'Main', items: [...] }]`}</p>
                <p className="text-muted-foreground mt-4">{`// Wrap your page content`}</p>
                <p>{`<DashboardLayout sections={navSections}>`}</p>
                <p className="pl-4">{`  <PageHeader title="Dashboard" />`}</p>
                <p className="pl-4">{`  {/* Your content */}`}</p>
                <p>{`</DashboardLayout>`}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ============================================= */}
        {/* COMPLETE EXAMPLE */}
        {/* ============================================= */}
        <Section title="Complete Example — Staking Card">
          <div className="max-w-lg">
            <BracketCard allCorners className="p-0 bg-card">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm tracking-widest uppercase">STAKE WITH US</h3>
                  <button className="p-1 hover:bg-surface rounded transition-colors">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <p className="text-secondary-foreground text-sm mb-6">
                  Earn yield on your SOL while helping protect and improve Solana for everyone.{' '}
                  <a href="#" className="text-primary hover:underline">Learn more</a>
                </p>

                <DotDivider className="mb-6" />

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs uppercase tracking-wide text-muted-foreground">Amount</label>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs border border-border hover:border-muted-foreground transition-colors">SOL</button>
                      <button className="px-3 py-1 text-xs border border-border hover:border-muted-foreground transition-colors">HALF</button>
                      <button className="px-3 py-1 text-xs border border-border hover:border-muted-foreground transition-colors">MAX</button>
                    </div>
                  </div>
                  <Input placeholder="Enter amount to stake" className="font-mono" />
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated APY</span>
                    <span className="font-mono text-primary">6.62%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Helius Fees</span>
                    <span className="font-mono">0%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Validator</span>
                    <span className="font-mono">Helius</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total staked</span>
                    <span className="font-mono">14.55M SOL</span>
                  </div>
                </div>

                <Button className="w-full">Connect Wallet</Button>
              </div>
            </BracketCard>
          </div>
        </Section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <p className="text-xs text-muted-foreground">Minimal Data-Brutalism Design System — Xnode Platform</p>
        </div>
      </footer>
    </div>
  )
}
