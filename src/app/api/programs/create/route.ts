import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, category, difficulty, isActive, workouts } = body

    // 1. Create the program
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        is_active: isActive,
      })
      .select()
      .single()

    if (programError) {
      console.error('Program create error:', programError)
      throw programError
    }

    // 2. Create workouts
    if (workouts && workouts.length > 0 && program) {
      for (const workout of workouts) {
        const { data: workoutData, error: workoutError } = await supabaseAdmin
          .from('program_workouts')
          .insert({
            program_id: program.id,
            name: workout.name,
            day_of_week: workout.dayOfWeek,
            order_index: workout.order,
            notes: workout.notes || null,
            is_emom: workout.isEmom || false,
            emom_interval: workout.emomInterval || null,
          })
          .select()
          .single()

        if (workoutError) {
          console.error('Workout insert error:', workoutError)
          throw workoutError
        }

        // 3. Create workout exercises
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

            // 4. Create exercise sets
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

        // 5. Create finisher (sub-workout) if exists
        if (workout.finisher && workoutData) {
          const { data: finisherData, error: finisherError } = await supabaseAdmin
            .from('program_workouts')
            .insert({
              program_id: program.id,
              parent_workout_id: workoutData.id,
              name: workout.finisher.name,
              category: workout.finisher.category,
              order_index: 0,
              notes: workout.finisher.notes || null,
            })
            .select()
            .single()

          if (finisherError) {
            console.error('Finisher insert error:', finisherError)
            throw finisherError
          }

          // Create finisher exercises
          if (workout.finisher.exercises?.length > 0 && finisherData) {
            for (const exercise of workout.finisher.exercises) {
              const { data: exerciseData, error: exerciseError } = await supabaseAdmin
                .from('workout_exercises')
                .insert({
                  workout_id: finisherData.id,
                  exercise_id: exercise.exerciseId,
                  exercise_name: exercise.exerciseName,
                  order_index: exercise.order,
                  notes: exercise.notes || null,
                })
                .select()
                .single()

              if (exerciseError) {
                console.error('Finisher exercise insert error:', exerciseError)
                throw exerciseError
              }

              // Create finisher exercise sets
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
                  console.error('Finisher sets insert error:', setsError)
                  throw setsError
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, programId: program.id })

  } catch (error) {
    console.error('Error creating program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create program' },
      { status: 500 }
    )
  }
}
