import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, customMonthlyPrice, maxTrainers, adminEmail, adminPassword, adminFullName } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json({ error: 'Company name and slug are required' }, { status: 400 });
    }

    if (!adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Admin email and password are required' }, { status: 400 });
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingOrg) {
      return NextResponse.json({ error: 'Company slug already taken' }, { status: 400 });
    }

    // Check if email is already in use
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    // Create the company admin user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 });
    }

    // Create the company (organization)
    const { data: company, error: companyError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug: slug.toLowerCase().replace(/\s+/g, '-'),
        owner_id: authData.user.id,
        organization_type: 'company',
        custom_monthly_price: customMonthlyPrice ? parseInt(customMonthlyPrice) : null,
        max_trainers: parseInt(maxTrainers) || 5,
        subscription_status: 'active',
        subscription_tier: 'gym',
        client_limit: -1, // Unlimited for companies
      })
      .select()
      .single();

    if (companyError || !company) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('Company error:', companyError);
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    // Create the company admin profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: adminEmail,
        full_name: adminFullName || name + ' Admin',
        role: 'company_admin',
        company_id: company.id,
        organization_id: company.id,
        is_active: true,
        must_change_password: false,
        password_changed: true,
        status: 'active',
      });

    if (profileError) {
      // Rollback
      await supabaseAdmin.from('organizations').delete().eq('id', company.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'Failed to create admin profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      company,
      message: `Company "${name}" created with admin account ${adminEmail}`,
    });

  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, slug, customMonthlyPrice, maxTrainers } = body;

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/\s+/g, '-');
    if (customMonthlyPrice !== undefined) updates.custom_monthly_price = customMonthlyPrice ? parseInt(customMonthlyPrice) : null;
    if (maxTrainers !== undefined) updates.max_trainers = parseInt(maxTrainers) || 5;

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, company: data });

  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    // Get all users associated with this company
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`company_id.eq.${id},organization_id.eq.${id}`);

    // Delete auth users
    if (users) {
      for (const user of users) {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      }
    }

    // Delete the company (cascades to profiles via FK)
    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Company deleted' });

  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
