'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string | number
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarProps {
  sections: NavSection[]
  header?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function Sidebar({ sections, header, footer, className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40',
        className
      )}
    >
      {/* Header */}
      {header && (
        <div className="p-6 border-b border-sidebar-border">
          {header}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {section.title && (
              <div className="px-6 mb-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </span>
              </div>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 px-6 py-3 text-sm transition-colors',
                        isActive
                          ? 'text-sidebar-primary bg-sidebar-accent'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      {/* Active indicator - left accent border */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary"
                          initial={false}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 35,
                          }}
                        />
                      )}

                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>

                      {item.badge !== undefined && (
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs',
                            isActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className="p-4 border-t border-sidebar-border">
          {footer}
        </div>
      )}
    </aside>
  )
}

// Collapsible sidebar variant (icon-only when collapsed)
interface CollapsibleSidebarProps extends SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function CollapsibleSidebar({
  sections,
  header,
  footer,
  className,
  collapsed = false,
  onToggle,
}: CollapsibleSidebarProps) {
  const pathname = usePathname()

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-40',
        className
      )}
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      {header && (
        <div className={cn('border-b border-sidebar-border', collapsed ? 'p-4' : 'p-6')}>
          {header}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn('flex-1 py-4', collapsed ? 'overflow-hidden' : 'overflow-y-auto')}>
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {section.title && !collapsed && (
              <div className="px-6 mb-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </span>
              </div>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 py-3 text-sm transition-colors',
                        collapsed ? 'px-4 justify-center' : 'px-6',
                        isActive
                          ? 'text-sidebar-primary bg-sidebar-accent'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator-collapsible"
                          className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-primary"
                          initial={false}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 35,
                          }}
                        />
                      )}

                      <Icon className="w-5 h-5 shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs',
                                isActive
                                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}

                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-border z-50">
                          {item.label}
                          {item.badge !== undefined && ` (${item.badge})`}
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'p-4')}>
          {footer}
        </div>
      )}
    </motion.aside>
  )
}
