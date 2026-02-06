'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Users, Building2, DollarSign, TrendingUp, Eye, Search, Plus, X, Trash2, Activity, UserPlus, CreditCard, UserMinus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  created_at: string;
  custom_monthly_price?: number | null;
  profiles?: { email: string; full_name: string }[];
  client_count?: number;
}

interface Stats {
  totalTrainers: number;
  totalClients: number;
  activeSubscriptions: number;
  trialingOrgs: number;
  mrr: number;
}

interface PlatformActivity {
  id: string;
  type: 'trainer_signup' | 'subscription_change' | 'subscription_started' | 'subscription_cancelled' | 'client_added';
  title: string;
  description: string;
  organization_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TIER_PRICES: Record<string, number> = {
  starter: 39,
  pro: 79,
  studio: 149,
  gym: 299,
};

export default function PlatformPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [newTrainer, setNewTrainer] = useState({
    email: '',
    password: '',
    fullName: '',
    orgName: '',
    orgSlug: '',
    accessType: 'trial' as 'trial' | 'lifetime' | 'custom',
    expiryDate: '',
    tier: 'starter' as 'starter' | 'pro' | 'studio' | 'gym',
    customMonthlyPrice: '',
  });
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [activities, setActivities] = useState<PlatformActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if super_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      setIsSuperAdmin(true);

      // Fetch organizations
      const response = await fetch('/api/organizations');
      const data = await response.json();

      if (data.organizations) {
        // Get client counts for each org
        const orgsWithCounts = await Promise.all(
          data.organizations.map(async (org: Organization) => {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id)
              .eq('role', 'client');
            return { ...org, client_count: count || 0 };
          })
        );

        setOrganizations(orgsWithCounts);

        // Calculate stats
        const activeOrgs = orgsWithCounts.filter((o: Organization) => o.subscription_status === 'active');
        const trialingOrgs = orgsWithCounts.filter((o: Organization) => o.subscription_status === 'trialing');
        const totalClients = orgsWithCounts.reduce((sum: number, o: Organization) => sum + (o.client_count || 0), 0);
        // Use custom_monthly_price if set, otherwise use tier price
        const mrr = activeOrgs.reduce((sum: number, o: Organization) => {
          const price = o.custom_monthly_price ?? TIER_PRICES[o.subscription_tier] ?? 0;
          return sum + price;
        }, 0);

        setStats({
          totalTrainers: orgsWithCounts.length,
          totalClients,
          activeSubscriptions: activeOrgs.length,
          trialingOrgs: trialingOrgs.length,
          mrr,
        });
      }

      // Fetch recent activity
      try {
        const activityRes = await fetch('/api/platform-activity?limit=10');
        const activityData = await activityRes.json();
        if (activityData.activities) {
          setActivities(activityData.activities);
        }
      } catch (err) {
        console.error('Error fetching activity:', err);
      }
      setActivitiesLoading(false);

      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'trainer_signup':
        return <UserPlus className="w-4 h-4 text-green-400" />;
      case 'subscription_started':
        return <CreditCard className="w-4 h-4 text-yellow-400" />;
      case 'subscription_change':
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case 'subscription_cancelled':
        return <UserMinus className="w-4 h-4 text-red-400" />;
      case 'client_added':
        return <Users className="w-4 h-4 text-blue-400" />;
      default:
        return <Activity className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getActivityBg = (type: string) => {
    switch (type) {
      case 'trainer_signup':
        return 'bg-green-500/10';
      case 'subscription_started':
        return 'bg-yellow-500/10';
      case 'subscription_change':
        return 'bg-blue-500/10';
      case 'subscription_cancelled':
        return 'bg-red-500/10';
      case 'client_added':
        return 'bg-blue-500/10';
      default:
        return 'bg-zinc-500/10';
    }
  };

  const handleImpersonate = async (orgId: string) => {
    // Store the impersonation in session storage
    sessionStorage.setItem('impersonating_org', orgId);
    router.push('/dashboard');
    router.refresh();
  };

  const handleDeleteTrainer = async (org: Organization) => {
    const confirmText = `Are you sure you want to delete "${org.name}"?\n\nThis will permanently remove:\n- The trainer account\n- All ${org.client_count || 0} clients\n- All programs and workouts\n- All nutrition plans\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmText)) {
      return;
    }

    // Double-check with org name
    const typedName = prompt(`Type "${org.name}" to confirm deletion:`);
    if (typedName !== org.name) {
      alert('Organization name did not match. Deletion cancelled.');
      return;
    }

    setDeletingOrgId(org.id);

    try {
      const response = await fetch(`/api/trainers/${org.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to delete trainer');
        return;
      }

      // Remove from local state
      setOrganizations(orgs => orgs.filter(o => o.id !== org.id));
      
      // Update stats
      if (stats) {
        const orgPrice = org.custom_monthly_price ?? TIER_PRICES[org.subscription_tier] ?? 0;
        setStats({
          ...stats,
          totalTrainers: stats.totalTrainers - 1,
          totalClients: stats.totalClients - (org.client_count || 0),
          activeSubscriptions: org.subscription_status === 'active' ? stats.activeSubscriptions - 1 : stats.activeSubscriptions,
          trialingOrgs: org.subscription_status === 'trialing' ? stats.trialingOrgs - 1 : stats.trialingOrgs,
          mrr: org.subscription_status === 'active' ? stats.mrr - orgPrice : stats.mrr,
        });
      }

      alert(data.message || 'Trainer deleted successfully');
    } catch (error) {
      console.error('Error deleting trainer:', error);
      alert('Failed to delete trainer');
    } finally {
      setDeletingOrgId(null);
    }
  };

  const handleEditPrice = (org: Organization) => {
    setEditingOrg(org);
    setEditPrice(org.custom_monthly_price?.toString() || '');
    setEditTier(org.subscription_tier);
    setEditStatus(org.subscription_status);
  };

  const handleSavePrice = async () => {
    if (!editingOrg) return;

    const newPrice = editPrice === '' ? null : parseInt(editPrice);
    const tierClientLimits: Record<string, number> = {
      starter: 10,
      pro: 30,
      studio: 75,
      gym: -1,
    };

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ 
          custom_monthly_price: newPrice,
          subscription_tier: editTier,
          subscription_status: editStatus,
          client_limit: tierClientLimits[editTier] || 10,
        })
        .eq('id', editingOrg.id);

      if (error) throw error;

      // Update local state
      setOrganizations(orgs =>
        orgs.map(o =>
          o.id === editingOrg.id ? { 
            ...o, 
            custom_monthly_price: newPrice,
            subscription_tier: editTier,
            subscription_status: editStatus,
            client_limit: tierClientLimits[editTier] || 10,
          } : o
        )
      );

      // Recalculate stats
      const updatedOrgs = organizations.map(o =>
        o.id === editingOrg.id ? { 
          ...o, 
          custom_monthly_price: newPrice,
          subscription_tier: editTier,
          subscription_status: editStatus,
        } : o
      );
      const activeOrgs = updatedOrgs.filter(o => o.subscription_status === 'active');
      const trialingOrgs = updatedOrgs.filter(o => o.subscription_status === 'trialing');
      const mrr = activeOrgs.reduce((sum, o) => {
        const price = o.custom_monthly_price ?? TIER_PRICES[o.subscription_tier] ?? 0;
        return sum + price;
      }, 0);

      if (stats) {
        setStats({
          ...stats,
          activeSubscriptions: activeOrgs.length,
          trialingOrgs: trialingOrgs.length,
          mrr,
        });
      }

      setEditingOrg(null);
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    }
  };

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTrainer(true);

    try {
      // Call API to create trainer
      const response = await fetch('/api/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrainer),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create trainer');
        return;
      }

      // Refresh the page to show new trainer
      window.location.reload();
    } catch (error) {
      console.error('Error creating trainer:', error);
      alert('Failed to create trainer');
    } finally {
      setAddingTrainer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
          <div className="animate-pulse">Loading...</div>
        </main>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-8 ml-64">
        <div className="max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Platform Management</h1>
              <p className="text-zinc-400">Overview of all trainers and organizations</p>
            </div>
            <button
              onClick={() => setShowAddTrainer(true)}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Trainer
            </button>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-yellow-400" />
                  <span className="text-zinc-400 text-sm">Total Trainers</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalTrainers}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-zinc-400 text-sm">Total Clients</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">Paying Trainers</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.activeSubscriptions}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">Monthly Revenue</span>
                </div>
                <p className="text-2xl font-bold text-white">${stats.mrr}</p>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
            </div>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              {activitiesLoading ? (
                <p className="text-zinc-500 text-sm">Loading activity...</p>
              ) : activities.length === 0 ? (
                <p className="text-zinc-500 text-sm">No recent activity yet. Events will appear here as trainers sign up, subscribe, and add clients.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getActivityBg(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{activity.title}</p>
                        <p className="text-zinc-400 text-xs truncate">{activity.description}</p>
                      </div>
                      <span className="text-zinc-500 text-xs whitespace-nowrap">
                        {getTimeAgo(activity.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trainers..."
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          {/* Organizations Table */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-400 font-medium">Organization</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Owner</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Plan</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Price</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Clients</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{org.name}</p>
                        <p className="text-zinc-500 text-sm">/{org.slug}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-zinc-300">{org.profiles?.[0]?.full_name || 'Unknown'}</p>
                      <p className="text-zinc-500 text-sm">{org.profiles?.[0]?.email || ''}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-yellow-400/10 text-yellow-400 rounded text-sm capitalize">
                        {org.subscription_tier}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleEditPrice(org)}
                        className="group flex items-center gap-1 hover:text-yellow-400 transition-colors"
                        title="Click to edit price"
                      >
                        <span className="text-white font-medium group-hover:text-yellow-400">
                          ${org.custom_monthly_price ?? TIER_PRICES[org.subscription_tier] ?? 0}
                        </span>
                        {org.custom_monthly_price !== null && org.custom_monthly_price !== undefined && (
                          <span className="text-xs text-zinc-500 ml-1">(custom)</span>
                        )}
                        <svg className="w-3 h-3 text-zinc-600 group-hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          org.subscription_status === 'active'
                            ? 'bg-green-500/10 text-green-400'
                            : org.subscription_status === 'trialing'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {org.subscription_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-white">
                        {org.client_count} / {org.client_limit === -1 ? '∞' : org.client_limit}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPrice(org)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 rounded-lg text-sm transition-colors"
                          title="Edit subscription tier and status"
                        >
                          <CreditCard className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleImpersonate(org.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteTrainer(org)}
                          disabled={deletingOrgId === org.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                          title="Delete trainer and all data"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingOrgId === org.id ? 'Deleting...' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredOrgs.length === 0 && (
              <div className="p-8 text-center text-zinc-500">
                No organizations found
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Trainer Modal */}
      {showAddTrainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <h2 className="text-xl font-semibold text-white">Add New Trainer</h2>
              <button
                onClick={() => setShowAddTrainer(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrainer} className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newTrainer.fullName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="trainer@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newTrainer.password}
                  onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newTrainer.orgName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, orgName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Smith Fitness"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">app.cmpdcollective.com/</span>
                  <input
                    type="text"
                    value={newTrainer.orgSlug}
                    onChange={(e) => setNewTrainer({ ...newTrainer, orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="smith-fitness"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Plan Tier
                </label>
                <select
                  value={newTrainer.tier}
                  onChange={(e) => setNewTrainer({ ...newTrainer, tier: e.target.value as 'starter' | 'pro' | 'studio' | 'gym' })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="starter">Starter (10 clients)</option>
                  <option value="pro">Pro (30 clients)</option>
                  <option value="studio">Studio (75 clients)</option>
                  <option value="gym">Gym (Unlimited)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Monthly Price (Custom)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={newTrainer.customMonthlyPrice}
                    onChange={(e) => setNewTrainer({ ...newTrainer, customMonthlyPrice: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder={`${TIER_PRICES[newTrainer.tier] || 0} (default)`}
                    min="0"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Leave empty to use standard tier price (${TIER_PRICES[newTrainer.tier] || 0}/mo)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Access Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-600">
                    <input
                      type="radio"
                      name="accessType"
                      value="trial"
                      checked={newTrainer.accessType === 'trial'}
                      onChange={() => setNewTrainer({ ...newTrainer, accessType: 'trial' })}
                      className="text-yellow-400"
                    />
                    <div>
                      <p className="text-white font-medium">Free Trial</p>
                      <p className="text-zinc-500 text-sm">14 days, then requires payment</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-600">
                    <input
                      type="radio"
                      name="accessType"
                      value="lifetime"
                      checked={newTrainer.accessType === 'lifetime'}
                      onChange={() => setNewTrainer({ ...newTrainer, accessType: 'lifetime' })}
                      className="text-yellow-400"
                    />
                    <div>
                      <p className="text-white font-medium">Lifetime Access</p>
                      <p className="text-zinc-500 text-sm">Never expires, no payment required</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-600">
                    <input
                      type="radio"
                      name="accessType"
                      value="custom"
                      checked={newTrainer.accessType === 'custom'}
                      onChange={() => setNewTrainer({ ...newTrainer, accessType: 'custom' })}
                      className="text-yellow-400"
                    />
                    <div>
                      <p className="text-white font-medium">Custom Expiry</p>
                      <p className="text-zinc-500 text-sm">Set a specific end date</p>
                    </div>
                  </label>
                </div>
              </div>

              {newTrainer.accessType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newTrainer.expiryDate}
                    onChange={(e) => setNewTrainer({ ...newTrainer, expiryDate: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required={newTrainer.accessType === 'custom'}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTrainer(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTrainer}
                  className="flex-1 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black rounded-xl font-medium transition-colors"
                >
                  {addingTrainer ? 'Creating...' : 'Create Trainer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Edit Subscription</h2>
              <button
                onClick={() => setEditingOrg(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">
                {editingOrg.name}
              </p>

              {/* Tier Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Plan Tier
                </label>
                <select
                  value={editTier}
                  onChange={(e) => setEditTier(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="starter">Starter (10 clients) - $39/mo</option>
                  <option value="pro">Pro (30 clients) - $79/mo</option>
                  <option value="studio">Studio (75 clients) - $149/mo</option>
                  <option value="gym">Gym (Unlimited) - $299/mo</option>
                </select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="trialing">Trialing (Free Trial)</option>
                  <option value="active">Active (Paid)</option>
                  <option value="canceled">Canceled</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>

              {/* Custom Price */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Custom Monthly Price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder={`${TIER_PRICES[editTier] || 0} (tier default)`}
                    min="0"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Leave empty to use tier price (${TIER_PRICES[editTier] || 0}/mo)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingOrg(null)}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrice}
                className="flex-1 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black rounded-xl font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
