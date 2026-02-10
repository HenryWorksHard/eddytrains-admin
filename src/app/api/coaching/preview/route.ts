import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify trainer is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workoutId = searchParams.get('workoutId')

  if (!workoutId) {
    return NextResponse.json({ error: 'Missing workoutId' }, { status: 400 })
  }

  try {
    // Get workout with exercises and sets
    const { data: workout } = await supabaseAdmin
      .from('program_workouts')
      .select(`
        id,
        name,
        programs (
          name
        ),
        workout_exercises (
          id,
          exercise_name,
          order_index,
          exercise_sets (
            set_number,
            reps,
            intensity_type,
            intensity_value
          )
        )
      `)
      .eq('id', workoutId)
      .single()

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Format exercises with sets
    const exercises = (workout.workout_exercises || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((ex: any) => ({
        name: ex.exercise_name,
        sets: (ex.exercise_sets || [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((set: any) => ({
            set_number: set.set_number,
            reps: set.reps,
            intensity: set.intensity_type === 'percentage' ? `${set.intensity_value}%` :
                       set.intensity_type === 'rpe' ? `RPE ${set.intensity_value}` :
                       set.intensity_type === 'rir' ? `${set.intensity_value} RIR` :
                       set.intensity_value
          }))
      }))

    return NextResponse.json({
      workout: {
        name: workout.name,
        programName: (workout.programs as any)?.name || '',
        exercises
      }
    })
  } catch (err: any) {
    console.error('Error fetching workout preview:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
