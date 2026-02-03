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
    const { id: userId } = await params
    const adminClient = getAdminClient()
    
    const { data, error } = await adminClient
      .from('client_1rms')
      .select('*')
      .eq('client_id', userId)
    
    if (error) {
      console.error('Error fetching 1RMs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('1RMs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch 1RMs' }, { status: 500 })
  }
}
