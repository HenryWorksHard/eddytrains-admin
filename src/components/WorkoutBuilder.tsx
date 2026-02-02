'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, Dumbbell, Info, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import ExerciseSelector from './ExerciseSelector'
import exercisesData from '@/data/exercises.json'

interface ExerciseSet {
  id: string
  setNumber: number
  reps: string
  intensityType: 'percentage' | 'rir' | 'rpe'
  intensityValue: string
  restSeconds: number
  restBracket: string // e.g., "90-120"
  notes: string
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

function createDefaultSet(setNumber: number): ExerciseSet {
  return {
    id: generateId(),
    setNumber,
    reps: '8-12',
    intensityType: 'rir',
    intensityValue: '2',
    restSeconds: 90,
    restBracket: '90-120',
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

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      order: workout.exercises.length,
      sets: [createDefaultSet(1), createDefaultSet(2), createDefaultSet(3)],
      notes: '',
    }

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, newExercise],
    })
    setExpandedExercises(prev => new Set([...prev, newExercise.id]))
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

  const addSet = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    const newSet = createDefaultSet(exercise.sets.length + 1)
    updateExercise(workoutId, exerciseId, {
      sets: [...exercise.sets, newSet],
    })
  }

  const updateSet = (workoutId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => s.id === setId ? { ...s, ...updates } : s),
    })
  }

  const deleteSet = (workoutId: string, exerciseId: string, setId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.filter(s => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 })),
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

  return (
    <div className="space-y-6">
      {/* Workouts List */}
      {workouts.map((workout, workoutIndex) => (
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
              {/* Exercises */}
              {workout.exercises.map((exercise, exerciseIndex) => (
                <div key={exercise.id} className="bg-zinc-800/30 border border-zinc-800 rounded-xl overflow-hidden">
                  {/* Exercise Header */}
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50"
                    onClick={() => toggleExerciseExpanded(exercise.id)}
                  >
                    <div className="text-zinc-600 cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span className="text-zinc-500 text-sm font-mono w-6">{exerciseIndex + 1}</span>
                    <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{exercise.exerciseName}</h4>
                      <span className="text-xs text-zinc-500 capitalize">{exercise.category}</span>
                    </div>
                    <span className="text-sm text-zinc-500">{exercise.sets.length} sets</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteExercise(workout.id, exercise.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expandedExercises.has(exercise.id) ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>

                  {/* Sets Table */}
                  {expandedExercises.has(exercise.id) && (
                    <div className="border-t border-zinc-800">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-zinc-500 uppercase">
                            <th className="px-3 py-2 text-left w-16">Set</th>
                            <th className="px-3 py-2 text-left">Reps</th>
                            <th className="px-3 py-2 text-left">Intensity</th>
                            <th className="px-3 py-2 text-left w-24">Rest</th>
                            <th className="px-3 py-2 w-10"></th>
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
                                  placeholder="8-12"
                                />
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
                                    className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    placeholder={set.intensityType === 'percentage' ? '75' : '2'}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={set.restBracket || `${set.restSeconds}`}
                                    onChange={(e) => updateSet(workout.id, exercise.id, set.id, { 
                                      restBracket: e.target.value,
                                      restSeconds: parseInt(e.target.value.split('-')[0]) || 90
                                    })}
                                    className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    placeholder="90-120"
                                  />
                                  <span className="text-xs text-zinc-500">sec</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {exercise.sets.length > 1 && (
                                  <button
                                    onClick={() => deleteSet(workout.id, exercise.id, set.id)}
                                    className="p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Add Set Button */}
                      <div className="p-3 border-t border-zinc-800/50">
                        <button
                          onClick={() => addSet(workout.id, exercise.id)}
                          className="text-sm text-zinc-400 hover:text-yellow-400 transition-colors"
                        >
                          + Add Set
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

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
          onClose={() => setShowExerciseSelector(null)}
        />
      )}
    </div>
  )
}
