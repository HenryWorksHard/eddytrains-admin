import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { COMPLETION_LOOKBACK_DAYS } from '@/lib/constants'

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
    const { id: userId } = await params
    const adminClient = getAdminClient()
    
    // Get user's active programs with workouts (including week_number)
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select(`
        id,
        program_id,
        start_date,
        duration_weeks,
        programs (
          id,
          name,
          program_workouts (
            id,
            name,
            day_of_week,
            week_number,
            parent_workout_id
          )
        )
      `)
      .eq('client_id', userId)
      .eq('is_active', true)

    // Get active client program IDs
    const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

    // Get workout completions for the lookback period, filtered by active programs
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
    
    let completionsQuery = adminClient
      .from('workout_completions')
      .select('workout_id, scheduled_date, client_program_id')
      .eq('client_id', userId)
      .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])
    
    // Only show completions for current active program assignments
    if (activeClientProgramIds.length > 0) {
      completionsQuery = completionsQuery.in('client_program_id', activeClientProgramIds)
    }
    
    const { data: completions } = await completionsQuery

    // Build schedule data with week support
    interface WorkoutSchedule {
      dayOfWeek: number
      workoutId: string
      workoutName: string
      programName: string
      clientProgramId: string
      weekNumber: number
    }

    // Legacy flat structure (week 1 only, for backwards compat)
    const scheduleByDay: Record<number, WorkoutSchedule> = {}
    
    // New structure: scheduleByWeekAndDay[weekNum][dayOfWeek] = WorkoutSchedule[]
    const scheduleByWeekAndDay: Record<number, Record<number, WorkoutSchedule[]>> = {}
    
    let maxWeek = 1
    let earliestProgramStart: string | null = null
    
    // Initialize week 1
    scheduleByWeekAndDay[1] = {}
    for (let i = 0; i < 7; i++) {
      scheduleByWeekAndDay[1][i] = []
    }
    
    if (clientPrograms) {
      for (const cp of clientPrograms) {
        // Track earliest program start date
        if (cp.start_date && (!earliestProgramStart || cp.start_date < earliestProgramStart)) {
          earliestProgramStart = cp.start_date
        }
        
        const programData = cp.programs as unknown
        const program = (Array.isArray(programData) ? programData[0] : programData) as {
          id: string
          name: string
          program_workouts?: { 
            id: string
            name: string
            day_of_week: number | null
            week_number?: number | null
            parent_workout_id?: string | null
          }[]
        } | null
        
        if (program?.program_workouts) {
          for (const workout of program.program_workouts) {
            // Skip child workouts (variations)
            if (workout.parent_workout_id) continue
            
            if (workout.day_of_week !== null) {
              const weekNum = workout.week_number || 1
              maxWeek = Math.max(maxWeek, weekNum)
              
              // Initialize week if needed
              if (!scheduleByWeekAndDay[weekNum]) {
                scheduleByWeekAndDay[weekNum] = {}
                for (let i = 0; i < 7; i++) {
                  scheduleByWeekAndDay[weekNum][i] = []
                }
              }
              
              const workoutData: WorkoutSchedule = {
                dayOfWeek: workout.day_of_week,
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program.name,
                clientProgramId: cp.id,
                weekNumber: weekNum
              }
              
              // Add to week-based structure
              scheduleByWeekAndDay[weekNum][workout.day_of_week].push(workoutData)
              
              // Legacy: only add week 1 to flat scheduleByDay (last one wins for backwards compat)
              if (weekNum === 1) {
                scheduleByDay[workout.day_of_week] = workoutData
              }
            }
          }
        }
      }
    }

    // Format completions with more precise keys
    // Key format: "YYYY-MM-DD:workoutId:clientProgramId" for exact match
    // Also include "YYYY-MM-DD:workoutId" and "YYYY-MM-DD:any" for backwards compatibility
    const completionsByDate: Record<string, string> = {}
    const completionsByDateAndWorkout: Record<string, boolean> = {}
    
    completions?.forEach(c => {
      // Legacy format (just date -> workoutId)
      completionsByDate[c.scheduled_date] = c.workout_id
      
      // Precise format: date:workoutId:clientProgramId
      if (c.client_program_id) {
        completionsByDateAndWorkout[`${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`] = true
      }
      // Fallback format: date:workoutId
      completionsByDateAndWorkout[`${c.scheduled_date}:${c.workout_id}`] = true
      // Any workout on this date
      completionsByDateAndWorkout[`${c.scheduled_date}:any`] = true
    })

    // Debug logging
    const today = new Date().toISOString().split('T')[0]
    const todayCompletions = completions?.filter(c => c.scheduled_date === today) || []
    console.log('[Schedule API Debug]', {
      userId,
      today,
      todayCompletions,
      totalCompletions: completions?.length || 0,
      programStartDate: earliestProgramStart,
      maxWeek,
      activeClientProgramIds
    })

    return NextResponse.json({ 
      scheduleByDay,  // Legacy flat structure
      scheduleByWeekAndDay,  // New week-based structure
      completionsByDate,  // Legacy: date -> workoutId
      completionsByDateAndWorkout,  // New: precise completion tracking
      programStartDate: earliestProgramStart,
      maxWeek,
      // Debug info (can remove later)
      _debug: {
        today,
        todayCompletionsCount: todayCompletions.length,
        todayCompletions: todayCompletions.map(c => ({
          scheduled_date: c.scheduled_date,
          workout_id: c.workout_id,
          client_program_id: c.client_program_id
        }))
      }
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
