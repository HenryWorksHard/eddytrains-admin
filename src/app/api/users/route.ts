import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    
    // Get all profiles (non-admin users)
    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
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
    const { email, full_name, permissions } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    const tempPassword = generateTempPassword()
    const adminClient = getAdminClient()
    
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
        role: 'user',
        is_active: true,
        must_change_password: true,
        password_changed: false,
        temp_password: tempPassword,
        status: 'pending',
        // Permissions embedded directly
        can_access_strength: permissions?.strength || false,
        can_access_cardio: permissions?.cardio || false,
        can_access_hyrox: permissions?.hyrox || false
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
