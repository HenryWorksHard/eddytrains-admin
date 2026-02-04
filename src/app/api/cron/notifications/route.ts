import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// This cron job runs daily to:
// 1. Check for users who missed workouts in the last 7 days
// 2. Update streak information
// 3. Detect new PRs from recent workout logs
// 4. Create notifications for admins

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'fitness-cron-secret-2026'

export async function GET(request: Request) {
  // Check authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      missedWorkouts: 0,
      streaksUpdated: 0,
      prsDetected: 0,
      notificationsCreated: 0,
    }

    // 1. Get all active users with their workout schedules
    const { data: activeUsers } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'user')
      .eq('is_active', true)

    if (!activeUsers || activeUsers.length === 0) {
      return NextResponse.json({ message: 'No active users found', results })
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // 2. Check for missed workouts (users with active programs but no workout in 3+ days)
    for (const user of activeUsers) {
      // Check if user has an active program
      const { data: activeProgram } = await supabaseAdmin
        .from('client_programs')
        .select('id')
        .eq('client_id', user.id)
        .eq('is_active', true)
        .single()

      if (!activeProgram) continue // Skip users without active programs

      // Get last workout completion
      const { data: lastWorkout } = await supabaseAdmin
        .from('workout_completions')
        .select('scheduled_date, completed_at')
        .eq('client_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      let daysSinceWorkout = 999
      if (lastWorkout?.completed_at) {
        const lastDate = new Date(lastWorkout.completed_at)
        daysSinceWorkout = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Check if we already have a recent notification for this user
      const { data: existingNotification } = await supabaseAdmin
        .from('admin_notifications')
        .select('id')
        .eq('client_id', user.id)
        .eq('type', 'missed_workout')
        .eq('is_dismissed', false)
        .gte('created_at', sevenDaysAgoStr)
        .single()

      // Create notification if 3+ days without workout and no recent notification
      if (daysSinceWorkout >= 3 && !existingNotification) {
        const displayName = user.full_name || user.email?.split('@')[0] || 'User'
        
        await supabaseAdmin.from('admin_notifications').insert({
          client_id: user.id,
          type: 'missed_workout',
          title: `${displayName} hasn't worked out`,
          message: daysSinceWorkout >= 999 
            ? `${displayName} has never logged a workout`
            : `${displayName} hasn't logged a workout in ${daysSinceWorkout} days`,
          metadata: { days_missed: daysSinceWorkout },
        })
        results.missedWorkouts++
        results.notificationsCreated++
      }

      // 3. Update streak information
      await updateUserStreak(user.id, lastWorkout?.completed_at)
      results.streaksUpdated++
    }

    // 4. Check for new PRs from recent set_logs
    const { data: recentLogs } = await supabaseAdmin
      .from('set_logs')
      .select(`
        id,
        reps_completed,
        weight_kg,
        workout_log_id,
        workout_logs!inner(client_id, completed_at),
        exercise_id,
        workout_exercises!inner(exercise_name)
      `)
      .gte('created_at', sevenDaysAgoStr)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)

    if (recentLogs && recentLogs.length > 0) {
      // Group by user and exercise
      const prCandidates = new Map<string, { userId: string, exerciseName: string, weight: number, reps: number, estimated1rm: number }>()
      
      for (const log of recentLogs) {
        // @ts-expect-error - complex join types
        const userId = log.workout_logs?.client_id
        // @ts-expect-error - complex join types
        const exerciseName = log.workout_exercises?.exercise_name
        const weight = log.weight_kg
        const reps = log.reps_completed

        if (!userId || !exerciseName || !weight || !reps) continue

        // Calculate estimated 1RM using Brzycki formula
        const estimated1rm = weight * (36 / (37 - reps))
        const key = `${userId}-${exerciseName}`
        
        const existing = prCandidates.get(key)
        if (!existing || estimated1rm > existing.estimated1rm) {
          prCandidates.set(key, { userId, exerciseName, weight, reps, estimated1rm })
        }
      }

      // Check each candidate against existing PRs
      for (const [key, candidate] of prCandidates) {
        const { data: existingPR } = await supabaseAdmin
          .from('personal_records')
          .select('id, estimated_1rm')
          .eq('client_id', candidate.userId)
          .eq('exercise_name', candidate.exerciseName)
          .single()

        const isNewPR = !existingPR || candidate.estimated1rm > (existingPR.estimated_1rm || 0)

        if (isNewPR) {
          // Upsert the PR
          await supabaseAdmin.from('personal_records').upsert({
            client_id: candidate.userId,
            exercise_name: candidate.exerciseName,
            weight_kg: candidate.weight,
            reps: candidate.reps,
            estimated_1rm: Math.round(candidate.estimated1rm * 10) / 10,
            achieved_at: new Date().toISOString(),
          }, { onConflict: 'client_id,exercise_name' })

          // Get user info for notification
          const { data: user } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', candidate.userId)
            .single()

          const displayName = user?.full_name || user?.email?.split('@')[0] || 'User'
          const improvement = existingPR?.estimated_1rm 
            ? Math.round((candidate.estimated1rm - existingPR.estimated_1rm) * 10) / 10
            : null

          await supabaseAdmin.from('admin_notifications').insert({
            client_id: candidate.userId,
            type: 'new_pr',
            title: `🏆 ${displayName} hit a new PR!`,
            message: improvement
              ? `${candidate.exerciseName}: ${candidate.weight}kg x ${candidate.reps} (est 1RM: ${Math.round(candidate.estimated1rm)}kg, +${improvement}kg)`
              : `${candidate.exerciseName}: ${candidate.weight}kg x ${candidate.reps} (est 1RM: ${Math.round(candidate.estimated1rm)}kg)`,
            metadata: {
              exercise: candidate.exerciseName,
              weight: candidate.weight,
              reps: candidate.reps,
              estimated_1rm: Math.round(candidate.estimated1rm * 10) / 10,
              previous_1rm: existingPR?.estimated_1rm || null,
            },
          })
          results.prsDetected++
          results.notificationsCreated++
        }
      }
    }

    return NextResponse.json({
      message: 'Cron job completed successfully',
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper function to update user streak
async function updateUserStreak(userId: string, lastWorkoutDate: string | null) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Get current streak record
  const { data: streak } = await supabaseAdmin
    .from('client_streaks')
    .select('*')
    .eq('client_id', userId)
    .single()

  if (!lastWorkoutDate) {
    // No workouts ever - create or reset streak
    if (!streak) {
      await supabaseAdmin.from('client_streaks').insert({
        client_id: userId,
        current_streak: 0,
        longest_streak: 0,
      })
    }
    return
  }

  const lastDate = new Date(lastWorkoutDate).toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (!streak) {
    // Create new streak record
    await supabaseAdmin.from('client_streaks').insert({
      client_id: userId,
      current_streak: lastDate === todayStr || lastDate === yesterdayStr ? 1 : 0,
      longest_streak: 1,
      last_workout_date: lastDate,
      streak_start_date: lastDate,
    })
    return
  }

  // Check if streak continues
  if (lastDate === todayStr || lastDate === yesterdayStr) {
    // Streak continues
    if (lastDate !== streak.last_workout_date) {
      const newStreak = streak.current_streak + 1
      const longestStreak = Math.max(newStreak, streak.longest_streak)

      await supabaseAdmin.from('client_streaks').update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_workout_date: lastDate,
        updated_at: new Date().toISOString(),
      }).eq('client_id', userId)

      // Create milestone notifications
      if ([7, 14, 30, 60, 90, 100].includes(newStreak)) {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', userId)
          .single()

        const displayName = user?.full_name || user?.email?.split('@')[0] || 'User'

        await supabaseAdmin.from('admin_notifications').insert({
          client_id: userId,
          type: 'streak_achieved',
          title: `🔥 ${displayName} reached a ${newStreak}-day streak!`,
          message: `${displayName} has been consistently working out for ${newStreak} days straight. Great consistency!`,
          metadata: { streak_days: newStreak },
        })
      }
    }
  } else {
    // Streak broken - check if we should notify
    if (streak.current_streak >= 7) {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()

      const displayName = user?.full_name || user?.email?.split('@')[0] || 'User'

      // Check for existing streak_lost notification
      const { data: existingNotif } = await supabaseAdmin
        .from('admin_notifications')
        .select('id')
        .eq('client_id', userId)
        .eq('type', 'streak_lost')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .single()

      if (!existingNotif) {
        await supabaseAdmin.from('admin_notifications').insert({
          client_id: userId,
          type: 'streak_lost',
          title: `${displayName} lost their ${streak.current_streak}-day streak`,
          message: `${displayName}'s workout streak of ${streak.current_streak} days has been broken. Consider reaching out to check in.`,
          metadata: { lost_streak: streak.current_streak },
        })
      }
    }

    // Reset streak
    await supabaseAdmin.from('client_streaks').update({
      current_streak: 0,
      last_workout_date: lastDate,
      streak_start_date: null,
      updated_at: new Date().toISOString(),
    }).eq('client_id', userId)
  }
}

// Allow POST as well for testing
export async function POST(request: Request) {
  return GET(request)
}
