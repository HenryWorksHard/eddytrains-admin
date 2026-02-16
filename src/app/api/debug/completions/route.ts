import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  
  const adminClient = getAdminClient()
  
  // Get completions for this user in Feb 2026
  const { data: completions, error } = await adminClient
    .from('workout_completions')
    .select('*')
    .eq('client_id', userId)
    .gte('scheduled_date', '2026-02-01')
    .lte('scheduled_date', '2026-02-28')
    .order('scheduled_date', { ascending: true })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ 
    count: completions?.length || 0,
    completions: completions?.map(c => ({
      id: c.id,
      scheduled_date: c.scheduled_date,
      workout_id: c.workout_id,
      completed_at: c.completed_at,
      client_program_id: c.client_program_id
    }))
  })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const completionId = searchParams.get('id')
  
  if (!completionId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  
  const adminClient = getAdminClient()
  
  const { error } = await adminClient
    .from('workout_completions')
    .delete()
    .eq('id', completionId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ success: true, deleted: completionId })
}
