'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Dumbbell, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Trophy,
  Play,
  Square
} from 'lucide-react'
import Link from 'next/link'

interface ExerciseSet {
  id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_seconds?: number
  weight_type?: string
  notes: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  order_index: number
  exercise_sets: ExerciseSet[]
}

interface Workout {
  id: string
  name: string
  program_workouts: {
    id: string
    name: string
  }
}

interface SetLog {
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
}

interface Client1RM {
  exercise_name: string
  weight_kg: number
}

export default function CoachSessionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const clientId = params.id as string
  const workoutId = params.workoutId as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workout, setWorkout] = useState<{ name: string; programName: string } | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [client1RMs, setClient1RMs] = useState<Map<string, number>>(new Map())
  const [clientName, setClientName] = useState('')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [setLogs, setSetLogs] = useState<Map<string, SetLog>>(new Map()) // key: exerciseId-setNumber
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [clientProgramId, setClientProgramId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [clientId, workoutId])

  async function fetchData() {
    setLoading(true)

    // Get client name
    const { data: clientData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', clientId)
      .single()
    
    if (clientData) setClientName(clientData.full_name || 'Client')

    // Get workout details
    const { data: workoutData } = await supabase
      .from('program_workouts')
      .select(`
        id,
        name,
        programs (
          id,
          name
        ),
        workout_exercises (
          id,
          exercise_name,
          order_index,
          exercise_sets (
            id,
            set_number,
            reps,
            intensity_type,
            intensity_value,
            rest_seconds,
            weight_type,
            notes
          )
        )
      `)
      .eq('id', workoutId)
      .single()

    if (workoutData) {
      const program = workoutData.programs as any
      setWorkout({
        name: workoutData.name,
        programName: program?.name || ''
      })
      
      // Sort exercises by order_index and sets by set_number
      const sortedExercises = (workoutData.workout_exercises || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((ex: any) => ({
          ...ex,
          exercise_sets: (ex.exercise_sets || []).sort((a: any, b: any) => a.set_number - b.set_number)
        }))
      
      setExercises(sortedExercises)
      
      // Auto-expand first exercise
      if (sortedExercises.length > 0) {
        setExpandedExercise(sortedExercises[0].id)
      }
    }

    // Get client's 1RMs for suggested weights
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg')
      .eq('client_id', clientId)

    if (rmData) {
      const rmMap = new Map(rmData.map(rm => [rm.exercise_name, rm.weight_kg]))
      setClient1RMs(rmMap)
    }

    // Get client's active program assignment for this workout
    const { data: clientPrograms } = await supabase
      .from('client_programs')
      .select('id, program_id')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (clientPrograms && clientPrograms.length > 0) {
      // Find which program contains this workout
      const { data: workoutProgram } = await supabase
        .from('program_workouts')
        .select('program_id')
        .eq('id', workoutId)
        .single()

      if (workoutProgram) {
        const matchingProgram = clientPrograms.find(cp => cp.program_id === workoutProgram.program_id)
        if (matchingProgram) {
          setClientProgramId(matchingProgram.id)
        }
      }
    }

    setLoading(false)
  }

  const calculateSuggestedWeight = (exerciseName: string, intensityType: string, intensityValue: string): number | null => {
    const oneRM = client1RMs.get(exerciseName)
    if (!oneRM) return null

    if (intensityType === 'percentage') {
      const percentage = parseFloat(intensityValue) / 100
      return Math.round(oneRM * percentage * 2) / 2 // Round to nearest 0.5
    }
    
    if (intensityType === 'rpe') {
      // Rough RPE to percentage conversion
      const rpe = parseFloat(intensityValue)
      const percentage = 0.5 + (rpe / 20) // RPE 10 = ~100%, RPE 6 = ~80%
      return Math.round(oneRM * percentage * 2) / 2
    }

    return null
  }

  const getSetKey = (exerciseId: string, setNumber: number) => `${exerciseId}-${setNumber}`

  const updateSetLog = (exerciseId: string, setNumber: number, field: 'weight_kg' | 'reps_completed', value: number | null) => {
    const key = getSetKey(exerciseId, setNumber)
    setSetLogs(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(key) || { set_number: setNumber, weight_kg: null, reps_completed: null }
      newMap.set(key, { ...existing, [field]: value })
      return newMap
    })
  }

  const markExerciseComplete = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const newSet = new Set(prev)
      newSet.add(exerciseId)
      return newSet
    })

    // Auto-expand next incomplete exercise
    const currentIndex = exercises.findIndex(e => e.id === exerciseId)
    for (let i = currentIndex + 1; i < exercises.length; i++) {
      if (!completedExercises.has(exercises[i].id)) {
        setExpandedExercise(exercises[i].id)
        return
      }
    }
  }

  const completeSession = async () => {
    if (!clientProgramId) {
      alert('No active program found for this client')
      return
    }

    setSaving(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      // Create workout completion record
      const { data: completion, error: completionError } = await supabase
        .from('workout_completions')
        .insert({
          client_id: clientId,
          workout_id: workoutId,
          client_program_id: clientProgramId,
          scheduled_date: today,
          completed_at: new Date().toISOString()
        })
        .select()
        .single()

      if (completionError) throw completionError

      // Create workout log
      const { data: workoutLog, error: logError } = await supabase
        .from('workout_logs')
        .insert({
          client_id: clientId,
          workout_id: workoutId,
          completed_at: new Date().toISOString(),
          notes: 'Coached session'
        })
        .select()
        .single()

      if (logError) throw logError

      // Save all set logs
      const setLogsToInsert: any[] = []
      
      for (const exercise of exercises) {
        for (const set of exercise.exercise_sets) {
          const key = getSetKey(exercise.id, set.set_number)
          const log = setLogs.get(key)
          
          if (log && (log.weight_kg !== null || log.reps_completed !== null)) {
            setLogsToInsert.push({
              workout_log_id: workoutLog.id,
              workout_exercise_id: exercise.id,
              set_number: set.set_number,
              weight_kg: log.weight_kg,
              reps_completed: log.reps_completed
            })
          }
        }
      }

      if (setLogsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('set_logs')
          .insert(setLogsToInsert)

        if (setsError) throw setsError
      }

      // Update client's 1RMs if any new PRs
      for (const exercise of exercises) {
        const exerciseLogs = Array.from(setLogs.entries())
          .filter(([key]) => key.startsWith(exercise.id))
          .map(([_, log]) => log)
          .filter(log => log.weight_kg && log.reps_completed)

        if (exerciseLogs.length > 0) {
          const bestSet = exerciseLogs.reduce((best, log) => {
            const estimated1RM = (log.weight_kg || 0) * (1 + (log.reps_completed || 0) / 30)
            const bestEstimated = (best.weight_kg || 0) * (1 + (best.reps_completed || 0) / 30)
            return estimated1RM > bestEstimated ? log : best
          })

          const current1RM = client1RMs.get(exercise.exercise_name) || 0
          const newEstimated1RM = (bestSet.weight_kg || 0) * (1 + (bestSet.reps_completed || 0) / 30)

          if (newEstimated1RM > current1RM) {
            await supabase
              .from('client_1rms')
              .upsert({
                client_id: clientId,
                exercise_name: exercise.exercise_name,
                weight_kg: Math.round(newEstimated1RM * 2) / 2,
                updated_at: new Date().toISOString()
              }, { onConflict: 'client_id,exercise_name' })
          }
        }
      }

      setSessionComplete(true)
    } catch (err) {
      console.error('Failed to save session:', err)
      alert('Failed to save session. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Session Complete!</h1>
          <p className="text-zinc-400 mb-6">
            Workout logged for {clientName}. All data has been saved to their account.
          </p>
          <Link
            href={`/users/${clientId}?tab=progress`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
          >
            View Client Progress
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/users/${clientId}?tab=schedule`}
          className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{workout?.name}</h1>
          <p className="text-zinc-500 text-sm">
            Coaching session for {clientName}
          </p>
        </div>
        {sessionStarted && (
          <button
            onClick={completeSession}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Complete
          </button>
        )}
      </div>

      {/* Start Session Button */}
      {!sessionStarted && (
        <div className="card p-8 text-center mb-6">
          <Dumbbell className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Ready to Coach?</h2>
          <p className="text-zinc-400 mb-6">
            {exercises.length} exercises • {exercises.reduce((sum, e) => sum + e.exercise_sets.length, 0)} sets total
          </p>
          <button
            onClick={() => setSessionStarted(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
          >
            <Play className="w-5 h-5" />
            Start Session
          </button>
        </div>
      )}

      {/* Exercise List */}
      {sessionStarted && (
        <div className="space-y-4">
          {exercises.map((exercise, index) => {
            const isExpanded = expandedExercise === exercise.id
            const isComplete = completedExercises.has(exercise.id)
            const suggested = calculateSuggestedWeight(
              exercise.exercise_name,
              exercise.exercise_sets[0]?.intensity_type || '',
              exercise.exercise_sets[0]?.intensity_value || ''
            )

            return (
              <div 
                key={exercise.id} 
                className={`card overflow-hidden transition-all ${isComplete ? 'opacity-60' : ''}`}
              >
                {/* Exercise Header */}
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isComplete 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-400/10 text-yellow-400'
                    }`}>
                      {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white">{exercise.exercise_name}</p>
                      <p className="text-xs text-zinc-500">
                        {exercise.exercise_sets.length} sets
                        {suggested && ` • Suggested: ${suggested}kg`}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                  )}
                </button>

                {/* Sets */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800">
                    <div className="space-y-3 mt-4">
                      {exercise.exercise_sets.map((set) => {
                        const key = getSetKey(exercise.id, set.set_number)
                        const log = setLogs.get(key) || { set_number: set.set_number, weight_kg: null, reps_completed: null }
                        
                        return (
                          <div key={set.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl p-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">
                              {set.set_number}
                            </div>
                            
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              {/* Weight Input */}
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase">Weight (kg)</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  placeholder={suggested?.toString() || '0'}
                                  value={log.weight_kg ?? ''}
                                  onChange={(e) => updateSetLog(exercise.id, set.set_number, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                              </div>
                              
                              {/* Reps Input */}
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase">Reps (target: {set.reps})</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  placeholder={set.reps}
                                  value={log.reps_completed ?? ''}
                                  onChange={(e) => updateSetLog(exercise.id, set.set_number, 'reps_completed', e.target.value ? parseInt(e.target.value) : null)}
                                  className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                              </div>
                            </div>

                            {/* Set info */}
                            <div className="text-right text-xs text-zinc-500 w-16">
                              {set.intensity_type === 'percentage' && `${set.intensity_value}%`}
                              {set.intensity_type === 'rpe' && `RPE ${set.intensity_value}`}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mark Complete Button */}
                    {!isComplete && (
                      <button
                        onClick={() => markExerciseComplete(exercise.id)}
                        className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Mark Exercise Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Complete Session Button */}
          <button
            onClick={completeSession}
            disabled={saving || completedExercises.size === 0}
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Complete Session ({completedExercises.size}/{exercises.length} exercises)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
