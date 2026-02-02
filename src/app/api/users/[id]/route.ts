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

// Move profile to inactive list in Klaviyo
async function moveToInactiveList(email: string) {
  const apiKey = process.env.KLAVIYO_API_KEY
  const activeListId = process.env.KLAVIYO_LIST_ID
  const inactiveListId = process.env.KLAVIYO_INACTIVE_LIST_ID
  
  if (!apiKey) return { success: false, reason: 'No API key' }

  try {
    // First, find the profile
    const searchResponse = await fetch(`https://a.klaviyo.com/api/profiles/?filter=equals(email,"${email}")`, {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2024-02-15'
      }
    })
    
    const searchData = await searchResponse.json()
    const profileId = searchData.data?.[0]?.id
    
    if (!profileId) return { success: false, reason: 'Profile not found' }

    // Remove from active list
    if (activeListId) {
      await fetch(`https://a.klaviyo.com/api/lists/${activeListId}/relationships/profiles/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15'
        },
        body: JSON.stringify({
          data: [{ type: 'profile', id: profileId }]
        })
      })
    }

    // Add to inactive list (if configured)
    if (inactiveListId) {
      await fetch(`https://a.klaviyo.com/api/lists/${inactiveListId}/relationships/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15'
        },
        body: JSON.stringify({
          data: [{ type: 'profile', id: profileId }]
        })
      })
    }

    return { success: true, profileId }
  } catch (error) {
    console.error('Klaviyo error:', error)
    return { success: false, error }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminClient = getAdminClient()
    
    // Get profile
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select(`
        *,
        user_permissions (
          can_access_strength,
          can_access_cardio,
          can_access_hyrox
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get auth user for email
    const { data: authUser } = await adminClient.auth.admin.getUserById(id)
    
    return NextResponse.json({ 
      user: {
        ...profile,
        email: authUser?.user?.email || profile.email || 'Unknown'
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { full_name, email, permissions } = await request.json()
    const adminClient = getAdminClient()
    
    // Update profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name,
        email,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (profileError) throw profileError

    // Update auth user email if changed
    if (email) {
      await adminClient.auth.admin.updateUserById(id, { email })
    }

    // Update permissions
    if (permissions) {
      await adminClient
        .from('user_permissions')
        .upsert({
          user_id: id,
          can_access_strength: permissions.strength || false,
          can_access_cardio: permissions.cardio || false,
          can_access_hyrox: permissions.hyrox || false,
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminClient = getAdminClient()
    
    // Get user email first for Klaviyo
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', id)
      .single()
    
    const { data: authUser } = await adminClient.auth.admin.getUserById(id)
    const email = authUser?.user?.email || profile?.email

    // Move to inactive list in Klaviyo
    if (email) {
      await moveToInactiveList(email)
    }

    // Delete from auth (this should cascade to profiles if FK is set)
    const { error: authError } = await adminClient.auth.admin.deleteUser(id)
    if (authError) throw authError

    // Also delete profile manually in case no cascade
    await adminClient.from('profiles').delete().eq('id', id)
    await adminClient.from('user_permissions').delete().eq('user_id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
