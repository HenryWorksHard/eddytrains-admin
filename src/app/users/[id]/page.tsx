'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Check, 
  Dumbbell, 
  Heart, 
  Zap,
  Mail,
  Calendar,
  Clock,
  Shield,
  Edit2,
  Key,
  User as UserIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  status: string | null
  temp_password: string | null
  password_changed: boolean | null
  created_at: string
  updated_at: string
}

interface ClientProgram {
  id: string
  program_id: string
  start_date: string
  end_date: string | null
  duration_weeks: number
  is_active: boolean
  program: {
    id: string
    name: string
    category: string
    difficulty: string
    duration_weeks: number
  } | null
}

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params.id as string
  // Support both email and UUID - decode if it's a URL-encoded email
  const userId = decodeURIComponent(rawId)
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState({
    strength: false,
    cardio: false,
    hyrox: false,
  })

  useEffect(() => {
    fetchUser()
  }, [userId])
  
  // Fetch client programs after we have the user (need actual UUID)
  useEffect(() => {
    if (user?.id) {
      fetchClientPrograms(user.id)
    }
  }, [user?.id])

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return
      }
      
      setUser(data.user)
      setFullName(data.user.full_name || '')
      setEmail(data.user.email || '')
      setPermissions({
        strength: data.user.user_permissions?.[0]?.can_access_strength || false,
        cardio: data.user.user_permissions?.[0]?.can_access_cardio || false,
        hyrox: data.user.user_permissions?.[0]?.can_access_hyrox || false,
      })
    } catch (err) {
      setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const fetchClientPrograms = async (userUuid: string) => {
    try {
      const { data, error } = await supabase
        .from('client_programs')
        .select(`
          id,
          program_id,
          start_date,
          end_date,
          duration_weeks,
          is_active,
          program:programs (id, name, category, difficulty, duration_weeks)
        `)
        .eq('client_id', userUuid)
        .order('start_date', { ascending: false })
      
      if (error) throw error
      // Transform data - Supabase returns program as array, we need single object
      const transformed = (data || []).map(cp => ({
        ...cp,
        program: Array.isArray(cp.program) ? cp.program[0] : cp.program
      }))
      setClientPrograms(transformed)
    } catch (err) {
      console.error('Failed to fetch client programs:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          permissions
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to update user')
        return
      }

      setSuccess(true)
      setEditMode(false)
      fetchUser() // Refresh data
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to delete user')
        setDeleting(false)
        return
      }

      router.push('/users')
      router.refresh()
    } catch (err) {
      setError('Failed to delete user')
      setDeleting(false)
    }
  }

  const permissionOptions = [
    { key: 'strength', name: 'Strength Training', icon: Dumbbell, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { key: 'cardio', name: 'Cardio', icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' },
    { key: 'hyrox', name: 'HYROX', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ]

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'strength': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'cardio': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'hyrox': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner': return 'bg-green-500/10 text-green-400'
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-400'
      case 'advanced': return 'bg-red-500/10 text-red-400'
      default: return 'bg-zinc-500/10 text-zinc-400'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl">
        <Link href="/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">User not found</h2>
          <p className="text-zinc-400">This user may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 mb-6">
          <Check className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">User updated successfully!</p>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black text-3xl font-bold flex-shrink-0">
            {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {editMode ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-2xl font-bold bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Full Name"
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">{user.full_name || 'No name set'}</h1>
              )}
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
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {editMode ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Email"
                  />
                ) : (
                  <span>{user.email}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                <span className="text-xs font-mono text-zinc-500">ID: {user.id.slice(0, 8)}...</span>
              </div>
            </div>

            {user.temp_password && !user.password_changed && (
              <div className="mt-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-zinc-400">Temp Password:</span>
                <code className="bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-400 font-mono">
                  {user.temp_password}
                </code>
              </div>
            )}
          </div>

          {/* Edit Button */}
          <div className="flex-shrink-0">
            {editMode ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditMode(false)
                    setFullName(user.full_name || '')
                    setEmail(user.email || '')
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permissions Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Program Access</h2>
          </div>
          
          <div className="space-y-3">
            {permissionOptions.map((perm) => {
              const hasAccess = permissions[perm.key as keyof typeof permissions]
              return (
                <div
                  key={perm.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    editMode 
                      ? 'cursor-pointer hover:border-zinc-600' 
                      : ''
                  } ${
                    hasAccess
                      ? 'bg-zinc-800/50 border-zinc-700'
                      : 'bg-zinc-900/50 border-zinc-800'
                  }`}
                  onClick={() => editMode && setPermissions(prev => ({ ...prev, [perm.key]: !hasAccess }))}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasAccess ? perm.bg : 'bg-zinc-800'}`}>
                    <perm.icon className={`w-5 h-5 ${hasAccess ? perm.color : 'text-zinc-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${hasAccess ? 'text-white' : 'text-zinc-500'}`}>
                      {perm.name}
                    </p>
                  </div>
                  {hasAccess ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="text-xs text-zinc-600">No access</span>
                  )}
                </div>
              )
            })}
          </div>
          {editMode && (
            <p className="text-xs text-zinc-500 mt-3">Click to toggle access</p>
          )}
        </div>

        {/* Quick Stats Card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{clientPrograms.length}</p>
              <p className="text-sm text-zinc-400">Total Programs</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{clientPrograms.filter(p => p.is_active).length}</p>
              <p className="text-sm text-zinc-400">Active</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))}
              </p>
              <p className="text-sm text-zinc-400">Days as Client</p>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {Object.values(permissions).filter(Boolean).length}
              </p>
              <p className="text-sm text-zinc-400">Access Types</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Programs */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Assigned Programs</h2>
          </div>
          <Link
            href={`/schedules?client=${user?.id || userId}`}
            className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            Manage in Schedules →
          </Link>
        </div>
        
        {clientPrograms.length > 0 ? (
          <div className="space-y-3">
            {clientPrograms.map((cp) => (
              <div
                key={cp.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  cp.is_active 
                    ? 'bg-yellow-400/5 border-yellow-400/20' 
                    : 'bg-zinc-800/30 border-zinc-800'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(cp.program?.category)}`}>
                  {cp.program?.category?.toLowerCase() === 'strength' && <Dumbbell className="w-6 h-6" />}
                  {cp.program?.category?.toLowerCase() === 'cardio' && <Heart className="w-6 h-6" />}
                  {cp.program?.category?.toLowerCase() === 'hyrox' && <Zap className="w-6 h-6" />}
                  {!['strength', 'cardio', 'hyrox'].includes(cp.program?.category?.toLowerCase() || '') && <Dumbbell className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white">{cp.program?.name || 'Unknown Program'}</p>
                    {cp.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-400/20 text-yellow-400 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(cp.program?.difficulty)}`}>
                      {cp.program?.difficulty || 'Unknown'}
                    </span>
                    <span>{cp.duration_weeks || cp.program?.duration_weeks || '?'} weeks</span>
                    <span>•</span>
                    <span>Started {new Date(cp.start_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="text-right text-sm">
                  {cp.end_date && (
                    <>
                      <p className="text-zinc-400">Ends</p>
                      <p className="text-white">{new Date(cp.end_date).toLocaleDateString()}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Dumbbell className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-2">No programs assigned yet</p>
            <Link
              href={`/schedules?client=${user?.id || userId}`}
              className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Assign a program →
            </Link>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-red-500/20 mt-6">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Deleting this user will remove their account and move them to the inactive list in Klaviyo.
          This action cannot be undone.
        </p>
        
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete User
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Confirm Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
