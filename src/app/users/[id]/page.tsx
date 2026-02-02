'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Loader2, AlertCircle, Check, Dumbbell, Heart, Zap } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  status: string | null
  temp_password: string | null
  password_changed: boolean | null
}

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
    { key: 'strength', name: 'Strength Training', icon: Dumbbell, desc: 'Access to strength workouts' },
    { key: 'cardio', name: 'Cardio', icon: Heart, desc: 'Access to cardio programs' },
    { key: 'hyrox', name: 'HYROX', icon: Zap, desc: 'Access to HYROX training' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl">
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
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <h1 className="text-3xl font-bold text-white">Edit User</h1>
        <p className="text-zinc-400 mt-1">Update user details and permissions</p>
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

      {/* Basic Info */}
      <div className="card p-6 space-y-6 mb-6">
        <h2 className="text-xl font-semibold text-white">Basic Information</h2>
        
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder="user@example.com"
          />
        </div>

        {user.temp_password && !user.password_changed && (
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Temporary Password</label>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-yellow-400 font-mono">
                {user.temp_password}
              </code>
              <span className="badge badge-warning">Not changed yet</span>
            </div>
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="card p-6 space-y-6 mb-6">
        <h2 className="text-xl font-semibold text-white">Program Access</h2>
        
        <div className="space-y-3">
          {permissionOptions.map((perm) => (
            <label
              key={perm.key}
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                permissions[perm.key as keyof typeof permissions]
                  ? 'bg-yellow-400/10 border-yellow-400/30'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="checkbox"
                checked={permissions[perm.key as keyof typeof permissions]}
                onChange={(e) => setPermissions(prev => ({ ...prev, [perm.key]: e.target.checked }))}
                className="sr-only"
              />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                permissions[perm.key as keyof typeof permissions]
                  ? 'bg-yellow-400 text-black'
                  : 'bg-zinc-700 text-zinc-400'
              }`}>
                <perm.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${permissions[perm.key as keyof typeof permissions] ? 'text-white' : 'text-zinc-300'}`}>
                  {perm.name}
                </p>
                <p className="text-sm text-zinc-500">{perm.desc}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                permissions[perm.key as keyof typeof permissions]
                  ? 'bg-yellow-400 border-yellow-400'
                  : 'border-zinc-600'
              }`}>
                {permissions[perm.key as keyof typeof permissions] && (
                  <Check className="w-4 h-4 text-black" />
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-red-500/20">
        <h2 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h2>
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
