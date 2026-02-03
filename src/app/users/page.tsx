'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Search, Filter, Mail, Edit2, Trash2, Key, Clock, Copy, Check, RefreshCw } from 'lucide-react'

interface User {
  id: string
  slug: string | null
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  status: string | null
  temp_password: string | null
  password_changed: boolean | null
  can_access_strength: boolean
  can_access_cardio: boolean
  can_access_hyrox: boolean
  can_access_hybrid: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <button 
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
      title="Copy password"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      setUsers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users</h1>
          <p className="text-zinc-400 mt-1">Manage your fitness clients</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/users/new"
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </Link>
        </div>
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
                  <th>Status</th>
                  <th>Temp Password</th>
                  <th>Joined</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/users/${user.slug || user.id}`} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black font-medium group-hover:ring-2 group-hover:ring-yellow-400/50 transition-all">
                          {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-yellow-400 transition-colors">{user.full_name || 'No name set'}</p>
                          <p className="text-xs text-zinc-500">@{user.slug || user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        {user.email || 'No email'}
                      </div>
                    </td>
                    <td>
                      {user.password_changed ? (
                        <span className="badge badge-success">Active</span>
                      ) : user.status === 'pending' ? (
                        <span className="badge badge-warning flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="badge badge-info">Invited</span>
                      )}
                    </td>
                    <td>
                      {user.temp_password && !user.password_changed ? (
                        <div className="flex items-center gap-2">
                          <code className="bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-400 font-mono">
                            {user.temp_password}
                          </code>
                          <CopyButton text={user.temp_password} />
                        </div>
                      ) : user.password_changed ? (
                        <span className="text-zinc-500 text-xs">Changed</span>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-zinc-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/users/${user.slug || user.id}`}
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
