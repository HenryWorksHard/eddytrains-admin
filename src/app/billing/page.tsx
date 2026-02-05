'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface Tier {
  id: string;
  name: string;
  price: number;
  clients: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    clients: 'Up to 10 clients',
    features: ['Client management', 'Program builder', 'Basic analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    clients: 'Up to 30 clients',
    features: ['Everything in Starter', 'Nutrition plans', 'Progress tracking', 'Priority support'],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 149,
    clients: 'Up to 75 clients',
    features: ['Everything in Pro', 'Team accounts', 'Custom branding', 'API access'],
  },
  {
    id: 'gym',
    name: 'Gym',
    price: 299,
    clients: 'Unlimited clients',
    features: ['Everything in Studio', 'White-label option', 'Dedicated support', 'Custom integrations'],
  },
];

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Check for success/cancel from Stripe redirect
    if (searchParams.get('success')) {
      setMessage({ type: 'success', text: 'Subscription activated successfully!' });
    } else if (searchParams.get('canceled')) {
      setMessage({ type: 'error', text: 'Checkout was canceled.' });
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      // Get organization details
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      setOrganization(org);

      // Get client count
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('role', 'client');

      setClientCount(count || 0);
      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const handleSubscribe = async (tier: string) => {
    if (!organization) return;
    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organization.id,
          tier,
          email: user?.email,
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start checkout' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    if (!organization) return;
    setActionLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: organization.id }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to open billing portal' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'trialing':
        return 'bg-blue-500/20 text-blue-400';
      case 'past_due':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'canceled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-2">Billing</h1>
      <p className="text-zinc-400 mb-8">Manage your subscription and billing details</p>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current Plan */}
      {organization && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Current Plan</h2>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-yellow-500 capitalize">
                  {organization.subscription_tier}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(organization.subscription_status)}`}>
                  {organization.subscription_status}
                </span>
              </div>
              <p className="text-zinc-400 mt-2">
                {clientCount} / {organization.client_limit === -1 ? '∞' : organization.client_limit} clients
              </p>
            </div>
            {organization.stripe_subscription_id && (
              <button
                onClick={handleManageBilling}
                disabled={actionLoading}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Manage Billing
              </button>
            )}
          </div>

          {/* Usage bar */}
          {organization.client_limit !== -1 && (
            <div className="mt-4">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    clientCount / organization.client_limit > 0.9
                      ? 'bg-red-500'
                      : clientCount / organization.client_limit > 0.7
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((clientCount / organization.client_limit) * 100, 100)}%` }}
                />
              </div>
              {clientCount >= organization.client_limit && (
                <p className="text-red-400 text-sm mt-2">
                  You&apos;ve reached your client limit. Upgrade to add more clients.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pricing Tiers */}
      <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const isCurrentTier = organization?.subscription_tier === tier.id;
          const hasSubscription = !!organization?.stripe_subscription_id;

          return (
            <div
              key={tier.id}
              className={`bg-zinc-900 rounded-xl border p-6 ${
                isCurrentTier ? 'border-yellow-500' : 'border-zinc-800'
              }`}
            >
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">${tier.price}</span>
                <span className="text-zinc-400">/mo</span>
              </div>
              <p className="text-zinc-400 text-sm mt-1">{tier.clients}</p>

              <ul className="mt-4 space-y-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.id)}
                disabled={isCurrentTier || actionLoading}
                className={`w-full mt-6 py-2 rounded-lg font-medium transition-colors ${
                  isCurrentTier
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900'
                }`}
              >
                {isCurrentTier
                  ? 'Current Plan'
                  : hasSubscription
                  ? 'Switch Plan'
                  : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ or additional info */}
      <div className="mt-12 bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Billing FAQ</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium text-white">When will I be charged?</h3>
            <p className="text-zinc-400">You&apos;ll be charged immediately upon subscribing, then monthly on the same date.</p>
          </div>
          <div>
            <h3 className="font-medium text-white">Can I cancel anytime?</h3>
            <p className="text-zinc-400">Yes, you can cancel your subscription at any time. You&apos;ll retain access until the end of your billing period.</p>
          </div>
          <div>
            <h3 className="font-medium text-white">What happens if I exceed my client limit?</h3>
            <p className="text-zinc-400">You won&apos;t be able to add new clients until you upgrade or remove existing clients.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <Suspense fallback={<div className="animate-pulse">Loading billing...</div>}>
          <BillingContent />
        </Suspense>
      </main>
    </div>
  );
}
