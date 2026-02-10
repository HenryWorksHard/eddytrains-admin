import { createClient } from '@/lib/supabase/server'
import { Settings, User, Bell, Database, Shield, Image as ImageIcon } from 'lucide-react'
import DangerZone from '@/components/DangerZone'
import LogoUpload from '@/components/LogoUpload'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  // Get current admin user
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  // Get organization for trainers
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('owner_id', user?.id)
    .single()

  // Get some stats for the data section
  const [usersCount, programsCount, completionsCount] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'client'),
    supabase.from('programs').select('id', { count: 'exact' }),
    supabase.from('workout_completions').select('id', { count: 'exact' }),
  ])

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-yellow-400/10 rounded-xl">
          <Settings className="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-zinc-500">Manage your admin account and app settings</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Admin Profile */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Admin Profile</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-zinc-500 mb-1">Email</label>
              <p className="text-white font-medium">{profile?.email || user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-500 mb-1">Name</label>
              <p className="text-white font-medium">{profile?.full_name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-500 mb-1">Role</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-400/10 text-yellow-400 capitalize">
                {profile?.role}
              </span>
            </div>
            <div>
              <label className="block text-sm text-zinc-500 mb-1">Account Status</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                Active
              </span>
            </div>
          </div>
        </section>

        {/* Branding - Logo Upload (trainers only) */}
        {organization && (profile?.role === 'trainer' || profile?.role === 'company_admin') && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <ImageIcon className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Branding</h2>
            </div>
            
            <LogoUpload 
              organizationId={organization.id} 
              currentLogoUrl={organization.logo_url} 
            />
          </section>
        )}

        {/* Notification Settings */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-zinc-800">
              <div>
                <p className="text-white font-medium">Missed Workout Alerts</p>
                <p className="text-sm text-zinc-500">Get notified when clients miss scheduled workouts</p>
              </div>
              <div className="w-12 h-7 bg-yellow-400 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3 border-b border-zinc-800">
              <div>
                <p className="text-white font-medium">New PR Notifications</p>
                <p className="text-sm text-zinc-500">Get notified when clients hit personal records</p>
              </div>
              <div className="w-12 h-7 bg-yellow-400 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </div>
            
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-white font-medium">Streak Milestones</p>
                <p className="text-sm text-zinc-500">Get notified when clients reach streak milestones</p>
              </div>
              <div className="w-12 h-7 bg-yellow-400 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </div>
          </div>
        </section>

        {/* Data Overview */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Data Overview</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{usersCount.count || 0}</p>
              <p className="text-sm text-zinc-500">Total Users</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{programsCount.count || 0}</p>
              <p className="text-sm text-zinc-500">Programs</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{completionsCount.count || 0}</p>
              <p className="text-sm text-zinc-500">Workouts Logged</p>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Security</h2>
          </div>
          
          <div className="space-y-4">
            <button className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors text-left">
              <div>
                <p className="text-white font-medium">Change Password</p>
                <p className="text-sm text-zinc-500">Update your admin password</p>
              </div>
              <span className="text-zinc-500">→</span>
            </button>
            
            <button className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors text-left">
              <div>
                <p className="text-white font-medium">Active Sessions</p>
                <p className="text-sm text-zinc-500">Manage your logged-in devices</p>
              </div>
              <span className="text-zinc-500">→</span>
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <DangerZone />

        {/* App Info */}
        <section className="text-center py-6 text-zinc-600 text-sm">
          <p>CMPD Fitness Admin Portal</p>
          <p>Version 1.0.0</p>
        </section>
      </div>
    </div>
  )
}
