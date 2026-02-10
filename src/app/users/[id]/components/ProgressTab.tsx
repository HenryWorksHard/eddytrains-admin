'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Trophy, Flame, Dumbbell, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

interface ProgressTabProps {
  clientId: string
}

interface OneRMRecord {
  exercise_name: string
  weight_kg: number
  updated_at: string
}

interface PersonalRecord {
  exercise_name: string
  weight_kg: number
  reps: number
  estimated_1rm: number
  achieved_at: string
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_workout_date: string
}

interface WorkoutLog {
  id: string
  workout_id: string
  completed_at: string
  duration_minutes: number | null
  rating: number | null
  difficulty: string | null
  notes: string | null
  workout_name?: string
}

interface SetLog {
  exercise_name: string
  set_number: number
  reps_completed: number
  weight_kg: number
}

export default function ProgressTab({ clientId }: ProgressTabProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [oneRMs, setOneRMs] = useState<OneRMRecord[]>([])
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([])
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [logSets, setLogSets] = useState<Record<string, SetLog[]>>({})
  const [weeklyVolume, setWeeklyVolume] = useState<{ week: string; volume: number }[]>([])

  useEffect(() => {
    fetchProgressData()
  }, [clientId])

  async function fetchProgressData() {
    setLoading(true)

    // Fetch 1RMs
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', clientId)
      .order('weight_kg', { ascending: false })

    if (rmData) setOneRMs(rmData)

    // Fetch Personal Records
    const { data: prData } = await supabase
      .from('personal_records')
      .select('exercise_name, weight_kg, reps, estimated_1rm, achieved_at')
      .eq('client_id', clientId)
      .order('estimated_1rm', { ascending: false })

    if (prData) setPersonalRecords(prData)

    // Fetch Streak
    const { data: streakData } = await supabase
      .from('client_streaks')
      .select('current_streak, longest_streak, last_workout_date')
      .eq('client_id', clientId)
      .single()

    if (streakData) setStreak(streakData)

    // Fetch Recent Workout Logs (last 20)
    const { data: logData } = await supabase
      .from('workout_logs')
      .select(`
        id,
        workout_id,
        completed_at,
        duration_minutes,
        rating,
        difficulty,
        notes
      `)
      .eq('client_id', clientId)
      .order('completed_at', { ascending: false })
      .limit(20)

    if (logData) {
      // Get workout names
      const workoutIds = logData.map(l => l.workout_id)
      const { data: workouts } = await supabase
        .from('program_workouts')
        .select('id, name')
        .in('id', workoutIds)

      const workoutMap = new Map(workouts?.map(w => [w.id, w.name]) || [])
      
      setWorkoutLogs(logData.map(log => ({
        ...log,
        workout_name: workoutMap.get(log.workout_id) || 'Workout'
      })))
    }

    // Calculate weekly volume (last 8 weeks)
    const { data: volumeData } = await supabase
      .from('set_logs')
      .select(`
        weight_kg,
        reps_completed,
        workout_log_id,
        workout_logs!inner(client_id, completed_at)
      `)
      .eq('workout_logs.client_id', clientId)
      .gte('workout_logs.completed_at', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString())

    if (volumeData) {
      // Group by week and sum volume
      const weeklyMap = new Map<string, number>()
      volumeData.forEach((set: any) => {
        const date = new Date(set.workout_logs.completed_at)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = weekStart.toISOString().split('T')[0]
        const volume = (set.weight_kg || 0) * (set.reps_completed || 0)
        weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + volume)
      })

      const sortedWeeks = Array.from(weeklyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, volume]) => ({ week, volume: Math.round(volume) }))

      setWeeklyVolume(sortedWeeks)
    }

    setLoading(false)
  }

  async function fetchLogSets(logId: string) {
    if (logSets[logId]) return

    const { data } = await supabase
      .from('set_logs')
      .select(`
        set_number,
        reps_completed,
        weight_kg,
        workout_exercises!inner(exercise_name)
      `)
      .eq('workout_log_id', logId)
      .order('set_number')

    if (data) {
      setLogSets(prev => ({
        ...prev,
        [logId]: data.map((s: any) => ({
          exercise_name: s.workout_exercises.exercise_name,
          set_number: s.set_number,
          reps_completed: s.reps_completed,
          weight_kg: s.weight_kg
        }))
      }))
    }
  }

  const toggleLog = (logId: string) => {
    if (expandedLog === logId) {
      setExpandedLog(null)
    } else {
      setExpandedLog(logId)
      fetchLogSets(logId)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const maxVolume = Math.max(...weeklyVolume.map(w => w.volume), 1)

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

      {/* Weekly Volume Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Weekly Volume (kg)
        </h3>
        {weeklyVolume.length > 0 ? (
          <div className="flex items-end gap-2 h-32">
            {weeklyVolume.map((week, i) => (
              <div key={week.week} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-green-500/80 rounded-t transition-all"
                  style={{ height: `${(week.volume / maxVolume) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-zinc-500">W{i + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No volume data yet</p>
        )}
      </div>

      {/* Personal Records */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Personal Records
        </h3>
        {personalRecords.length > 0 ? (
          <div className="space-y-2">
            {personalRecords.slice(0, 10).map((pr) => (
              <div key={pr.exercise_name} className="flex items-center justify-between bg-zinc-800 rounded-xl p-3">
                <div>
                  <p className="font-medium text-white">{pr.exercise_name}</p>
                  <p className="text-sm text-zinc-500">
                    {pr.weight_kg}kg × {pr.reps} reps
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-400">~{pr.estimated_1rm}kg</p>
                  <p className="text-xs text-zinc-500">est. 1RM</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No personal records yet</p>
        )}
      </div>

      {/* Workout History */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          Recent Workouts
        </h3>
        {workoutLogs.length > 0 ? (
          <div className="space-y-2">
            {workoutLogs.map((log) => (
              <div key={log.id} className="bg-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleLog(log.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/50 transition-colors"
                >
                  <div className="text-left">
                    <p className="font-medium text-white">{log.workout_name}</p>
                    <p className="text-sm text-zinc-500">
                      {new Date(log.completed_at).toLocaleDateString()} 
                      {log.duration_minutes && ` • ${log.duration_minutes} min`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.rating && (
                      <span className="text-yellow-400">{'★'.repeat(log.rating)}</span>
                    )}
                    {log.difficulty && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        log.difficulty === 'too_easy' ? 'bg-green-500/20 text-green-400' :
                        log.difficulty === 'just_right' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {log.difficulty.replace('_', ' ')}
                      </span>
                    )}
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </button>
                
                {expandedLog === log.id && (
                  <div className="px-4 pb-4 border-t border-zinc-700">
                    {log.notes && (
                      <p className="text-sm text-zinc-400 mt-3 mb-3">{log.notes}</p>
                    )}
                    {logSets[log.id] ? (
                      <div className="space-y-1 mt-3">
                        {logSets[log.id].map((set, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-zinc-400">{set.exercise_name}</span>
                            <span className="text-white">
                              {set.weight_kg}kg × {set.reps_completed}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-sm mt-3">Loading...</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">No workout history yet</p>
        )}
      </div>
    </div>
  )
}
