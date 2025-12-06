'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react'
import { Sidebar, CollapsibleSidebar, NavSection } from './Sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  sections: NavSection[]
  /** Full logo for expanded sidebar */
  logo?: React.ReactNode
  /** Compact logo for collapsed sidebar (icon only) */
  logoCollapsed?: React.ReactNode
  headerRight?: React.ReactNode
  sidebarFooter?: React.ReactNode
  className?: string
  /** Enable collapsible sidebar (default: true) */
  collapsible?: boolean
  /** Show dark mode toggle */
  showThemeToggle?: boolean
}

export function DashboardLayout({
  children,
  sections,
  logo,
  logoCollapsed,
  headerRight,
  sidebarFooter,
  className,
  collapsible = true,
  showThemeToggle = true,
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    // Check if we're on the client and get initial state
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored) return stored === 'dark'
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  // Initialize dark mode from system preference (sync external state)
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const stored = localStorage.getItem('theme')
    const shouldBeDark = stored ? stored === 'dark' : prefersDark
    const currentIsDark = document.documentElement.classList.contains('dark')

    // Only update DOM if needed
    if (shouldBeDark !== currentIsDark) {
      document.documentElement.classList.toggle('dark', shouldBeDark)
    }

    // Update state via microtask to avoid synchronous setState warning
    if (shouldBeDark !== isDark) {
      queueMicrotask(() => setIsDark(shouldBeDark))
    }
  }, [])

  const toggleDarkMode = () => {
    const newValue = !isDark
    setIsDark(newValue)
    document.documentElement.classList.toggle('dark', newValue)
    localStorage.setItem('theme', newValue ? 'dark' : 'light')
  }

  const sidebarWidth = collapsible ? (sidebarCollapsed ? 72 : 256) : 256

  // Sidebar header with logo (switches between full and collapsed versions)
  const sidebarHeader = (logo || logoCollapsed) ? (
    <div className={cn('flex items-center', sidebarCollapsed && collapsible ? 'justify-center' : 'gap-3')}>
      {sidebarCollapsed && collapsible ? (logoCollapsed || logo) : logo}
    </div>
  ) : null

  // Sidebar footer with collapse toggle
  const sidebarFooterContent = (
    <div className="space-y-2">
      {sidebarFooter}
      {collapsible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full justify-start gap-2"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      )}
    </div>
  )

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        {collapsible ? (
          <CollapsibleSidebar
            sections={sections}
            header={sidebarHeader}
            footer={sidebarFooterContent}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        ) : (
          <Sidebar
            sections={sections}
            header={sidebarHeader}
            footer={sidebarFooterContent}
          />
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <motion.div
        className="fixed inset-y-0 left-0 z-50 md:hidden"
        initial={{ x: '-100%' }}
        animate={{ x: mobileMenuOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Sidebar
          sections={sections}
          header={
            <div className="flex items-center justify-between">
              {logo}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          }
          footer={sidebarFooter}
        />
      </motion.div>

      {/* Main Content Area */}
      <motion.div
        className="md:transition-[margin-left] md:duration-300"
        style={{ marginLeft: 0 }}
        animate={{ marginLeft: `${sidebarWidth}px` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Top Header Bar */}
        <header className="border-b border-border bg-background">
          <div className="flex h-14 items-center gap-4 px-4 md:px-6">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Header Right Content */}
            <div className="flex items-center gap-2">
              {headerRight}

              {showThemeToggle && (
                <Button variant="ghost" size="icon-sm" onClick={toggleDarkMode}>
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </motion.div>
    </div>
  )
}

// Simple page header component for consistency
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 md:mb-8', className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl tracking-widest uppercase font-normal">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm md:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// Content section wrapper
interface ContentSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function ContentSection({ title, description, children, className }: ContentSectionProps) {
  return (
    <section className={cn('mb-8', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-sm tracking-widest uppercase text-muted-foreground">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
