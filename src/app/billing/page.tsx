'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Crown, Sparkles, Clock, X, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
}

interface Tier {
  id: string;
  name: string;
  price: number;
  clients: string;
  clientLimit: number;
  features: string[];
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    clients: 'Up to 10 clients',
    clientLimit: 10,
    features: ['Client management', 'Program builder', 'Basic analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    clients: 'Up to 30 clients',
    clientLimit: 30,
    features: ['Everything in Starter', 'Nutrition plans', 'Progress tracking', 'Priority support'],
    popular: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 149,
    clients: 'Up to 75 clients',
    clientLimit: 75,
    features: ['Everything in Pro', 'Team accounts', 'Custom branding', 'API access'],
  },
  {
    id: 'gym',
    name: 'Gym',
    price: 299,
    clients: 'Unlimited clients',
    clientLimit: -1,
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
  
  // Embedded checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const isTrialing = organization?.subscription_status === 'trialing';
  const trialDaysLeft = organization?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(organization.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  useEffect(() => {
    // Check for successful checkout return
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      setMessage({ type: 'success', text: 'Subscription activated successfully!' });
      // Clean up URL
      router.replace('/billing');
    }
  }, [searchParams, router]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      setOrganization(org);

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
    setSelectedTier(tier);
    
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
      
      if (data.updated) {
        // Subscription was updated directly (trial case) - no checkout needed
        setMessage({ type: 'success', text: data.message || `Plan updated to ${tier}!` });
        setSelectedTier(null);
        // Refresh organization data
        const { data: updatedOrg } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', organization.id)
          .single();
        if (updatedOrg) setOrganization(updatedOrg);
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowCheckout(true);
        // Keep selectedTier for modal header
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start checkout' });
        setSelectedTier(null);
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
      setSelectedTier(null);
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleCloseCheckout = () => {
    setShowCheckout(false);
    setSelectedTier(null);
    setClientSecret(null);
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
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setActionLoading(false);
    }
  };

  // Recommend a tier based on client count
  const getRecommendedTier = () => {
    if (clientCount <= 10) return 'starter';
    if (clientCount <= 30) return 'pro';
    if (clientCount <= 75) return 'studio';
    return 'gym';
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
      <h1 className="text-2xl font-bold text-white mb-2">
        {isTrialing ? 'Choose Your Plan' : 'Billing'}
      </h1>
      <p className="text-zinc-400 mb-8">
        {isTrialing 
          ? 'You have full access to all features during your trial. Pick a plan to continue after your trial ends.'
          : 'Manage your subscription and billing details'}
      </p>

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

      {/* Trial Status Banner */}
      {isTrialing && organization && (
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white mb-1">
                Full Access Trial
              </h2>
              <p className="text-zinc-300 text-sm mb-3">
                You&apos;re experiencing all premium features. Explore everything, add clients, 
                build programs — when you&apos;re ready, pick the plan that fits your needs.
              </p>
              <div className="flex items-center gap-2 text-blue-400">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{trialDaysLeft} days remaining</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-zinc-400 text-sm">Current clients</p>
              <p className="text-2xl font-bold text-white">{clientCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Subscription Status */}
      {!isTrialing && organization && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Current Plan</h2>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-yellow-500 capitalize">
                  {organization.subscription_tier}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  organization.subscription_status === 'active' 
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
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
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && !selectedTier && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Manage Billing
              </button>
            )}
          </div>

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
      <h2 className="text-lg font-semibold text-white mb-4">
        {isTrialing ? 'Select a plan to continue after your trial' : 'Available Plans'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const isCurrentTier = !isTrialing && organization?.subscription_tier === tier.id;
          const hasSubscription = !!organization?.stripe_subscription_id;
          const isRecommended = isTrialing && tier.id === getRecommendedTier();

          return (
            <div
              key={tier.id}
              className={`bg-zinc-900 rounded-xl border p-6 relative ${
                isCurrentTier 
                  ? 'border-yellow-500' 
                  : isRecommended
                  ? 'border-green-500'
                  : tier.popular
                  ? 'border-blue-500'
                  : 'border-zinc-800'
              }`}
            >
              {/* Badges */}
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Recommended
                </div>
              )}
              {tier.popular && !isRecommended && !isCurrentTier && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                  Most Popular
                </div>
              )}

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
                className={`w-full mt-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isCurrentTier
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : isRecommended
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-zinc-900'
                }`}
              >
                {actionLoading && selectedTier === tier.id && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isCurrentTier
                  ? 'Current Plan'
                  : hasSubscription
                  ? 'Switch Plan'
                  : isTrialing
                  ? 'Choose Plan'
                  : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mt-12 bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Billing FAQ</h2>
        <div className="space-y-4 text-sm">
          {isTrialing && (
            <div>
              <h3 className="font-medium text-white">What happens when my trial ends?</h3>
              <p className="text-zinc-400">
                You&apos;ll need to select a plan to continue. If you don&apos;t, you&apos;ll lose access to premium features 
                but your data will be saved.
              </p>
            </div>
          )}
          <div>
            <h3 className="font-medium text-white">When will I be charged?</h3>
            <p className="text-zinc-400">
              {isTrialing 
                ? 'Pick your plan now and billing starts after your trial ends. Your trial is completely free.'
                : 'You\'ll be charged immediately upon subscribing, then monthly on the same date.'}
            </p>
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

      {/* Embedded Checkout Modal */}
      {showCheckout && selectedTier && clientSecret && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Subscribe to {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                </h3>
                <p className="text-sm text-gray-500">
                  ${TIERS.find(t => t.id === selectedTier)?.price}/month
                </p>
              </div>
              <button 
                onClick={handleCloseCheckout}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Stripe Embedded Checkout */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}
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
