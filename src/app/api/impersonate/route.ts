import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { IMPERSONATION_COOKIE } from '@/lib/org-context'

// Start impersonation - set cookie
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Verify user is super_admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  
  const { orgId } = await request.json()
  if (!orgId) {
    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
  }
  
  // Verify org exists
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single()
  
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  
  // Set the impersonation cookie
  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, orgId, {
    httpOnly: false, // Allow client-side access for sidebar check
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
  
  return NextResponse.json({ success: true, orgName: org.name })
}

// End impersonation - clear cookie
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)
  
  return NextResponse.json({ success: true })
}
