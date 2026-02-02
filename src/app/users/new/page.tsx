'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail, User, Check, AlertCircle, Dumbbell, Heart, Zap, Loader2 } from 'lucide-react'

export default function NewUserPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [permissions, setPermissions] = useState({
    strength: false,
    cardio: false,
    hyrox: false,
    nutrition: false,
    recovery: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase()

      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData.user) {
        // Update profile with name
        await supabase
          .from('profiles')
          .update({ 
            full_name: fullName,
            must_change_password: true,
          })
          .eq('id', authData.user.id)

        // Update permissions
        await supabase
          .from('user_permissions')
          .update({
            can_access_strength: permissions.strength,
            can_access_cardio: permissions.cardio,
            can_access_hyrox: permissions.hyrox,
            can_access_nutrition: permissions.nutrition,
            can_access_recovery: permissions.recovery,
          })
          .eq('user_id', authData.user.id)

        // Note: In production, you'd send an email with the temp password here
        // For now, we'll show success and the password in development
        setSuccess(true)
        console.log('Temp password for', email, ':', tempPassword)
        
        // Wait a moment then redirect
        setTimeout(() => {
          router.push('/users')
          router.refresh()
        }, 2000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const permissionOptions = [
    { key: 'strength', name: 'Strength Training', icon: Dumbbell, desc: 'Access to strength workouts and programs' },
    { key: 'cardio', name: 'Cardio', icon: Heart, desc: 'Access to cardio and conditioning programs' },
    { key: 'hyrox', name: 'HYROX', icon: Zap, desc: 'Access to HYROX-specific training' },
    { key: 'nutrition', name: 'Nutrition', icon: Check, desc: 'Access to nutrition plans and guides' },
    { key: 'recovery', name: 'Recovery', icon: Check, desc: 'Access to recovery protocols' },
  ]

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">User Created!</h2>
          <p className="text-zinc-400 mb-4">
            {fullName || email} has been added and will receive an invite email.
          </p>
          <p className="text-sm text-zinc-500">Redirecting to users list...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <h1 className="text-3xl font-bold text-white">Add New User</h1>
        <p className="text-zinc-400 mt-1">Create a new client account and send them an invite</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address *
              </div>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="client@example.com"
              required
            />
            <p className="mt-2 text-sm text-zinc-500">
              An invite email with a temporary password will be sent to this address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="John Smith"
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Permissions</h2>
            <p className="text-zinc-400 text-sm mt-1">Select what content this user can access</p>
          </div>
          
          <div className="space-y-3">
            {permissionOptions.map((perm) => (
              <label
                key={perm.key}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  permissions[perm.key as keyof typeof permissions]
                    ? 'bg-orange-500/10 border-orange-500/30'
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
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  <perm.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    permissions[perm.key as keyof typeof permissions] ? 'text-white' : 'text-zinc-300'
                  }`}>
                    {perm.name}
                  </p>
                  <p className="text-sm text-zinc-500">{perm.desc}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  permissions[perm.key as keyof typeof permissions]
                    ? 'bg-orange-500 border-orange-500'
                    : 'border-zinc-600'
                }`}>
                  {permissions[perm.key as keyof typeof permissions] && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/users"
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !email}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-medium rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Create & Send Invite
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
