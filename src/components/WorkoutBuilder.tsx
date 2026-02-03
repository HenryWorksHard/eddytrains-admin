'use client'

import { useState } from 'react'
import { Plus, Minus, Trash2, GripVertical, Dumbbell, ChevronDown, ChevronUp, Copy, Settings2, Layers } from 'lucide-react'
import ExerciseSelector from './ExerciseSelector'
import exercisesData from '@/data/exercises.json'

interface ExerciseSet {
  id: string
  setNumber: number
  reps: string
  intensityType: 'percentage' | 'rir' | 'rpe'
  intensityValue: string
  restSeconds: number
  restBracket: string
  weightType: string
  notes: string
}

const weightTypes = [
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'freeweight', label: 'Freeweight (DB/BB)' },
  { id: 'machine', label: 'Machine' },
  { id: 'cable', label: 'Cable' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'weight_belt', label: 'Weight Belt' },
  { id: 'smith_machine', label: 'Smith Machine' },
  { id: 'plate_loaded', label: 'Plate Loaded' },
  { id: 'resistance_band', label: 'Resistance Band' },
  { id: 'medicine_ball', label: 'Medicine Ball' },
  { id: 'trx', label: 'TRX/Suspension' },
]

const restBrackets = [
  { value: '30-60', label: '30-60s' },
  { value: '60-90', label: '60-90s' },
  { value: '90-120', label: '90-120s' },
  { value: '120-180', label: '2-3min' },
  { value: '180-300', label: '3-5min' },
]

function getDefaultWeightType(exerciseId: string): string {
  const exercise = exercisesData.exercises.find((e: { id: string }) => e.id === exerciseId)
  if (!exercise) return 'freeweight'
  
  const equipment = exercise.equipment || []
  
  if (equipment.includes('barbell')) return 'plate_loaded'
  if (equipment.includes('smith')) return 'smith_machine'
  if (equipment.includes('dumbbell')) return 'freeweight'
  if (equipment.includes('cable')) return 'cable'
  if (equipment.includes('machine')) return 'machine'
  if (equipment.includes('kettlebell')) return 'kettlebell'
  if (equipment.includes('bands')) return 'resistance_band'
  if (equipment.includes('trx')) return 'trx'
  if (equipment.includes('medicineball')) return 'medicine_ball'
  if (equipment.includes('bodyweight') || equipment.includes('pullupbar')) return 'bodyweight'
  
  return 'freeweight'
}

interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  category: string
  order: number
  sets: ExerciseSet[]
  notes: string
  supersetGroup?: string
}

export interface Workout {
  id: string
  name: string
  dayOfWeek: number | null
  order: number
  exercises: WorkoutExercise[]
  notes: string
}

interface WorkoutBuilderProps {
  workouts: Workout[]
  onChange: (workouts: Workout[]) => void
}

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const intensityTypes = exercisesData.intensityTypes

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function createDefaultSet(setNumber: number, weightType: string = 'freeweight'): ExerciseSet {
  return {
    id: generateId(),
    setNumber,
    reps: '8-12',
    intensityType: 'rir',
    intensityValue: '2',
    restSeconds: 90,
    restBracket: '90-120',
    weightType,
    notes: '',
  }
}

export default function WorkoutBuilder({ workouts, onChange }: WorkoutBuilderProps) {
  const [showExerciseSelector, setShowExerciseSelector] = useState<string | null>(null)
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set(workouts.map(w => w.id)))
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set())

  const addWorkout = () => {
    const newWorkout: Workout = {
      id: generateId(),
      name: `Workout ${workouts.length + 1}`,
      dayOfWeek: null,
      order: workouts.length,
      exercises: [],
      notes: '',
    }
    onChange([...workouts, newWorkout])
    setExpandedWorkouts(prev => new Set([...prev, newWorkout.id]))
  }

  const duplicateWorkout = (workout: Workout) => {
    const newWorkout: Workout = {
      ...workout,
      id: generateId(),
      name: `${workout.name} (Copy)`,
      order: workouts.length,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        id: generateId(),
        sets: ex.sets.map(s => ({ ...s, id: generateId() })),
      })),
    }
    onChange([...workouts, newWorkout])
    setExpandedWorkouts(prev => new Set([...prev, newWorkout.id]))
  }

  const updateWorkout = (workoutId: string, updates: Partial<Workout>) => {
    onChange(workouts.map(w => w.id === workoutId ? { ...w, ...updates } : w))
  }

  const deleteWorkout = (workoutId: string) => {
    onChange(workouts.filter(w => w.id !== workoutId))
  }

  const addExercise = (workoutId: string, exercise: { id: string; name: string; category: string }) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const defaultWeightType = getDefaultWeightType(exercise.id)

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      order: workout.exercises.length,
      sets: [
        createDefaultSet(1, defaultWeightType),
        createDefaultSet(2, defaultWeightType),
        createDefaultSet(3, defaultWeightType),
      ],
      notes: '',
    }

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, newExercise],
    })
    setShowExerciseSelector(null)
  }

  const addSuperset = (workoutId: string, exercises: { id: string; name: string; category: string }[]) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout || exercises.length < 2) return

    const supersetGroupId = `superset_${generateId()}`
    
    const newExercises: WorkoutExercise[] = exercises.map((exercise, index) => {
      const defaultWeightType = getDefaultWeightType(exercise.id)
      return {
        id: generateId(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        order: workout.exercises.length + index,
        sets: [
          createDefaultSet(1, defaultWeightType),
          createDefaultSet(2, defaultWeightType),
          createDefaultSet(3, defaultWeightType),
        ],
        notes: '',
        supersetGroup: supersetGroupId,
      }
    })

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, ...newExercises],
    })
    setShowExerciseSelector(null)
  }

  const updateExercise = (workoutId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      ),
    })
  }

  const deleteExercise = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.filter(ex => ex.id !== exerciseId),
    })
  }

  const deleteSuperset = (workoutId: string, supersetGroup: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.filter(ex => ex.supersetGroup !== supersetGroup),
    })
  }

  const updateAllSets = (workoutId: string, exerciseId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => ({ ...s, ...updates })),
    })
  }

  const setSetCount = (workoutId: string, exerciseId: string, count: number) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise || count < 1 || count > 10) return

    const currentCount = exercise.sets.length
    const weightType = exercise.sets[0]?.weightType || 'freeweight'
    
    if (count > currentCount) {
      const lastSet = exercise.sets[exercise.sets.length - 1]
      const newSets = [...exercise.sets]
      for (let i = currentCount; i < count; i++) {
        newSets.push({
          ...createDefaultSet(i + 1, weightType),
          reps: lastSet?.reps || '8-12',
          intensityType: lastSet?.intensityType || 'rir',
          intensityValue: lastSet?.intensityValue || '2',
          restBracket: lastSet?.restBracket || '90-120',
          weightType: lastSet?.weightType || weightType,
        })
      }
      updateExercise(workoutId, exerciseId, { sets: newSets })
    } else {
      updateExercise(workoutId, exerciseId, {
        sets: exercise.sets.slice(0, count).map((s, i) => ({ ...s, setNumber: i + 1 })),
      })
    }
  }

  const updateSet = (workoutId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => s.id === setId ? { ...s, ...updates } : s),
    })
  }

  const toggleWorkoutExpanded = (workoutId: string) => {
    setExpandedWorkouts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(workoutId)) {
        newSet.delete(workoutId)
      } else {
        newSet.add(workoutId)
      }
      return newSet
    })
  }

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises(prev => {
      const newSet = new Set(prev)
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId)
      } else {
        newSet.add(exerciseId)
      }
      return newSet
    })
  }

  // Group exercises by superset
  const groupExercises = (exercises: WorkoutExercise[]) => {
    const groups: { type: 'single' | 'superset'; exercises: WorkoutExercise[]; supersetGroup?: string }[] = []
    const processedSupersets = new Set<string>()

    exercises.forEach(exercise => {
      if (exercise.supersetGroup) {
        if (!processedSupersets.has(exercise.supersetGroup)) {
          processedSupersets.add(exercise.supersetGroup)
          const supersetExercises = exercises.filter(ex => ex.supersetGroup === exercise.supersetGroup)
          groups.push({ type: 'superset', exercises: supersetExercises, supersetGroup: exercise.supersetGroup })
        }
      } else {
        groups.push({ type: 'single', exercises: [exercise] })
      }
    })

    return groups
  }

  const renderExerciseCard = (workout: Workout, exercise: WorkoutExercise, exerciseIndex: number, isSuperset: boolean = false) => {
    const isExpanded = expandedExercises.has(exercise.id)
    const firstSet = exercise.sets[0]

    return (
      <div key={exercise.id} className="p-3">
        <div className="flex items-center gap-3">
          {!isSuperset && (
            <div className="text-zinc-600 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <span className="text-zinc-500 text-sm font-mono w-6">{exerciseIndex + 1}</span>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSuperset ? 'bg-yellow-400/20' : 'bg-zinc-700'}`}>
            <Dumbbell className={`w-5 h-5 ${isSuperset ? 'text-yellow-400' : 'text-zinc-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate">{exercise.exerciseName}</h4>
            <span className="text-xs text-zinc-500 capitalize">{exercise.category}</span>
          </div>
          {!isSuperset && (
            <button
              onClick={() => deleteExercise(workout.id, exercise.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Edit Row */}
        <div className={`mt-3 flex flex-wrap items-center gap-3 ${isSuperset ? 'pl-10' : 'pl-[72px]'}`}>
          {/* Set Count */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 mr-1">Sets</span>
            <button
              onClick={() => setSetCount(workout.id, exercise.id, exercise.sets.length - 1)}
              className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              disabled={exercise.sets.length <= 1}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-white font-medium">{exercise.sets.length}</span>
            <button
              onClick={() => setSetCount(workout.id, exercise.id, exercise.sets.length + 1)}
              className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              disabled={exercise.sets.length >= 10}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="w-px h-6 bg-zinc-700" />

          {/* Reps */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Reps</span>
            <input
              type="text"
              value={firstSet?.reps || '8-12'}
              onChange={(e) => updateAllSets(workout.id, exercise.id, { reps: e.target.value })}
              className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="8-12"
            />
          </div>

          {/* Intensity */}
          <div className="flex items-center gap-1">
            <select
              value={firstSet?.intensityType || 'rir'}
              onChange={(e) => updateAllSets(workout.id, exercise.id, { 
                intensityType: e.target.value as ExerciseSet['intensityType'] 
              })}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              {intensityTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={firstSet?.intensityValue || '2'}
              onChange={(e) => updateAllSets(workout.id, exercise.id, { intensityValue: e.target.value })}
              className="w-12 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          {/* Rest */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Rest</span>
            <select
              value={firstSet?.restBracket || '90-120'}
              onChange={(e) => updateAllSets(workout.id, exercise.id, { 
                restBracket: e.target.value,
                restSeconds: parseInt(e.target.value.split('-')[0]) || 90
              })}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              {restBrackets.map(bracket => (
                <option key={bracket.value} value={bracket.value}>{bracket.label}</option>
              ))}
            </select>
          </div>

          {/* Weight Type */}
          <div className="flex items-center gap-1">
            <select
              value={firstSet?.weightType || 'freeweight'}
              onChange={(e) => updateAllSets(workout.id, exercise.id, { weightType: e.target.value })}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              {weightTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Expand for individual editing */}
          <button
            onClick={() => toggleExerciseExpanded(exercise.id)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-yellow-400 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{isExpanded ? 'Hide' : 'Edit'} sets</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Individual Sets Table */}
        {isExpanded && (
          <div className={`mt-3 border-t border-zinc-800 ${isSuperset ? 'ml-10' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase">
                  <th className="px-3 py-2 text-left w-16">Set</th>
                  <th className="px-3 py-2 text-left">Reps</th>
                  <th className="px-3 py-2 text-left">Weight Type</th>
                  <th className="px-3 py-2 text-left">Intensity</th>
                  <th className="px-3 py-2 text-left">Rest</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                  <tr key={set.id} className="border-t border-zinc-800/50">
                    <td className="px-3 py-2">
                      <span className="text-zinc-400 font-mono">{set.setNumber}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={set.reps}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { reps: e.target.value })}
                        className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={set.weightType || 'freeweight'}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { weightType: e.target.value })}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {weightTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <select
                          value={set.intensityType}
                          onChange={(e) => updateSet(workout.id, exercise.id, set.id, { 
                            intensityType: e.target.value as ExerciseSet['intensityType'] 
                          })}
                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        >
                          {intensityTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={set.intensityValue}
                          onChange={(e) => updateSet(workout.id, exercise.id, set.id, { intensityValue: e.target.value })}
                          className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={set.restBracket || '90-120'}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { 
                          restBracket: e.target.value,
                          restSeconds: parseInt(e.target.value.split('-')[0]) || 90
                        })}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {restBrackets.map(bracket => (
                          <option key={bracket.value} value={bracket.value}>{bracket.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={set.notes}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { notes: e.target.value })}
                        className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        placeholder="Set notes..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {workouts.map((workout) => (
        <div key={workout.id} className="card overflow-hidden">
          {/* Workout Header */}
          <div 
            className="flex items-center gap-4 p-4 bg-zinc-800/50 cursor-pointer"
            onClick={() => toggleWorkoutExpanded(workout.id)}
          >
            <div className="text-zinc-600 cursor-grab">
              <GripVertical className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={workout.name}
                onChange={(e) => updateWorkout(workout.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded px-2 -ml-2"
                placeholder="Workout Name"
              />
              <div className="flex items-center gap-4 mt-1">
                <select
                  value={workout.dayOfWeek ?? ''}
                  onChange={(e) => updateWorkout(workout.id, { 
                    dayOfWeek: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm bg-transparent text-zinc-400 focus:outline-none"
                >
                  <option value="">No specific day</option>
                  {daysOfWeek.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
                <span className="text-sm text-zinc-500">
                  {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); duplicateWorkout(workout) }}
                className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="Duplicate workout"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id) }}
                className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {expandedWorkouts.has(workout.id) ? (
                <ChevronUp className="w-5 h-5 text-zinc-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-zinc-500" />
              )}
            </div>
          </div>

          {/* Workout Content */}
          {expandedWorkouts.has(workout.id) && (
            <div className="p-4 space-y-4">
              {/* Exercises - grouped by superset */}
              {groupExercises(workout.exercises).map((group, groupIndex) => {
                if (group.type === 'superset') {
                  return (
                    <div 
                      key={group.supersetGroup} 
                      className="bg-yellow-400/5 border-2 border-yellow-400/30 rounded-xl overflow-hidden"
                    >
                      {/* Superset Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-yellow-400/10 border-b border-yellow-400/20">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-400">
                            Superset ({group.exercises.length} exercises)
                          </span>
                        </div>
                        <button
                          onClick={() => deleteSuperset(workout.id, group.supersetGroup!)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Superset Exercises */}
                      <div className="divide-y divide-yellow-400/10">
                        {group.exercises.map((exercise, exIndex) => (
                          renderExerciseCard(workout, exercise, workout.exercises.indexOf(exercise), true)
                        ))}
                      </div>
                    </div>
                  )
                } else {
                  const exercise = group.exercises[0]
                  return (
                    <div key={exercise.id} className="bg-zinc-800/30 border border-zinc-800 rounded-xl overflow-hidden">
                      {renderExerciseCard(workout, exercise, workout.exercises.indexOf(exercise), false)}
                    </div>
                  )
                }
              })}

              {/* Add Exercise Button */}
              <button
                onClick={() => setShowExerciseSelector(workout.id)}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-700 hover:border-yellow-400/50 rounded-xl text-zinc-400 hover:text-yellow-400 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Add Exercise</span>
              </button>

              {/* Workout Notes */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Workout Notes</label>
                <textarea
                  value={workout.notes}
                  onChange={(e) => updateWorkout(workout.id, { notes: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  rows={2}
                  placeholder="Add notes for this workout..."
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add Workout Button */}
      <button
        onClick={addWorkout}
        className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-zinc-700 hover:border-yellow-400 rounded-xl text-zinc-400 hover:text-yellow-400 transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-yellow-400/10 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5" />
        </div>
        <span className="font-medium">Add Workout Day</span>
      </button>

      {/* Exercise Selector Modal */}
      {showExerciseSelector && (
        <ExerciseSelector
          onSelect={(exercise) => addExercise(showExerciseSelector, exercise)}
          onSelectSuperset={(exercises) => addSuperset(showExerciseSelector, exercises)}
          onClose={() => setShowExerciseSelector(null)}
          allowSuperset={true}
        />
      )}
    </div>
  )
}
