import { type ReactNode } from 'react'
import { SidebarNav } from './SidebarNav'
import { BottomTabBar } from './BottomTabBar'
import type { DashboardTab } from '@/types'

interface DashboardLayoutProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  eventName: string
  eventLogoUrl: string | null
  userName: string
  userEmail: string
  onSignOut: () => void
  children: ReactNode
}

export function DashboardLayout({
  activeTab,
  onTabChange,
  eventName,
  eventLogoUrl,
  userName,
  userEmail,
  onSignOut,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <SidebarNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        eventName={eventName}
        eventLogoUrl={eventLogoUrl}
        userName={userName}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />

      {/* Main content area */}
      <main className="md:ml-16 lg:ml-60">
        <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:py-8 md:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        userName={userName}
        userEmail={userEmail}
        onSignOut={onSignOut}
      />
    </div>
  )
}
