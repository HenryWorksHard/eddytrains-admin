import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Price IDs for each tier
const PRICE_IDS: Record<string, string> = {
  starter: 'price_1SxHgCBDGilw48s7lrc9Pjox',
  pro: 'price_1SxHgDBDGilw48s7vI6lQPE6',
  studio: 'price_1SxHgDBDGilw48s7hHTBfSGO',
  gym: 'price_1SxHgEBDGilw48s7ccmMHgzb',
};

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
      const customer = await stripe.customers.create({
        email,
        metadata: {
          organization_id: organizationId,
          organization_name: org?.name || '',
        },
      });
      customerId = customer.id;

      // Save customer ID to organization
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      metadata: {
        organization_id: organizationId,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
