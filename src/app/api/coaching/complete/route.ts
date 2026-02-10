import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Verify trainer is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { 
      clientId, 
      workoutId, 
      clientProgramId, 
      sessionNotes, 
      setLogs,
      exercises 
    } = body

    const today = new Date().toISOString().split('T')[0]

    // Create workout log (with trainer_id)
    const { data: workoutLog, error: logError } = await supabaseAdmin
      .from('workout_logs')
      .insert({
        client_id: clientId,
        workout_id: workoutId,
        completed_at: new Date().toISOString(),
        notes: sessionNotes || null,
        trainer_id: user.id,
        scheduled_date: today
      })
      .select()
      .single()

    if (logError) {
      console.error('workout_logs insert error:', logError)
      return NextResponse.json({ error: `workout_logs: ${logError.message}` }, { status: 500 })
    }

    // Create workout completion record
    const { error: completionError } = await supabaseAdmin
      .from('workout_completions')
      .insert({
        client_id: clientId,
        workout_id: workoutId,
        client_program_id: clientProgramId,
        scheduled_date: today,
        completed_at: new Date().toISOString(),
        workout_log_id: workoutLog.id
      })

    if (completionError) {
      console.error('workout_completions insert error:', completionError)
      return NextResponse.json({ error: `workout_completions: ${completionError.message}` }, { status: 500 })
    }

    // Save set logs
    if (setLogs && setLogs.length > 0) {
      const setLogsToInsert = setLogs.map((log: any) => ({
        workout_log_id: workoutLog.id,
        exercise_id: log.exercise_id,
        set_number: log.set_number,
        weight_kg: log.weight_kg,
        reps_completed: log.reps_completed
      }))

      const { error: setsError } = await supabaseAdmin
        .from('set_logs')
        .insert(setLogsToInsert)

      if (setsError) {
        console.error('set_logs insert error:', setsError)
        return NextResponse.json({ error: `set_logs: ${setsError.message}` }, { status: 500 })
      }
    }

    // Update client's 1RMs if any new PRs
    for (const exercise of exercises || []) {
      const exerciseLogs = setLogs?.filter((l: any) => l.exercise_id === exercise.id && l.weight_kg && l.reps_completed) || []
      
      if (exerciseLogs.length > 0) {
        const bestSet = exerciseLogs.reduce((best: any, log: any) => {
          const estimated1RM = log.weight_kg * (1 + log.reps_completed / 30)
          const bestEstimated = best.weight_kg * (1 + best.reps_completed / 30)
          return estimated1RM > bestEstimated ? log : best
        })

        const { data: current1RM } = await supabaseAdmin
          .from('client_1rms')
          .select('weight_kg')
          .eq('client_id', clientId)
          .eq('exercise_name', exercise.exercise_name)
          .single()

        const currentWeight = current1RM?.weight_kg || 0
        const newEstimated1RM = bestSet.weight_kg * (1 + bestSet.reps_completed / 30)

        if (newEstimated1RM > currentWeight) {
          await supabaseAdmin
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

    return NextResponse.json({ success: true, workoutLogId: workoutLog.id })
  } catch (err: any) {
    console.error('Coaching complete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
