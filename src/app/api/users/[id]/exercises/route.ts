import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const adminClient = getAdminClient()
    
    // Get client's active programs
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select('program_id')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (!clientPrograms || clientPrograms.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const programIds = clientPrograms.map(cp => cp.program_id)

    // Get all workout exercises from these programs
    const { data: programWorkouts } = await adminClient
      .from('program_workouts')
      .select('id')
      .in('program_id', programIds)

    if (!programWorkouts || programWorkouts.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const workoutIds = programWorkouts.map(pw => pw.id)

    // Get unique exercise names from workout_exercises
    const { data: workoutExercises } = await adminClient
      .from('workout_exercises')
      .select('id, exercise_name')
      .in('workout_id', workoutIds)

    if (!workoutExercises) {
      return NextResponse.json({ exercises: [] })
    }

    // Get unique exercise names with their IDs
    const exerciseMap = new Map<string, string>()
    workoutExercises.forEach(we => {
      if (!exerciseMap.has(we.exercise_name)) {
        exerciseMap.set(we.exercise_name, we.id)
      }
    })

    const exercises = Array.from(exerciseMap.entries()).map(([name, id]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
