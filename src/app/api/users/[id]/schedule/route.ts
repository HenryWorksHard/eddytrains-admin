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
    
    // First pass: determine maxWeek and collect workout data
    const workoutDataList: { weekNum: number; dayOfWeek: number; data: WorkoutSchedule }[] = []
    
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
              
              workoutDataList.push({
                weekNum,
                dayOfWeek: workout.day_of_week,
                data: {
                  dayOfWeek: workout.day_of_week,
                  workoutId: workout.id,
                  workoutName: workout.name,
                  programName: program.name,
                  clientProgramId: cp.id,
                  weekNumber: weekNum
                }
              })
            }
          }
        }
      }
    }
    
    // Initialize ALL weeks from 1 to maxWeek with empty arrays for all 7 days
    // This ensures rest days are properly represented as empty arrays
    for (let w = 1; w <= maxWeek; w++) {
      scheduleByWeekAndDay[w] = {}
      for (let d = 0; d < 7; d++) {
        scheduleByWeekAndDay[w][d] = []
      }
    }
    
    // Now populate with actual workout data
    for (const { weekNum, dayOfWeek, data } of workoutDataList) {
      scheduleByWeekAndDay[weekNum][dayOfWeek].push(data)
      
      // Legacy: only add week 1 to flat scheduleByDay (last one wins for backwards compat)
      if (weekNum === 1) {
        scheduleByDay[dayOfWeek] = data
      }
    }

    // Format completions with STRICT date matching
    // Key format: "YYYY-MM-DD:workoutId:clientProgramId" for exact match
    // This ensures Week 1's completion doesn't show as complete for Week 2
    const completionsByDate: Record<string, string> = {}
    const completionsByDateAndWorkout: Record<string, boolean> = {}
    
    completions?.forEach(c => {
      // Legacy format (just date -> workoutId) - for backwards compat display only
      completionsByDate[c.scheduled_date] = c.workout_id
      
      // Primary: exact match with date, workout, and program
      const keyWithProgram = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
      completionsByDateAndWorkout[keyWithProgram] = true
      
      // Fallback for old completions without client_program_id
      if (!c.client_program_id) {
        completionsByDateAndWorkout[`${c.scheduled_date}:${c.workout_id}`] = true
      }
      // REMOVED: "any" fallback - was too loose and could match wrong workouts
    })

    return NextResponse.json({ 
      scheduleByDay,  // Legacy flat structure
      scheduleByWeekAndDay,  // New week-based structure
      completionsByDate,  // Legacy: date -> workoutId
      completionsByDateAndWorkout,  // New: precise completion tracking
      programStartDate: earliestProgramStart,
      maxWeek
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
