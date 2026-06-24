'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard, Users, UserPlus, Camera, LogOut as ExitIcon,
  FileBarChart, Ban, Settings, Bell, Search, LogOut,
  ChevronLeft, ChevronRight, ShieldCheck, CheckSquare
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'security_officer', 'receptionist', 'employee'] },
  { href: '/dashboard/registration', icon: UserPlus, label: 'Register Visitor', roles: ['admin', 'receptionist', 'security_officer'] },
  { href: '/dashboard/visitors', icon: Users, label: 'Visitors', roles: ['admin', 'security_officer', 'receptionist'] },
  { href: '/dashboard/entry-gate', icon: Camera, label: 'Entry Gate', roles: ['admin', 'security_officer'] },
  { href: '/dashboard/exit-gate', icon: ExitIcon, label: 'Exit Gate', roles: ['admin', 'security_officer'] },
  { href: '/dashboard/approvals', icon: CheckSquare, label: 'Approvals', roles: ['admin', 'employee', 'receptionist'] },
  { href: '/dashboard/blacklist', icon: Ban, label: 'Blacklist', roles: ['admin', 'security_officer'] },
  { href: '/dashboard/reports', icon: FileBarChart, label: 'Reports', roles: ['admin', 'security_officer', 'receptionist'] },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter(item =>
    user?.role && item.roles.includes(user.role)
  )

  return (
    <aside className={cn(
      'bhel-gradient text-white flex flex-col transition-all duration-300 shadow-xl',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-blue-800">
        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-blue-900 font-black text-xs">BHEL</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight">BHEL Smart VMS</p>
            <p className="text-blue-300 text-xs">Varanasi</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-blue-300 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 group',
                active
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', active && 'text-yellow-400')} />
              {!collapsed && <span className="text-sm">{item.label}</span>}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 bg-yellow-400 rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-blue-800">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-blue-300 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 text-red-300 hover:text-red-100 transition-colors w-full px-2 py-2 rounded-lg hover:bg-red-900/30"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
