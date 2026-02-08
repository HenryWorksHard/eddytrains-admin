import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_1SxHgCBDGilw48s7lrc9Pjox',
  pro: process.env.STRIPE_PRICE_PRO || 'price_1SxHgDBDGilw48s7vI6lQPE6',
  studio: process.env.STRIPE_PRICE_STUDIO || 'price_1SxHgDBDGilw48s7hHTBfSGO',
  gym: process.env.STRIPE_PRICE_GYM || 'price_1SxHgEBDGilw48s7ccmMHgzb',
};

async function stripeRequest(endpoint: string, data: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
  });
  return response.json();
}

export async function POST(req: Request) {
  try {
    const { organizationId, tier, email } = await req.json();

    if (!organizationId || !tier || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      );
    }

    // Check if organization already has a Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', organizationId)
      .single();

    let customerId = org?.stripe_customer_id;

    // Create new customer if needed
    if (!customerId) {
      const customer = await stripeRequest('customers', {
        email,
        'metadata[organization_id]': organizationId,
        'metadata[organization_name]': org?.name || '',
      });
      
      if (customer.error) {
        return NextResponse.json(
          { error: 'Failed to create customer', details: customer.error.message },
          { status: 500 }
        );
      }
      
      customerId = customer.id;

      // Save customer ID to organization
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    // Create checkout session for embedded checkout
    const returnUrl = 'https://eddytrains-admin.vercel.app/billing?session_id={CHECKOUT_SESSION_ID}';
    
    const sessionParams: Record<string, string> = {
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: returnUrl,
      'metadata[organization_id]': organizationId,
      'subscription_data[metadata][organization_id]': organizationId,
    };
    
    console.log('Creating embedded checkout session with params:', JSON.stringify(sessionParams));
    
    const session = await stripeRequest('checkout/sessions', sessionParams);

    if (session.error) {
      console.error('Stripe error:', JSON.stringify(session.error));
      return NextResponse.json(
        { error: 'Failed to create checkout', details: session.error.message, code: session.error.code },
        { status: 500 }
      );
    }

    // Return client_secret for embedded checkout
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
