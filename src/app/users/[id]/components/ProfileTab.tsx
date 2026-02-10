'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Weight, Save, Loader2, Edit2, Camera, User } from 'lucide-react'
import UserProgressGallery from '../UserProgressGallery'

interface ProfileTabProps {
  clientId: string
}

interface Client1RM {
  exercise_name: string
  weight_kg: number
}

interface ClientProfile {
  full_name: string | null
  email: string
  profile_picture_url: string | null
  created_at: string
}

export default function ProfileTab({ clientId }: ProfileTabProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [client1RMs, setClient1RMs] = useState<Client1RM[]>([])
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)

  useEffect(() => {
    fetchData()
  }, [clientId])

  async function fetchData() {
    setLoading(true)
    
    // Fetch profile info
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, profile_picture_url, created_at')
      .eq('id', clientId)
      .single()
    
    if (profileData) setProfile(profileData)
    
    // Fetch 1RMs
    const { data } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg')
      .eq('client_id', clientId)
      .order('exercise_name')

    if (data) setClient1RMs(data)
    setLoading(false)
  }

  const update1RM = (exercise: string, value: string) => {
    setClient1RMs(prev => 
      prev.map(rm => 
        rm.exercise_name === exercise 
          ? { ...rm, weight_kg: parseFloat(value) || 0 }
          : rm
      )
    )
  }

  const save1RMs = async () => {
    setSaving1RM(true)
    
    for (const rm of client1RMs) {
      await supabase
        .from('client_1rms')
        .upsert({
          client_id: clientId,
          exercise_name: rm.exercise_name,
          weight_kg: rm.weight_kg,
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id,exercise_name' })
    }

    setSaving1RM(false)
    setEditing1RM(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Profile Picture</h3>
        </div>
        
        <div className="flex items-center gap-6">
          {profile?.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt={profile.full_name || 'Client'}
              className="w-32 h-32 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <User className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          <div>
            <p className="text-zinc-400 text-sm">
              {profile?.profile_picture_url 
                ? 'Profile picture uploaded by client'
                : 'No profile picture uploaded yet'
              }
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              Clients can update their profile picture in the app
            </p>
          </div>
        </div>
      </div>

      {/* 1RM Board */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Weight className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">1RM Board</h3>
          </div>
          {editing1RM ? (
            <div className="flex gap-2">
              <button
                onClick={save1RMs}
                disabled={saving1RM}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {saving1RM ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={() => {
                  setEditing1RM(false)
                  fetchData()
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing1RM(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {client1RMs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {client1RMs.map((rm) => (
              <div key={rm.exercise_name} className="bg-zinc-800 rounded-xl p-4">
                <p className="text-sm text-zinc-400 mb-1 truncate">{rm.exercise_name}</p>
                {editing1RM ? (
                  <input
                    type="number"
                    value={rm.weight_kg || ''}
                    onChange={(e) => update1RM(rm.exercise_name, e.target.value)}
                    className="w-full text-xl font-bold text-yellow-400 bg-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                ) : (
                  <p className="text-xl font-bold text-yellow-400">{rm.weight_kg} kg</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Weight className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400">No 1RM records yet</p>
            <p className="text-zinc-500 text-sm mt-1">1RMs will appear as the client logs workouts</p>
          </div>
        )}
      </div>

      {/* Progress Pictures */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Camera className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Progress Pictures</h3>
        </div>
        <UserProgressGallery userId={clientId} />
      </div>
    </div>
  )
}
