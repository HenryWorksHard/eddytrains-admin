import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveOrgId, IMPERSONATION_COOKIE } from '@/lib/org-context'

// Admin client with service role for user management
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

// Generate a random temp password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Send to Klaviyo
async function sendToKlaviyo(email: string, name: string, tempPassword: string) {
  const apiKey = process.env.KLAVIYO_API_KEY
  const listId = process.env.KLAVIYO_LIST_ID
  
  if (!apiKey || !listId) {
    console.log('Klaviyo not configured - skipping')
    return { success: true, skipped: true }
  }

  try {
    // Create/update profile
    const profileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'Content-Type': 'application/json',
        'revision': '2024-02-15'
      },
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email,
            first_name: name || email.split('@')[0],
            properties: {
              temp_password: tempPassword,
              login_url: 'https://app.cmpdcollective.com/login',
              account_type: 'fitness_client'
            }
          }
        }
      })
    })

    let profileId: string | null = null

    if (profileResponse.status === 409) {
      const existingData = await profileResponse.json()
      profileId = existingData.errors?.[0]?.meta?.duplicate_profile_id
      
      if (profileId) {
        await fetch(`https://a.klaviyo.com/api/profiles/${profileId}/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'Content-Type': 'application/json',
            'revision': '2024-02-15'
          },
          body: JSON.stringify({
            data: {
              type: 'profile',
              id: profileId,
              attributes: {
                properties: {
                  temp_password: tempPassword,
                  login_url: 'https://app.cmpdcollective.com/login'
                }
              }
            }
          })
        })
      }
    } else if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      profileId = profileData.data.id
    }

    // Add to list
    if (profileId) {
      await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
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

export async function GET() {
  try {
    const adminClient = getAdminClient()
    
    // Get effective organization (handles impersonation for super admins)
    const organizationId = await getEffectiveOrgId()
    if (!organizationId) {
      return NextResponse.json({ users: [] })
    }
    
    // Get only client profiles for this organization
    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    
    if (error) throw error

    // Get auth users for email addresses
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    
    const usersWithEmail = profiles?.map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || 'Unknown',
        last_sign_in: authUser?.last_sign_in_at
      }
    }) || []
    
    return NextResponse.json({ users: usersWithEmail })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()
    
    // Verify this is a client (not admin/trainer)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (!profile || profile.role !== 'client') {
      return NextResponse.json({ error: 'Can only delete client accounts' }, { status: 403 })
    }
    
    // Delete from auth (this will cascade to profile via trigger or we delete manually)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (authError) {
      console.error('Auth delete error:', authError)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
    
    // Also delete profile explicitly (in case no cascade)
    await adminClient.from('profiles').delete().eq('id', userId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

// Generate unique slug from name or email
async function generateSlug(adminClient: ReturnType<typeof getAdminClient>, name: string | null, email: string): Promise<string> {
  let base = name || email.split('@')[0]
  base = base.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20)
  
  if (!base) base = 'user'
  
  // Check existing slugs
  const { data } = await adminClient
    .from('profiles')
    .select('slug')
    .not('slug', 'is', null)
  
  const existingSlugs = new Set((data || []).map(p => p.slug))
  
  let slug = base
  let counter = 1
  while (existingSlugs.has(slug)) {
    slug = `${base}${counter}`
    counter++
  }
  return slug
}

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, permissions, organization_id } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const adminClient = getAdminClient()
    
    // Check client limit if organization_id provided
    if (organization_id) {
      // Get organization's client limit
      const { data: org } = await adminClient
        .from('organizations')
        .select('client_limit, subscription_status')
        .eq('id', organization_id)
        .single()
      
      if (org) {
        // Check subscription status
        if (org.subscription_status === 'canceled' || org.subscription_status === 'past_due') {
          return NextResponse.json({ 
            error: 'Subscription inactive', 
            details: 'Please update your billing to add new clients.',
            upgradeRequired: true
          }, { status: 403 })
        }
        
        // Check client count (only if not unlimited)
        if (org.client_limit !== -1) {
          const { count } = await adminClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization_id)
            .eq('role', 'client')
          
          if (count !== null && count >= org.client_limit) {
            return NextResponse.json({ 
              error: 'Client limit reached', 
              details: `You've reached your limit of ${org.client_limit} clients. Upgrade your plan to add more.`,
              currentCount: count,
              limit: org.client_limit,
              upgradeRequired: true
            }, { status: 403 })
          }
        }
      }
    }
    
    const tempPassword = generateTempPassword()
    
    // Generate unique slug
    const slug = await generateSlug(adminClient, full_name, email)
    
    // Create user with service role (bypasses email confirmation)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email.split('@')[0]
      }
    })
    
    if (createError) {
      console.error('Create user error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    
    // Create profile with embedded permissions
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email,
        slug: slug,
        full_name: full_name || email.split('@')[0],
        role: 'client',
        organization_id: organization_id || null,
        is_active: true,
        must_change_password: true,
        password_changed: false,
        temp_password: tempPassword,
        status: 'pending',
        // Permissions embedded directly
        can_access_strength: permissions?.strength || false,
        can_access_cardio: permissions?.cardio || false,
        can_access_hyrox: permissions?.hyrox || false,
        can_access_hybrid: permissions?.hybrid || false,
        can_access_nutrition: permissions?.nutrition || false
      })
    
    if (profileError) {
      console.error('Profile error:', profileError)
    }
    
    // Send to Klaviyo
    const klaviyoResult = await sendToKlaviyo(email, full_name, tempPassword)
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        slug: slug
      },
      emailSent: klaviyoResult.success && !klaviyoResult.skipped,
      tempPassword: klaviyoResult.skipped ? tempPassword : undefined
    })
    
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
