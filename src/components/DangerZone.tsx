'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Loader2, CheckCircle } from 'lucide-react';

interface Organization {
  id: string;
  stripe_subscription_id: string | null;
  subscription_status: string;
  subscription_tier: string;
}

interface SubscriptionDetails {
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

async function stripeAction(action: string, organizationId: string) {
  const response = await fetch('/api/stripe/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, organizationId }),
  });
  return response.json();
}

async function fetchSubscriptionDetails(organizationId: string): Promise<SubscriptionDetails | null> {
  try {
    const response = await fetch(`/api/stripe/subscription?organizationId=${organizationId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      cancel_at_period_end: data.subscription?.cancelAtPeriodEnd || false,
      current_period_end: data.subscription?.currentPeriodEnd || null,
    };
  } catch {
    return null;
  }
}

export default function DangerZone() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadOrg() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, stripe_subscription_id, subscription_status, subscription_tier')
          .eq('id', profile.organization_id)
          .single();
        
        if (org) {
          setOrganization(org);
          
          // Fetch Stripe subscription details
          if (org.stripe_subscription_id) {
            const details = await fetchSubscriptionDetails(org.id);
            setSubscriptionDetails(details);
          }
        }
      }
      setLoading(false);
    }
    loadOrg();
  }, [supabase]);

  const handleCancel = async () => {
    if (!organization) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const result = await stripeAction('cancel', organization.id);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: result.message || 'Subscription cancelled.' });
        setShowConfirm(false);
        
        // If subscription was cleared (trial cancel), hide immediately and redirect
        if (result.cleared) {
          setOrganization(null);
          setMessage({ type: 'success', text: result.message });
          setTimeout(() => {
            window.location.href = '/billing?cleared=' + Date.now();
          }, 1500);
          return;
        }
        
        // Refresh subscription details to show cancellation scheduled
        const details = await fetchSubscriptionDetails(organization.id);
        setSubscriptionDetails(details);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to cancel subscription' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!organization) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const result = await stripeAction('reactivate', organization.id);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Subscription reactivated!' });
        
        // Refresh subscription details
        const details = await fetchSubscriptionDetails(organization.id);
        setSubscriptionDetails(details);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to reactivate subscription' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-zinc-900 border border-red-900/30 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      </section>
    );
  }

  if (!organization?.stripe_subscription_id) {
    return null; // No subscription to cancel
  }

  const isTrialing = organization.subscription_status === 'trialing';
  const isCancelled = organization.subscription_status === 'canceled';
  const isPendingCancel = subscriptionDetails?.cancel_at_period_end === true;

  if (isCancelled) {
    return null; // Already cancelled
  }

  // Format the cancellation date
  const cancelDate = subscriptionDetails?.current_period_end 
    ? new Date(subscriptionDetails.current_period_end).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Show "Cancellation Scheduled" state
  if (isPendingCancel) {
    return (
      <section className="bg-zinc-900 border border-yellow-900/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Cancellation Scheduled</h2>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 font-medium mb-2">Your subscription will cancel on {cancelDate}</p>
          <p className="text-sm text-zinc-400 mb-4">
            You&apos;ll keep full access to all features until then. Changed your mind?
          </p>
          <button
            onClick={handleReactivate}
            disabled={actionLoading}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Keep My Subscription
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-zinc-900 border border-red-900/30 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {!showConfirm ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Cancel Subscription</p>
            <p className="text-sm text-zinc-500">
              {isTrialing 
                ? 'Cancel your plan selection. You won\'t be charged when trial ends.'
                : 'Your access will continue until the end of your current billing period.'
              }
            </p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors text-sm"
          >
            Cancel Plan
          </button>
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 font-medium mb-2">Are you sure?</p>
          <p className="text-sm text-zinc-400 mb-4">
            {isTrialing
              ? 'Your plan selection will be removed. You can select a new plan anytime before your trial ends.'
              : `Your ${organization.subscription_tier} subscription will be cancelled at the end of your billing period.`
            }
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, Cancel
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={actionLoading}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm"
            >
              Keep Subscription
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
