import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Dumbbell, Calendar, Activity, TrendingUp, UserPlus } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()
  
  // Get counts
  const [usersResult, programsResult, schedulesResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'user'),
    supabase.from('programs').select('id', { count: 'exact' }),
    supabase.from('schedules').select('id', { count: 'exact' }),
  ])

  return {
    totalUsers: usersResult.count || 0,
    totalPrograms: programsResult.count || 0,
    totalSchedules: schedulesResult.count || 0,
  }
}

async function getRecentUsers() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, is_active')
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(5)
  
  return data || []
}

export default async function DashboardPage() {
  const stats = await getStats()
  const recentUsers = await getRecentUsers()

  const statCards = [
    { name: 'Total Users', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-cyan-500', href: '/users' },
    { name: 'Programs', value: stats.totalPrograms, icon: Dumbbell, color: 'from-yellow-400 to-yellow-500', href: '/programs' },
    { name: 'Schedules', value: stats.totalSchedules, icon: Calendar, color: 'from-purple-500 to-pink-500', href: '/schedules' },
    { name: 'Active Today', value: '-', icon: Activity, color: 'from-green-500 to-emerald-500', href: '/users' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
        </div>
        <Link
          href="/users/new"
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Add User
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="card p-6 group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-zinc-400">{stat.name}</p>
          </Link>
        ))}
      </div>

      {/* Recent Users */}
      <div className="card">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Users</h2>
          <Link
            href="/users"
            className="text-sm text-yellow-400 hover:text-yellow-300 font-medium"
          >
            View all →
          </Link>
        </div>
        {recentUsers.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium text-sm">
                          {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{user.full_name || 'No name'}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No users yet. Add your first user to get started.</p>
            <Link
              href="/users/new"
              className="inline-flex items-center gap-2 mt-4 text-yellow-400 hover:text-yellow-300 font-medium"
            >
              <UserPlus className="w-5 h-5" />
              Add User
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/users/new" className="card p-6 group hover:border-yellow-400/50">
          <UserPlus className="w-8 h-8 text-yellow-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">Add New User</h3>
          <p className="text-zinc-400 text-sm">Invite a new client and assign them programs</p>
        </Link>
        <Link href="/programs/new" className="card p-6 group hover:border-yellow-400/50">
          <Dumbbell className="w-8 h-8 text-yellow-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">Create Program</h3>
          <p className="text-zinc-400 text-sm">Build a new workout program for your clients</p>
        </Link>
        <Link href="/schedules/new" className="card p-6 group hover:border-yellow-400/50">
          <Calendar className="w-8 h-8 text-yellow-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">Create Schedule</h3>
          <p className="text-zinc-400 text-sm">Set up weekly workout schedules</p>
        </Link>
      </div>
    </div>
  )
}
