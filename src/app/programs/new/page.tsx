'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, ChevronDown } from 'lucide-react'
import WorkoutBuilder, { Workout } from '@/components/WorkoutBuilder'
import { createClient } from '@/lib/supabase/client'

const categories = [
  { value: 'strength', label: 'Strength Training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'recovery', label: 'Recovery' },
]

const difficulties = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function CreateProgramPage() {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Program details
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('strength')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [isActive, setIsActive] = useState(true)

  // Workouts
  const [workouts, setWorkouts] = useState<Workout[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Program name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // 1. Create the program (duration is set per-assignment, not on program)
      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category,
          difficulty,
          is_active: isActive,
        })
        .select()
        .single()

      if (programError) throw programError

      // 2. Create workouts
      if (workouts.length > 0 && program) {
        for (const workout of workouts) {
          const { data: workoutData, error: workoutError } = await supabase
            .from('program_workouts')
            .insert({
              program_id: program.id,
              name: workout.name,
              day_of_week: workout.dayOfWeek,
              order_index: workout.order,
              notes: workout.notes || null,
            })
            .select()
            .single()

          if (workoutError) throw workoutError

          // 3. Create workout exercises
          if (workout.exercises.length > 0 && workoutData) {
            for (const exercise of workout.exercises) {
              const { data: exerciseData, error: exerciseError } = await supabase
                .from('workout_exercises')
                .insert({
                  workout_id: workoutData.id,
                  exercise_id: exercise.exerciseId,
                  exercise_name: exercise.exerciseName,
                  order_index: exercise.order,
                  notes: exercise.notes || null,
                  superset_group: exercise.supersetGroup || null,
                })
                .select()
                .single()

              if (exerciseError) throw exerciseError

              // 4. Create exercise sets
              if (exercise.sets.length > 0 && exerciseData) {
                const setsToInsert = exercise.sets.map(set => ({
                  exercise_id: exerciseData.id,
                  set_number: set.setNumber,
                  reps: set.reps,
                  intensity_type: set.intensityType,
                  intensity_value: set.intensityValue,
                  rest_seconds: set.restSeconds,
                  notes: set.notes || null,
                }))

                const { error: setsError } = await supabase
                  .from('exercise_sets')
                  .insert(setsToInsert)

                if (setsError) throw setsError
              }
            }
          }
        }
      }

      // Success - redirect to programs list
      router.push('/programs')
      router.refresh()

    } catch (err) {
      console.error('Error creating program:', err)
      setError(err instanceof Error ? err.message : 'Failed to create program')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/programs"
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Create Program</h1>
            <p className="text-zinc-400 mt-1">Build a new fitness program with workouts</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black px-6 py-2.5 rounded-xl font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : 'Save Program'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Program Details */}
      <div className="card p-6 space-y-6">
        <h2 className="text-xl font-semibold text-white">Program Details</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Program Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="e.g., 12-Week Strength Builder"
              required
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              rows={3}
              placeholder="Describe the program goals, target audience, and what to expect..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Difficulty
            </label>
            <div className="relative">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                {difficulties.map(diff => (
                  <option key={diff.value} value={diff.value}>{diff.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Active Status */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Status
            </label>
            <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-700/50 transition-colors">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0"
              />
              <span className="text-white">Active (visible to clients)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Workouts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Workouts</h2>
            <p className="text-zinc-400 text-sm mt-1">Add workout days and their exercises</p>
          </div>
          <span className="text-sm text-zinc-500">
            {workouts.length} workout{workouts.length !== 1 ? 's' : ''} • {workouts.reduce((acc, w) => acc + w.exercises.length, 0)} exercises
          </span>
        </div>

        <WorkoutBuilder workouts={workouts} onChange={setWorkouts} />
      </div>
    </form>
  )
}
