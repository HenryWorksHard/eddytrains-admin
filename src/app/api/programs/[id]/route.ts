import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify user is authenticated
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

    // Fetch program with all nested data
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .select('*')
      .eq('id', id)
      .single()

    if (programError) {
      console.error('Error fetching program:', programError)
      throw programError
    }

    // Fetch workouts
    const { data: workouts, error: workoutsError } = await supabaseAdmin
      .from('program_workouts')
      .select(`
        *,
        workout_exercises (
          *,
          exercise_sets (*)
        )
      `)
      .eq('program_id', id)
      .order('order_index')

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError)
      throw workoutsError
    }

    return NextResponse.json({ 
      program,
      workouts: workouts || []
    })

  } catch (error) {
    console.error('Error getting program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get program' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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

    // Delete program (should cascade)
    const { error } = await supabaseAdmin
      .from('programs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting program:', error)
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete program' },
      { status: 500 }
    )
  }
}
