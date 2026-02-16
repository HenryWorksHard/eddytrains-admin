import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Resolve slug or UUID to user ID
async function resolveUserId(adminClient: ReturnType<typeof getAdminClient>, identifier: string) {
  // If it's a UUID (has dashes and is 36 chars), use directly
  if (identifier.includes('-') && identifier.length === 36) {
    return identifier
  }
  
  // Otherwise, look up by slug
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('slug', identifier)
    .single()
  
  return profile?.id || null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdOrSlug = searchParams.get('userId') || searchParams.get('slug')
  const secret = searchParams.get('secret')
  
  // Simple auth check for debug endpoint
  if (secret !== 'henrydebug2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  if (!userIdOrSlug) {
    return NextResponse.json({ error: 'userId or slug required' }, { status: 400 })
  }
  
  const adminClient = getAdminClient()
  
  // Resolve to UUID
  const userId = await resolveUserId(adminClient, userIdOrSlug)
  
  if (!userId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  
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
  
  // Also get active programs to understand the context
  const { data: activePrograms } = await adminClient
    .from('client_programs')
    .select('id, program_id, start_date, is_active')
    .eq('client_id', userId)
    .eq('is_active', true)
  
  return NextResponse.json({ 
    userId,
    activePrograms: activePrograms || [],
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
  const userIdOrSlug = searchParams.get('userId') || searchParams.get('slug')
  const date = searchParams.get('date') // YYYY-MM-DD format
  const secret = searchParams.get('secret')
  
  // Simple auth check for debug endpoint
  if (secret !== 'henrydebug2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const adminClient = getAdminClient()
  
  // Option 1: Delete by completion ID
  if (completionId) {
    const { error } = await adminClient
      .from('workout_completions')
      .delete()
      .eq('id', completionId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, deleted: completionId })
  }
  
  // Option 2: Delete by user + date (delete ALL completions for that date)
  if (userIdOrSlug && date) {
    const userId = await resolveUserId(adminClient, userIdOrSlug)
    
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const { data: deleted, error } = await adminClient
      .from('workout_completions')
      .delete()
      .eq('client_id', userId)
      .eq('scheduled_date', date)
      .select()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, deletedCount: deleted?.length || 0, deleted })
  }
  
  return NextResponse.json({ error: 'Provide either id, or userId+date' }, { status: 400 })
}
