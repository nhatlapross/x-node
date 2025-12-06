'use client'

import { LayoutDashboard, Server, Activity, Users, Database, Wallet, BarChart3, Settings, HelpCircle } from 'lucide-react'
import { DashboardLayout, PageHeader, ContentSection, type NavSection } from '@/components/layout'
import { Logo, LogoIcon, BracketCard, DotDivider, DotProgress } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Define navigation sections
const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/demo', icon: LayoutDashboard },
      { label: 'Analytics', href: '/demo/analytics', icon: BarChart3, badge: 'New' },
    ],
  },
  {
    title: 'Network',
    items: [
      { label: 'Nodes', href: '/demo/nodes', icon: Server, badge: 42 },
      { label: 'Activity', href: '/demo/activity', icon: Activity },
      { label: 'Validators', href: '/demo/validators', icon: Users },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Storage', href: '/demo/storage', icon: Database },
      { label: 'Wallet', href: '/demo/wallet', icon: Wallet },
    ],
  },
  {
    items: [
      { label: 'Settings', href: '/demo/settings', icon: Settings },
      { label: 'Help', href: '/demo/help', icon: HelpCircle },
    ],
  },
]

export default function DemoPage() {
  return (
    <DashboardLayout
      sections={navSections}
      logo={<Logo height={36} />}
      logoCollapsed={<LogoIcon size={36} />}
      headerRight={
        <Button variant="outline" size="sm">
          Connect Wallet
        </Button>
      }
    >
      <PageHeader
        title="Dashboard"
        description="Overview of your Xnode network"
        actions={
          <Button size="sm">
            Refresh Data
          </Button>
        }
      />

      {/* Stats Grid */}
      <ContentSection title="Network Stats">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BracketCard className="p-4 bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Nodes Online</p>
            <p className="text-3xl font-light font-mono">42/48</p>
            <DotProgress percent={87.5} className="mt-2" />
          </BracketCard>

          <BracketCard className="p-4 bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Storage</p>
            <p className="text-3xl font-light font-mono">2.4 TB</p>
          </BracketCard>

          <BracketCard className="p-4 bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Avg CPU</p>
            <p className="text-3xl font-light font-mono text-primary">12.4%</p>
          </BracketCard>

          <BracketCard className="p-4 bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Uptime</p>
            <p className="text-3xl font-light font-mono text-success">99.9%</p>
          </BracketCard>
        </div>
      </ContentSection>

      <DotDivider className="my-8" />

      {/* Recent Activity */}
      <ContentSection title="Recent Activity">
        <div className="space-y-3">
          {[
            { node: 'Node 1', event: 'Connected', time: '2 min ago', status: 'success' },
            { node: 'Node 7', event: 'Storage sync complete', time: '5 min ago', status: 'success' },
            { node: 'Node 12', event: 'High CPU usage', time: '12 min ago', status: 'warning' },
            { node: 'Node 3', event: 'Disconnected', time: '1 hour ago', status: 'error' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-border bg-card">
              <div className="flex items-center gap-4">
                <Badge
                  className={
                    item.status === 'success'
                      ? 'bg-success text-white'
                      : item.status === 'warning'
                      ? 'bg-primary text-white'
                      : 'bg-destructive text-white'
                  }
                >
                  {item.status}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{item.node}</p>
                  <p className="text-xs text-muted-foreground">{item.event}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{item.time}</p>
            </div>
          ))}
        </div>
      </ContentSection>

      {/* Instructions */}
      <div className="mt-12 p-6 border border-dashed border-border bg-card/50">
        <p className="text-sm text-muted-foreground mb-2">
          <strong>Try it out:</strong>
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Click the <strong>Collapse</strong> button at the bottom of the sidebar</li>
          <li>Hover over icons when collapsed to see tooltips</li>
          <li>Toggle dark mode with the sun/moon icon in the header</li>
          <li>On mobile, use the hamburger menu to open the sidebar</li>
        </ul>
      </div>
    </DashboardLayout>
  )
}
