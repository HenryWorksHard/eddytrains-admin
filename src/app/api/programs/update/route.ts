import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Create admin client inside handler to ensure env vars are loaded
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Verify user is authenticated and is admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, category, difficulty, durationWeeks, isActive, workouts } = body

    // 1. Update the program
    const { error: programError } = await supabaseAdmin
      .from('programs')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        duration_weeks: durationWeeks,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (programError) {
      console.error('Program update error:', programError)
      throw programError
    }

    // 2. Delete existing workouts (this should cascade to exercises and sets)
    const { error: deleteError } = await supabaseAdmin
      .from('program_workouts')
      .delete()
      .eq('program_id', id)

    if (deleteError) {
      console.error('Delete workouts error:', deleteError)
      throw deleteError
    }

    // 3. Recreate workouts
    if (workouts && workouts.length > 0) {
      for (const workout of workouts) {
        const { data: workoutData, error: workoutError } = await supabaseAdmin
          .from('program_workouts')
          .insert({
            program_id: id,
            name: workout.name,
            day_of_week: workout.dayOfWeek,
            order_index: workout.order,
            notes: workout.notes || null,
          })
          .select()
          .single()

        if (workoutError) {
          console.error('Workout insert error:', workoutError)
          throw workoutError
        }

        // 4. Create workout exercises
        if (workout.exercises?.length > 0 && workoutData) {
          for (const exercise of workout.exercises) {
            const { data: exerciseData, error: exerciseError } = await supabaseAdmin
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

            if (exerciseError) {
              console.error('Exercise insert error:', exerciseError)
              throw exerciseError
            }

            // 5. Create exercise sets
            if (exercise.sets?.length > 0 && exerciseData) {
              const setsToInsert = exercise.sets.map((set: any) => ({
                exercise_id: exerciseData.id,
                set_number: set.setNumber,
                reps: set.reps,
                intensity_type: set.intensityType,
                intensity_value: set.intensityValue,
                rest_seconds: set.restSeconds,
                rest_bracket: set.restBracket || '90-120',
                weight_type: set.weightType || 'freeweight',
                notes: set.notes || null,
              }))

              const { error: setsError } = await supabaseAdmin
                .from('exercise_sets')
                .insert(setsToInsert)

              if (setsError) {
                console.error('Sets insert error:', setsError)
                throw setsError
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update program' },
      { status: 500 }
    )
  }
}
