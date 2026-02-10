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
    const { workoutLogId, sets } = await request.json()

    if (!workoutLogId || !sets) {
      return NextResponse.json({ error: 'Missing workoutLogId or sets' }, { status: 400 })
    }

    // Update or insert each set
    for (const set of sets) {
      if (set.weight_kg !== null || set.reps_completed !== null) {
        // Upsert the set log
        const { error } = await supabaseAdmin
          .from('set_logs')
          .upsert({
            workout_log_id: workoutLogId,
            exercise_id: set.exercise_id,
            set_number: set.set_number,
            weight_kg: set.weight_kg,
            reps_completed: set.reps_completed
          }, {
            onConflict: 'workout_log_id,exercise_id,set_number'
          })

        if (error) {
          console.error('Error upserting set_log:', error)
          // If upsert fails, try delete + insert
          await supabaseAdmin
            .from('set_logs')
            .delete()
            .eq('workout_log_id', workoutLogId)
            .eq('exercise_id', set.exercise_id)
            .eq('set_number', set.set_number)

          await supabaseAdmin
            .from('set_logs')
            .insert({
              workout_log_id: workoutLogId,
              exercise_id: set.exercise_id,
              set_number: set.set_number,
              weight_kg: set.weight_kg,
              reps_completed: set.reps_completed
            })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error updating workout:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
