'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from './ThemeProvider'
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Apple,
  Bell,
  Sun,
  Moon,
  CreditCard,
  Building2,
  Shield,
} from 'lucide-react'

// Trainer nav items (what trainers see)
const trainerNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Clients', href: '/users', icon: Users },
  { name: 'Programs', href: '/programs', icon: Dumbbell },
  { name: 'Nutrition', href: '/nutrition', icon: Apple },
  { name: 'Schedules', href: '/schedules', icon: Calendar },
  { name: 'Organization', href: '/organization', icon: Building2 },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
]

// Super admin nav items (platform management only)
const superAdminNavItems = [
  { name: 'Platform', href: '/platform', icon: Shield },
  { name: 'Settings', href: '/settings', icon: Settings },
]

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [orgName, setOrgName] = useState<string>('CMPD')
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedOrgName, setImpersonatedOrgName] = useState<string>('')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)

  useEffect(() => {
    setMounted(true)
    
    // Check for impersonation
    const impersonatingOrgId = sessionStorage.getItem('impersonating_org')
    if (impersonatingOrgId) {
      setIsImpersonating(true)
      // Fetch the impersonated org name
      supabase
        .from('organizations')
        .select('name')
        .eq('id', impersonatingOrgId)
        .single()
        .then(({ data }) => {
          if (data?.name) {
            setImpersonatedOrgName(data.name)
          }
        })
    }
    
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('id', user.id)
          .single()
        
        // If profile doesn't exist (user was deleted), sign them out
        if (error || !profile) {
          console.log('User profile not found, signing out...')
          await supabase.auth.signOut()
          router.push('/login')
          return
        }
        
        setIsSuperAdmin(profile?.role === 'super_admin')
        
        // Fetch org name and subscription status for trainers
        if (profile?.organization_id && profile?.role !== 'super_admin') {
          const { data: org } = await supabase
            .from('organizations')
            .select('name, subscription_status, trial_ends_at')
            .eq('id', profile.organization_id)
            .single()
          if (org?.name) {
            setOrgName(org.name)
          }
          if (org?.subscription_status === 'trialing') {
            setIsTrialing(true)
            if (org?.trial_ends_at) {
              const trialEnd = new Date(org.trial_ends_at)
              const now = new Date()
              const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
              setTrialDaysLeft(daysLeft)
            }
          }
        }
      }
    }
    checkRole()
  }, [supabase])
  
  const navItems = isSuperAdmin && !isImpersonating ? superAdminNavItems : trainerNavItems

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleBackToPlatform = async () => {
    // Clear impersonation cookie via API
    await fetch('/api/impersonate', { method: 'DELETE' })
    sessionStorage.removeItem('impersonating_org')
    router.push('/platform')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40">
      {/* Back to Platform button when impersonating */}
      {isImpersonating && (
        <button
          onClick={handleBackToPlatform}
          className="flex items-center gap-2 px-4 py-3 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors border-b border-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Platform</span>
        </button>
      )}
      
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <Link href={isSuperAdmin && !isImpersonating ? "/platform" : "/dashboard"} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
            <span className="text-black font-bold">
              {isImpersonating ? impersonatedOrgName.charAt(0).toUpperCase() : orgName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-bold text-white truncate max-w-[140px]">
              {isImpersonating ? impersonatedOrgName : (isSuperAdmin ? 'CMPD' : orgName)}
            </h1>
            <p className="text-xs text-zinc-500">
              {isImpersonating ? 'Viewing as Trainer' : (isSuperAdmin ? 'Platform Admin' : 'Trainer Portal')}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade Banner for Trial Users */}
      {isTrialing && !isSuperAdmin && !isImpersonating && (
        <div className="p-4 border-t border-zinc-800">
          <Link
            href="/billing"
            className="block p-3 bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border border-yellow-400/30 rounded-xl hover:border-yellow-400/50 transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">Trial · {trialDaysLeft} days</span>
            </div>
            <p className="text-xs text-zinc-400">
              Pick a plan to continue · <span className="text-yellow-400">Billing</span>
            </p>
          </Link>
        </div>
      )}

      {/* Theme Toggle & Sign Out */}
      <div className="p-4 border-t border-zinc-800 space-y-2">
        {mounted && (
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-5 h-5" />
                <span className="font-medium">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5" />
                <span className="font-medium">Dark Mode</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
