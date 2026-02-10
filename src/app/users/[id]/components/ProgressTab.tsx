'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Flame, Weight, Save, Loader2, Edit2, Camera } from 'lucide-react'
import UserProgressGallery from '../UserProgressGallery'

interface ProgressTabProps {
  clientId: string
}

interface OneRMRecord {
  exercise_name: string
  weight_kg: number
  updated_at: string
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_workout_date: string
}

type TonnagePeriod = 'day' | 'week' | 'month' | 'year'

export default function ProgressTab({ clientId }: ProgressTabProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [oneRMs, setOneRMs] = useState<OneRMRecord[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [tonnage, setTonnage] = useState<number>(0)
  const [tonnagePeriod, setTonnagePeriod] = useState<TonnagePeriod>('week')
  const [loadingTonnage, setLoadingTonnage] = useState(false)
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)
  const [editable1RMs, setEditable1RMs] = useState<{exercise_name: string, weight_kg: number}[]>([])

  useEffect(() => {
    fetchProgressData()
  }, [clientId])

  useEffect(() => {
    fetchTonnage(tonnagePeriod)
  }, [clientId, tonnagePeriod])

  async function fetchProgressData() {
    setLoading(true)

    // Fetch 1RMs
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', clientId)
      .order('weight_kg', { ascending: false })

    if (rmData) setOneRMs(rmData)

    // Fetch Streak via API (bypasses RLS)
    try {
      const streakResponse = await fetch(`/api/users/${clientId}/streak`)
      if (streakResponse.ok) {
        const { streak: streakData } = await streakResponse.json()
        if (streakData) setStreak(streakData)
      }
    } catch (err) {
      console.error('Failed to fetch streak:', err)
    }

    setLoading(false)
  }

  async function fetchTonnage(period: TonnagePeriod) {
    setLoadingTonnage(true)
    
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
    }

    // Fetch set logs with workout logs to calculate tonnage
    const { data: volumeData } = await supabase
      .from('set_logs')
      .select(`
        weight_kg,
        reps_completed,
        workout_log_id,
        workout_logs!inner(client_id, completed_at)
      `)
      .eq('workout_logs.client_id', clientId)
      .gte('workout_logs.completed_at', startDate.toISOString())

    if (volumeData) {
      const totalTonnage = volumeData.reduce((sum: number, set: any) => {
        return sum + ((set.weight_kg || 0) * (set.reps_completed || 0))
      }, 0)
      setTonnage(Math.round(totalTonnage))
    } else {
      setTonnage(0)
    }

    setLoadingTonnage(false)
  }

  const startEditing1RM = () => {
    setEditable1RMs(oneRMs.map(rm => ({ exercise_name: rm.exercise_name, weight_kg: rm.weight_kg })))
    setEditing1RM(true)
  }

  const update1RM = (exercise: string, value: string) => {
    setEditable1RMs(prev => 
      prev.map(rm => 
        rm.exercise_name === exercise 
          ? { ...rm, weight_kg: parseFloat(value) || 0 }
          : rm
      )
    )
  }

  const save1RMs = async () => {
    setSaving1RM(true)
    
    for (const rm of editable1RMs) {
      await supabase
        .from('client_1rms')
        .upsert({
          client_id: clientId,
          exercise_name: rm.exercise_name,
          weight_kg: rm.weight_kg,
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id,exercise_name' })
    }

    // Refresh data
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', clientId)
      .order('weight_kg', { ascending: false })
    if (rmData) setOneRMs(rmData)

    setSaving1RM(false)
    setEditing1RM(false)
  }

  const formatTonnage = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  const getPeriodLabel = (period: TonnagePeriod) => {
    switch (period) {
      case 'day': return 'Today'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'year': return 'This Year'
    }
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
      {/* Streak Card */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Workout Streak
        </h3>
        {streak ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-400">{streak.current_streak}</p>
              <p className="text-sm text-zinc-400">Current Streak</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{streak.longest_streak}</p>
              <p className="text-sm text-zinc-400">Longest Streak</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-lg font-medium text-white">
                {streak.last_workout_date 
                  ? new Date(streak.last_workout_date).toLocaleDateString()
                  : 'Never'}
              </p>
              <p className="text-sm text-zinc-400">Last Workout</p>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">No streak data yet</p>
        )}
      </div>

      {/* Tonnage Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Tonnage
          </h3>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['day', 'week', 'month', 'year'] as TonnagePeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTonnagePeriod(period)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tonnagePeriod === period
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
          {loadingTonnage ? (
            <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto" />
          ) : (
            <>
              <p className="text-4xl font-bold text-green-400">{formatTonnage(tonnage)} kg</p>
              <p className="text-sm text-zinc-400 mt-1">{getPeriodLabel(tonnagePeriod)}</p>
            </>
          )}
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
                onClick={() => setEditing1RM(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startEditing1RM}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {oneRMs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(editing1RM ? editable1RMs : oneRMs).map((rm) => (
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
