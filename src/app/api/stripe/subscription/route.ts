import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch subscription details
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    // Get organization's Stripe IDs
    const { data: org, error } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, trial_ends_at')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    let subscription = null;
    let paymentMethod = null;
    let invoices: any[] = [];

    // Get subscription details if exists
    if (org.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
        expand: ['default_payment_method', 'latest_invoice'],
      });

      subscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        priceId: sub.items.data[0]?.price.id,
        amount: sub.items.data[0]?.price.unit_amount,
        interval: sub.items.data[0]?.price.recurring?.interval,
      };

      // Get payment method
      if (sub.default_payment_method && typeof sub.default_payment_method !== 'string') {
        const pm = sub.default_payment_method as Stripe.PaymentMethod;
        if (pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      }
    }

    // Get customer's default payment method if not on subscription
    if (!paymentMethod) {
      const customer = await stripe.customers.retrieve(org.stripe_customer_id) as Stripe.Customer;
      if (customer.invoice_settings?.default_payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
          customer.invoice_settings.default_payment_method as string
        );
        if (pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      }
    }

    // Get recent invoices
    const invoiceList = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 10,
    });

    invoices = invoiceList.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.amount_paid,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));

    return NextResponse.json({
      subscription,
      paymentMethod,
      invoices,
      tier: org.subscription_tier,
      status: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// POST - Update payment method
export async function POST(req: Request) {
  try {
    const { organizationId, action, paymentMethodId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    // Get organization's Stripe IDs
    const { data: org, error } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
    }

    if (action === 'update_payment_method' && paymentMethodId) {
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: org.stripe_customer_id,
      });

      // Set as default on customer
      await stripe.customers.update(org.stripe_customer_id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Set as default on subscription if exists
      if (org.stripe_subscription_id) {
        await stripe.subscriptions.update(org.stripe_subscription_id, {
          default_payment_method: paymentMethodId,
        });
      }

      return NextResponse.json({ success: true, message: 'Payment method updated' });
    }

    if (action === 'cancel') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
      }

      // Cancel at period end (don't cancel immediately)
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      return NextResponse.json({ success: true, message: 'Subscription will cancel at period end' });
    }

    if (action === 'reactivate') {
      if (!org.stripe_subscription_id) {
        return NextResponse.json({ error: 'No subscription to reactivate' }, { status: 400 });
      }

      // Remove cancellation
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      return NextResponse.json({ success: true, message: 'Subscription reactivated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Subscription action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}

// DELETE - Immediately cancel subscription
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .select('stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    if (error || !org?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    // Cancel immediately
    await stripe.subscriptions.cancel(org.stripe_subscription_id);

    // Update database
    await supabase
      .from('organizations')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId);

    return NextResponse.json({ success: true, message: 'Subscription canceled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
