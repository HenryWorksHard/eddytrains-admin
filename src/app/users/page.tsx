import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserPlus, Search, Filter, MoreVertical, Mail, Edit2, Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  user_permissions?: {
    can_access_strength: boolean
    can_access_cardio: boolean
    can_access_hyrox: boolean
  }[]
}

async function getUsers(): Promise<User[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      is_active,
      created_at,
      user_permissions (
        can_access_strength,
        can_access_cardio,
        can_access_hyrox
      )
    `)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
  
  return (data as User[]) || []
}

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-zinc-400 mt-1">Manage your fitness clients</p>
        </div>
        <Link
          href="/users/new"
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Add User
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="search"
            placeholder="Search users by name or email..."
            className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors">
          <Filter className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        {users.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black font-medium">
                          {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{user.full_name || 'No name set'}</p>
                          <p className="text-xs text-zinc-500">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        {user.email}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {user.user_permissions?.[0]?.can_access_strength && (
                          <span className="badge badge-info">Strength</span>
                        )}
                        {user.user_permissions?.[0]?.can_access_cardio && (
                          <span className="badge badge-success">Cardio</span>
                        )}
                        {user.user_permissions?.[0]?.can_access_hyrox && (
                          <span className="badge badge-warning">HYROX</span>
                        )}
                        {!user.user_permissions?.[0]?.can_access_strength && 
                         !user.user_permissions?.[0]?.can_access_cardio && 
                         !user.user_permissions?.[0]?.can_access_hyrox && (
                          <span className="text-zinc-500 text-xs">No permissions</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/users/${user.id}`}
                          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No users yet</h3>
            <p className="text-zinc-400 mb-6">Get started by adding your first client</p>
            <Link
              href="/users/new"
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 rounded-xl font-medium transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Add Your First User
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-white">{users.length}</p>
          <p className="text-zinc-400 text-sm">Total Users</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{users.filter(u => u.is_active).length}</p>
          <p className="text-zinc-400 text-sm">Active</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{users.filter(u => !u.is_active).length}</p>
          <p className="text-zinc-400 text-sm">Inactive</p>
        </div>
      </div>
    </div>
  )
}
