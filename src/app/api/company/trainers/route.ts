import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile to check role and company
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = profile.company_id || profile.organization_id
    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }

    const body = await request.json()
    const { email, password, fullName } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Check company's trainer limit
    const { data: company } = await supabaseAdmin
      .from('organizations')
      .select('max_trainers, name')
      .eq('id', companyId)
      .single()

    const { count: currentTrainers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', 'trainer')

    if (company && currentTrainers !== null && currentTrainers >= (company.max_trainers || 5)) {
      return NextResponse.json({ 
        error: `Trainer limit reached (${company.max_trainers}). Contact support to upgrade.` 
      }, { status: 400 })
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 })
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName || null,
        role: 'trainer',
        company_id: companyId,
        organization_id: companyId,
        is_active: true,
        must_change_password: false,
        password_changed: true,
        status: 'active',
      })

    if (profileError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      trainer: {
        id: authData.user.id,
        email,
        full_name: fullName,
      },
      message: `Trainer ${email} created successfully`,
    })

  } catch (error) {
    console.error('Error creating trainer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('id')

    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 400 })
    }

    // Get user's profile to check role and company
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['company_admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const companyId = profile.company_id || profile.organization_id

    // Verify trainer belongs to this company
    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', trainerId)
      .single()

    if (!trainer || trainer.company_id !== companyId) {
      return NextResponse.json({ error: 'Trainer not found in your company' }, { status: 404 })
    }

    // Delete auth user (cascades to profile)
    await supabaseAdmin.auth.admin.deleteUser(trainerId)

    return NextResponse.json({ success: true, message: 'Trainer removed' })

  } catch (error) {
    console.error('Error deleting trainer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
