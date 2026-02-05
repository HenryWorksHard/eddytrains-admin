import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, orgName, orgSlug } = body;

    // Validate required fields
    if (!email || !password || !fullName || !orgName || !orgSlug) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization slug already taken' },
        { status: 400 }
      );
    }

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Create the organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_id: userId,
        subscription_tier: 'starter',
        subscription_status: 'trialing',
        client_limit: 10,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org error:', orgError);
      // Clean up: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // Update the profile with trainer role and org
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'trainer',
        full_name: fullName,
        organization_id: org.id,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Profile error:', profileError);
      // Note: Not cleaning up here as user/org are created
    }

    return NextResponse.json({
      success: true,
      trainer: {
        id: userId,
        email,
        fullName,
        organization: org,
      },
    });
  } catch (error) {
    console.error('Error creating trainer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
